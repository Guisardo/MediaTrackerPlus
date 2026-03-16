import { Database } from 'src/dbconfig';
import { Progress } from 'src/entity/progress';
import { progressRepository } from 'src/repository/progress';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * progressRepository tests.
 *
 * The ProgressRepository is a straight generic-repository extension that
 * persists in-progress / playback-state records for a given user + mediaItem
 * (or user + episode, for TV shows).
 *
 * Database prerequisites (inserted once in beforeAll):
 *   - user (Data.user)
 *   - user2 (Data.user2)         — for cross-user isolation tests
 *   - tvShow mediaItem (Data.tvShow)
 *   - movie mediaItem (Data.movie)
 *   - season (Data.season)
 *   - episode (Data.episode)     — for episode-level progress tests
 */

describe('progressRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('progress').delete();
  });

  // ---------------------------------------------------------------------------
  // create — add a new progress entry
  // ---------------------------------------------------------------------------

  describe('create (add a new progress entry)', () => {
    test('inserts a progress entry for a movie and returns a numeric id', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.45,
      });

      expect(typeof id).toBe('number');
    });

    test('the inserted row contains the correct userId and mediaItemId', async () => {
      const now = new Date().getTime();

      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: now,
        progress: 0.1,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.userId).toBe(Data.user.id);
      expect(row.mediaItemId).toBe(Data.movie.id);
      expect(row.date).toBe(now);
    });

    test('stores the optional progress fraction correctly', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.75,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.progress).toBe(0.75);
    });

    test('stores the optional duration in seconds', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        duration: 7440,
        progress: 0.5,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.duration).toBe(7440);
    });

    test('stores the optional action as "playing"', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        action: 'playing',
        progress: 0.5,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.action).toBe('playing');
    });

    test('stores the optional action as "paused"', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        action: 'paused',
        progress: 0.5,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.action).toBe('paused');
    });

    test('stores the optional device name', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        device: 'Apple TV',
        progress: 0.5,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.device).toBe('Apple TV');
    });

    test('stores episode-level progress when episodeId is provided', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
        progress: 0.3,
      });

      const row: Progress = await Database.knex('progress')
        .where({ id })
        .first();

      expect(row.episodeId).toBe(Data.episode.id);
      expect(row.mediaItemId).toBe(Data.tvShow.id);
    });

    test('allows two different users to have concurrent progress on the same item', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.5,
      });

      await progressRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.2,
      });

      const rows: Progress[] = await Database.knex('progress').where({
        mediaItemId: Data.movie.id,
      });

      expect(rows).toHaveLength(2);
      const userIds = rows.map((r) => r.userId);
      expect(userIds).toContain(Data.user.id);
      expect(userIds).toContain(Data.user2.id);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — retrieve a single progress entry
  // ---------------------------------------------------------------------------

  describe('findOne (retrieve a single progress entry)', () => {
    test('returns the matching progress entry when queried by id', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.6,
      });

      const found = (await progressRepository.findOne({ id }))!;

      expect(found).toBeDefined();
      expect(found.id).toBe(id);
      expect(found.userId).toBe(Data.user.id);
    });

    test('returns the progress entry when queried by userId and mediaItemId', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.55,
      });

      const found = (await progressRepository.findOne({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      }))!;

      expect(found).toBeDefined();
      expect(found.userId).toBe(Data.user.id);
      expect(found.mediaItemId).toBe(Data.movie.id);
    });

    test('returns undefined when no matching progress entry exists', async () => {
      const found = await progressRepository.findOne({ id: 999999 });

      expect(found).toBeUndefined();
    });

    test('returns undefined for a non-existent userId and mediaItemId combination', async () => {
      const found = await progressRepository.findOne({
        userId: Data.user.id,
        mediaItemId: 999999,
      });

      expect(found).toBeUndefined();
    });

    test('returns the episode-level progress entry when queried by episodeId', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
        progress: 0.25,
      });

      const found = (await progressRepository.findOne({
        userId: Data.user.id,
        episodeId: Data.episode.id,
      }))!;

      expect(found).toBeDefined();
      expect(found.episodeId).toBe(Data.episode.id);
    });
  });

  // ---------------------------------------------------------------------------
  // find — retrieve multiple progress entries
  // ---------------------------------------------------------------------------

  describe('find (retrieve multiple progress entries)', () => {
    test('returns all progress entries for the specified user', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.1,
      });
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
        progress: 0.4,
      });

      const entries = await progressRepository.find({ userId: Data.user.id });

      expect(entries.length).toBeGreaterThanOrEqual(2);
      entries.forEach((entry) => expect(entry.userId).toBe(Data.user.id));
    });

    test('returns an empty array when the user has no progress entries', async () => {
      const entries = await progressRepository.find({
        userId: Data.user2.id,
      });

      expect(entries).toEqual([]);
    });

    test('does not return entries belonging to other users', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.3,
      });
      await progressRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.8,
      });

      const user1Entries = await progressRepository.find({
        userId: Data.user.id,
      });

      user1Entries.forEach((entry) =>
        expect(entry.userId).toBe(Data.user.id)
      );
    });

    test('returns entries filtered by mediaItemId', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.2,
      });
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        date: new Date().getTime(),
        progress: 0.9,
      });

      const movieEntries = await progressRepository.find({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      expect(movieEntries.length).toBeGreaterThanOrEqual(1);
      movieEntries.forEach((entry) =>
        expect(entry.mediaItemId).toBe(Data.movie.id)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update — modify an existing progress entry
  // ---------------------------------------------------------------------------

  describe('update (modify an existing progress entry)', () => {
    test('updates the progress fraction of an existing entry', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.1,
      });

      await progressRepository.update({ id, progress: 0.9 });

      const updated = (await progressRepository.findOne({ id }))!;

      expect(updated.progress).toBe(0.9);
    });

    test('updates the action field', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        action: 'playing',
        progress: 0.5,
      });

      await progressRepository.update({ id, action: 'paused' });

      const updated = (await progressRepository.findOne({ id }))!;

      expect(updated.action).toBe('paused');
    });

    test('updates the duration field', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        duration: 3600,
        progress: 0.5,
      });

      await progressRepository.update({ id, duration: 5400 });

      const updated = (await progressRepository.findOne({ id }))!;

      expect(updated.duration).toBe(5400);
    });

    test('updates the device field', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        device: 'Phone',
        progress: 0.5,
      });

      await progressRepository.update({ id, device: 'Smart TV' });

      const updated = (await progressRepository.findOne({ id }))!;

      expect(updated.device).toBe('Smart TV');
    });

    test('updating one entry does not affect other entries', async () => {
      const idA = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.2,
      });
      const idB = await progressRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.7,
      });

      await progressRepository.update({ id: idA, progress: 0.99 });

      const entryB = (await progressRepository.findOne({ id: idB }))!;

      expect(entryB.progress).toBe(0.7);
    });
  });

  // ---------------------------------------------------------------------------
  // delete — remove a progress entry
  // ---------------------------------------------------------------------------

  describe('delete (remove a progress entry)', () => {
    test('removes a progress entry by id', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.5,
      });

      await progressRepository.delete({ id });

      const found = await progressRepository.findOne({ id });

      expect(found).toBeUndefined();
    });

    test('removes all progress entries for a userId and mediaItemId combination', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime() - 60000,
        progress: 0.3,
      });
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.6,
      });

      await progressRepository.delete({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      const remaining = await progressRepository.find({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      expect(remaining).toHaveLength(0);
    });

    test('delete is idempotent — deleting a non-existent entry does not throw', async () => {
      await expect(
        progressRepository.delete({ id: 999999 })
      ).resolves.not.toThrow();
    });

    test('deleting by userId does not remove entries belonging to other users', async () => {
      await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.4,
      });
      await progressRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.8,
      });

      await progressRepository.delete({ userId: Data.user.id });

      const user2Entry = (await progressRepository.findOne({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
      }))!;

      expect(user2Entry).toBeDefined();
      expect(user2Entry.userId).toBe(Data.user2.id);
    });

    test('after deletion the entry is no longer returned by find', async () => {
      const id = await progressRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
        progress: 0.15,
      });

      await progressRepository.delete({ id });

      const entries = await progressRepository.find({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      const deletedEntry = entries.find((e) => e.id === id);
      expect(deletedEntry).toBeUndefined();
    });
  });
});
