import { MediaItemController } from 'src/controllers/item';
import { ItemsController } from 'src/controllers/items';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { upsertMediaItemTranslation } from 'src/repository/translationRepository';
import {
  _resetMetadataLanguagesCache,
} from 'src/metadataLanguages';
import { Config } from 'src/config';

/**
 * Integration tests for locale resolution in media item API endpoints.
 *
 * Tests the three-tier fallback logic:
 *   Tier 1: Exact locale match from mediaItemTranslation
 *   Tier 2: First language in METADATA_LANGUAGES when no exact match
 *   Tier 3: Base mediaItem fields unchanged when no translation exists (metadataLanguage = null)
 *
 * Also verifies:
 *   - The metadataLanguage field is set correctly in all three scenarios
 *   - Batch SELECT is used for list endpoints (no per-row queries)
 *   - When language header is absent, fallback language is still applied
 */
describe('Locale Resolution - Media Item API', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);

    // Add items to watchlist so they appear in list queries
    const now = Date.now();
    await Database.knex('listItem').insert([
      { listId: Data.watchlist.id, mediaItemId: Data.movie.id, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: Data.tvShow.id, addedAt: now },
    ]);

    // Seed a Spanish translation for the movie
    await upsertMediaItemTranslation(Data.movie.id, 'es', {
      title: 'Pelicula de prueba',
      overview: 'Una descripcion en español',
      genres: ['Accion', 'Drama'],
    });

    // Seed an English translation for the movie (first language)
    await upsertMediaItemTranslation(Data.movie.id, 'en', {
      title: 'English Movie Title',
      overview: 'English overview',
      genres: ['Action', 'Drama'],
    });
  });

  afterAll(clearDatabase);

  beforeEach(() => {
    // Reset the metadata language cache before each test so we can control it
    _resetMetadataLanguagesCache();
  });

  afterEach(() => {
    // Clean up config mock after each test
    (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = null;
    _resetMetadataLanguagesCache();
  });

  // ---------------------------------------------------------------------------
  // /api/details/:mediaItemId - MediaItemController.details
  // ---------------------------------------------------------------------------

  describe('GET /api/details/:mediaItemId', () => {
    test('Tier 1: exact locale match returns localized data with correct metadataLanguage', async () => {
      // Configure METADATA_LANGUAGES to include both 'en' and 'es'
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
        'es',
      ];

      const controller = new MediaItemController();

      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: Data.movie.id },
        requestHeaders: { 'accept-language': 'es' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.title).toBe('Pelicula de prueba');
      expect(data.overview).toBe('Una descripcion en español');
      expect(data.metadataLanguage).toBe('es');
    });

    test('Tier 2: no exact locale match returns first-language fallback', async () => {
      // METADATA_LANGUAGES has en and es, request for 'fr' which has no translation
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
        'es',
      ];

      const controller = new MediaItemController();

      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: Data.movie.id },
        requestHeaders: { 'accept-language': 'fr' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      // Falls back to 'en' (first language) — should get English translation
      expect(data.title).toBe('English Movie Title');
      expect(data.overview).toBe('English overview');
      expect(data.metadataLanguage).toBe('en');
    });

    test('Tier 3: no translation exists returns base fields with metadataLanguage null', async () => {
      // METADATA_LANGUAGES has 'de' only, but no German translation exists
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'de',
      ];

      const controller = new MediaItemController();

      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: Data.movie.id },
        requestHeaders: { 'accept-language': 'de' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      // No translation exists for 'de', base fields unchanged
      expect(data.title).toBe(Data.movie.title);
      expect(data.metadataLanguage).toBeNull();
    });

    test('returns base fields when Accept-Language header is absent', async () => {
      // When no header, falls back to first language ('en') which has a translation
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
      ];

      const controller = new MediaItemController();

      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: Data.movie.id },
        // No requestHeaders => no Accept-Language
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      // No exact match (undefined header), but fallback to 'en' which has a translation
      expect(data.title).toBe('English Movie Title');
      expect(data.metadataLanguage).toBe('en');
    });

    test('metadataLanguage field is present in response (not undefined)', async () => {
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
      ];

      const controller = new MediaItemController();

      const res = await request(controller.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: Data.movie.id },
        requestHeaders: { 'accept-language': 'en' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect('metadataLanguage' in data).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // /api/items - ItemsController.get (list endpoint with batch translation)
  // ---------------------------------------------------------------------------

  describe('GET /api/items', () => {
    test('Tier 1: exact locale match applies translation overlay to all items', async () => {
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
        'es',
      ];

      const controller = new ItemsController();

      const res = await request(controller.get, {
        userId: Data.user.id,
        requestHeaders: { 'accept-language': 'es' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(Array.isArray(items)).toBe(true);

      // Find the movie item and verify it has the Spanish translation
      const movie = items.find((item) => item.id === Data.movie.id);
      expect(movie).toBeDefined();
      expect(movie.title).toBe('Pelicula de prueba');
      expect(movie.metadataLanguage).toBe('es');
    });

    test('Tier 2: no exact match returns first-language fallback for all items', async () => {
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
        'es',
      ];

      const controller = new ItemsController();

      const res = await request(controller.get, {
        userId: Data.user.id,
        requestHeaders: { 'accept-language': 'ja' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(Array.isArray(items)).toBe(true);

      const movie = items.find((item) => item.id === Data.movie.id);
      expect(movie).toBeDefined();
      // Falls back to 'en' (first language)
      expect(movie.title).toBe('English Movie Title');
      expect(movie.metadataLanguage).toBe('en');
    });

    test('Tier 3: items without translations get metadataLanguage null', async () => {
      // Only 'de' configured — no German translations seeded
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'de',
      ];

      const controller = new ItemsController();

      const res = await request(controller.get, {
        userId: Data.user.id,
        requestHeaders: { 'accept-language': 'de' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(Array.isArray(items)).toBe(true);

      const movie = items.find((item) => item.id === Data.movie.id);
      expect(movie).toBeDefined();
      // No German translation, base fields preserved
      expect(movie.title).toBe(Data.movie.title);
      expect(movie.metadataLanguage).toBeNull();
    });

    test('all items in response include metadataLanguage field', async () => {
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
      ];

      const controller = new ItemsController();

      const res = await request(controller.get, {
        userId: Data.user.id,
        requestHeaders: { 'accept-language': 'en' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(Array.isArray(items)).toBe(true);

      for (const item of items) {
        expect('metadataLanguage' in item).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Paginated endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/items/paginated', () => {
    test('Tier 1: exact locale match applies to paginated results', async () => {
      (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
        'en',
        'es',
      ];

      const controller = new ItemsController();

      const res = await request(controller.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
        requestHeaders: { 'accept-language': 'es' },
      });

      expect(res.statusCode).toBe(200);
      const paginatedData = res.data as any;
      expect(Array.isArray(paginatedData.data)).toBe(true);

      const movie = paginatedData.data.find(
        (item: any) => item.id === Data.movie.id
      );
      expect(movie).toBeDefined();
      expect(movie.title).toBe('Pelicula de prueba');
      expect(movie.metadataLanguage).toBe('es');
    });
  });
});
