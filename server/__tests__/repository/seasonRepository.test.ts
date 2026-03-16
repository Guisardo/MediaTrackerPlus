import { Database } from 'src/dbconfig';
import { TvSeason } from 'src/entity/tvseason';
import { tvSeasonRepository } from 'src/repository/season';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * tvSeasonRepository tests.
 *
 * The TvSeasonRepository extends the generic repository with boolean
 * serialisation/deserialisation for the `isSpecialSeason` column.
 *
 * These tests verify:
 *   - create()   — inserts a season and returns its id
 *   - findOne()  — retrieves a season by id or other fields
 *   - find()     — retrieves all seasons for a TV show
 *   - update()   — modifies season fields
 *   - delete()   — removes a season from the database
 *
 * Database prerequisites (inserted once in beforeAll):
 *   - user (Data.user)       — not directly FK'd to season but kept for
 *                               symmetry with the rest of the test suite
 *   - tvShow mediaItem (Data.tvShow) — required as the FK parent for seasons
 *
 * A second TV show (tvShow2) is inserted inline where cross-show isolation
 * must be verified.
 */

const tvShow2 = {
  id: 10,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'tmdb',
  title: 'Another TV Show',
  externalPosterUrl: 'posterUrl2',
  externalBackdropUrl: 'backdropUrl2',
  releaseDate: '2010-01-01',
  runtime: 45,
  tmdbId: 999001,
};

describe('tvSeasonRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('mediaItem').insert(tvShow2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('season').delete();
  });

  // ---------------------------------------------------------------------------
  // create — add a season to a TV show
  // ---------------------------------------------------------------------------

  describe('create (add a season to a TV show)', () => {
    test('inserts a season and returns a numeric id', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Season 1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      expect(typeof id).toBe('number');
    });

    test('the inserted row contains the correct tvShowId and seasonNumber', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 2,
        title: 'Season 2',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 8,
      });

      const row: TvSeason = await Database.knex('season').where({ id }).first();

      expect(row.tvShowId).toBe(Data.tvShow.id);
      expect(row.seasonNumber).toBe(2);
    });

    test('stores all optional fields — title, description, releaseDate, numberOfEpisodes, tmdbId', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 3,
        title: 'The Third Season',
        description: 'Things get complicated.',
        releaseDate: '2022-03-15',
        numberOfEpisodes: 12,
        tmdbId: 88888,
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
      });

      const row: TvSeason = await Database.knex('season').where({ id }).first();

      expect(row.title).toBe('The Third Season');
      expect(row.description).toBe('Things get complicated.');
      expect(row.releaseDate).toBe('2022-03-15');
      expect(row.numberOfEpisodes).toBe(12);
      expect(row.tmdbId).toBe(88888);
    });

    test('stores isSpecialSeason = true and deserialises it as a boolean', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 0,
        title: 'Specials',
        isSpecialSeason: true,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 5,
      });

      const found = (await tvSeasonRepository.findOne({ id }))!;

      expect(found.isSpecialSeason).toBe(true);
      expect(typeof found.isSpecialSeason).toBe('boolean');
    });

    test('stores isSpecialSeason = false and deserialises it as a boolean', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 4,
        title: 'Season 4',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      const found = (await tvSeasonRepository.findOne({ id }))!;

      expect(found.isSpecialSeason).toBe(false);
      expect(typeof found.isSpecialSeason).toBe('boolean');
    });

    test('allows two different shows to each have a season with the same seasonNumber', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show 1 - Season 1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show 2 - Season 1',
        isSpecialSeason: false,
        tvShowId: tvShow2.id,
        numberOfEpisodes: 10,
      });

      const show1Seasons: TvSeason[] = await Database.knex('season').where({
        tvShowId: Data.tvShow.id,
        seasonNumber: 1,
      });
      const show2Seasons: TvSeason[] = await Database.knex('season').where({
        tvShowId: tvShow2.id,
        seasonNumber: 1,
      });

      expect(show1Seasons).toHaveLength(1);
      expect(show2Seasons).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — retrieve a single season
  // ---------------------------------------------------------------------------

  describe('findOne (retrieve a single season)', () => {
    test('returns the correct season by id', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Findable Season',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 6,
      });

      const found = (await tvSeasonRepository.findOne({ id }))!;

      expect(found).toBeDefined();
      expect(found.id).toBe(id);
      expect(found.title).toBe('Findable Season');
    });

    test('returns undefined when the id does not exist', async () => {
      const found = await tvSeasonRepository.findOne({ id: 999999 });

      expect(found).toBeUndefined();
    });

    test('can query by tvShowId and seasonNumber', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 5,
        title: 'Season 5',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 8,
      });

      const found = (await tvSeasonRepository.findOne({
        tvShowId: Data.tvShow.id,
        seasonNumber: 5,
      }))!;

      expect(found).toBeDefined();
      expect(found.tvShowId).toBe(Data.tvShow.id);
      expect(found.seasonNumber).toBe(5);
    });

    test('returns a deserialized boolean for isSpecialSeason', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 0,
        title: 'Boolean Deserialise Test',
        isSpecialSeason: true,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 3,
      });

      const found = (await tvSeasonRepository.findOne({ id }))!;

      expect(typeof found.isSpecialSeason).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // find — retrieve all seasons for a TV show
  // ---------------------------------------------------------------------------

  describe('find (retrieve all seasons for a TV show)', () => {
    test('returns all seasons belonging to the given TV show', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'S1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      await tvSeasonRepository.create({
        seasonNumber: 2,
        title: 'S2',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      await tvSeasonRepository.create({
        seasonNumber: 3,
        title: 'S3',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      const seasons = await tvSeasonRepository.find({
        tvShowId: Data.tvShow.id,
      });

      expect(seasons.length).toBeGreaterThanOrEqual(3);
      seasons.forEach((s) => expect(s.tvShowId).toBe(Data.tvShow.id));
    });

    test('returns an empty array when the TV show has no seasons', async () => {
      const seasons = await tvSeasonRepository.find({ tvShowId: 999999 });

      expect(seasons).toEqual([]);
    });

    test('does not return seasons belonging to a different TV show', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show1 S1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show2 S1',
        isSpecialSeason: false,
        tvShowId: tvShow2.id,
        numberOfEpisodes: 10,
      });

      const show1Seasons = await tvSeasonRepository.find({
        tvShowId: Data.tvShow.id,
      });

      show1Seasons.forEach((s) => expect(s.tvShowId).toBe(Data.tvShow.id));

      const titles = show1Seasons.map((s) => s.title);
      expect(titles).not.toContain('Show2 S1');
    });

    test('returns all seasons including special seasons', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 0,
        title: 'Specials',
        isSpecialSeason: true,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 5,
      });
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Season 1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      const seasons = await tvSeasonRepository.find({
        tvShowId: Data.tvShow.id,
      });

      const specialSeasons = seasons.filter((s) => s.isSpecialSeason === true);
      const regularSeasons = seasons.filter((s) => s.isSpecialSeason === false);

      expect(specialSeasons.length).toBeGreaterThanOrEqual(1);
      expect(regularSeasons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // update — modify season fields
  // ---------------------------------------------------------------------------

  describe('update (modify season fields)', () => {
    test('updates the title of a season', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Old Title',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.update({ id, title: 'New Title' });

      const updated = (await tvSeasonRepository.findOne({ id }))!;

      expect(updated.title).toBe('New Title');
    });

    test('updates the numberOfEpisodes field', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 2,
        title: 'Season 2',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.update({ id, numberOfEpisodes: 13 });

      const updated = (await tvSeasonRepository.findOne({ id }))!;

      expect(updated.numberOfEpisodes).toBe(13);
    });

    test('updates the releaseDate field', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 3,
        title: 'Season 3',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        releaseDate: '2020-01-01',
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.update({ id, releaseDate: '2021-06-01' });

      const updated = (await tvSeasonRepository.findOne({ id }))!;

      expect(updated.releaseDate).toBe('2021-06-01');
    });

    test('updates the description field', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 4,
        title: 'Season 4',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.update({
        id,
        description: 'A brand new description.',
      });

      const updated = (await tvSeasonRepository.findOne({ id }))!;

      expect(updated.description).toBe('A brand new description.');
    });

    test('updating one season does not affect other seasons of the same show', async () => {
      const idA = await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Season A',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      const idB = await tvSeasonRepository.create({
        seasonNumber: 2,
        title: 'Season B',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.update({ id: idA, title: 'Season A - Updated' });

      const seasonB = (await tvSeasonRepository.findOne({ id: idB }))!;

      expect(seasonB.title).toBe('Season B');
    });
  });

  // ---------------------------------------------------------------------------
  // delete — remove a season
  // ---------------------------------------------------------------------------

  describe('delete (remove a season)', () => {
    test('removes a season from the database by id', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 9,
        title: 'To Be Deleted',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.delete({ id });

      const found = await tvSeasonRepository.findOne({ id });

      expect(found).toBeUndefined();
    });

    test('delete is idempotent — deleting a non-existent id does not throw', async () => {
      await expect(
        tvSeasonRepository.delete({ id: 777777 })
      ).resolves.not.toThrow();
    });

    test('deleting by tvShowId removes all seasons for that show', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'S1',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      await tvSeasonRepository.create({
        seasonNumber: 2,
        title: 'S2',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.delete({ tvShowId: Data.tvShow.id });

      const remaining = await tvSeasonRepository.find({
        tvShowId: Data.tvShow.id,
      });

      expect(remaining).toHaveLength(0);
    });

    test('deleting seasons for one show does not affect seasons of another show', async () => {
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show1 Season',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });
      await tvSeasonRepository.create({
        seasonNumber: 1,
        title: 'Show2 Season',
        isSpecialSeason: false,
        tvShowId: tvShow2.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.delete({ tvShowId: Data.tvShow.id });

      const show2Seasons = await tvSeasonRepository.find({
        tvShowId: tvShow2.id,
      });

      expect(show2Seasons.length).toBeGreaterThanOrEqual(1);
      show2Seasons.forEach((s) => expect(s.tvShowId).toBe(tvShow2.id));
    });

    test('after deletion the season is no longer returned by find', async () => {
      const id = await tvSeasonRepository.create({
        seasonNumber: 7,
        title: 'Ephemeral Season',
        isSpecialSeason: false,
        tvShowId: Data.tvShow.id,
        numberOfEpisodes: 10,
      });

      await tvSeasonRepository.delete({ id });

      const all = await tvSeasonRepository.find({ tvShowId: Data.tvShow.id });
      const deleted = all.find((s) => s.id === id);

      expect(deleted).toBeUndefined();
    });
  });
});
