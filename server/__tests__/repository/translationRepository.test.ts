import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import {
  upsertMediaItemTranslation,
  MediaItemTranslationData,
} from 'src/repository/translationRepository';

/**
 * translationRepository tests.
 *
 * The translationRepository exposes:
 *   - upsertMediaItemTranslation(mediaItemId, language, data) -- inserts a new
 *     row or updates an existing one when the (mediaItemId, language) unique
 *     constraint conflicts.
 *
 * Database prerequisites:
 *   - A user row (required by FK chains)
 *   - A mediaItem row that the translations reference via mediaItemId FK
 *
 * The mediaItemTranslation table is cleaned between tests via afterEach
 * to guarantee isolation.
 */

describe('translationRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    // Seed prerequisite rows: user and a mediaItem (tv show from Data)
    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('mediaItem').insert(Data.movie);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('mediaItemTranslation').delete();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Read all rows from the mediaItemTranslation table. */
  async function getAllTranslations(): Promise<Record<string, unknown>[]> {
    return Database.knex('mediaItemTranslation').select('*');
  }

  /** Read a single translation row by mediaItemId + language. */
  async function getTranslation(
    mediaItemId: number,
    language: string
  ): Promise<Record<string, unknown> | undefined> {
    return Database.knex('mediaItemTranslation')
      .where({ mediaItemId, language })
      .first();
  }

  // ---------------------------------------------------------------------------
  // upsertMediaItemTranslation -- insert (new row)
  // ---------------------------------------------------------------------------

  describe('upsertMediaItemTranslation (insert new row)', () => {
    test('creates a new translation row when none exists for the (mediaItemId, language) pair', async () => {
      const data: MediaItemTranslationData = {
        title: 'Titre en francais',
        overview: 'Un apercu en francais',
        genres: ['Aventure', 'Fantaisie'],
      };

      await upsertMediaItemTranslation(Data.tvShow.id, 'fr', data);

      const rows = await getAllTranslations();
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row.mediaItemId).toBe(Data.tvShow.id);
      expect(row.language).toBe('fr');
      expect(row.title).toBe('Titre en francais');
      expect(row.overview).toBe('Un apercu en francais');
    });

    test('creates separate rows for different languages on the same mediaItem', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'English Title',
        overview: 'English overview',
        genres: ['Adventure'],
      });

      await upsertMediaItemTranslation(Data.tvShow.id, 'es', {
        title: 'Titulo en espanol',
        overview: 'Resumen en espanol',
        genres: ['Aventura'],
      });

      const rows = await getAllTranslations();
      expect(rows).toHaveLength(2);

      const enRow = await getTranslation(Data.tvShow.id, 'en');
      expect(enRow).toBeDefined();
      expect(enRow.title).toBe('English Title');

      const esRow = await getTranslation(Data.tvShow.id, 'es');
      expect(esRow).toBeDefined();
      expect(esRow.title).toBe('Titulo en espanol');
    });

    test('creates separate rows for different mediaItems with the same language', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'de', {
        title: 'TV Show Titel',
        overview: 'TV Show Ubersicht',
        genres: null,
      });

      await upsertMediaItemTranslation(Data.movie.id, 'de', {
        title: 'Film Titel',
        overview: 'Film Ubersicht',
        genres: null,
      });

      const rows = await getAllTranslations();
      expect(rows).toHaveLength(2);

      const tvRow = await getTranslation(Data.tvShow.id, 'de');
      expect(tvRow.title).toBe('TV Show Titel');

      const movieRow = await getTranslation(Data.movie.id, 'de');
      expect(movieRow.title).toBe('Film Titel');
    });
  });

  // ---------------------------------------------------------------------------
  // upsertMediaItemTranslation -- upsert (update existing row on conflict)
  // ---------------------------------------------------------------------------

  describe('upsertMediaItemTranslation (upsert on conflict)', () => {
    test('updates an existing row when (mediaItemId, language) conflict occurs', async () => {
      // Insert initial row
      await upsertMediaItemTranslation(Data.tvShow.id, 'fr', {
        title: 'Ancien titre',
        overview: 'Ancien apercu',
        genres: ['Action'],
      });

      // Upsert with new data for the same (mediaItemId, language) pair
      await upsertMediaItemTranslation(Data.tvShow.id, 'fr', {
        title: 'Nouveau titre',
        overview: 'Nouveau apercu',
        genres: ['Comedie', 'Drame'],
      });

      // Should still be only one row
      const rows = await getAllTranslations();
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row.title).toBe('Nouveau titre');
      expect(row.overview).toBe('Nouveau apercu');
    });

    test('upsert preserves the same id (single row, no duplicates)', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'Original',
        overview: 'Original overview',
        genres: null,
      });

      const firstRow = await getTranslation(Data.tvShow.id, 'en');
      const firstId = firstRow.id;

      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'Updated',
        overview: 'Updated overview',
        genres: ['Drama'],
      });

      const rows = await getAllTranslations();
      expect(rows).toHaveLength(1);

      const updatedRow = rows[0];
      // The id should remain the same (SQLite onConflict merge behavior)
      expect(updatedRow.id).toBe(firstId);
      expect(updatedRow.title).toBe('Updated');
    });
  });

  // ---------------------------------------------------------------------------
  // upsertMediaItemTranslation -- genres JSON serialization
  // ---------------------------------------------------------------------------

  describe('upsertMediaItemTranslation (genres JSON storage)', () => {
    test('stores genres as a JSON stringified array', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'Test',
        overview: 'Test overview',
        genres: ['Action', 'Comedy', 'Drama'],
      });

      const row = await getTranslation(Data.tvShow.id, 'en');
      expect(row).toBeDefined();

      // The raw DB value should be a JSON string
      const rawGenres = row.genres as string;
      expect(typeof rawGenres).toBe('string');

      const parsed = JSON.parse(rawGenres);
      expect(parsed).toEqual(['Action', 'Comedy', 'Drama']);
    });

    test('stores an empty genres array as JSON "[]" when provided as empty array', async () => {
      // Note: The application layer converts empty arrays to null before calling,
      // but if called directly with an empty array, it should still serialize correctly.
      await upsertMediaItemTranslation(Data.tvShow.id, 'ja', {
        title: 'Test',
        overview: null,
        genres: [],
      });

      const row = await getTranslation(Data.tvShow.id, 'ja');
      expect(row).toBeDefined();

      const rawGenres = row.genres as string;
      const parsed = JSON.parse(rawGenres);
      expect(parsed).toEqual([]);
    });

    test('stores single-element genres array correctly', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'ko', {
        title: 'Test',
        overview: null,
        genres: ['Horror'],
      });

      const row = await getTranslation(Data.tvShow.id, 'ko');
      const parsed = JSON.parse(row.genres as string);
      expect(parsed).toEqual(['Horror']);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertMediaItemTranslation -- null handling
  // ---------------------------------------------------------------------------

  describe('upsertMediaItemTranslation (null value handling)', () => {
    test('stores null title correctly', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: null,
        overview: 'Some overview',
        genres: ['Action'],
      });

      const row = await getTranslation(Data.tvShow.id, 'en');
      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBe('Some overview');
    });

    test('stores null overview correctly', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'Some title',
        overview: null,
        genres: ['Action'],
      });

      const row = await getTranslation(Data.tvShow.id, 'en');
      expect(row).toBeDefined();
      expect(row.overview).toBeNull();
      expect(row.title).toBe('Some title');
    });

    test('stores null genres correctly', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: 'Some title',
        overview: 'Some overview',
        genres: null,
      });

      const row = await getTranslation(Data.tvShow.id, 'en');
      expect(row).toBeDefined();
      expect(row.genres).toBeNull();
    });

    test('stores all null values correctly', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'en', {
        title: null,
        overview: null,
        genres: null,
      });

      const row = await getTranslation(Data.tvShow.id, 'en');
      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBeNull();
      expect(row.genres).toBeNull();
      // Required fields should still be set
      expect(row.mediaItemId).toBe(Data.tvShow.id);
      expect(row.language).toBe('en');
    });

    test('treats undefined data fields as null via nullish coalescing', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'pt', {
        // title, overview, genres are all undefined (not provided)
      });

      const row = await getTranslation(Data.tvShow.id, 'pt');
      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBeNull();
      expect(row.genres).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // upsertMediaItemTranslation -- upsert can overwrite non-null with null
  // ---------------------------------------------------------------------------

  describe('upsertMediaItemTranslation (overwrite with null)', () => {
    test('can overwrite a non-null title with null on upsert', async () => {
      await upsertMediaItemTranslation(Data.tvShow.id, 'it', {
        title: 'Titolo italiano',
        overview: 'Panoramica',
        genres: ['Azione'],
      });

      // Now upsert with null title
      await upsertMediaItemTranslation(Data.tvShow.id, 'it', {
        title: null,
        overview: 'Panoramica aggiornata',
        genres: null,
      });

      const row = await getTranslation(Data.tvShow.id, 'it');
      expect(row).toBeDefined();
      expect(row.title).toBeNull();
      expect(row.overview).toBe('Panoramica aggiornata');
      expect(row.genres).toBeNull();
    });
  });
});
