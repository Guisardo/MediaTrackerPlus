import knexLib, { Knex } from 'knex';
import { Config } from 'src/config';
import { InitialData } from '__tests__/__utils__/data';

// Use an isolated in-memory database for all tests in this file to avoid
// interfering with parallel tests that share data.db. Migration tests that
// exercise DROP TABLE (migrate.down) must never touch the shared database.
let knex: Knex;

describe('translationTables migration', () => {
  beforeAll(async () => {
    knex = knexLib({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
      migrations: {
        extension: Config.MIGRATIONS_EXTENSION,
      },
    });

    // Apply migrations up to (but not including) translationTables so that
    // test 1 can explicitly apply the migration under test.
    await knex.migrate.up({
      name: `20210818142342_init.${Config.MIGRATIONS_EXTENSION}`,
      directory: Config.MIGRATIONS_DIRECTORY,
    });

    await knex('user').insert(InitialData.user);
    await knex('configuration').insert(InitialData.configuration);
    await knex('mediaItem').insert(InitialData.mediaItem);
    await knex('season').insert(InitialData.season);
    await knex('episode').insert(InitialData.episode);
  });

  afterAll(async () => {
    await knex.destroy();
  });

  test('20260314000000_translationTables creates three translation tables', async () => {
    await knex.migrate.up({
      name: `20260314000000_translationTables.${Config.MIGRATIONS_EXTENSION}`,
      directory: Config.MIGRATIONS_DIRECTORY,
    });

    // Check that all three tables exist
    const hasMediaItemTranslation =
      await knex.schema.hasTable('mediaItemTranslation');
    const hasSeasonTranslation =
      await knex.schema.hasTable('seasonTranslation');
    const hasEpisodeTranslation =
      await knex.schema.hasTable('episodeTranslation');

    expect(hasMediaItemTranslation).toBe(true);
    expect(hasSeasonTranslation).toBe(true);
    expect(hasEpisodeTranslation).toBe(true);

    // Check columns on mediaItemTranslation
    const columns = await knex.raw("PRAGMA table_info(mediaItemTranslation);");
    const columnNames = columns.map((col: { name: string }) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('mediaItemId');
    expect(columnNames).toContain('language');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('overview');
    expect(columnNames).toContain('genres');
  });

  test('mediaItemTranslation upsert behavior via onConflict merge', async () => {
    const mediaItemId = InitialData.mediaItem.id;

    // Insert first translation (stringify genres for SQLite)
    await knex('mediaItemTranslation').insert({
      mediaItemId,
      language: 'en',
      title: 'Movie Title EN',
      overview: 'Overview EN',
      genres: JSON.stringify(['action', 'thriller']),
    });

    // Verify insertion
    let result = await knex('mediaItemTranslation')
      .where({ mediaItemId, language: 'en' })
      .first();
    expect(result).toBeDefined();
    expect(result?.title).toBe('Movie Title EN');

    // Upsert with same (mediaItemId, language) — should merge/update
    await knex('mediaItemTranslation')
      .insert({
        mediaItemId,
        language: 'en',
        title: 'Movie Title EN Updated',
        overview: 'Overview EN Updated',
        genres: JSON.stringify(['action']),
      })
      .onConflict(['mediaItemId', 'language'])
      .merge();

    // Verify the update
    result = await knex('mediaItemTranslation')
      .where({ mediaItemId, language: 'en' })
      .first();
    expect(result?.title).toBe('Movie Title EN Updated');
    expect(result?.overview).toBe('Overview EN Updated');

    // Verify we still have exactly one row (not two)
    const count = await knex('mediaItemTranslation')
      .where({ mediaItemId, language: 'en' })
      .count('* as cnt')
      .first();
    expect(count?.cnt).toBe(1);
  });

  test('seasonTranslation and episodeTranslation tables work correctly', async () => {
    const seasonId = InitialData.season.id;
    const episodeId = InitialData.episode.id;

    // Insert season translation
    await knex('seasonTranslation').insert({
      seasonId,
      language: 'en',
      title: 'Season 1',
      description: 'First season description',
    });

    // Insert episode translation
    await knex('episodeTranslation').insert({
      episodeId,
      language: 'en',
      title: 'Episode 1',
      description: 'First episode description',
    });

    // Verify season translation
    const seasonResult = await knex('seasonTranslation')
      .where({ seasonId, language: 'en' })
      .first();
    expect(seasonResult).toBeDefined();
    expect(seasonResult?.title).toBe('Season 1');

    // Verify episode translation
    const episodeResult = await knex('episodeTranslation')
      .where({ episodeId, language: 'en' })
      .first();
    expect(episodeResult).toBeDefined();
    expect(episodeResult?.title).toBe('Episode 1');
  });

  test('ON DELETE CASCADE works for all translation tables', async () => {
    const testMediaItemId = 999;
    const testSeasonId = 999;
    const testEpisodeId = 999;

    await knex('mediaItem').insert({
      id: testMediaItemId,
      title: 'Test Item for Cascade',
      source: 'user',
      lastTimeUpdated: new Date().getTime(),
    });

    await knex('season').insert({
      id: testSeasonId,
      tvShowId: InitialData.mediaItem.id,
      seasonNumber: 99,
      numberOfEpisodes: 1,
      title: 'Test Season 99',
      isSpecialSeason: false,
    });

    await knex('episode').insert({
      id: testEpisodeId,
      tvShowId: InitialData.mediaItem.id,
      seasonId: testSeasonId,
      seasonNumber: 99,
      episodeNumber: 1,
      title: 'Test Episode 1',
      isSpecialEpisode: false,
      seasonAndEpisodeNumber: 9901,
    });

    await knex('mediaItemTranslation').insert({
      mediaItemId: testMediaItemId,
      language: 'en',
      title: 'Test Translation',
    });
    await knex('seasonTranslation').insert({
      seasonId: testSeasonId,
      language: 'en',
      title: 'Test Season Translation',
    });
    await knex('episodeTranslation').insert({
      episodeId: testEpisodeId,
      language: 'en',
      title: 'Test Episode Translation',
    });

    // Verify translations exist
    let mediaCount = await knex('mediaItemTranslation')
      .where({ mediaItemId: testMediaItemId })
      .count('* as cnt')
      .first();
    expect(mediaCount?.cnt).toBe(1);

    let seasonCount = await knex('seasonTranslation')
      .where({ seasonId: testSeasonId })
      .count('* as cnt')
      .first();
    expect(seasonCount?.cnt).toBe(1);

    let episodeCount = await knex('episodeTranslation')
      .where({ episodeId: testEpisodeId })
      .count('* as cnt')
      .first();
    expect(episodeCount?.cnt).toBe(1);

    // Delete parents; translations should cascade-delete
    await knex('episode').where({ id: testEpisodeId }).delete();
    await knex('season').where({ id: testSeasonId }).delete();
    await knex('mediaItem').where({ id: testMediaItemId }).delete();

    mediaCount = await knex('mediaItemTranslation')
      .where({ mediaItemId: testMediaItemId })
      .count('* as cnt')
      .first();
    expect(mediaCount?.cnt).toBe(0);

    seasonCount = await knex('seasonTranslation')
      .where({ seasonId: testSeasonId })
      .count('* as cnt')
      .first();
    expect(seasonCount?.cnt).toBe(0);

    episodeCount = await knex('episodeTranslation')
      .where({ episodeId: testEpisodeId })
      .count('* as cnt')
      .first();
    expect(episodeCount?.cnt).toBe(0);
  });

  test('migration down drops all three tables in correct order', async () => {
    // Verify tables exist before rollback
    let hasMediaItemTranslation =
      await knex.schema.hasTable('mediaItemTranslation');
    let hasSeasonTranslation = await knex.schema.hasTable('seasonTranslation');
    let hasEpisodeTranslation =
      await knex.schema.hasTable('episodeTranslation');

    expect(hasMediaItemTranslation).toBe(true);
    expect(hasSeasonTranslation).toBe(true);
    expect(hasEpisodeTranslation).toBe(true);

    // Roll back the translationTables migration
    await knex.migrate.down({
      directory: Config.MIGRATIONS_DIRECTORY,
    });

    // Verify tables are dropped
    hasMediaItemTranslation =
      await knex.schema.hasTable('mediaItemTranslation');
    hasSeasonTranslation = await knex.schema.hasTable('seasonTranslation');
    hasEpisodeTranslation = await knex.schema.hasTable('episodeTranslation');

    expect(hasMediaItemTranslation).toBe(false);
    expect(hasSeasonTranslation).toBe(false);
    expect(hasEpisodeTranslation).toBe(false);

    // Re-apply to test idempotency (hasTable guard inside migration)
    await knex.migrate.up({
      name: `20260314000000_translationTables.${Config.MIGRATIONS_EXTENSION}`,
      directory: Config.MIGRATIONS_DIRECTORY,
    });

    hasMediaItemTranslation =
      await knex.schema.hasTable('mediaItemTranslation');
    hasSeasonTranslation = await knex.schema.hasTable('seasonTranslation');
    hasEpisodeTranslation = await knex.schema.hasTable('episodeTranslation');

    expect(hasMediaItemTranslation).toBe(true);
    expect(hasSeasonTranslation).toBe(true);
    expect(hasEpisodeTranslation).toBe(true);
  });

  test('unique constraint on (mediaItemId, language) is enforced', async () => {
    const mediaItemId = InitialData.mediaItem.id;

    // Clean up any leftover rows from prior tests in this suite
    await knex('mediaItemTranslation').where({ mediaItemId, language: 'es' }).del();

    // Insert first translation
    await knex('mediaItemTranslation').insert({
      mediaItemId,
      language: 'es',
      title: 'Spanish Title',
    });

    // Attempt to insert duplicate (should fail without onConflict merge)
    await expect(
      knex('mediaItemTranslation').insert({
        mediaItemId,
        language: 'es',
        title: 'Duplicate',
      })
    ).rejects.toThrow();
  });
});
