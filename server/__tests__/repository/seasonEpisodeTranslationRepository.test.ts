import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import {
  upsertSeasonTranslation,
  upsertEpisodeTranslation,
  SeasonTranslationData,
  EpisodeTranslationData,
} from 'src/repository/translationRepository';

/**
 * Season and episode translation repository tests.
 *
 * Tests for:
 *   - upsertSeasonTranslation(seasonId, language, data)
 *   - upsertEpisodeTranslation(episodeId, language, data)
 *
 * Both follow the same onConflict().merge() pattern as upsertMediaItemTranslation.
 *
 * Database prerequisites:
 *   - user → mediaItem (tvShow) → season → episode rows
 */

describe('seasonEpisodeTranslationRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    // Seed prerequisite rows in dependency order
    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('episode').insert(Data.episode2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('episodeTranslation').delete();
    await Database.knex('seasonTranslation').delete();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function getAllSeasonTranslations(): Promise<Record<string, unknown>[]> {
    return Database.knex('seasonTranslation').select('*');
  }

  async function getSeasonTranslation(
    seasonId: number,
    language: string
  ): Promise<Record<string, unknown> | undefined> {
    return Database.knex('seasonTranslation')
      .where({ seasonId, language })
      .first();
  }

  async function getAllEpisodeTranslations(): Promise<Record<string, unknown>[]> {
    return Database.knex('episodeTranslation').select('*');
  }

  async function getEpisodeTranslation(
    episodeId: number,
    language: string
  ): Promise<Record<string, unknown> | undefined> {
    return Database.knex('episodeTranslation')
      .where({ episodeId, language })
      .first();
  }

  // ===========================================================================
  // upsertSeasonTranslation
  // ===========================================================================

  describe('upsertSeasonTranslation', () => {
    // -------------------------------------------------------------------------
    // Insert new row
    // -------------------------------------------------------------------------

    describe('insert new row', () => {
      test('creates a new translation row when none exists for (seasonId, language)', async () => {
        const data: SeasonTranslationData = {
          title: 'Temporada 1',
          description: 'La primera temporada de la serie.',
        };

        await upsertSeasonTranslation(Data.season.id, 'es', data);

        const rows = await getAllSeasonTranslations();
        expect(rows).toHaveLength(1);

        const row = rows[0];
        expect(row.seasonId).toBe(Data.season.id);
        expect(row.language).toBe('es');
        expect(row.title).toBe('Temporada 1');
        expect(row.description).toBe('La primera temporada de la serie.');
      });

      test('creates separate rows for different languages on the same season', async () => {
        await upsertSeasonTranslation(Data.season.id, 'en', {
          title: 'Season 1',
          description: 'The first season.',
        });

        await upsertSeasonTranslation(Data.season.id, 'fr', {
          title: 'Saison 1',
          description: 'La premiere saison.',
        });

        const rows = await getAllSeasonTranslations();
        expect(rows).toHaveLength(2);

        const enRow = await getSeasonTranslation(Data.season.id, 'en');
        expect(enRow.title).toBe('Season 1');

        const frRow = await getSeasonTranslation(Data.season.id, 'fr');
        expect(frRow.title).toBe('Saison 1');
      });
    });

    // -------------------------------------------------------------------------
    // Upsert on conflict
    // -------------------------------------------------------------------------

    describe('upsert on conflict', () => {
      test('updates an existing row when (seasonId, language) conflict occurs', async () => {
        await upsertSeasonTranslation(Data.season.id, 'de', {
          title: 'Staffel 1 (alt)',
          description: 'Alte Beschreibung',
        });

        await upsertSeasonTranslation(Data.season.id, 'de', {
          title: 'Staffel 1 (neu)',
          description: 'Neue Beschreibung',
        });

        const rows = await getAllSeasonTranslations();
        expect(rows).toHaveLength(1);

        const row = rows[0];
        expect(row.title).toBe('Staffel 1 (neu)');
        expect(row.description).toBe('Neue Beschreibung');
      });
    });

    // -------------------------------------------------------------------------
    // Null handling
    // -------------------------------------------------------------------------

    describe('null handling', () => {
      test('stores null title correctly', async () => {
        await upsertSeasonTranslation(Data.season.id, 'pt', {
          title: null,
          description: 'Descricao da temporada',
        });

        const row = await getSeasonTranslation(Data.season.id, 'pt');
        expect(row.title).toBeNull();
        expect(row.description).toBe('Descricao da temporada');
      });

      test('stores null description correctly', async () => {
        await upsertSeasonTranslation(Data.season.id, 'it', {
          title: 'Stagione 1',
          description: null,
        });

        const row = await getSeasonTranslation(Data.season.id, 'it');
        expect(row.title).toBe('Stagione 1');
        expect(row.description).toBeNull();
      });

      test('stores all null values correctly', async () => {
        await upsertSeasonTranslation(Data.season.id, 'ja', {
          title: null,
          description: null,
        });

        const row = await getSeasonTranslation(Data.season.id, 'ja');
        expect(row.title).toBeNull();
        expect(row.description).toBeNull();
        expect(row.seasonId).toBe(Data.season.id);
        expect(row.language).toBe('ja');
      });

      test('treats undefined data fields as null via nullish coalescing', async () => {
        await upsertSeasonTranslation(Data.season.id, 'ko', {});

        const row = await getSeasonTranslation(Data.season.id, 'ko');
        expect(row.title).toBeNull();
        expect(row.description).toBeNull();
      });

      test('can overwrite a non-null title with null on upsert', async () => {
        await upsertSeasonTranslation(Data.season.id, 'zh', {
          title: 'Original Title',
          description: 'Original Description',
        });

        await upsertSeasonTranslation(Data.season.id, 'zh', {
          title: null,
          description: 'Updated Description',
        });

        const row = await getSeasonTranslation(Data.season.id, 'zh');
        expect(row.title).toBeNull();
        expect(row.description).toBe('Updated Description');
      });
    });
  });

  // ===========================================================================
  // upsertEpisodeTranslation
  // ===========================================================================

  describe('upsertEpisodeTranslation', () => {
    // -------------------------------------------------------------------------
    // Insert new row
    // -------------------------------------------------------------------------

    describe('insert new row', () => {
      test('creates a new translation row when none exists for (episodeId, language)', async () => {
        const data: EpisodeTranslationData = {
          title: 'Episodio Uno',
          description: 'El primer episodio de la serie.',
        };

        await upsertEpisodeTranslation(Data.episode.id, 'es', data);

        const rows = await getAllEpisodeTranslations();
        expect(rows).toHaveLength(1);

        const row = rows[0];
        expect(row.episodeId).toBe(Data.episode.id);
        expect(row.language).toBe('es');
        expect(row.title).toBe('Episodio Uno');
        expect(row.description).toBe('El primer episodio de la serie.');
      });

      test('creates separate rows for different languages on the same episode', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'en', {
          title: 'Episode 1',
          description: 'The first episode.',
        });

        await upsertEpisodeTranslation(Data.episode.id, 'fr', {
          title: 'Episode 1',
          description: 'Le premier episode.',
        });

        const rows = await getAllEpisodeTranslations();
        expect(rows).toHaveLength(2);

        const enRow = await getEpisodeTranslation(Data.episode.id, 'en');
        expect(enRow.title).toBe('Episode 1');

        const frRow = await getEpisodeTranslation(Data.episode.id, 'fr');
        expect(frRow.description).toBe('Le premier episode.');
      });

      test('creates separate rows for different episodes with the same language', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'de', {
          title: 'Folge 1',
          description: 'Die erste Folge.',
        });

        await upsertEpisodeTranslation(Data.episode2.id, 'de', {
          title: 'Folge 2',
          description: 'Die zweite Folge.',
        });

        const rows = await getAllEpisodeTranslations();
        expect(rows).toHaveLength(2);

        const ep1Row = await getEpisodeTranslation(Data.episode.id, 'de');
        expect(ep1Row.title).toBe('Folge 1');

        const ep2Row = await getEpisodeTranslation(Data.episode2.id, 'de');
        expect(ep2Row.title).toBe('Folge 2');
      });
    });

    // -------------------------------------------------------------------------
    // Upsert on conflict
    // -------------------------------------------------------------------------

    describe('upsert on conflict', () => {
      test('updates an existing row when (episodeId, language) conflict occurs', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'it', {
          title: 'Titolo Vecchio',
          description: 'Descrizione Vecchia',
        });

        await upsertEpisodeTranslation(Data.episode.id, 'it', {
          title: 'Titolo Nuovo',
          description: 'Descrizione Nuova',
        });

        const rows = await getAllEpisodeTranslations();
        expect(rows).toHaveLength(1);

        const row = rows[0];
        expect(row.title).toBe('Titolo Nuovo');
        expect(row.description).toBe('Descrizione Nuova');
      });

      test('upsert preserves the same id (single row, no duplicates)', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'en', {
          title: 'Original',
          description: 'Original description',
        });

        const firstRow = await getEpisodeTranslation(Data.episode.id, 'en');
        const firstId = firstRow.id;

        await upsertEpisodeTranslation(Data.episode.id, 'en', {
          title: 'Updated',
          description: 'Updated description',
        });

        const rows = await getAllEpisodeTranslations();
        expect(rows).toHaveLength(1);

        const updatedRow = rows[0];
        expect(updatedRow.id).toBe(firstId);
        expect(updatedRow.title).toBe('Updated');
      });
    });

    // -------------------------------------------------------------------------
    // Null handling
    // -------------------------------------------------------------------------

    describe('null handling', () => {
      test('stores null title correctly', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'pt', {
          title: null,
          description: 'Descricao do episodio',
        });

        const row = await getEpisodeTranslation(Data.episode.id, 'pt');
        expect(row.title).toBeNull();
        expect(row.description).toBe('Descricao do episodio');
      });

      test('stores null description correctly', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'ja', {
          title: 'Episode Title',
          description: null,
        });

        const row = await getEpisodeTranslation(Data.episode.id, 'ja');
        expect(row.title).toBe('Episode Title');
        expect(row.description).toBeNull();
      });

      test('treats undefined data fields as null via nullish coalescing', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'ko', {});

        const row = await getEpisodeTranslation(Data.episode.id, 'ko');
        expect(row.title).toBeNull();
        expect(row.description).toBeNull();
      });

      test('can overwrite a non-null value with null on upsert', async () => {
        await upsertEpisodeTranslation(Data.episode.id, 'zh', {
          title: 'Original Title',
          description: 'Original Description',
        });

        await upsertEpisodeTranslation(Data.episode.id, 'zh', {
          title: null,
          description: null,
        });

        const row = await getEpisodeTranslation(Data.episode.id, 'zh');
        expect(row.title).toBeNull();
        expect(row.description).toBeNull();
      });
    });
  });
});
