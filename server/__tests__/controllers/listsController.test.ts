import { ListsController, getUserLists } from 'src/controllers/listsController';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * ListsController tests.
 *
 * Covers:
 *  - Getting all lists for a user (both own user and another user)
 *  - Privacy filtering: private lists hidden when accessed by a different user
 *  - itemsCount aggregation on each returned list
 *  - Filtering by mediaItemId, seasonId, and episodeId
 *  - Response shape (id, name, privacy, user, itemsCount, etc.)
 */
describe('ListsController', () => {
  beforeAll(async () => {
    await runMigrations();

    // Seed two users
    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);

    // Watchlist and regular list for user 1
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('list').insert(Data.list);

    // Private list for user 2
    await Database.knex('list').insert(Data.listUser2);

    // Seed media items for list-item tests
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
  });

  // ---------------------------------------------------------------------------
  // getLists HTTP handler
  // ---------------------------------------------------------------------------

  describe('getLists', () => {
    test('returns HTTP 200 with an array', async () => {
      const listsController = new ListsController();

      const res = await request(listsController.getLists, {
        userId: Data.user.id,
        requestQuery: { userId: Data.user.id },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns HTTP 400 when the target userId does not exist', async () => {
      const listsController = new ListsController();

      const res = await request(listsController.getLists, {
        userId: Data.user.id,
        requestQuery: { userId: 99999 },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns own private and public lists when requesting own user lists', async () => {
      const listsController = new ListsController();

      const res = await request(listsController.getLists, {
        userId: Data.user.id,
        requestQuery: { userId: Data.user.id },
      });

      expect(res.statusCode).toBe(200);
      const lists = res.data as any[];
      const listIds = lists.map((l) => l.id);

      // Both the watchlist and the regular list belong to Data.user
      expect(listIds).toContain(Data.watchlist.id);
      expect(listIds).toContain(Data.list.id);
    });

    test('hides private lists when fetching another user lists', async () => {
      const listsController = new ListsController();

      // Data.user (id=0) requests lists for Data.user2 (id=1) whose list is private
      const res = await request(listsController.getLists, {
        userId: Data.user.id,
        requestQuery: { userId: Data.user2.id },
      });

      expect(res.statusCode).toBe(200);
      const lists = res.data as any[];
      const listIds = lists.map((l) => l.id);

      // Data.listUser2 is private, so it should NOT appear
      expect(listIds).not.toContain(Data.listUser2.id);
    });
  });

  // ---------------------------------------------------------------------------
  // getUserLists helper function
  // ---------------------------------------------------------------------------

  describe('getUserLists', () => {
    test('returns all lists belonging to a user', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      const listIds = result.map((l) => l.id);
      expect(listIds).toContain(Data.watchlist.id);
      expect(listIds).toContain(Data.list.id);
    });

    test('each list entry includes user object with id and name', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      for (const list of result) {
        expect(list).toHaveProperty('user');
        expect(list.user).toHaveProperty('id', Data.user.id);
        expect(list.user).toHaveProperty('name', Data.user.name);
      }
    });

    test('each list entry includes itemsCount field', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      for (const list of result) {
        expect(list).toHaveProperty('itemsCount');
      }
    });

    test('itemsCount reflects the number of items in the list', async () => {
      // Add two items to Data.list
      await Database.knex('listItem').insert([
        {
          listId: Data.list.id,
          mediaItemId: Data.movie.id,
          seasonId: null,
          episodeId: null,
          addedAt: new Date().getTime(),
        },
        {
          listId: Data.list.id,
          mediaItemId: Data.tvShow.id,
          seasonId: null,
          episodeId: null,
          addedAt: new Date().getTime(),
        },
      ]);

      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      const listEntry = result.find((l) => l.id === Data.list.id);
      expect(listEntry).toBeDefined();
      expect(Number(listEntry!.itemsCount)).toBe(2);
    });

    test('itemsCount is null or 0 for an empty list', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      const watchlistEntry = result.find((l) => l.id === Data.watchlist.id);
      expect(watchlistEntry).toBeDefined();
      // The left-join returns null when there are no items
      const count = watchlistEntry!.itemsCount;
      expect(count == null || Number(count) === 0).toBe(true);
    });

    test('hides private lists when currentUserId differs from userId', async () => {
      const result = await getUserLists({
        userId: Data.user2.id,
        currentUserId: Data.user.id,
      });

      const listIds = result.map((l) => l.id);
      expect(listIds).not.toContain(Data.listUser2.id);
    });

    test('shows private lists when currentUserId equals userId', async () => {
      const result = await getUserLists({
        userId: Data.user2.id,
        currentUserId: Data.user2.id,
      });

      const listIds = result.map((l) => l.id);
      expect(listIds).toContain(Data.listUser2.id);
    });

    test('isWatchlist is returned as a boolean', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      for (const list of result) {
        expect(typeof list.isWatchlist).toBe('boolean');
      }
    });

    test('allowComments is returned as a boolean', async () => {
      const result = await getUserLists({
        userId: Data.user.id,
        currentUserId: Data.user.id,
      });

      for (const list of result) {
        expect(typeof list.allowComments).toBe('boolean');
      }
    });

    // -------------------------------------------------------------------------
    // mediaItemId filtering
    // -------------------------------------------------------------------------

    describe('filtering by mediaItemId', () => {
      test('returns only lists that contain the specified mediaItemId', async () => {
        // Add movie to Data.list only
        await Database.knex('listItem').insert({
          listId: Data.list.id,
          mediaItemId: Data.movie.id,
          seasonId: null,
          episodeId: null,
          addedAt: new Date().getTime(),
        });

        const result = await getUserLists({
          userId: Data.user.id,
          currentUserId: Data.user.id,
          mediaItemId: Data.movie.id,
        });

        const listIds = result.map((l) => l.id);
        expect(listIds).toContain(Data.list.id);
        // Watchlist has no items, should not appear
        expect(listIds).not.toContain(Data.watchlist.id);
      });

      test('returns empty array when no list contains the specified mediaItemId', async () => {
        const result = await getUserLists({
          userId: Data.user.id,
          currentUserId: Data.user.id,
          mediaItemId: 999999,
        });

        expect(result.length).toBe(0);
      });
    });

    // -------------------------------------------------------------------------
    // episodeId filtering
    // -------------------------------------------------------------------------

    describe('filtering by episodeId', () => {
      test('returns only lists that contain the specified episodeId', async () => {
        await Database.knex('listItem').insert({
          listId: Data.list.id,
          mediaItemId: Data.tvShow.id,
          seasonId: null,
          episodeId: Data.episode.id,
          addedAt: new Date().getTime(),
        });

        const result = await getUserLists({
          userId: Data.user.id,
          currentUserId: Data.user.id,
          episodeId: Data.episode.id,
        });

        const listIds = result.map((l) => l.id);
        expect(listIds).toContain(Data.list.id);
        expect(listIds).not.toContain(Data.watchlist.id);
      });
    });

    // -------------------------------------------------------------------------
    // seasonId filtering
    // -------------------------------------------------------------------------

    describe('filtering by seasonId', () => {
      test('returns only lists that contain the specified seasonId (without episodeId)', async () => {
        await Database.knex('listItem').insert({
          listId: Data.list.id,
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
          episodeId: null,
          addedAt: new Date().getTime(),
        });

        const result = await getUserLists({
          userId: Data.user.id,
          currentUserId: Data.user.id,
          seasonId: Data.season.id,
        });

        const listIds = result.map((l) => l.id);
        expect(listIds).toContain(Data.list.id);
        expect(listIds).not.toContain(Data.watchlist.id);
      });
    });
  });
});
