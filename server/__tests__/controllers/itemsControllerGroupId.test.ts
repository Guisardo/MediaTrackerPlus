import { ItemsController } from 'src/controllers/items';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Tests for groupId parameter handling in ItemsController.
 *
 * Covers US-011 acceptance criteria:
 *  - groupId is parsed and forwarded to query layer
 *  - membership validation returns 403 for non-members
 *  - soft-deleted group falls back to all-users behavior (no error)
 *  - invalid groupId (NaN) is ignored
 *  - all four endpoints (getPaginated, getFacets, get, getRandom) accept groupId
 */
describe('ItemsController — groupId parameter', () => {
  let itemsController: ItemsController;

  const now = Date.now();

  // Group and member IDs used across tests
  let memberGroupId: number;
  let softDeletedGroupId: number;
  let nonMemberGroupId: number;

  beforeAll(async () => {
    await runMigrations();

    // Seed two users
    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);

    // Seed watchlists for both users (items query requires a watchlist)
    await Database.knex('list').insert(Data.watchlist);
    const watchlistUser2 = {
      ...Data.watchlist,
      id: 99,
      userId: Data.user2.id,
    };
    await Database.knex('list').insert(watchlistUser2);

    // Seed media items
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);

    // Add items to both watchlists
    await Database.knex('listItem').insert([
      { listId: Data.watchlist.id, mediaItemId: Data.movie.id, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: Data.tvShow.id, addedAt: now },
      { listId: watchlistUser2.id, mediaItemId: Data.movie.id, addedAt: now },
    ]);

    // Group 1: memberGroup — Data.user is an admin member
    [memberGroupId] = await Database.knex('userGroup').insert({
      name: 'Test Member Group',
      createdBy: Data.user.id,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });
    await Database.knex('userGroupMember').insert({
      groupId: memberGroupId,
      userId: Data.user.id,
      role: 'admin',
      addedAt: now,
    });

    // Group 2: softDeletedGroup — Data.user is a member, but the group is soft-deleted
    [softDeletedGroupId] = await Database.knex('userGroup').insert({
      name: 'Soft Deleted Group',
      createdBy: Data.user.id,
      createdAt: now,
      updatedAt: null,
      deletedAt: now - 10000,
    });
    await Database.knex('userGroupMember').insert({
      groupId: softDeletedGroupId,
      userId: Data.user.id,
      role: 'admin',
      addedAt: now,
    });

    // Group 3: nonMemberGroup — Data.user is NOT a member; only Data.user2 is
    [nonMemberGroupId] = await Database.knex('userGroup').insert({
      name: 'Non-Member Group',
      createdBy: Data.user2.id,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });
    await Database.knex('userGroupMember').insert({
      groupId: nonMemberGroupId,
      userId: Data.user2.id,
      role: 'admin',
      addedAt: now,
    });
  });

  afterAll(clearDatabase);

  beforeEach(() => {
    itemsController = new ItemsController();
  });

  // ---------------------------------------------------------------------------
  // getPaginated — groupId validation
  // ---------------------------------------------------------------------------

  describe('getPaginated', () => {
    test('returns 200 when user is a member of the group', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, groupId: memberGroupId },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('returns 403 when user is NOT a member of the group', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, groupId: nonMemberGroupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('falls back to all-users behavior (200) for soft-deleted group', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, groupId: softDeletedGroupId },
      });

      // Soft-deleted group should not cause an error — falls back to all-users
      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('data');
    });

    test('ignores invalid (NaN) groupId and returns 200', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, groupId: 'not-a-number' },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns 200 without groupId (no groupId param provided)', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
      });

      expect(res.statusCode).toBe(200);
    });

    test('non-existent group falls back to all-users behavior (200)', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, groupId: 99999 },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // getFacets — groupId validation
  // ---------------------------------------------------------------------------

  describe('getFacets', () => {
    test('returns 200 when user is a member of the group', async () => {
      const res = await request(itemsController.getFacets, {
        userId: Data.user.id,
        requestQuery: { groupId: memberGroupId },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns 403 when user is NOT a member of the group', async () => {
      const res = await request(itemsController.getFacets, {
        userId: Data.user.id,
        requestQuery: { groupId: nonMemberGroupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('falls back to all-users behavior (200) for soft-deleted group', async () => {
      const res = await request(itemsController.getFacets, {
        userId: Data.user.id,
        requestQuery: { groupId: softDeletedGroupId },
      });

      expect(res.statusCode).toBe(200);
    });

    test('ignores invalid (NaN) groupId and returns 200', async () => {
      const res = await request(itemsController.getFacets, {
        userId: Data.user.id,
        requestQuery: { groupId: 'abc' },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns 200 without groupId', async () => {
      const res = await request(itemsController.getFacets, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // get (non-paginated) — groupId validation
  // ---------------------------------------------------------------------------

  describe('get', () => {
    test('returns 200 when user is a member of the group', async () => {
      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { groupId: memberGroupId },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns 403 when user is NOT a member of the group', async () => {
      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { groupId: nonMemberGroupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('falls back to all-users behavior (200) for soft-deleted group', async () => {
      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { groupId: softDeletedGroupId },
      });

      expect(res.statusCode).toBe(200);
    });

    test('ignores invalid (NaN) groupId and returns 200', async () => {
      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { groupId: 'invalid' },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // getRandom — groupId validation
  // ---------------------------------------------------------------------------

  describe('getRandom', () => {
    test('returns 200 when user is a member of the group', async () => {
      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: { groupId: memberGroupId },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns 403 when user is NOT a member of the group', async () => {
      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: { groupId: nonMemberGroupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('falls back to all-users behavior (200) for soft-deleted group', async () => {
      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: { groupId: softDeletedGroupId },
      });

      expect(res.statusCode).toBe(200);
    });

    test('ignores invalid (NaN) groupId and returns 200', async () => {
      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: { groupId: NaN },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
