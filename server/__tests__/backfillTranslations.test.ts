import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { Database } from 'src/dbconfig';
import { MediaItemBase } from 'src/entity/mediaItem';

// Mock metadataLanguages — jest.fn() inline per codebase pattern
jest.mock('src/metadataLanguages', () => ({
  getMetadataLanguages: jest.fn(() => ['en', 'es-419']),
  toTmdbLang: jest.fn((tag: string) => tag.split('-')[0]),
  IGDB_REGION_MAP: {
    1: ['de', 'fr', 'es', 'it', 'nl', 'pl', 'pt'],
    2: ['en'],
    3: ['en'],
    4: ['en'],
    5: ['ja'],
    6: ['zh'],
    7: ['ko', 'zh'],
    8: 'all',
    9: ['ko'],
  },
}));

// Mock metadataProviders
jest.mock('src/metadata/metadataProviders');

// Mock mediaItemRepository for seasonsWithEpisodes
jest.mock('src/repository/mediaItem');

import {
  detectBackfillNeeded,
  backfillItemTranslations,
  runBackfill,
  startBackfillIfNeeded,
  BACKFILL_BATCH_SIZE,
  INTER_BATCH_DELAY_MS,
} from 'src/backfillTranslations';
import { getMetadataLanguages } from 'src/metadataLanguages';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';

const mockGetMetadataLanguages = getMetadataLanguages as jest.MockedFunction<typeof getMetadataLanguages>;
const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
>;
const mockedMediaItemRepository = mediaItemRepository as jest.Mocked<
  typeof mediaItemRepository
>;

// Helper to insert a media item directly into the database
async function insertMediaItem(item: { id: number; title: string; mediaType: string; source: string; tmdbId?: number; igdbId?: number; audibleId?: string; openlibraryId?: string }): Promise<void> {
  await Database.knex('mediaItem').insert({
    id: item.id,
    title: item.title,
    mediaType: item.mediaType,
    source: item.source,
    tmdbId: item.tmdbId ?? null,
    igdbId: item.igdbId ?? null,
    audibleId: item.audibleId ?? null,
    openlibraryId: item.openlibraryId ?? null,
  });
}

// Helper to insert a season
async function insertSeason(season: { id: number; seasonNumber: number; title: string; isSpecialSeason: boolean; tvShowId: number; numberOfEpisodes?: number }): Promise<void> {
  await Database.knex('season').insert({
    ...season,
    numberOfEpisodes: season.numberOfEpisodes ?? 0,
  });
}

// Helper to insert an episode
async function insertEpisode(episode: { id: number; episodeNumber: number; seasonNumber: number; seasonAndEpisodeNumber: number; title: string; isSpecialEpisode: boolean; seasonId: number; tvShowId: number }): Promise<void> {
  await Database.knex('episode').insert(episode);
}

// Helper to insert a translation row directly
async function insertTranslation(mediaItemId: number, language: string, title: string): Promise<void> {
  await Database.knex('mediaItemTranslation').insert({
    mediaItemId,
    language,
    title,
    overview: null,
    genres: null,
  });
}

describe('backfillTranslations', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  beforeEach(async () => {
    // Clear translation tables and media items for isolation
    await Database.knex('episodeTranslation').del();
    await Database.knex('seasonTranslation').del();
    await Database.knex('mediaItemTranslation').del();
    await Database.knex('episode').del();
    await Database.knex('season').del();
    await Database.knex('mediaItem').del();

    jest.clearAllMocks();
    mockGetMetadataLanguages.mockReturnValue(['en', 'es-419']);
  });

  describe('constants', () => {
    it('should have BACKFILL_BATCH_SIZE of 50', () => {
      expect(BACKFILL_BATCH_SIZE).toBe(50);
    });

    it('should have INTER_BATCH_DELAY_MS of 35000', () => {
      expect(INTER_BATCH_DELAY_MS).toBe(35_000);
    });
  });

  describe('detectBackfillNeeded', () => {
    it('should return empty array when no media items exist', async () => {
      const result = await detectBackfillNeeded();
      expect(result).toEqual([]);
    });

    it('should detect initial deployment: empty translation table with existing media items', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });
      await insertMediaItem({
        id: 2,
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 101,
      });

      const result = await detectBackfillNeeded();

      // Should return ALL configured languages since translation table is empty
      expect(result).toEqual(['en', 'es-419']);
    });

    it('should detect missing languages when translations exist for some languages', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      // Only 'en' translations exist
      await insertTranslation(1, 'en', 'Movie 1 EN');

      const result = await detectBackfillNeeded();

      // Should return only 'es-419' since 'en' already exists
      expect(result).toEqual(['es-419']);
    });

    it('should return empty array when all configured languages have translations', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      await insertTranslation(1, 'en', 'Movie 1 EN');
      await insertTranslation(1, 'es-419', 'Movie 1 ES');

      const result = await detectBackfillNeeded();

      expect(result).toEqual([]);
    });

    it('should handle three configured languages with one missing', async () => {
      mockGetMetadataLanguages.mockReturnValue(['en', 'es-419', 'fr']);

      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      await insertTranslation(1, 'en', 'Movie 1 EN');
      await insertTranslation(1, 'es-419', 'Movie 1 ES');

      const result = await detectBackfillNeeded();

      expect(result).toEqual(['fr']);
    });
  });

  describe('backfillItemTranslations', () => {
    const movieItem = {
      id: 1,
      title: 'Test Movie',
      mediaType: 'movie' as const,
      source: 'tmdb',
      tmdbId: 12345,
    };

    it('should call localizedDetails for each missing language and upsert translations', async () => {
      await insertMediaItem(movieItem);

      const mockProvider = {
        localizedDetails: jest.fn()
          .mockResolvedValueOnce({
            title: 'Test Movie EN',
            overview: 'English overview',
            genres: ['Action'],
          })
          .mockResolvedValueOnce({
            title: 'Pelicula de Prueba',
            overview: 'Resumen en espanol',
            genres: ['Accion'],
          }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(movieItem, ['en', 'es-419']);

      expect(mockProvider.localizedDetails).toHaveBeenCalledTimes(2);
      expect(mockProvider.localizedDetails).toHaveBeenCalledWith(movieItem, 'en');
      expect(mockProvider.localizedDetails).toHaveBeenCalledWith(movieItem, 'es-419');

      // Verify translations were upserted
      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');

      expect(translations).toHaveLength(2);

      const enTranslation = translations.find((t: any) => t.language === 'en');
      expect(enTranslation.title).toBe('Test Movie EN');
      expect(enTranslation.overview).toBe('English overview');

      const esTranslation = translations.find((t: any) => t.language === 'es-419');
      expect(esTranslation.title).toBe('Pelicula de Prueba');
      expect(esTranslation.overview).toBe('Resumen en espanol');
    });

    it('should skip item when no metadata provider found', async () => {
      mockedMetadataProviders.get.mockReturnValue(undefined as any);

      // Should not throw
      await backfillItemTranslations(movieItem, ['en']);

      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');

      expect(translations).toHaveLength(0);
    });

    it('should continue with other languages when one language fails', async () => {
      await insertMediaItem(movieItem);

      const mockProvider = {
        localizedDetails: jest.fn()
          .mockRejectedValueOnce(new Error('API timeout'))
          .mockResolvedValueOnce({
            title: 'Pelicula de Prueba',
            overview: 'Resumen',
            genres: null,
          }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(movieItem, ['en', 'es-419']);

      // First language failed but second should succeed
      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');

      expect(translations).toHaveLength(1);
      expect(translations[0].language).toBe('es-419');
      expect(translations[0].title).toBe('Pelicula de Prueba');
    });

    it('should handle localizedDetails returning null', async () => {
      await insertMediaItem(movieItem);

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue(null),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(movieItem, ['en']);

      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');

      expect(translations).toHaveLength(0);
    });

    it('should handle provider without localizedDetails method', async () => {
      await insertMediaItem(movieItem);

      const mockProvider = {
        localizedDetails: null as any,
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(movieItem, ['en']);

      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');

      expect(translations).toHaveLength(0);
    });

    it('should backfill TV show with season and episode translations', async () => {
      const tvItem = {
        id: 10,
        title: 'Test TV Show',
        mediaType: 'tv' as const,
        source: 'tmdb',
        tmdbId: 99999,
      };

      await insertMediaItem(tvItem);
      await insertSeason({
        id: 100,
        seasonNumber: 1,
        title: 'Season 1',
        isSpecialSeason: false,
        tvShowId: 10,
      });
      await insertEpisode({
        id: 200,
        episodeNumber: 1,
        seasonNumber: 1,
        seasonAndEpisodeNumber: 1001,
        title: 'Ep 1',
        isSpecialEpisode: false,
        seasonId: 100,
        tvShowId: 10,
      });

      // Mock seasonsWithEpisodes to return seasons with episodes for the ID lookup maps
      mockedMediaItemRepository.seasonsWithEpisodes.mockResolvedValue([
        {
          id: 100,
          seasonNumber: 1,
          title: 'Season 1',
          isSpecialSeason: false,
          episodes: [
            {
              id: 200,
              episodeNumber: 1,
              seasonNumber: 1,
              seasonAndEpisodeNumber: 1001,
              title: 'Ep 1',
              isSpecialEpisode: false,
              seasonId: 100,
            },
          ],
        },
      ] as any);

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue({
          title: 'Serie de Prueba',
          overview: 'Resumen serie',
          genres: ['Drama'],
          seasons: [
            {
              seasonNumber: 1,
              title: 'Temporada 1',
              description: 'Desc temporada 1',
              episodes: [
                {
                  episodeNumber: 1,
                  seasonNumber: 1,
                  title: 'Episodio 1',
                  description: 'Desc episodio 1',
                },
              ],
            },
          ],
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(tvItem, ['es-419']);

      // Verify media item translation
      const mediaTranslations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 10)
        .select('*');
      expect(mediaTranslations).toHaveLength(1);
      expect(mediaTranslations[0].title).toBe('Serie de Prueba');
      expect(mediaTranslations[0].language).toBe('es-419');

      // Verify season translation
      const seasonTranslations = await Database.knex('seasonTranslation')
        .where('seasonId', 100)
        .select('*');
      expect(seasonTranslations).toHaveLength(1);
      expect(seasonTranslations[0].title).toBe('Temporada 1');
      expect(seasonTranslations[0].language).toBe('es-419');

      // Verify episode translation
      const episodeTranslations = await Database.knex('episodeTranslation')
        .where('episodeId', 200)
        .select('*');
      expect(episodeTranslations).toHaveLength(1);
      expect(episodeTranslations[0].title).toBe('Episodio 1');
      expect(episodeTranslations[0].language).toBe('es-419');
    });

    it('should handle IGDB game localizations during backfill', async () => {
      const gameItem = {
        id: 20,
        title: 'Test Game',
        mediaType: 'video_game' as const,
        source: 'igdb',
        igdbId: 55555,
      };

      await insertMediaItem(gameItem);

      const mockProvider = {
        localizedDetails: null as any,
        fetchGameLocalizations: jest.fn().mockResolvedValue([
          { regionId: 2, name: 'Test Game US' },  // region 2 = north_america = ['en']
        ]),
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(gameItem, ['en', 'es-419']);

      expect(mockProvider.fetchGameLocalizations).toHaveBeenCalledWith(gameItem);

      // Only 'en' should be upserted since region 2 maps to ['en'] and 'en' is in missingLanguages
      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 20)
        .select('*');
      expect(translations).toHaveLength(1);
      expect(translations[0].language).toBe('en');
      expect(translations[0].title).toBe('Test Game US');
    });

    it('should handle IGDB worldwide region (region 8) — maps to all missing languages', async () => {
      const gameItem = {
        id: 21,
        title: 'Worldwide Game',
        mediaType: 'video_game' as const,
        source: 'igdb',
        igdbId: 55556,
      };

      await insertMediaItem(gameItem);

      const mockProvider = {
        localizedDetails: null as any,
        fetchGameLocalizations: jest.fn().mockResolvedValue([
          { regionId: 8, name: 'Worldwide Game Title' },  // region 8 = worldwide = 'all'
        ]),
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(gameItem, ['en', 'es-419']);

      // Both missing languages should get the translation
      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 21)
        .orderBy('language')
        .select('*');
      expect(translations).toHaveLength(2);
      expect(translations.map((t: any) => t.language).sort()).toEqual(['en', 'es-419']);
      expect(translations[0].title).toBe('Worldwide Game Title');
      expect(translations[1].title).toBe('Worldwide Game Title');
    });

    it('should continue when IGDB fetchGameLocalizations fails', async () => {
      const gameItem = {
        id: 22,
        title: 'Failed Game',
        mediaType: 'video_game' as const,
        source: 'igdb',
        igdbId: 55557,
      };

      await insertMediaItem(gameItem);

      const mockProvider = {
        localizedDetails: null as any,
        fetchGameLocalizations: jest.fn().mockRejectedValue(new Error('IGDB API down')),
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      // Should not throw
      await backfillItemTranslations(gameItem, ['en']);

      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 22)
        .select('*');
      expect(translations).toHaveLength(0);
    });

    it('should correctly use toTmdbLang for BCP 47 tags like es-419', async () => {
      await insertMediaItem(movieItem);

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue({
          title: 'Titulo',
          overview: 'Resumen',
          genres: null,
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await backfillItemTranslations(movieItem, ['es-419']);

      // localizedDetails should be called with the full BCP 47 tag 'es-419'
      // (the provider itself decides how to use it — e.g., TMDB provider calls toTmdbLang internally)
      expect(mockProvider.localizedDetails).toHaveBeenCalledWith(movieItem, 'es-419');
    });
  });

  describe('runBackfill', () => {
    it('should process items in batches', async () => {
      // Insert 3 items (with BACKFILL_BATCH_SIZE=50, all should be in one batch)
      for (let i = 1; i <= 3; i++) {
        await insertMediaItem({
          id: i,
          title: `Movie ${i}`,
          mediaType: 'movie',
          source: 'tmdb',
          tmdbId: 100 + i,
        });
      }

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue({
          title: 'Localized Title',
          overview: 'Localized Overview',
          genres: null,
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['es-419']);

      // Should have called localizedDetails 3 times (one per item, one language)
      expect(mockProvider.localizedDetails).toHaveBeenCalledTimes(3);

      // Verify translations exist for all items
      const translations = await Database.knex('mediaItemTranslation')
        .where('language', 'es-419')
        .select('*');
      expect(translations).toHaveLength(3);
    });

    it('should do nothing when missingLanguages is empty', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      await runBackfill([]);

      const translations = await Database.knex('mediaItemTranslation').select('*');
      expect(translations).toHaveLength(0);
    });

    it('should continue with remaining items when one item fails', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });
      await insertMediaItem({
        id: 2,
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 101,
      });

      const mockProvider = {
        localizedDetails: jest.fn()
          .mockRejectedValueOnce(new Error('API Error'))
          .mockResolvedValueOnce({
            title: 'Movie 2 ES',
            overview: null,
            genres: null,
          }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['es-419']);

      // Second item should still have translation despite first item failing
      const translations = await Database.knex('mediaItemTranslation')
        .where('language', 'es-419')
        .select('*');
      expect(translations).toHaveLength(1);
      expect(translations[0].mediaItemId).toBe(2);
    });

    it('should respect batch ordering by ID ascending', async () => {
      // Insert items in non-sequential order
      await insertMediaItem({
        id: 5,
        title: 'Movie 5',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 105,
      });
      await insertMediaItem({
        id: 2,
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 102,
      });
      await insertMediaItem({
        id: 8,
        title: 'Movie 8',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 108,
      });

      const callOrder: number[] = [];
      const mockProvider = {
        localizedDetails: jest.fn().mockImplementation((item: MediaItemBase) => {
          callOrder.push(item.id!);
          return Promise.resolve({
            title: `${item.title} ES`,
            overview: null,
            genres: null,
          });
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['es-419']);

      // Items should be processed in ascending ID order
      expect(callOrder).toEqual([2, 5, 8]);
    });
  });

  describe('startBackfillIfNeeded', () => {
    it('should not block — returns immediately before backfill completes', () => {
      // startBackfillIfNeeded uses setImmediate, so it should not block
      // We just verify it does not throw synchronously
      mockedMetadataProviders.get.mockReturnValue(undefined as any);

      expect(() => startBackfillIfNeeded()).not.toThrow();
    });
  });

  describe('removal of languages does not delete translations', () => {
    it('should not delete existing translations when a language is removed from config', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      // Simulate existing translations for 3 languages
      await insertTranslation(1, 'en', 'Movie 1 EN');
      await insertTranslation(1, 'es-419', 'Pelicula 1 ES');
      await insertTranslation(1, 'fr', 'Film 1 FR');

      // Now config only has 2 languages — 'fr' was removed
      mockGetMetadataLanguages.mockReturnValue(['en', 'es-419']);

      const missingLanguages = await detectBackfillNeeded();

      // No missing languages, so backfill should not be triggered
      expect(missingLanguages).toEqual([]);

      // Verify 'fr' translation still exists (not deleted)
      const frTranslation = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 1, language: 'fr' })
        .first();
      expect(frTranslation).toBeTruthy();
      expect(frTranslation.title).toBe('Film 1 FR');
    });
  });

  describe('initial deployment scenario with METADATA_LANGUAGES=en,es-419', () => {
    it('should detect need for backfill for ALL configured languages on initial deploy', async () => {
      // Simulate initial deployment: items exist, but no translations at all
      for (let i = 1; i <= 5; i++) {
        await insertMediaItem({
          id: i,
          title: `Movie ${i}`,
          mediaType: 'movie',
          source: 'tmdb',
          tmdbId: 100 + i,
        });
      }

      mockGetMetadataLanguages.mockReturnValue(['en', 'es-419']);

      const result = await detectBackfillNeeded();

      // ALL configured languages should be returned
      expect(result).toEqual(['en', 'es-419']);
    });

    it('should populate translations for ALL configured languages on initial backfill', async () => {
      for (let i = 1; i <= 2; i++) {
        await insertMediaItem({
          id: i,
          title: `Movie ${i}`,
          mediaType: 'movie',
          source: 'tmdb',
          tmdbId: 100 + i,
        });
      }

      const mockProvider = {
        localizedDetails: jest.fn().mockImplementation(
          (_item: MediaItemBase, language: string) => {
            return Promise.resolve({
              title: `Title in ${language}`,
              overview: `Overview in ${language}`,
              genres: null,
            });
          }
        ),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['en', 'es-419']);

      // 2 items × 2 languages = 4 calls
      expect(mockProvider.localizedDetails).toHaveBeenCalledTimes(4);

      // 4 translation rows total
      const translations = await Database.knex('mediaItemTranslation').select('*');
      expect(translations).toHaveLength(4);

      // Verify each item has both languages
      for (const itemId of [1, 2]) {
        const itemTranslations = translations.filter((t: any) => t.mediaItemId === itemId);
        expect(itemTranslations).toHaveLength(2);
        expect(itemTranslations.map((t: any) => t.language).sort()).toEqual(['en', 'es-419']);
      }
    });
  });

  describe('BCP 47 tag handling', () => {
    it('should pass full BCP 47 tag to localizedDetails (provider handles toTmdbLang internally)', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue({
          title: 'Titulo ES-419',
          overview: 'Resumen',
          genres: null,
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['es-419', 'pt-BR']);

      // Should be called with full BCP 47 tags
      expect(mockProvider.localizedDetails).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        'es-419'
      );
      expect(mockProvider.localizedDetails).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        'pt-BR'
      );
    });

    it('should store translations with full BCP 47 tag as language key', async () => {
      await insertMediaItem({
        id: 1,
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 100,
      });

      const mockProvider = {
        localizedDetails: jest.fn().mockResolvedValue({
          title: 'Titulo',
          overview: null,
          genres: null,
        }),
        fetchGameLocalizations: null as any,
      };

      mockedMetadataProviders.get.mockReturnValue(mockProvider as any);

      await runBackfill(['es-419']);

      const translations = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 1)
        .select('*');
      expect(translations).toHaveLength(1);
      expect(translations[0].language).toBe('es-419');
    });
  });
});
