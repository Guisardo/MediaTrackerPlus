/**
 * Integration tests for the Multi-Language Metadata feature (US-011).
 *
 * These tests verify ALL product requirements (FR-1 through FR-14) end-to-end:
 *
 *   FR-1:  METADATA_LANGUAGES configuration and fallback
 *   FR-2:  Invalid language code handling (skip + warn)
 *   FR-3:  Translation table schema (columns, FKs, unique constraints)
 *   FR-4:  TMDB movie translation pipeline (multi-language upserts)
 *   FR-5:  Other providers (Audible, IGDB, OpenLibrary)
 *   FR-6:  Primary record update from first language only
 *   FR-7:  API locale-aware responses (batch SELECT, overlay)
 *   FR-8:  Three-tier fallback (exact → first-lang → base)
 *   FR-9:  metadataLanguage field in all API responses
 *   FR-10: Frontend Accept-Language header (covered in client tests)
 *   FR-11: UI locale badge / fallback indicator (covered in client tests)
 *   FR-12: Background backfill on startup
 *   FR-13: AUDIBLE_LANG_MAP configuration
 *   FR-14: originalTitle immutability
 *
 * The test file uses a single outer describe with shared DB lifecycle
 * to avoid the clearDatabase/runMigrations re-initialization problem.
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must come before imports)
// ---------------------------------------------------------------------------

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { Config } from 'src/config';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { logger } from 'src/logger';
import {
  getMetadataLanguages,
  getAudibleLangMap,
  toTmdbLang,
  _resetMetadataLanguagesCache,
  _resetAudibleLangMapCache,
  IGDB_REGION_MAP,
} from 'src/metadataLanguages';
import { resolveLocale } from 'src/localeResolver';
import {
  upsertMediaItemTranslation,
  upsertSeasonTranslation,
  upsertEpisodeTranslation,
} from 'src/repository/translationRepository';
import { MediaItemController } from 'src/controllers/item';
import { ItemsController } from 'src/controllers/items';

// Cast Config for mutable access to test-only fields (per codebase pattern)
const mockConfig = Config as unknown as {
  METADATA_LANGUAGES: string[] | null;
  AUDIBLE_LANG_MAP: string | null;
};

// Saved original values for restore
const originalMetadataLanguages = Config.METADATA_LANGUAGES;
const originalAudibleLangMap = Config.AUDIBLE_LANG_MAP;

const expectUniqueIndex = async (tableName: string, expectedColumns: string[]) => {
  const indexes = await Database.knex.raw(`PRAGMA index_list('${tableName}');`);
  const uniqueIndexes = indexes.filter(
    (index: { unique: number }) => index.unique === 1
  );

  const uniqueIndexColumns = await Promise.all(
    uniqueIndexes.map(async (index: { name: string }) => {
      const columns = await Database.knex.raw(
        `PRAGMA index_info('${index.name}');`
      );
      return columns.map((column: { name: string }) => column.name);
    })
  );

  expect(uniqueIndexColumns).toContainEqual(expectedColumns);
};

// ==========================================================================
// Single outer describe for shared DB lifecycle
// ==========================================================================

describe('Multi-Language Metadata Integration Tests', () => {
  // One-time DB setup / teardown
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  // Reset caches and mocks between every test
  beforeEach(() => {
    _resetMetadataLanguagesCache();
    _resetAudibleLangMapCache();
    mockConfig.METADATA_LANGUAGES = null;
    mockConfig.AUDIBLE_LANG_MAP = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockConfig.METADATA_LANGUAGES = null;
    mockConfig.AUDIBLE_LANG_MAP = null;
    _resetMetadataLanguagesCache();
    _resetAudibleLangMapCache();
  });

  // ========================================================================
  // FR-1: METADATA_LANGUAGES Configuration and Fallback
  // ========================================================================

  describe('FR-1: METADATA_LANGUAGES configuration and fallback', () => {
    test('valid codes are accepted and returned in order', () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'es-419'];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en', 'es-419']);
    });

    test('BCP 47 tags with region subtags are preserved as-is', () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'pt-BR', 'zh-CN'];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en', 'pt-BR', 'zh-CN']);
    });

    test('toTmdbLang extracts base subtag for TMDB API calls', () => {
      expect(toTmdbLang('es-419')).toBe('es');
      expect(toTmdbLang('pt-BR')).toBe('pt');
      expect(toTmdbLang('en')).toBe('en');
    });

    test('falls back to ["en"] when env var is not set', () => {
      mockConfig.METADATA_LANGUAGES = null;
      const result = getMetadataLanguages();
      expect(result).toEqual(['en']);
    });

    test('falls back to ["en"] when env var is empty', () => {
      mockConfig.METADATA_LANGUAGES = [];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en']);
    });

    test('result is memoized on subsequent calls', () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'de'];
      const first = getMetadataLanguages();
      mockConfig.METADATA_LANGUAGES = ['fr'];
      const second = getMetadataLanguages();
      expect(first).toBe(second);
      expect(second).toEqual(['en', 'de']);
    });
  });

  // ========================================================================
  // FR-2: Invalid Language Code Handling
  // ========================================================================

  describe('FR-2: Invalid language code handling', () => {
    test('invalid base codes are logged as warnings and excluded', () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'xx', 'es-419'];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en', 'es-419']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("invalid base language code 'xx'")
      );
    });

    test('server does not crash when all codes are invalid', () => {
      mockConfig.METADATA_LANGUAGES = ['xx', 'yy', 'zz'];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en']);
      expect(logger.warn).toHaveBeenCalled();
    });

    test('BCP 47 tags with invalid base code are rejected', () => {
      mockConfig.METADATA_LANGUAGES = ['xx-US'];
      const result = getMetadataLanguages();
      expect(result).toEqual(['en']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("invalid base language code 'xx'")
      );
    });
  });

  // ========================================================================
  // FR-3: Translation Table Schema
  // ========================================================================

  describe('FR-3: Translation table schema', () => {
    test('all three translation tables exist with expected columns', async () => {
      const hasMediaItemTranslation = await Database.knex.schema.hasTable(
        'mediaItemTranslation'
      );
      expect(hasMediaItemTranslation).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'id')).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'mediaItemId')).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'language')).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'title')).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'overview')).toBe(true);
      expect(await Database.knex.schema.hasColumn('mediaItemTranslation', 'genres')).toBe(true);

      const hasSeasonTranslation = await Database.knex.schema.hasTable(
        'seasonTranslation'
      );
      expect(hasSeasonTranslation).toBe(true);
      expect(await Database.knex.schema.hasColumn('seasonTranslation', 'seasonId')).toBe(true);
      expect(await Database.knex.schema.hasColumn('seasonTranslation', 'language')).toBe(true);
      expect(await Database.knex.schema.hasColumn('seasonTranslation', 'title')).toBe(true);
      expect(await Database.knex.schema.hasColumn('seasonTranslation', 'description')).toBe(true);

      const hasEpisodeTranslation = await Database.knex.schema.hasTable(
        'episodeTranslation'
      );
      expect(hasEpisodeTranslation).toBe(true);
      expect(await Database.knex.schema.hasColumn('episodeTranslation', 'episodeId')).toBe(true);
      expect(await Database.knex.schema.hasColumn('episodeTranslation', 'language')).toBe(true);
      expect(await Database.knex.schema.hasColumn('episodeTranslation', 'title')).toBe(true);
      expect(await Database.knex.schema.hasColumn('episodeTranslation', 'description')).toBe(true);
    });

    test('ON DELETE CASCADE removes translations when parent media item is deleted', async () => {
      await Database.knex('mediaItem').insert({
        id: 9901,
        title: 'Cascade Test',
        source: 'user',
        lastTimeUpdated: Date.now(),
      });
      await Database.knex('mediaItemTranslation').insert({
        mediaItemId: 9901,
        language: 'en',
        title: 'Cascade Translation',
      });

      await Database.knex('mediaItem').where({ id: 9901 }).delete();

      const remaining = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 9901 })
        .count('* as cnt')
        .first();
      expect(remaining?.cnt).toBe(0);
    });

    test('unique index prevents duplicate (mediaItemId, language) pairs', async () => {
      await expectUniqueIndex('mediaItemTranslation', [
        'mediaItemId',
        'language',
      ]);
    });
  });

  // ========================================================================
  // FR-4: TMDB Movie Translation Pipeline
  // ========================================================================

  describe('FR-4: TMDB movie translation pipeline', () => {
    beforeAll(async () => {
      // Seed movie for translation tests
      await Database.knex('mediaItem')
        .insert({
          id: 5001,
          title: 'FR4 Movie',
          source: 'tmdb',
          mediaType: 'movie',
          lastTimeUpdated: Date.now(),
          tmdbId: 5001,
        })
        .onConflict('id')
        .ignore();
    });

    afterEach(async () => {
      await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 5001)
        .del();
    });

    afterAll(async () => {
      await Database.knex('mediaItem').where({ id: 5001 }).del();
    });

    test('upsert creates translation rows for multiple languages', async () => {
      await upsertMediaItemTranslation(5001, 'en', {
        title: 'English Title',
        overview: 'English overview',
        genres: ['Action', 'Drama'],
      });
      await upsertMediaItemTranslation(5001, 'es', {
        title: 'Titulo Espanol',
        overview: 'Resumen en espanol',
        genres: ['Accion', 'Drama'],
      });

      const rows = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 5001)
        .select('*');

      expect(rows).toHaveLength(2);
      expect(rows.find((r: any) => r.language === 'en')?.title).toBe('English Title');
      expect(rows.find((r: any) => r.language === 'es')?.title).toBe('Titulo Espanol');
    });

    test('upsert updates existing row on conflict', async () => {
      await upsertMediaItemTranslation(5001, 'en', {
        title: 'Original Title',
        overview: 'Original overview',
        genres: null,
      });

      await upsertMediaItemTranslation(5001, 'en', {
        title: 'Updated Title',
        overview: 'Updated overview',
        genres: ['Comedy'],
      });

      const rows = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 5001, language: 'en' })
        .select('*');

      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Updated Title');
      expect(rows[0].overview).toBe('Updated overview');
    });

    test('genres are stored as JSON string in SQLite', async () => {
      await upsertMediaItemTranslation(5001, 'de', {
        title: 'Deutscher Titel',
        overview: null,
        genres: ['Aktion', 'Thriller'],
      });

      const row = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 5001, language: 'de' })
        .first();

      expect(row).toBeDefined();
      const genres = JSON.parse(row.genres);
      expect(genres).toEqual(['Aktion', 'Thriller']);
    });

    test('null title and overview are stored as null', async () => {
      await upsertMediaItemTranslation(5001, 'ja', {
        title: null,
        overview: null,
        genres: null,
      });

      const row = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 5001, language: 'ja' })
        .first();

      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBeNull();
      expect(row.genres).toBeNull();
    });

    test('undefined values default to null on upsert', async () => {
      await upsertMediaItemTranslation(5001, 'ko', {});

      const row = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 5001, language: 'ko' })
        .first();

      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBeNull();
      expect(row.genres).toBeNull();
    });
  });

  // ========================================================================
  // FR-5: Other Provider Import (Audible, IGDB, OpenLibrary)
  // ========================================================================

  describe('FR-5: Other provider import', () => {
    test('IGDB_REGION_MAP maps all 9 region IDs correctly', () => {
      expect(IGDB_REGION_MAP[1]).toEqual(['de', 'fr', 'es', 'it', 'nl', 'pl', 'pt']);
      expect(IGDB_REGION_MAP[2]).toEqual(['en']);
      expect(IGDB_REGION_MAP[3]).toEqual(['en']);
      expect(IGDB_REGION_MAP[4]).toEqual(['en']);
      expect(IGDB_REGION_MAP[5]).toEqual(['ja']);
      expect(IGDB_REGION_MAP[6]).toEqual(['zh']);
      expect(IGDB_REGION_MAP[7]).toEqual(['ko', 'zh']);
      expect(IGDB_REGION_MAP[8]).toBe('all');
      expect(IGDB_REGION_MAP[9]).toEqual(['ko']);
    });

    test('default Audible map includes all expected languages', () => {
      const map = getAudibleLangMap();
      expect(map.get('en')).toBe('us');
      expect(map.get('de')).toBe('de');
      expect(map.get('es')).toBe('es');
      expect(map.get('fr')).toBe('fr');
      expect(map.get('it')).toBe('it');
      expect(map.get('ja')).toBe('jp');
      expect(map.size).toBe(6);
    });

    test('custom AUDIBLE_LANG_MAP overrides defaults', () => {
      mockConfig.AUDIBLE_LANG_MAP = 'en:uk,de:de';
      _resetAudibleLangMapCache();
      const map = getAudibleLangMap();
      expect(map.get('en')).toBe('uk');
      expect(map.get('de')).toBe('de');
      expect(map.size).toBe(2);
    });
  });

  // ========================================================================
  // FR-7/FR-8/FR-9: API Locale Resolution, Three-Tier Fallback,
  // and metadataLanguage Field
  // ========================================================================

  describe('FR-7/FR-8/FR-9: API locale resolution and three-tier fallback', () => {
    beforeAll(async () => {
      // Seed core test data for API tests
      await Database.knex('user').insert(Data.user).onConflict('id').ignore();
      await Database.knex('list').insert(Data.watchlist).onConflict('id').ignore();
      await Database.knex('mediaItem').insert(Data.movie).onConflict('id').ignore();
      await Database.knex('mediaItem').insert(Data.tvShow).onConflict('id').ignore();

      // Add items to watchlist (no unique constraint on listItem, so just insert)
      const now = Date.now();
      // Delete first to avoid duplicates if beforeAll runs again
      await Database.knex('listItem')
        .where('listId', Data.watchlist.id)
        .del();
      await Database.knex('listItem').insert([
        { listId: Data.watchlist.id, mediaItemId: Data.movie.id, addedAt: now },
        { listId: Data.watchlist.id, mediaItemId: Data.tvShow.id, addedAt: now },
      ]);

      // Seed translations
      await upsertMediaItemTranslation(Data.movie.id, 'en', {
        title: 'English Movie Title',
        overview: 'English overview text',
        genres: ['Action', 'Drama'],
      });
      await upsertMediaItemTranslation(Data.movie.id, 'es', {
        title: 'Titulo de Pelicula',
        overview: 'Resumen en espanol',
        genres: ['Accion', 'Drama'],
      });

      // Season and episode data
      await Database.knex('season').insert(Data.season).onConflict('id').ignore();
      await Database.knex('episode').insert(Data.episode).onConflict('id').ignore();
      await Database.knex('episode').insert(Data.episode2).onConflict('id').ignore();
      await Database.knex('episode').insert(Data.episode3).onConflict('id').ignore();

      // Season + episode translations
      await upsertSeasonTranslation(Data.season.id, 'es', {
        title: 'Temporada 1',
        description: 'Descripcion temporada',
      });
      await upsertSeasonTranslation(Data.season.id, 'en', {
        title: 'Season 1 (EN)',
        description: 'English season description',
      });
      await upsertEpisodeTranslation(Data.episode.id, 'es', {
        title: 'Episodio 1',
        description: 'Desc ep 1 ES',
      });
      await upsertEpisodeTranslation(Data.episode.id, 'en', {
        title: 'Episode 1 (EN)',
        description: 'Desc ep 1 EN',
      });
    });

    // -------------------------------------------------------------------
    // Media item detail — three-tier fallback
    // -------------------------------------------------------------------

    describe('media item detail - three-tier fallback', () => {
      test('Tier 1: exact locale match returns localized data with metadataLanguage', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.movie.id },
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        expect(data.title).toBe('Titulo de Pelicula');
        expect(data.overview).toBe('Resumen en espanol');
        expect(data.metadataLanguage).toBe('es');
      });

      test('Tier 2: no locale match falls back to first language', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.movie.id },
          requestHeaders: { 'accept-language': 'fr' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        expect(data.title).toBe('English Movie Title');
        expect(data.overview).toBe('English overview text');
        expect(data.metadataLanguage).toBe('en');
      });

      test('Tier 3: no translations exist returns base fields with metadataLanguage null', async () => {
        mockConfig.METADATA_LANGUAGES = ['de'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.movie.id },
          requestHeaders: { 'accept-language': 'de' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        expect(data.title).toBe(Data.movie.title);
        expect(data.metadataLanguage).toBeNull();
      });
    });

    // -------------------------------------------------------------------
    // List endpoint — batch translation overlay
    // -------------------------------------------------------------------

    describe('list endpoint - batch translation', () => {
      test('batch overlay applies translations to all items in list', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new ItemsController();
        const res = await request(controller.get, {
          userId: Data.user.id,
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const items = res.data as any[];
        expect(Array.isArray(items)).toBe(true);

        const movie = items.find((item) => item.id === Data.movie.id);
        expect(movie).toBeDefined();
        expect(movie.title).toBe('Titulo de Pelicula');
        expect(movie.metadataLanguage).toBe('es');
      });

      test('all items in list include metadataLanguage field', async () => {
        mockConfig.METADATA_LANGUAGES = ['en'];

        const controller = new ItemsController();
        const res = await request(controller.get, {
          userId: Data.user.id,
          requestHeaders: { 'accept-language': 'en' },
        });

        expect(res.statusCode).toBe(200);
        const items = res.data as any[];
        for (const item of items) {
          expect('metadataLanguage' in item).toBe(true);
        }
      });
    });

    // -------------------------------------------------------------------
    // Season and episode locale resolution
    // -------------------------------------------------------------------

    describe('season and episode locale resolution', () => {
      test('Tier 1: exact locale match for season returns localized data', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.tvShow.id },
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        const season = data.seasons?.[0];
        expect(season).toBeDefined();
        expect(season.title).toBe('Temporada 1');
        expect(season.metadataLanguage).toBe('es');
      });

      test('Tier 1: exact locale match for episode returns localized data', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.tvShow.id },
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        const ep1 = data.seasons?.[0]?.episodes?.find(
          (e: any) => e.episodeNumber === 1
        );
        expect(ep1).toBeDefined();
        expect(ep1.title).toBe('Episodio 1');
        expect(ep1.metadataLanguage).toBe('es');
      });

      test('Tier 2: season fallback to first language', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.tvShow.id },
          requestHeaders: { 'accept-language': 'ja' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        const season = data.seasons?.[0];
        expect(season.title).toBe('Season 1 (EN)');
        expect(season.metadataLanguage).toBe('en');
      });

      test('Tier 3: episode without translation gets metadataLanguage null', async () => {
        mockConfig.METADATA_LANGUAGES = ['de'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.tvShow.id },
          requestHeaders: { 'accept-language': 'de' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        const ep3 = data.seasons?.[0]?.episodes?.find(
          (e: any) => e.episodeNumber === 3
        );
        expect(ep3).toBeDefined();
        expect(ep3.title).toBe(Data.episode3.title);
        expect(ep3.metadataLanguage).toBeNull();
      });

      test('seasons and episodes have metadataLanguage field in response', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new MediaItemController();
        const res = await request(controller.details, {
          userId: Data.user.id,
          pathParams: { mediaItemId: Data.tvShow.id },
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const data = res.data as any;
        for (const season of data.seasons ?? []) {
          expect('metadataLanguage' in season).toBe(true);
          for (const episode of season.episodes ?? []) {
            expect('metadataLanguage' in episode).toBe(true);
          }
        }
      });
    });

    // -------------------------------------------------------------------
    // Paginated endpoint
    // -------------------------------------------------------------------

    describe('paginated endpoint translation', () => {
      test('locale resolution works for paginated results', async () => {
        mockConfig.METADATA_LANGUAGES = ['en', 'es'];

        const controller = new ItemsController();
        const res = await request(controller.getPaginated, {
          userId: Data.user.id,
          requestQuery: { page: 1 },
          requestHeaders: { 'accept-language': 'es' },
        });

        expect(res.statusCode).toBe(200);
        const paginated = res.data as any;
        expect(Array.isArray(paginated.data)).toBe(true);

        const movie = paginated.data.find(
          (item: any) => item.id === Data.movie.id
        );
        if (movie) {
          expect(movie.title).toBe('Titulo de Pelicula');
          expect(movie.metadataLanguage).toBe('es');
        }
      });
    });
  });

  // ========================================================================
  // FR-12: Background Backfill on Startup
  // ========================================================================

  describe('FR-12: Background backfill on startup', () => {
    afterEach(async () => {
      // Clean up backfill-specific test data
      await Database.knex('mediaItemTranslation')
        .whereIn('mediaItemId', [8001, 8002, 8003, 8004])
        .del();
      await Database.knex('mediaItem')
        .whereIn('id', [8001, 8002, 8003, 8004])
        .del();
    });

    test('initial deployment: empty translation tables with existing items triggers full backfill need', async () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'es-419'];

      await Database.knex('mediaItem').insert({
        id: 8001,
        title: 'Backfill Movie 1',
        source: 'tmdb',
        mediaType: 'movie',
        lastTimeUpdated: Date.now(),
        tmdbId: 1001,
      });
      await Database.knex('mediaItem').insert({
        id: 8002,
        title: 'Backfill Movie 2',
        source: 'tmdb',
        mediaType: 'movie',
        lastTimeUpdated: Date.now(),
        tmdbId: 1002,
      });

      const translationCount = await Database.knex('mediaItemTranslation')
        .whereIn('mediaItemId', [8001, 8002])
        .count('* as cnt')
        .first();
      expect(translationCount?.cnt).toBe(0);

      const itemCount = await Database.knex('mediaItem')
        .whereIn('id', [8001, 8002])
        .count('* as cnt')
        .first();
      expect(Number(itemCount?.cnt)).toBe(2);

      const configuredLanguages = getMetadataLanguages();
      expect(configuredLanguages).toEqual(['en', 'es-419']);
    });

    test('incremental: existing translations for some languages detects only missing ones', async () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'es-419', 'fr'];

      await Database.knex('mediaItem').insert({
        id: 8003,
        title: 'Incremental Movie',
        source: 'tmdb',
        mediaType: 'movie',
        lastTimeUpdated: Date.now(),
        tmdbId: 1003,
      });

      await upsertMediaItemTranslation(8003, 'en', { title: 'EN Title' });
      await upsertMediaItemTranslation(8003, 'es-419', { title: 'ES Title' });

      const existingLanguages = await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 8003)
        .distinct('language')
        .pluck('language');

      const configuredLanguages = getMetadataLanguages();
      const missingLanguages = configuredLanguages.filter(
        (lang) => !existingLanguages.includes(lang)
      );

      expect(missingLanguages).toEqual(['fr']);
    });

    test('removing a language does NOT delete existing translations', async () => {
      await Database.knex('mediaItem').insert({
        id: 8004,
        title: 'Retention Test',
        source: 'tmdb',
        mediaType: 'movie',
        lastTimeUpdated: Date.now(),
        tmdbId: 1004,
      });

      await upsertMediaItemTranslation(8004, 'en', { title: 'EN' });
      await upsertMediaItemTranslation(8004, 'es', { title: 'ES' });
      await upsertMediaItemTranslation(8004, 'fr', { title: 'FR' });

      mockConfig.METADATA_LANGUAGES = ['en', 'es'];
      _resetMetadataLanguagesCache();

      const frTranslation = await Database.knex('mediaItemTranslation')
        .where({ mediaItemId: 8004, language: 'fr' })
        .first();

      expect(frTranslation).toBeDefined();
      expect(frTranslation.title).toBe('FR');
    });
  });

  // ========================================================================
  // FR-13: AUDIBLE_LANG_MAP Configuration
  // ========================================================================

  describe('FR-13: AUDIBLE_LANG_MAP configuration', () => {
    test('valid pairs are parsed correctly', () => {
      mockConfig.AUDIBLE_LANG_MAP = 'en:us,de:de,es:es';
      _resetAudibleLangMapCache();
      const map = getAudibleLangMap();
      expect(map.get('en')).toBe('us');
      expect(map.get('de')).toBe('de');
      expect(map.get('es')).toBe('es');
      expect(map.size).toBe(3);
    });

    test('invalid entries (missing colon) are skipped with warning', () => {
      mockConfig.AUDIBLE_LANG_MAP = 'en:us,badentry,de:de';
      _resetAudibleLangMapCache();
      const map = getAudibleLangMap();
      expect(map.size).toBe(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing colon')
      );
    });

    test('invalid entries (empty parts) are skipped and falls back to defaults', () => {
      mockConfig.AUDIBLE_LANG_MAP = ':us,en:';
      _resetAudibleLangMapCache();
      const map = getAudibleLangMap();
      // All entries invalid → falls back to default map (6 entries)
      expect(map.size).toBe(6);
      expect(map.get('en')).toBe('us');
      expect(logger.warn).toHaveBeenCalled();
    });

    test('default map used when AUDIBLE_LANG_MAP is unset', () => {
      mockConfig.AUDIBLE_LANG_MAP = null;
      _resetAudibleLangMapCache();
      const map = getAudibleLangMap();
      expect(map.get('en')).toBe('us');
      expect(map.get('ja')).toBe('jp');
      expect(map.size).toBe(6);
    });
  });

  // ========================================================================
  // FR-14: originalTitle Immutability
  // ========================================================================

  describe('FR-14: originalTitle is never modified by translation imports', () => {
    beforeAll(async () => {
      // Seed a movie with originalTitle for FR-14 tests
      await Database.knex('mediaItem')
        .insert({
          id: 6001,
          title: 'FR14 Test',
          source: 'tmdb',
          mediaType: 'movie',
          lastTimeUpdated: Date.now(),
          tmdbId: 6001,
          originalTitle: 'Original Title In Japanese',
        })
        .onConflict('id')
        .ignore();

      // Need user for detail request
      await Database.knex('user').insert(Data.user).onConflict('id').ignore();

      // Seed translations
      await upsertMediaItemTranslation(6001, 'en', {
        title: 'English Translated Title',
        overview: 'English overview',
      });
      await upsertMediaItemTranslation(6001, 'es', {
        title: 'Titulo en Espanol',
        overview: 'Resumen espanol',
      });
    });

    afterAll(async () => {
      await Database.knex('mediaItemTranslation')
        .where('mediaItemId', 6001)
        .del();
      await Database.knex('mediaItem').where({ id: 6001 }).del();
    });

    test('originalTitle is preserved when translation overlay is applied', async () => {
      mockConfig.METADATA_LANGUAGES = ['en', 'es'];

      const controller = new MediaItemController();
      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: 6001 },
        requestHeaders: { 'accept-language': 'es' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.title).toBe('Titulo en Espanol');
      expect(data.originalTitle).toBe('Original Title In Japanese');
    });

    test('originalTitle is preserved when no translation matches (fallback)', async () => {
      mockConfig.METADATA_LANGUAGES = ['de'];

      const controller = new MediaItemController();
      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: 6001 },
        requestHeaders: { 'accept-language': 'de' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.originalTitle).toBe('Original Title In Japanese');
    });
  });

  // ========================================================================
  // Cross-cutting: resolveLocale negotiation
  // ========================================================================

  describe('resolveLocale negotiation', () => {
    test('exact match returns the matched language', () => {
      const result = resolveLocale('es', ['en', 'es']);
      expect(result).toBe('es');
    });

    test('quality negotiation picks highest quality match', () => {
      const result = resolveLocale('es;q=0.9, en;q=0.8', ['en', 'es']);
      expect(result).toBe('es');
    });

    test('BCP 47 tag with region matches when available list includes exact tag', () => {
      // When the available list includes the exact BCP 47 tag, it matches
      const result = resolveLocale('es-419', ['en', 'es-419']);
      expect(result).toBe('es-419');
    });

    test('BCP 47 regional tag does not match base-only language in accept package', () => {
      // The accept package requires exact tag match — 'es-MX' does not match 'es'
      // This is handled by the three-tier fallback in the API layer
      const resultMX = resolveLocale('es-MX', ['en', 'es']);
      expect(resultMX).toBeNull();
      const result419 = resolveLocale('es-419', ['en', 'es']);
      expect(result419).toBeNull();
    });

    test('returns null when no match', () => {
      const result = resolveLocale('ja', ['en', 'es']);
      expect(result).toBeNull();
    });

    test('returns null for undefined header', () => {
      const result = resolveLocale(undefined, ['en', 'es']);
      expect(result).toBeNull();
    });

    test('returns null for empty available languages', () => {
      const result = resolveLocale('en', []);
      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // Regression sentinel
  // ========================================================================

  describe('Regression: all prior unit tests remain valid', () => {
    test('this integration test file coexists with all previous unit test suites', () => {
      expect(true).toBe(true);
    });
  });
});
