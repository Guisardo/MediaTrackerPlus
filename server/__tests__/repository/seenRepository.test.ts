import { Database } from 'src/dbconfig';
import { Seen } from 'src/entity/seen';
import { seenRepository } from 'src/repository/seen';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * seenRepository tests.
 *
 * The SeenRepository extends the generic repository with one custom method:
 *   - deleteForTvSeason(params) — deletes all seen entries for episodes
 *     belonging to a given season owned by a given user.
 *
 * The tests also cover the inherited base operations that the codebase relies
 * on: create, find, findOne, delete.
 *
 * Database prerequisites (inserted once in beforeAll):
 *   - user (Data.user)
 *   - user2 (Data.user2)         — for cross-user isolation tests
 *   - tvShow mediaItem (Data.tvShow)
 *   - movie mediaItem (Data.movie)
 *   - season (Data.season)
 *   - three episodes (Data.episode, episode2, episode3)
 */

describe('seenRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('episode').insert(Data.episode2);
    await Database.knex('episode').insert(Data.episode3);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('seen').delete();
  });

  // ---------------------------------------------------------------------------
  // create — mark a media item as seen
  // ---------------------------------------------------------------------------

  describe('create (mark as seen)', () => {
    test('marks a movie as seen and returns an id', async () => {
      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      expect(typeof id).toBe('number');
    });

    test('the inserted row contains the correct userId and mediaItemId', async () => {
      const now = new Date().getTime();

      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: now,
      });

      const row: Seen = await Database.knex('seen').where({ id }).first();

      expect(row.userId).toBe(Data.user.id);
      expect(row.mediaItemId).toBe(Data.movie.id);
    });

    test('marks a TV episode as seen', async () => {
      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });

      const row: Seen = await Database.knex('seen').where({ id }).first();

      expect(row.episodeId).toBe(Data.episode.id);
      expect(row.mediaItemId).toBe(Data.tvShow.id);
    });

    test('allows a NULL date (unknown watch date)', async () => {
      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: null,
      });

      const row: Seen = await Database.knex('seen').where({ id }).first();

      expect(row.date).toBeNull();
    });

    test('stores the optional duration when provided', async () => {
      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        duration: 7200,
      });

      const row: Seen = await Database.knex('seen').where({ id }).first();

      expect(row.duration).toBe(7200);
    });

    test('allows the same user to mark the same item as seen multiple times', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime() - 86400000,
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      const rows: Seen[] = await Database.knex('seen').where({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      expect(rows).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // find — get seen history for a user
  // ---------------------------------------------------------------------------

  describe('find (seen history for a user)', () => {
    test('returns all seen entries for the specified user', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });

      const history = await seenRepository.find({ userId: Data.user.id });

      expect(history.length).toBeGreaterThanOrEqual(2);
      history.forEach((entry) => expect(entry.userId).toBe(Data.user.id));
    });

    test('returns an empty array when the user has no seen entries', async () => {
      const history = await seenRepository.find({ userId: Data.user2.id });

      expect(history).toEqual([]);
    });

    test('does not return seen entries belonging to other users', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      const user1History = await seenRepository.find({
        userId: Data.user.id,
      });

      user1History.forEach((entry) =>
        expect(entry.userId).toBe(Data.user.id)
      );
    });

    test('returns seen entries filtered by mediaItemId', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });

      const movieSeen = await seenRepository.find({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      expect(movieSeen.length).toBeGreaterThanOrEqual(1);
      movieSeen.forEach((entry) =>
        expect(entry.mediaItemId).toBe(Data.movie.id)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — get seen status for a specific item
  // ---------------------------------------------------------------------------

  describe('findOne (seen status for a specific item)', () => {
    test('returns the seen entry for a specific episode', async () => {
      const now = new Date().getTime();

      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: now,
      });

      const entry = (await seenRepository.findOne({
        userId: Data.user.id,
        episodeId: Data.episode.id,
      }))!;

      expect(entry).toBeDefined();
      expect(entry.episodeId).toBe(Data.episode.id);
      expect(entry.userId).toBe(Data.user.id);
    });

    test('returns undefined when no matching seen entry exists', async () => {
      const entry = await seenRepository.findOne({
        userId: Data.user.id,
        episodeId: 999999,
      });

      expect(entry).toBeUndefined();
    });

    test('returns a movie-level seen entry (null episodeId)', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      const entry = (await seenRepository.findOne({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      }))!;

      expect(entry).toBeDefined();
      expect(entry.mediaItemId).toBe(Data.movie.id);
    });
  });

  // ---------------------------------------------------------------------------
  // delete — mark as unseen / remove
  // ---------------------------------------------------------------------------

  describe('delete (mark as unseen)', () => {
    test('removes a specific seen entry by id', async () => {
      const id = await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      await seenRepository.delete({ id });

      const found = await seenRepository.findOne({ id });

      expect(found).toBeUndefined();
    });

    test('removes all seen entries for a specific mediaItemId / userId combination', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime() - 86400000,
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      await seenRepository.delete({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      const remaining = await seenRepository.find({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      expect(remaining).toHaveLength(0);
    });

    test('delete is idempotent — deleting a non-existent entry does not throw', async () => {
      await expect(
        seenRepository.delete({ id: 888888 })
      ).resolves.not.toThrow();
    });

    test('does not delete entries belonging to other users', async () => {
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
        date: new Date().getTime(),
      });

      await seenRepository.delete({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      const user2Entry = await seenRepository.findOne({
        userId: Data.user2.id,
        mediaItemId: Data.movie.id,
      });

      expect(user2Entry).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteForTvSeason — custom method on SeenRepository
  // ---------------------------------------------------------------------------

  describe('deleteForTvSeason', () => {
    test('removes all seen entries for every episode in the given season', async () => {
      // Seed seen entries for all three episodes in Data.season
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode2.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode3.id,
        date: new Date().getTime(),
      });

      await seenRepository.deleteForTvSeason({
        userId: Data.user.id,
        seasonId: Data.season.id,
      });

      const remaining: Seen[] = await Database.knex('seen').where({
        userId: Data.user.id,
      });

      // All episode seen entries for the season must be gone
      const episodeIds = [Data.episode.id, Data.episode2.id, Data.episode3.id];
      remaining.forEach((entry) => {
        expect(episodeIds).not.toContain(entry.episodeId);
      });
    });

    test('does not delete seen entries belonging to a different user', async () => {
      // Both users have seen episode 1
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });
      await seenRepository.create({
        userId: Data.user2.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: new Date().getTime(),
      });

      // Only delete for Data.user
      await seenRepository.deleteForTvSeason({
        userId: Data.user.id,
        seasonId: Data.season.id,
      });

      const user2Entry = await seenRepository.findOne({
        userId: Data.user2.id,
        episodeId: Data.episode.id,
      });

      expect(user2Entry).toBeDefined();
    });

    test('does not remove media-item-level seen entries (no episodeId)', async () => {
      // Add a media-item-level (full show) seen entry
      await seenRepository.create({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        date: new Date().getTime(),
      });

      await seenRepository.deleteForTvSeason({
        userId: Data.user.id,
        seasonId: Data.season.id,
      });

      // The media-item level entry (episodeId IS NULL) should survive
      const showLevelEntry: Seen = await Database.knex('seen')
        .where({
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
        })
        .whereNull('episodeId')
        .first();

      expect(showLevelEntry).toBeDefined();
    });

    test('is idempotent — calling deleteForTvSeason with no matching entries does not throw', async () => {
      await expect(
        seenRepository.deleteForTvSeason({
          userId: Data.user.id,
          seasonId: 999999,
        })
      ).resolves.not.toThrow();
    });
  });
});
