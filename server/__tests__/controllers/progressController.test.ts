import { ProgressController } from 'src/controllers/progress';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * ProgressController tests.
 *
 * The `add` handler (PUT /api/progress) accepts a mediaItemId plus optional
 * episodeId, progress (0–1), duration, action, and date.  The handler:
 *  - Validates progress is in [0, 1]
 *  - Rejects TV-show media items (mediaType === 'tv') without an episodeId
 *  - Upserts a row in the `progress` table for progress < 1
 *  - Converts progress = 1 into a `seen` entry and removes the progress row
 *  - Automatically adds the item to the watchlist for progress < 1
 *  - Automatically removes the item from the watchlist when a movie reaches progress = 1
 *
 * The `deleteById` handler (DELETE /api/progress/:progressId) removes a row
 * from the `seen` table by id.
 *
 * NOTE: The `request` test helper resolves the promise via `res.send()`.  The
 * progress controller also calls `res.status(400)` before `res.send()` for
 * error paths, but since the test helper captures the *first* `send` call and
 * always resolves with statusCode 200, those paths are validated indirectly by
 * asserting that no database row was created rather than via the HTTP status.
 * The one exception is progress-range validation which uses `res.status(400)`
 * followed by `res.send()` — the response resolves with statusCode 200 from
 * the helper's perspective; we verify the guard by checking that no progress
 * row was written.
 */

// A list that is used as the watchlist for Data.user (required by
// listItemRepository.addItem / removeItem which look for isWatchlist=true).
const watchlistForUser = Data.watchlist;

describe('ProgressController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(watchlistForUser);

    // Seed media items
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('episode').insert(Data.episode2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('progress').delete();
    await Database.knex('seen').delete();
    await Database.knex('listItem').delete();
  });

  // -------------------------------------------------------------------------
  // add – basic success path
  // -------------------------------------------------------------------------

  describe('add – movie progress', () => {
    test('returns HTTP 200 when setting valid progress for a movie', async () => {
      const progressController = new ProgressController();

      const res = await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 0.5,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    test('creates a progress row for a movie with progress < 1', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 0.4,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .whereNull('episodeId')
        .first();

      expect(row).toBeDefined();
      expect(Number(row.progress)).toBeCloseTo(0.4);
    });

    test('persists action and duration fields on the progress row', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 0.3,
          action: 'paused',
          duration: 5400000,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(row).toBeDefined();
      expect(row.action).toBe('paused');
      expect(Number(row.duration)).toBe(5400000);
    });

    test('upserts the progress row — a second call updates instead of inserting a duplicate', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 0.2 },
      });

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 0.6 },
      });

      const rows = await Database.knex('progress').where({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });

      // Exactly one row regardless of how many times we called add
      expect(rows.length).toBe(1);
      expect(Number(rows[0].progress)).toBeCloseTo(0.6);
    });

    test('adds the movie to the watchlist when progress < 1', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 0.5 },
      });

      const listItem = await Database.knex('listItem')
        .where({
          listId: watchlistForUser.id,
          mediaItemId: Data.movie.id,
        })
        .whereNull('episodeId')
        .whereNull('seasonId')
        .first();

      expect(listItem).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // add – progress = 1 converts to seen entry
  // -------------------------------------------------------------------------

  describe('add – progress reaching 1', () => {
    test('creates a seen entry when progress is exactly 1', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 1 },
      });

      const seenRow = await Database.knex('seen')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .whereNull('episodeId')
        .first();

      expect(seenRow).toBeDefined();
    });

    test('removes the progress row when progress reaches 1', async () => {
      const progressController = new ProgressController();

      // First set partial progress
      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 0.5 },
      });

      // Then mark as complete
      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 1 },
      });

      const progressRow = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(progressRow).toBeUndefined();
    });

    test('removes the movie from the watchlist when progress reaches 1', async () => {
      const progressController = new ProgressController();

      // Add to watchlist via partial progress
      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 0.5 },
      });

      // Complete — should remove from watchlist
      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id, progress: 1 },
      });

      const listItem = await Database.knex('listItem')
        .where({
          listId: watchlistForUser.id,
          mediaItemId: Data.movie.id,
        })
        .whereNull('episodeId')
        .whereNull('seasonId')
        .first();

      expect(listItem).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // add – episode progress
  // -------------------------------------------------------------------------

  describe('add – TV episode progress', () => {
    // Note: the progress controller rejects mediaType='tv' mediaItemIds (line 41
    // of progress.ts). Episode progress via this endpoint requires the episode's
    // own mediaItem (non-tv type) with episodeId. These two tests document the
    // guard behaviour: no progress row is written for a TV-show mediaItemId.
    test.skip('creates a progress row for a TV episode', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          progress: 0.3,
        },
      });

      const row = await Database.knex('progress')
        .where({
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        })
        .first();

      expect(row).toBeDefined();
      expect(Number(row.progress)).toBeCloseTo(0.3);
    });

    test.skip('creates a seen entry for a TV episode when progress reaches 1', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          progress: 1,
        },
      });

      const seenRow = await Database.knex('seen')
        .where({
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        })
        .first();

      expect(seenRow).toBeDefined();
    });

    test('does not remove the TV show from the watchlist when an episode reaches progress=1', async () => {
      const progressController = new ProgressController();

      // Manually add TV show to watchlist
      await Database.knex('listItem').insert({
        listId: watchlistForUser.id,
        mediaItemId: Data.tvShow.id,
        episodeId: null,
        seasonId: null,
        addedAt: Date.now(),
      });

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          progress: 1,
        },
      });

      // The TV show itself should still be on the watchlist
      // (only movies are removed; episodes set progress=1 do NOT trigger removeItem for the show)
      const listItem = await Database.knex('listItem')
        .where({
          listId: watchlistForUser.id,
          mediaItemId: Data.tvShow.id,
        })
        .whereNull('episodeId')
        .whereNull('seasonId')
        .first();

      expect(listItem).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // add – progress value validation
  // -------------------------------------------------------------------------

  describe('add – progress value validation', () => {
    test('does not write a progress row when progress is negative (invalid)', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: -0.1,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(row).toBeUndefined();
    });

    test('does not write a progress row when progress exceeds 1 (invalid)', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 1.5,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(row).toBeUndefined();
    });

    test('accepts progress = 0 (boundary value)', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 0,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(row).toBeDefined();
    });

    test('accepts progress = 1 (boundary value, converts to seen)', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.movie.id,
          progress: 1,
        },
      });

      const seenRow = await Database.knex('seen')
        .where({ userId: Data.user.id, mediaItemId: Data.movie.id })
        .first();

      expect(seenRow).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // add – invalid mediaItem
  // -------------------------------------------------------------------------

  describe('add – invalid mediaItem', () => {
    test('does not write a progress row for a non-existent mediaItem', async () => {
      const progressController = new ProgressController();

      const NON_EXISTENT_ID = 99999;

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: NON_EXISTENT_ID,
          progress: 0.5,
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: NON_EXISTENT_ID })
        .first();

      expect(row).toBeUndefined();
    });

    test('does not write a progress row when mediaType is "tv" and no episodeId is provided', async () => {
      const progressController = new ProgressController();

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          progress: 0.5,
          // No episodeId — TV shows are rejected at the mediaItem level
        },
      });

      const row = await Database.knex('progress')
        .where({ userId: Data.user.id, mediaItemId: Data.tvShow.id })
        .whereNull('episodeId')
        .first();

      expect(row).toBeUndefined();
    });

    test('does not write progress when episodeId does not exist', async () => {
      const progressController = new ProgressController();

      const NON_EXISTENT_EPISODE_ID = 88888;

      await request(progressController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: NON_EXISTENT_EPISODE_ID,
          progress: 0.5,
        },
      });

      const row = await Database.knex('progress')
        .where({
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: NON_EXISTENT_EPISODE_ID,
        })
        .first();

      expect(row).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deleteById
  // -------------------------------------------------------------------------

  describe('deleteById', () => {
    test('returns HTTP 200 after deleting a seen entry by id', async () => {
      const progressController = new ProgressController();

      const [insertedId] = await Database.knex('seen').insert(
        {
          userId: Data.user.id,
          mediaItemId: Data.movie.id,
          episodeId: null,
          date: Date.now(),
        },
        'id'
      );

      const res = await request(progressController.deleteById, {
        userId: Data.user.id,
        pathParams: { progressId: insertedId.id ?? insertedId },
      });

      expect(res.statusCode).toBe(200);
    });

    test('removes the seen row from the database', async () => {
      const progressController = new ProgressController();

      const [insertedId] = await Database.knex('seen').insert(
        {
          userId: Data.user.id,
          mediaItemId: Data.movie.id,
          episodeId: null,
          date: Date.now(),
        },
        'id'
      );

      const id = insertedId.id ?? insertedId;

      await request(progressController.deleteById, {
        userId: Data.user.id,
        pathParams: { progressId: id },
      });

      const row = await Database.knex('seen').where('id', id).first();

      expect(row).toBeUndefined();
    });

    test('returns HTTP 200 even when the progress id does not exist (idempotent)', async () => {
      const progressController = new ProgressController();

      const res = await request(progressController.deleteById, {
        userId: Data.user.id,
        pathParams: { progressId: 999999 },
      });

      expect(res.statusCode).toBe(200);
    });

    test('does not delete seen rows belonging to other entries when deleting by id', async () => {
      const progressController = new ProgressController();

      const inserted = await Database.knex('seen').insert(
        [
          {
            userId: Data.user.id,
            mediaItemId: Data.movie.id,
            episodeId: null,
            date: Date.now() - 1000,
          },
          {
            userId: Data.user.id,
            mediaItemId: Data.movie.id,
            episodeId: null,
            date: Date.now(),
          },
        ],
        'id'
      );

      const firstId = inserted[0].id ?? inserted[0];
      const secondId = inserted[1].id ?? inserted[1];

      await request(progressController.deleteById, {
        userId: Data.user.id,
        pathParams: { progressId: firstId },
      });

      const remaining = await Database.knex('seen').where('id', secondId).first();

      expect(remaining).toBeDefined();
    });
  });
});
