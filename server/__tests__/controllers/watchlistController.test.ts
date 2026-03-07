import { WatchlistController } from 'src/controllers/watchlist';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * WatchlistController tests.
 *
 * Covers:
 *  - Adding a media item (movie, TV show, season, episode) to the watchlist
 *  - Removing items from the watchlist
 *  - Idempotency: duplicate add returns HTTP 400
 *  - Authorization via watchlist ownership (the repository looks up the watchlist
 *    by `isWatchlist=true` and `userId`, so a missing watchlist causes a 400)
 *  - State consistency verified directly in the `listItem` table
 */
describe('WatchlistController', () => {
  beforeAll(async () => {
    await runMigrations();

    // Seed user, watchlist and media content
    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);

    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('episode').insert(Data.episode2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
  });

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------

  describe('add', () => {
    test('returns HTTP 200 when adding a movie to the watchlist', async () => {
      const watchlistController = new WatchlistController();

      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(200);
    });

    test('persists the movie in the listItem table', async () => {
      const watchlistController = new WatchlistController();

      await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          seasonId: null,
          episodeId: null,
        })
        .first();

      expect(row).toBeDefined();
    });

    test('returns HTTP 200 when adding a TV show to the watchlist', async () => {
      const watchlistController = new WatchlistController();

      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.tvShow.id },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns HTTP 200 when adding a season to the watchlist', async () => {
      const watchlistController = new WatchlistController();

      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    test('persists the season entry in listItem with correct seasonId', async () => {
      const watchlistController = new WatchlistController();

      await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
        },
      });

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
          episodeId: null,
        })
        .first();

      expect(row).toBeDefined();
    });

    test('returns HTTP 200 when adding an episode to the watchlist', async () => {
      const watchlistController = new WatchlistController();

      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    test('persists the episode entry in listItem with correct episodeId', async () => {
      const watchlistController = new WatchlistController();

      await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        },
      });

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        })
        .first();

      expect(row).toBeDefined();
    });

    test('returns HTTP 400 when trying to add the same item twice (duplicate prevention)', async () => {
      const watchlistController = new WatchlistController();

      // First add — should succeed
      await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      // Second add — should be rejected
      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when there is no watchlist for the user', async () => {
      const watchlistController = new WatchlistController();

      // Data.user2 has not been seeded, so there is no watchlist for user id 999
      const res = await request(watchlistController.add, {
        userId: 999,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when the episodeId does not belong to the given mediaItemId', async () => {
      const watchlistController = new WatchlistController();

      const res = await request(watchlistController.add, {
        userId: Data.user.id,
        requestQuery: {
          // Data.episode belongs to Data.tvShow (id=1), not to Data.movie (id=2)
          mediaItemId: Data.movie.id,
          episodeId: Data.episode.id,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('returns HTTP 200 when removing an existing movie from the watchlist', async () => {
      const watchlistController = new WatchlistController();

      // Pre-add the item
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const res = await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(200);
    });

    test('removes the listItem row from the database on delete', async () => {
      const watchlistController = new WatchlistController();

      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          seasonId: null,
          episodeId: null,
        })
        .first();

      expect(row).toBeUndefined();
    });

    test('returns HTTP 200 even when removing an item that is not on the watchlist', async () => {
      const watchlistController = new WatchlistController();

      // movie is not in the watchlist — remove should still succeed (idempotent)
      const res = await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns HTTP 200 when removing a season from the watchlist', async () => {
      const watchlistController = new WatchlistController();

      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.tvShow.id,
        seasonId: Data.season.id,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const res = await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
        },
      });

      expect(res.statusCode).toBe(200);

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
          episodeId: null,
        })
        .first();

      expect(row).toBeUndefined();
    });

    test('returns HTTP 200 when removing an episode from the watchlist', async () => {
      const watchlistController = new WatchlistController();

      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.tvShow.id,
        seasonId: null,
        episodeId: Data.episode.id,
        addedAt: new Date().getTime(),
      });

      const res = await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        },
      });

      expect(res.statusCode).toBe(200);

      const row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        })
        .first();

      expect(row).toBeUndefined();
    });

    test('does not remove a different episode when only one episode is targeted for deletion', async () => {
      const watchlistController = new WatchlistController();

      // Add two episodes to the watchlist
      await Database.knex('listItem').insert([
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          seasonId: null,
          episodeId: Data.episode.id,
          addedAt: new Date().getTime(),
        },
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          seasonId: null,
          episodeId: Data.episode2.id,
          addedAt: new Date().getTime(),
        },
      ]);

      // Delete only episode 1
      await request(watchlistController.delete, {
        userId: Data.user.id,
        requestQuery: {
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
        },
      });

      // Episode 2 should still be present
      const episode2Row = await Database.knex('listItem')
        .where({
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode2.id,
        })
        .first();

      expect(episode2Row).toBeDefined();
    });

    test('returns HTTP 400 when there is no watchlist for the user', async () => {
      const watchlistController = new WatchlistController();

      // User id 999 has no watchlist
      const res = await request(watchlistController.delete, {
        userId: 999,
        requestQuery: { mediaItemId: Data.movie.id },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
