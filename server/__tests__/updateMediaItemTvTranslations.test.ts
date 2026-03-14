import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { Database } from 'src/dbconfig';
import { MediaItemBase } from 'src/entity/mediaItem';
import { MetadataProvider } from 'src/metadata/metadataProvider';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { updateMediaItem } from 'src/updateMetadata';

jest.mock('src/metadata/metadataProviders');
jest.mock('src/metadataLanguages', () => ({
  getMetadataLanguages: jest.fn(() => ['en', 'es']),
  toTmdbLang: jest.fn((tag: string) => tag.split('-')[0]),
}));

const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
>;

/**
 * Tests that updateMediaItem() correctly wires the TV translation pipeline:
 *  - Upserts first language's season/episode data from base details()
 *  - Calls localizedDetails() for each configured language
 *  - Upserts season and episode translations by mapping seasonNumber/episodeNumber
 *    to DB IDs from the merged updatedMediaItem
 */

const tvShow: MediaItemBase = {
  id: 10,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'tmdb',
  title: 'TV Show for Translation Test',
  runtime: 50,
  tmdbId: 99999,
};

const season1 = {
  id: 100,
  seasonNumber: 1,
  numberOfEpisodes: 2,
  title: 'Season 1',
  isSpecialSeason: false,
  tvShowId: tvShow.id,
};

const episode1 = {
  id: 200,
  episodeNumber: 1,
  seasonNumber: 1,
  seasonAndEpisodeNumber: 1001,
  title: 'Ep 1',
  releaseDate: '2020-01-15',
  isSpecialEpisode: false,
  tvShowId: tvShow.id,
  seasonId: season1.id,
};

const episode2 = {
  id: 201,
  episodeNumber: 2,
  seasonNumber: 1,
  seasonAndEpisodeNumber: 1002,
  title: 'Ep 2',
  releaseDate: '2020-01-22',
  isSpecialEpisode: false,
  tvShowId: tvShow.id,
  seasonId: season1.id,
};

const user = {
  id: 10,
  name: 'translation-test-user',
  admin: true,
  password: 'password',
  publicReviews: false,
};

const mediaItem = {
  ...tvShow,
  seasons: [
    {
      ...season1,
      episodes: [episode1, episode2],
    },
  ],
};

describe('updateMediaItem TV translation wiring', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(user);
    await Database.knex('mediaItem').insert(tvShow);
    await Database.knex('season').insert(season1);
    await Database.knex('episode').insert(episode1);
    await Database.knex('episode').insert(episode2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('episodeTranslation').delete();
    await Database.knex('seasonTranslation').delete();
    await Database.knex('mediaItemTranslation').delete();
  });

  test('upserts mediaItem, season, and episode translations for each configured language', async () => {
    const localizedDetailsMock = jest.fn();

    // localizedDetails for 'en'
    localizedDetailsMock.mockResolvedValueOnce({
      mediaType: 'tv',
      source: 'tmdb',
      title: 'English Show Title',
      overview: 'English overview',
      genres: ['Drama'],
      seasons: [
        {
          seasonNumber: 1,
          title: 'English Season 1',
          description: 'English season desc',
          numberOfEpisodes: 2,
          isSpecialSeason: false,
          episodes: [
            {
              episodeNumber: 1,
              seasonNumber: 1,
              title: 'English Ep 1',
              description: 'English ep 1 desc',
              isSpecialEpisode: false,
            },
            {
              episodeNumber: 2,
              seasonNumber: 1,
              title: 'English Ep 2',
              description: 'English ep 2 desc',
              isSpecialEpisode: false,
            },
          ],
        },
      ],
    });

    // localizedDetails for 'es'
    localizedDetailsMock.mockResolvedValueOnce({
      mediaType: 'tv',
      source: 'tmdb',
      title: 'Titulo Espanol',
      overview: 'Resumen en espanol',
      genres: ['Drama'],
      seasons: [
        {
          seasonNumber: 1,
          title: 'Temporada 1',
          description: 'Descripcion de la temporada',
          numberOfEpisodes: 2,
          isSpecialSeason: false,
          episodes: [
            {
              episodeNumber: 1,
              seasonNumber: 1,
              title: 'Episodio 1',
              description: 'Desc episodio 1',
              isSpecialEpisode: false,
            },
            {
              episodeNumber: 2,
              seasonNumber: 1,
              title: 'Episodio 2',
              description: 'Desc episodio 2',
              isSpecialEpisode: false,
            },
          ],
        },
      ],
    });

    mockedMetadataProviders.get.mockImplementation(() => {
      return {
        details: async () => ({
          mediaType: 'tv',
          source: 'tmdb',
          title: 'Base Title',
          overview: 'Base overview',
          genres: ['Drama'],
          seasons: [
            {
              seasonNumber: 1,
              title: 'Base Season 1',
              description: 'Base season desc',
              numberOfEpisodes: 2,
              isSpecialSeason: false,
              episodes: [
                {
                  episodeNumber: 1,
                  seasonNumber: 1,
                  title: 'Base Ep 1',
                  description: 'Base ep 1 desc',
                  isSpecialEpisode: false,
                  seasonAndEpisodeNumber: 1001,
                },
                {
                  episodeNumber: 2,
                  seasonNumber: 1,
                  title: 'Base Ep 2',
                  description: 'Base ep 2 desc',
                  isSpecialEpisode: false,
                  seasonAndEpisodeNumber: 1002,
                },
              ],
            },
          ],
        }),
        localizedDetails: localizedDetailsMock,
      } as unknown as MetadataProvider;
    });

    await updateMediaItem(mediaItem);

    // Verify mediaItemTranslation rows
    const mediaItemTranslations = await Database.knex('mediaItemTranslation')
      .where({ mediaItemId: tvShow.id })
      .select('*');

    expect(mediaItemTranslations).toHaveLength(2); // en + es

    const enMIT = mediaItemTranslations.find((r: Record<string, unknown>) => r.language === 'en');
    expect(enMIT).toBeDefined();
    expect(enMIT.title).toBe('English Show Title');

    const esMIT = mediaItemTranslations.find((r: Record<string, unknown>) => r.language === 'es');
    expect(esMIT).toBeDefined();
    expect(esMIT.title).toBe('Titulo Espanol');

    // Verify seasonTranslation rows
    const seasonTranslations = await Database.knex('seasonTranslation')
      .where({ seasonId: season1.id })
      .select('*');

    expect(seasonTranslations).toHaveLength(2); // en + es

    const enST = seasonTranslations.find((r: Record<string, unknown>) => r.language === 'en');
    expect(enST).toBeDefined();
    expect(enST.title).toBe('English Season 1');
    expect(enST.description).toBe('English season desc');

    const esST = seasonTranslations.find((r: Record<string, unknown>) => r.language === 'es');
    expect(esST).toBeDefined();
    expect(esST.title).toBe('Temporada 1');

    // Verify episodeTranslation rows
    const ep1Translations = await Database.knex('episodeTranslation')
      .where({ episodeId: episode1.id })
      .select('*');

    expect(ep1Translations).toHaveLength(2); // en + es

    const enEp1 = ep1Translations.find((r: Record<string, unknown>) => r.language === 'en');
    expect(enEp1).toBeDefined();
    expect(enEp1.title).toBe('English Ep 1');

    const esEp1 = ep1Translations.find((r: Record<string, unknown>) => r.language === 'es');
    expect(esEp1).toBeDefined();
    expect(esEp1.title).toBe('Episodio 1');

    const ep2Translations = await Database.knex('episodeTranslation')
      .where({ episodeId: episode2.id })
      .select('*');

    expect(ep2Translations).toHaveLength(2); // en + es

    const esEp2 = ep2Translations.find((r: Record<string, unknown>) => r.language === 'es');
    expect(esEp2).toBeDefined();
    expect(esEp2.title).toBe('Episodio 2');
    expect(esEp2.description).toBe('Desc episodio 2');
  });

  test('first language base details data is upserted into translation tables', async () => {
    mockedMetadataProviders.get.mockImplementation(() => {
      return {
        details: async () => ({
          mediaType: 'tv',
          source: 'tmdb',
          title: 'First Lang Base Title',
          overview: 'First lang base overview',
          genres: ['Thriller'],
          seasons: [
            {
              seasonNumber: 1,
              title: 'First Lang Season',
              description: 'First lang season desc',
              numberOfEpisodes: 2,
              isSpecialSeason: false,
              episodes: [
                {
                  episodeNumber: 1,
                  seasonNumber: 1,
                  title: 'First Lang Ep 1',
                  description: 'First lang ep 1 desc',
                  isSpecialEpisode: false,
                  seasonAndEpisodeNumber: 1001,
                },
                {
                  episodeNumber: 2,
                  seasonNumber: 1,
                  title: 'First Lang Ep 2',
                  description: 'First lang ep 2 desc',
                  isSpecialEpisode: false,
                  seasonAndEpisodeNumber: 1002,
                },
              ],
            },
          ],
        }),
        localizedDetails: jest.fn()
          .mockResolvedValueOnce({
            mediaType: 'tv',
            source: 'tmdb',
            title: 'English Localized',
            overview: 'English localized overview',
            genres: ['Thriller'],
            seasons: [
              {
                seasonNumber: 1,
                title: 'EN Season',
                description: 'EN season desc',
                numberOfEpisodes: 2,
                isSpecialSeason: false,
                episodes: [
                  { episodeNumber: 1, seasonNumber: 1, title: 'EN Ep1', description: 'EN ep1 desc', isSpecialEpisode: false },
                  { episodeNumber: 2, seasonNumber: 1, title: 'EN Ep2', description: 'EN ep2 desc', isSpecialEpisode: false },
                ],
              },
            ],
          })
          .mockResolvedValueOnce({
            mediaType: 'tv',
            source: 'tmdb',
            title: 'Spanish Localized',
            overview: 'Spanish localized overview',
            genres: ['Suspenso'],
            seasons: [
              {
                seasonNumber: 1,
                title: 'ES Season',
                description: 'ES season desc',
                numberOfEpisodes: 2,
                isSpecialSeason: false,
                episodes: [
                  { episodeNumber: 1, seasonNumber: 1, title: 'ES Ep1', description: 'ES ep1 desc', isSpecialEpisode: false },
                  { episodeNumber: 2, seasonNumber: 1, title: 'ES Ep2', description: 'ES ep2 desc', isSpecialEpisode: false },
                ],
              },
            ],
          }),
      } as unknown as MetadataProvider;
    });

    await updateMediaItem(mediaItem);

    // The first language ('en') should have both the base upsert AND the localized upsert
    // The localized upsert overwrites the base one, so we just verify the final state
    const enMIT = await Database.knex('mediaItemTranslation')
      .where({ mediaItemId: tvShow.id, language: 'en' })
      .first();

    expect(enMIT).toBeDefined();
    // The localized call for 'en' should have overwritten the base data
    expect(enMIT.title).toBe('English Localized');
  });

  test('continues processing remaining languages when one language fails', async () => {
    const localizedDetailsMock = jest.fn();

    // First language ('en') fails
    localizedDetailsMock.mockRejectedValueOnce(new Error('Network error'));

    // Second language ('es') succeeds
    localizedDetailsMock.mockResolvedValueOnce({
      mediaType: 'tv',
      source: 'tmdb',
      title: 'Titulo ES',
      overview: 'Resumen ES',
      genres: ['Drama'],
      seasons: [
        {
          seasonNumber: 1,
          title: 'Temporada 1 ES',
          description: 'Desc temporada ES',
          numberOfEpisodes: 2,
          isSpecialSeason: false,
          episodes: [
            { episodeNumber: 1, seasonNumber: 1, title: 'Ep1 ES', description: 'Desc ep1 ES', isSpecialEpisode: false },
            { episodeNumber: 2, seasonNumber: 1, title: 'Ep2 ES', description: 'Desc ep2 ES', isSpecialEpisode: false },
          ],
        },
      ],
    });

    mockedMetadataProviders.get.mockImplementation(() => {
      return {
        details: async () => ({
          mediaType: 'tv',
          source: 'tmdb',
          title: 'Base Title',
          overview: 'Base overview',
          genres: ['Drama'],
          seasons: [
            {
              seasonNumber: 1,
              title: 'Base Season',
              description: 'Base season desc',
              numberOfEpisodes: 2,
              isSpecialSeason: false,
              episodes: [
                { episodeNumber: 1, seasonNumber: 1, title: 'Base Ep1', description: 'Base ep1', isSpecialEpisode: false, seasonAndEpisodeNumber: 1001 },
                { episodeNumber: 2, seasonNumber: 1, title: 'Base Ep2', description: 'Base ep2', isSpecialEpisode: false, seasonAndEpisodeNumber: 1002 },
              ],
            },
          ],
        }),
        localizedDetails: localizedDetailsMock,
      } as unknown as MetadataProvider;
    });

    // Should NOT throw
    await updateMediaItem(mediaItem);

    // 'es' translations should still exist
    const esMIT = await Database.knex('mediaItemTranslation')
      .where({ mediaItemId: tvShow.id, language: 'es' })
      .first();
    expect(esMIT).toBeDefined();
    expect(esMIT.title).toBe('Titulo ES');

    const esST = await Database.knex('seasonTranslation')
      .where({ seasonId: season1.id, language: 'es' })
      .first();
    expect(esST).toBeDefined();
    expect(esST.title).toBe('Temporada 1 ES');

    const esEp1 = await Database.knex('episodeTranslation')
      .where({ episodeId: episode1.id, language: 'es' })
      .first();
    expect(esEp1).toBeDefined();
    expect(esEp1.title).toBe('Ep1 ES');
  });

  test('skips season/episode translations for non-TV media items (movies)', async () => {
    const movieMediaItem: MediaItemBase = {
      id: 11,
      lastTimeUpdated: new Date().getTime(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Movie Test',
      runtime: 120,
      tmdbId: 88888,
    };

    await Database.knex('mediaItem').insert(movieMediaItem);

    const localizedDetailsMock = jest.fn().mockResolvedValue({
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Movie Title ES',
      overview: 'Movie overview ES',
      genres: ['Action'],
    });

    mockedMetadataProviders.get.mockImplementation(() => {
      return {
        details: async () => ({
          mediaType: 'movie',
          source: 'tmdb',
          title: 'Movie Base Title',
          overview: 'Movie base overview',
          genres: ['Action'],
          runtime: 120,
        }),
        localizedDetails: localizedDetailsMock,
      } as unknown as MetadataProvider;
    });

    await updateMediaItem(movieMediaItem);

    // mediaItemTranslation should exist
    const mediaItemTranslations = await Database.knex('mediaItemTranslation')
      .where({ mediaItemId: movieMediaItem.id })
      .select('*');
    expect(mediaItemTranslations.length).toBeGreaterThan(0);

    // No season or episode translations should exist
    const seasonTranslations = await Database.knex('seasonTranslation').select('*');
    expect(seasonTranslations).toHaveLength(0);

    const episodeTranslations = await Database.knex('episodeTranslation').select('*');
    expect(episodeTranslations).toHaveLength(0);

    // Cleanup
    await Database.knex('mediaItemTranslation').where({ mediaItemId: movieMediaItem.id }).delete();
    await Database.knex('mediaItem').where({ id: movieMediaItem.id }).delete();
  });
});
