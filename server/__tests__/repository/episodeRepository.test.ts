import { Database } from 'src/dbconfig';
import { TvEpisode } from 'src/entity/tvepisode';
import { tvEpisodeRepository } from 'src/repository/episode';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * episodeRepository tests.
 *
 * The EpisodeRepository extends the generic repository with two overrides:
 *  - create()      — automatically computes seasonAndEpisodeNumber
 *  - createMany()  — same computation for bulk inserts
 *
 * These tests also verify the inherited base operations (findOne, find,
 * update, delete) are functional.
 *
 * Database prerequisites:
 *   - A user row (required by FK chains in later tests)
 *   - A mediaItem row representing the TV show
 *   - A season row owned by that TV show
 */

describe('tvEpisodeRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('episode').delete();
  });

  // ---------------------------------------------------------------------------
  // create — single episode
  // ---------------------------------------------------------------------------

  describe('create', () => {
    test('inserts an episode and returns its id', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Pilot',
        episodeNumber: 1,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      expect(typeof id).toBe('number');
    });

    test('auto-calculates seasonAndEpisodeNumber as seasonNumber * 1000 + episodeNumber', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Episode 3',
        episodeNumber: 3,
        seasonNumber: 2,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      const row: TvEpisode = await Database.knex('episode').where({ id }).first();

      // seasonNumber(2) * 1000 + episodeNumber(3) = 2003
      expect(row.seasonAndEpisodeNumber).toBe(2003);
    });

    test('stores all provided fields correctly', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'The One With All The Tests',
        description: 'A great episode',
        episodeNumber: 5,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
        releaseDate: '2001-09-01',
        runtime: 42,
      });

      const row: TvEpisode = await Database.knex('episode').where({ id }).first();

      expect(row.title).toBe('The One With All The Tests');
      expect(row.description).toBe('A great episode');
      expect(row.episodeNumber).toBe(5);
      expect(row.seasonNumber).toBe(1);
      expect(row.seasonId).toBe(Data.season.id);
      expect(row.tvShowId).toBe(Data.tvShow.id);
      expect(row.releaseDate).toBe('2001-09-01');
      expect(row.runtime).toBe(42);
    });

    test('stores isSpecialEpisode as a boolean', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Special Episode',
        episodeNumber: 0,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: true,
      });

      const row = (await tvEpisodeRepository.findOne({ id }))!;

      expect(row.isSpecialEpisode).toBe(true);
    });

    test('stores a non-special episode as isSpecialEpisode = false', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Regular Episode',
        episodeNumber: 7,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      const row = (await tvEpisodeRepository.findOne({ id }))!;

      expect(row.isSpecialEpisode).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createMany — bulk insert
  // ---------------------------------------------------------------------------

  describe('createMany', () => {
    test('inserts multiple episodes in a single call', async () => {
      await tvEpisodeRepository.createMany([
        {
          title: 'E1',
          episodeNumber: 1,
          seasonNumber: 1,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
        {
          title: 'E2',
          episodeNumber: 2,
          seasonNumber: 1,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
        {
          title: 'E3',
          episodeNumber: 3,
          seasonNumber: 1,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
      ]);

      const rows: TvEpisode[] = await Database.knex('episode').where({
        tvShowId: Data.tvShow.id,
      });

      expect(rows).toHaveLength(3);
    });

    test('auto-calculates seasonAndEpisodeNumber for each episode in the batch', async () => {
      await tvEpisodeRepository.createMany([
        {
          title: 'S2E1',
          episodeNumber: 1,
          seasonNumber: 2,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
        {
          title: 'S2E4',
          episodeNumber: 4,
          seasonNumber: 2,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
      ]);

      const rows: TvEpisode[] = await Database.knex('episode')
        .where({ tvShowId: Data.tvShow.id })
        .orderBy('episodeNumber');

      const numbers = rows.map((r) => r.seasonAndEpisodeNumber);
      expect(numbers).toContain(2001);
      expect(numbers).toContain(2004);
    });

    test('handles an empty array without throwing', async () => {
      await expect(tvEpisodeRepository.createMany([])).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — retrieve a single episode
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    test('returns the correct episode by id', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Findable Episode',
        episodeNumber: 9,
        seasonNumber: 3,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      const found = (await tvEpisodeRepository.findOne({ id }))!;

      expect(found).toBeDefined();
      expect(found.id).toBe(id);
      expect(found.title).toBe('Findable Episode');
    });

    test('returns undefined when the id does not exist', async () => {
      const found = await tvEpisodeRepository.findOne({ id: 999999 });

      expect(found).toBeUndefined();
    });

    test('returns the episode with a deserialised boolean for isSpecialEpisode', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Boolean deserialise test',
        episodeNumber: 11,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      const found = (await tvEpisodeRepository.findOne({ id }))!;

      expect(typeof found.isSpecialEpisode).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // find — retrieve episodes for a season
  // ---------------------------------------------------------------------------

  describe('find (retrieve episodes for a season)', () => {
    test('returns all episodes belonging to a given season', async () => {
      await tvEpisodeRepository.createMany([
        {
          title: 'Season Find E1',
          episodeNumber: 1,
          seasonNumber: 1,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
        {
          title: 'Season Find E2',
          episodeNumber: 2,
          seasonNumber: 1,
          seasonId: Data.season.id,
          tvShowId: Data.tvShow.id,
          isSpecialEpisode: false,
        },
      ]);

      const episodes = await tvEpisodeRepository.find({
        seasonId: Data.season.id,
      });

      expect(episodes.length).toBeGreaterThanOrEqual(2);
      episodes.forEach((ep) => expect(ep.seasonId).toBe(Data.season.id));
    });

    test('returns an empty array when no episodes exist for the season', async () => {
      const episodes = await tvEpisodeRepository.find({ seasonId: 99999 });

      expect(episodes).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    test('updates the title of an episode', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Old Title',
        episodeNumber: 1,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      await tvEpisodeRepository.update({ id, title: 'New Title' });

      const updated = (await tvEpisodeRepository.findOne({ id }))!;

      expect(updated.title).toBe('New Title');
    });

    test('updates the releaseDate of an episode', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Date Update Episode',
        episodeNumber: 2,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
        releaseDate: '2000-01-01',
      });

      await tvEpisodeRepository.update({ id, releaseDate: '2005-06-15' });

      const updated = (await tvEpisodeRepository.findOne({ id }))!;

      expect(updated.releaseDate).toBe('2005-06-15');
    });

    test('updates the runtime of an episode', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'Runtime Update Episode',
        episodeNumber: 3,
        seasonNumber: 1,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
        runtime: 30,
      });

      await tvEpisodeRepository.update({ id, runtime: 55 });

      const updated = (await tvEpisodeRepository.findOne({ id }))!;

      expect(updated.runtime).toBe(55);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('removes an episode from the database', async () => {
      const id = await tvEpisodeRepository.create({
        title: 'To Be Deleted',
        episodeNumber: 99,
        seasonNumber: 9,
        seasonId: Data.season.id,
        tvShowId: Data.tvShow.id,
        isSpecialEpisode: false,
      });

      await tvEpisodeRepository.delete({ id });

      const found = await tvEpisodeRepository.findOne({ id });

      expect(found).toBeUndefined();
    });

    test('delete is idempotent — deleting a non-existent id does not throw', async () => {
      await expect(
        tvEpisodeRepository.delete({ id: 777777 })
      ).resolves.not.toThrow();
    });
  });
});
