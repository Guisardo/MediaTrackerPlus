import { ListController } from 'src/controllers/listController';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * ListController tests.
 *
 * Covers:
 *  - Adding a new list (happy path + validation)
 *  - Updating an existing list (name, description, privacy, sort options)
 *  - Getting a single list by ID
 *  - Deleting a list
 *  - Authorization: a user cannot access another user's private list items
 *  - Getting list items
 */
describe('ListController', () => {
  beforeAll(async () => {
    await runMigrations();

    // user 1 (admin) and user 2
    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);

    // Watchlist for user 1 (isWatchlist = true)
    await Database.knex('list').insert(Data.watchlist);

    // A regular list for user 1
    await Database.knex('list').insert(Data.list);

    // A private list belonging to user 2
    await Database.knex('list').insert(Data.listUser2);

    // Seed media items so list-item operations have valid FK targets
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------

  describe('add', () => {
    afterEach(async () => {
      // Remove any lists created during a test, keeping the seed lists intact
      await Database.knex('list')
        .whereNotIn('id', [
          Data.watchlist.id,
          Data.list.id,
          Data.listUser2.id,
        ])
        .delete();
    });

    test('returns HTTP 200 and the created list on success', async () => {
      const listController = new ListController();

      const res = await request(listController.add, {
        userId: Data.user.id,
        requestBody: {
          name: 'My new list',
          privacy: 'private',
        },
      });

      expect(res.statusCode).toBe(200);
      const created = res.data as any;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('My new list');
      expect(created.userId).toBe(Data.user.id);
    });

    test('persists new list to the database', async () => {
      const listController = new ListController();

      const res = await request(listController.add, {
        userId: Data.user.id,
        requestBody: {
          name: 'Persistent list',
          privacy: 'public',
        },
      });

      const created = res.data as any;

      const dbRow = await Database.knex('list').where('id', created.id).first();
      expect(dbRow).toBeDefined();
      expect(dbRow.name).toBe('Persistent list');
    });

    test('stores sortBy and sortOrder when supplied', async () => {
      const listController = new ListController();

      const res = await request(listController.add, {
        userId: Data.user.id,
        requestBody: {
          name: 'Sorted list',
          privacy: 'private',
          sortBy: 'title',
          sortOrder: 'desc',
        },
      });

      expect(res.statusCode).toBe(200);
      const created = res.data as any;
      expect(created.sortBy).toBe('title');
      expect(created.sortOrder).toBe('desc');
    });

    test('stores optional description when supplied', async () => {
      const listController = new ListController();

      const res = await request(listController.add, {
        userId: Data.user.id,
        requestBody: {
          name: 'List with description',
          description: 'A detailed description',
          privacy: 'private',
        },
      });

      expect(res.statusCode).toBe(200);
      const created = res.data as any;
      expect(created.description).toBe('A detailed description');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    test('returns HTTP 200 with the updated list', async () => {
      const listController = new ListController();

      const res = await request(listController.update, {
        userId: Data.user.id,
        requestBody: {
          id: Data.list.id,
          name: 'Updated list name',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.data as any;
      expect(updated.name).toBe('Updated list name');
    });

    test('persists the name change to the database', async () => {
      const listController = new ListController();

      await request(listController.update, {
        userId: Data.user.id,
        requestBody: {
          id: Data.list.id,
          name: 'DB-persisted name',
        },
      });

      const dbRow = await Database.knex('list')
        .where('id', Data.list.id)
        .first();

      expect(dbRow.name).toBe('DB-persisted name');
    });

    test('updates privacy field', async () => {
      const listController = new ListController();

      const res = await request(listController.update, {
        userId: Data.user.id,
        requestBody: {
          id: Data.list.id,
          name: 'list',
          privacy: 'public',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.data as any;
      expect(updated.privacy).toBe('public');

      // Restore to private for subsequent tests
      await Database.knex('list')
        .where('id', Data.list.id)
        .update({ privacy: 'private' });
    });

    test('returns HTTP 400 when updating a list owned by a different user', async () => {
      const listController = new ListController();

      // Data.user (id=0) tries to update Data.listUser2 (userId=1)
      const res = await request(listController.update, {
        userId: Data.user.id,
        requestBody: {
          id: Data.listUser2.id,
          name: 'Hijacked name',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when name is an empty string', async () => {
      const listController = new ListController();

      const res = await request(listController.update, {
        userId: Data.user.id,
        requestBody: {
          id: Data.list.id,
          name: '   ',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // get (single list details)
  // ---------------------------------------------------------------------------

  describe('get', () => {
    test('returns HTTP 200 with list details for an existing list', async () => {
      const listController = new ListController();

      const res = await request(listController.get, {
        userId: Data.user.id,
        requestQuery: { listId: Data.list.id },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.id).toBe(Data.list.id);
    });

    test('returned list includes user info', async () => {
      const listController = new ListController();

      const res = await request(listController.get, {
        userId: Data.user.id,
        requestQuery: { listId: Data.list.id },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
    });

    test('returns HTTP 400 for a non-existent list ID', async () => {
      const listController = new ListController();

      const res = await request(listController.get, {
        userId: Data.user.id,
        requestQuery: { listId: 999999 },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('deletes a list owned by the user and returns HTTP 200', async () => {
      const listController = new ListController();

      // Create a disposable list
      const [newId] = await Database.knex('list').insert({
        name: 'To be deleted',
        userId: Data.user.id,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        isWatchlist: false,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        sortBy: 'recently-added',
        sortOrder: 'asc',
      });

      const res = await request(listController.delete, {
        userId: Data.user.id,
        requestQuery: { listId: newId },
      });

      expect(res.statusCode).toBe(200);

      const dbRow = await Database.knex('list').where('id', newId).first();
      expect(dbRow).toBeUndefined();
    });

    test('returns HTTP 400 when trying to delete a list owned by another user', async () => {
      const listController = new ListController();

      const res = await request(listController.delete, {
        userId: Data.user.id,
        requestQuery: { listId: Data.listUser2.id },
      });

      expect(res.statusCode).toBe(400);

      // Verify it was not actually deleted
      const dbRow = await Database.knex('list')
        .where('id', Data.listUser2.id)
        .first();
      expect(dbRow).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getListItems
  // ---------------------------------------------------------------------------

  describe('getListItems', () => {
    afterEach(async () => {
      await Database.knex('listItem').delete();
    });

    test('returns HTTP 200 and an array of items for the owner', async () => {
      await Database.knex('listItem').insert({
        listId: Data.list.id,
        mediaItemId: Data.movie.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const listController = new ListController();

      const res = await request(listController.getListItems, {
        userId: Data.user.id,
        requestQuery: { listId: Data.list.id },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns HTTP 404 for a non-existent list', async () => {
      const listController = new ListController();

      const res = await request(listController.getListItems, {
        userId: Data.user.id,
        requestQuery: { listId: 999999 },
      });

      expect(res.statusCode).toBe(404);
    });

    test('returns HTTP 403 when user accesses another user private list items', async () => {
      const listController = new ListController();

      // Data.listUser2 is private and owned by Data.user2 (id=1)
      // Data.user (id=0) should be denied access
      const res = await request(listController.getListItems, {
        userId: Data.user.id,
        requestQuery: { listId: Data.listUser2.id },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns items from the list in the response array', async () => {
      await Database.knex('listItem').insert({
        listId: Data.list.id,
        mediaItemId: Data.movie.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const listController = new ListController();

      const res = await request(listController.getListItems, {
        userId: Data.user.id,
        requestQuery: { listId: Data.list.id },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(items.length).toBeGreaterThanOrEqual(1);

      const addedItem = items.find(
        (item) => item.mediaItem?.id === Data.movie.id
      );
      expect(addedItem).toBeDefined();
    });

    test('returns empty array for an empty list', async () => {
      const listController = new ListController();

      const res = await request(listController.getListItems, {
        userId: Data.user.id,
        requestQuery: { listId: Data.list.id },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect((res.data as any[]).length).toBe(0);
    });
  });
});
