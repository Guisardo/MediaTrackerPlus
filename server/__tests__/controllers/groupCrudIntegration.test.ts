import { GroupController } from 'src/controllers/group';
import { UsersController } from 'src/controllers/users';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import * as groupPlatformRatingCache from 'src/repository/groupPlatformRatingCache';
import * as groupCleanup from 'src/repository/groupCleanup';

/**
 * Integration tests for group CRUD and membership API (US-016).
 *
 * These tests exercise the complete lifecycle of group operations,
 * verifying end-to-end flows including database state transitions,
 * cache recalculation triggers, async cleanup behavior, and
 * cross-endpoint consistency.
 *
 * Covers:
 *  - Group creation: creates group, auto-assigns admin role, returns group with id
 *  - Group listing: returns only user's groups, with correct role and member count, excludes soft-deleted
 *  - Group detail: returns member list for members, 403 for non-members, 404 for soft-deleted
 *  - Group update: admin can rename, viewer gets 403, updatedAt is set
 *  - Group deletion: soft-deletes (sets deletedAt), excluded from listings, async cleanup runs
 *  - Member addition: admin can add with role, viewer gets 403, duplicate 409, nonexistent user 404, cache recalculation triggered
 *  - Member removal: admin can remove, viewer gets 403, triggers cache recalculation, sole admin removal soft-deletes
 *  - Role update: admin can change roles, cannot demote last admin (400)
 *  - User search: returns matching users (case-insensitive), excludes current user, max 20 results
 */
describe('Group CRUD and Membership Integration Tests', () => {
  let groupController: GroupController;
  let usersController: UsersController;

  // Additional test user for multi-user scenarios
  const user3 = {
    id: 50,
    name: 'thirduser',
    admin: false,
    password: 'password',
    publicReviews: false,
  };

  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('user').insert(user3);

    // Seed media items for cache trigger tests
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);

    // Seed watchlist lists for cache computation
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('list').insert({
      ...Data.watchlist,
      id: 10,
      userId: Data.user2.id,
      name: 'Watchlist User2',
    });
    await Database.knex('list').insert({
      ...Data.watchlist,
      id: 11,
      userId: user3.id,
      name: 'Watchlist User3',
    });
  });

  beforeEach(() => {
    groupController = new GroupController();
    usersController = new UsersController();
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    // Clean up group-related tables after each test
    await Database.knex('groupPlatformRating').delete();
    await Database.knex('userGroupMember').delete();
    await Database.knex('userGroup').delete();
    // Clean up any list items inserted during tests
    await Database.knex('listItem').delete();
  });

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------

  const insertGroup = async (opts: {
    name: string;
    createdBy: number;
    deletedAt?: number | null;
  }) => {
    const now = Date.now();
    const [id] = await Database.knex('userGroup').insert({
      name: opts.name,
      createdBy: opts.createdBy,
      createdAt: now,
      updatedAt: null,
      deletedAt: opts.deletedAt ?? null,
    });
    return id as number;
  };

  const insertMember = async (
    groupId: number,
    userId: number,
    role: 'admin' | 'viewer'
  ) => {
    await Database.knex('userGroupMember').insert({
      groupId,
      userId,
      role,
      addedAt: Date.now(),
    });
  };

  // ===========================================================================
  // 1. Group Creation — complete lifecycle
  // ===========================================================================

  describe('Group creation lifecycle', () => {
    test('creates group, auto-assigns admin role to creator, and returns group with id', async () => {
      // Create the group via the API
      const createRes = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Integration Test Group' },
      });

      expect(createRes.statusCode).toBe(200);
      const created = createRes.data as any;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('Integration Test Group');
      expect(created.createdBy).toBe(Data.user.id);

      // Verify the group exists in the database
      const dbGroup = await Database.knex('userGroup')
        .where('id', created.id)
        .first();
      expect(dbGroup).toBeDefined();
      expect(dbGroup.name).toBe('Integration Test Group');
      expect(dbGroup.deletedAt).toBeNull();

      // Verify the creator is auto-assigned as admin
      const membership = await Database.knex('userGroupMember')
        .where('groupId', created.id)
        .where('userId', Data.user.id)
        .first();
      expect(membership).toBeDefined();
      expect(membership.role).toBe('admin');
      expect(membership.addedAt).toBeDefined();
    });

    test('created group appears in listing with correct role and member count', async () => {
      // Create group
      const createRes = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Listed Group' },
      });
      const created = createRes.data as any;

      // List groups
      const listRes = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(listRes.statusCode).toBe(200);
      const groups = listRes.data as any[];
      const foundGroup = groups.find((g: any) => g.id === created.id);
      expect(foundGroup).toBeDefined();
      expect(foundGroup.name).toBe('Listed Group');
      expect(foundGroup.role).toBe('admin');
      expect(foundGroup.memberCount).toBe(1);
    });

    test('created group is accessible via group detail with member list', async () => {
      // Create group
      const createRes = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Detail Test Group' },
      });
      const created = createRes.data as any;

      // Get group detail
      const detailRes = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId: created.id },
      });

      expect(detailRes.statusCode).toBe(200);
      const detail = detailRes.data as any;
      expect(detail.id).toBe(created.id);
      expect(detail.name).toBe('Detail Test Group');
      expect(detail.role).toBe('admin');
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].userId).toBe(Data.user.id);
      expect(detail.members[0].role).toBe('admin');
      expect(detail.members[0].name).toBe(Data.user.name);
    });
  });

  // ===========================================================================
  // 2. Group Listing
  // ===========================================================================

  describe('Group listing', () => {
    test('returns only groups the user belongs to with correct role and member count', async () => {
      // Create two groups — user is admin of one, user2 is admin of other
      const group1Id = await insertGroup({
        name: 'User Group',
        createdBy: Data.user.id,
      });
      await insertMember(group1Id, Data.user.id, 'admin');
      await insertMember(group1Id, Data.user2.id, 'viewer');

      const group2Id = await insertGroup({
        name: 'Other User Group',
        createdBy: Data.user2.id,
      });
      await insertMember(group2Id, Data.user2.id, 'admin');

      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(res.statusCode).toBe(200);
      const groups = res.data as any[];
      // User should only see group1, not group2
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(group1Id);
      expect(groups[0].role).toBe('admin');
      expect(groups[0].memberCount).toBe(2);
    });

    test('excludes soft-deleted groups from listing', async () => {
      const activeGroupId = await insertGroup({
        name: 'Active',
        createdBy: Data.user.id,
      });
      await insertMember(activeGroupId, Data.user.id, 'admin');

      const deletedGroupId = await insertGroup({
        name: 'Deleted',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(deletedGroupId, Data.user.id, 'admin');

      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      const groups = res.data as any[];
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(activeGroupId);
      expect(groups.every((g: any) => g.id !== deletedGroupId)).toBe(true);
    });

    test('shows viewer role for non-admin members', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.listGroups, {
        userId: Data.user2.id,
      });

      const groups = res.data as any[];
      expect(groups).toHaveLength(1);
      expect(groups[0].role).toBe('viewer');
    });
  });

  // ===========================================================================
  // 3. Group Detail
  // ===========================================================================

  describe('Group detail', () => {
    test('returns member list with user id, name, and role for members', async () => {
      const groupId = await insertGroup({
        name: 'Detail Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');
      await insertMember(groupId, user3.id, 'viewer');

      const res = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(200);
      const detail = res.data as any;
      expect(detail.members).toHaveLength(3);

      const adminMember = detail.members.find(
        (m: any) => m.userId === Data.user.id
      );
      expect(adminMember).toBeDefined();
      expect(adminMember.role).toBe('admin');
      expect(adminMember.name).toBe(Data.user.name);

      const viewerMember = detail.members.find(
        (m: any) => m.userId === Data.user2.id
      );
      expect(viewerMember).toBeDefined();
      expect(viewerMember.role).toBe('viewer');
      expect(viewerMember.name).toBe(Data.user2.name);
    });

    test('returns 403 for non-members', async () => {
      const groupId = await insertGroup({
        name: 'Private Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.getGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns 404 for soft-deleted groups', async () => {
      const groupId = await insertGroup({
        name: 'Deleted Detail Group',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // 4. Group Update
  // ===========================================================================

  describe('Group update', () => {
    test('admin can rename group and updatedAt is set', async () => {
      const beforeUpdate = Date.now();
      const groupId = await insertGroup({
        name: 'Original Name',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { name: 'Renamed Group' },
      });

      expect(res.statusCode).toBe(200);

      // Verify in database
      const dbGroup = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbGroup.name).toBe('Renamed Group');
      expect(dbGroup.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    test('viewer gets 403 when trying to update group name', async () => {
      const groupId = await insertGroup({
        name: 'Admin Only',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { name: 'Hijacked' },
      });

      expect(res.statusCode).toBe(403);

      // Name unchanged in DB
      const dbGroup = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbGroup.name).toBe('Admin Only');
    });

    test('updated name is reflected in group detail and listings', async () => {
      const groupId = await insertGroup({
        name: 'Before Rename',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      // Update the name
      await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { name: 'After Rename' },
      });

      // Verify in detail endpoint
      const detailRes = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });
      expect((detailRes.data as any).name).toBe('After Rename');

      // Verify in listing
      const listRes = await request(groupController.listGroups, {
        userId: Data.user.id,
      });
      const groups = listRes.data as any[];
      expect(groups.find((g: any) => g.id === groupId)?.name).toBe(
        'After Rename'
      );
    });
  });

  // ===========================================================================
  // 5. Group Deletion — soft-delete, excluded from listings, async cleanup
  // ===========================================================================

  describe('Group deletion', () => {
    test('soft-deletes the group by setting deletedAt', async () => {
      const beforeDelete = Date.now();
      const groupId = await insertGroup({
        name: 'To Delete',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.deleteGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(200);

      const dbGroup = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbGroup).toBeDefined();
      expect(dbGroup.deletedAt).toBeGreaterThanOrEqual(beforeDelete);
    });

    test('soft-deleted group is excluded from listings', async () => {
      const groupId = await insertGroup({
        name: 'Soon Deleted',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      // Delete it
      await request(groupController.deleteGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      // Listing should not include it
      const listRes = await request(groupController.listGroups, {
        userId: Data.user.id,
      });
      const groups = listRes.data as any[];
      expect(groups.every((g: any) => g.id !== groupId)).toBe(true);
    });

    test('async cleanup removes groupPlatformRating, userGroupMember, and userGroup rows', async () => {
      const groupId = await insertGroup({
        name: 'Cleanup Test',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      // Insert a cache row so we can verify cleanup
      await Database.knex('groupPlatformRating').insert({
        groupId,
        mediaItemId: Data.movie.id,
        rating: 8.5,
      });

      // Capture the setImmediate callback to execute it manually
      const originalSetImmediate = global.setImmediate;
      let capturedCallback: (() => void) | null = null;

      global.setImmediate = jest.fn((callback) => {
        capturedCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.deleteGroup, {
          userId: Data.user.id,
          pathParams: { groupId },
        });
        expect(res.statusCode).toBe(200);
        expect(capturedCallback).toBeDefined();

        // Restore setImmediate before executing the callback (which needs real async)
        global.setImmediate = originalSetImmediate;

        // Execute the cleanup callback
        await (capturedCallback as () => Promise<void>)();

        // Verify all related rows are physically deleted
        const cacheRows = await Database.knex('groupPlatformRating')
          .where('groupId', groupId);
        expect(cacheRows).toHaveLength(0);

        const memberRows = await Database.knex('userGroupMember')
          .where('groupId', groupId);
        expect(memberRows).toHaveLength(0);

        const groupRow = await Database.knex('userGroup')
          .where('id', groupId)
          .first();
        expect(groupRow).toBeUndefined();
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });

    test('returns 403 when viewer tries to delete the group', async () => {
      const groupId = await insertGroup({
        name: 'Protected Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.deleteGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(403);

      // Group should still be active
      const dbGroup = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbGroup.deletedAt).toBeNull();
    });
  });

  // ===========================================================================
  // 6. Member Addition
  // ===========================================================================

  describe('Member addition', () => {
    test('admin can add a member with specified role', async () => {
      const groupId = await insertGroup({
        name: 'Add Member Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: Data.user2.id, role: 'viewer' },
        });

        expect(res.statusCode).toBe(200);

        // Verify in database
        const membership = await Database.knex('userGroupMember')
          .where('groupId', groupId)
          .where('userId', Data.user2.id)
          .first();
        expect(membership).toBeDefined();
        expect(membership.role).toBe('viewer');
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });

    test('viewer gets 403 when trying to add a member', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Add Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { userId: user3.id, role: 'viewer' },
      });

      expect(res.statusCode).toBe(403);

      // user3 should NOT be added
      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', user3.id)
        .first();
      expect(membership).toBeUndefined();
    });

    test('returns 409 for duplicate membership', async () => {
      const groupId = await insertGroup({
        name: 'Duplicate Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: Data.user2.id, role: 'viewer' },
      });

      expect(res.statusCode).toBe(409);
    });

    test('returns 404 for nonexistent target user', async () => {
      const groupId = await insertGroup({
        name: 'Nonexistent User Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: 999999, role: 'viewer' },
      });

      expect(res.statusCode).toBe(404);
    });

    test('cache recalculation is triggered after member addition', async () => {
      const groupId = await insertGroup({
        name: 'Cache Trigger Add',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const recalcSpy = jest
        .spyOn(groupPlatformRatingCache, 'recalculateAllGroupPlatformRatings')
        .mockResolvedValue(undefined);

      const originalSetImmediate = global.setImmediate;
      let capturedCallback: (() => void) | null = null;

      global.setImmediate = jest.fn((callback) => {
        capturedCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: Data.user2.id, role: 'viewer' },
        });

        expect(res.statusCode).toBe(200);
        expect(capturedCallback).toBeDefined();

        // Execute the setImmediate callback
        global.setImmediate = originalSetImmediate;
        await (capturedCallback as () => Promise<void>)();

        expect(recalcSpy).toHaveBeenCalledWith(groupId);
      } finally {
        global.setImmediate = originalSetImmediate;
        recalcSpy.mockRestore();
      }
    });

    test('added member appears in group detail endpoint', async () => {
      const groupId = await insertGroup({
        name: 'Member Visibility',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        // Add user2 as viewer
        await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: Data.user2.id, role: 'viewer' },
        });

        // Verify member appears in detail
        const detailRes = await request(groupController.getGroup, {
          userId: Data.user.id,
          pathParams: { groupId },
        });
        const detail = detailRes.data as any;
        expect(detail.members).toHaveLength(2);
        const newMember = detail.members.find(
          (m: any) => m.userId === Data.user2.id
        );
        expect(newMember).toBeDefined();
        expect(newMember.role).toBe('viewer');
        expect(newMember.name).toBe(Data.user2.name);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });

  // ===========================================================================
  // 7. Member Removal
  // ===========================================================================

  describe('Member removal', () => {
    test('admin can remove a member', async () => {
      const groupId = await insertGroup({
        name: 'Remove Member Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: Data.user2.id },
        });

        expect(res.statusCode).toBe(200);

        // Verify member removed from DB
        const membership = await Database.knex('userGroupMember')
          .where('groupId', groupId)
          .where('userId', Data.user2.id)
          .first();
        expect(membership).toBeUndefined();
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });

    test('viewer gets 403 when trying to remove a member', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Remove Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user2.id,
        pathParams: { groupId, userId: Data.user.id },
      });

      expect(res.statusCode).toBe(403);

      // Admin should still be a member
      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user.id)
        .first();
      expect(membership).toBeDefined();
    });

    test('cache recalculation is triggered after member removal', async () => {
      const groupId = await insertGroup({
        name: 'Cache Trigger Remove',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const recalcSpy = jest
        .spyOn(groupPlatformRatingCache, 'recalculateAllGroupPlatformRatings')
        .mockResolvedValue(undefined);

      const originalSetImmediate = global.setImmediate;
      let capturedCallback: (() => void) | null = null;

      global.setImmediate = jest.fn((callback) => {
        capturedCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: Data.user2.id },
        });

        expect(res.statusCode).toBe(200);
        expect(capturedCallback).toBeDefined();

        // Execute the setImmediate callback
        global.setImmediate = originalSetImmediate;
        await (capturedCallback as () => Promise<void>)();

        expect(recalcSpy).toHaveBeenCalledWith(groupId);
      } finally {
        global.setImmediate = originalSetImmediate;
        recalcSpy.mockRestore();
      }
    });

    test('sole admin removal soft-deletes the group when other members exist', async () => {
      const beforeDelete = Date.now();
      const groupId = await insertGroup({
        name: 'Sole Admin Removal',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        // Admin removes themselves while other members exist
        const res = await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: Data.user.id },
        });

        expect(res.statusCode).toBe(200);

        // Group should be soft-deleted
        const dbGroup = await Database.knex('userGroup')
          .where('id', groupId)
          .first();
        expect(dbGroup.deletedAt).toBeGreaterThanOrEqual(beforeDelete);

        // Group should be excluded from listings
        const listRes = await request(groupController.listGroups, {
          userId: Data.user2.id,
        });
        const groups = listRes.data as any[];
        expect(groups.every((g: any) => g.id !== groupId)).toBe(true);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });

    test('removed member no longer appears in group detail', async () => {
      const groupId = await insertGroup({
        name: 'Remove Visibility',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        // Remove user2
        await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: Data.user2.id },
        });

        // Verify member no longer in detail
        const detailRes = await request(groupController.getGroup, {
          userId: Data.user.id,
          pathParams: { groupId },
        });
        const detail = detailRes.data as any;
        expect(detail.members).toHaveLength(1);
        expect(
          detail.members.every((m: any) => m.userId !== Data.user2.id)
        ).toBe(true);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });

  // ===========================================================================
  // 8. Role Update
  // ===========================================================================

  describe('Role update', () => {
    test('admin can promote a viewer to admin', async () => {
      const groupId = await insertGroup({
        name: 'Role Promote',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'admin' },
      });

      expect(res.statusCode).toBe(200);

      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user2.id)
        .first();
      expect(membership.role).toBe('admin');
    });

    test('admin can demote another admin when multiple admins exist', async () => {
      const groupId = await insertGroup({
        name: 'Multi Admin Demote',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'admin');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'viewer' },
      });

      expect(res.statusCode).toBe(200);

      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user2.id)
        .first();
      expect(membership.role).toBe('viewer');
    });

    test('cannot demote the last admin when other members exist (returns 400)', async () => {
      const groupId = await insertGroup({
        name: 'Last Admin Demote',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user.id },
        requestBody: { role: 'viewer' },
      });

      expect(res.statusCode).toBe(400);

      // Role should be unchanged
      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user.id)
        .first();
      expect(membership.role).toBe('admin');
    });

    test('viewer gets 403 when trying to change roles', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Role Change',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user2.id,
        pathParams: { groupId, userId: Data.user.id },
        requestBody: { role: 'viewer' },
      });

      expect(res.statusCode).toBe(403);
    });

    test('promoted viewer can now perform admin actions', async () => {
      const groupId = await insertGroup({
        name: 'Promoted Admin Actions',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      // Promote user2 to admin
      await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'admin' },
      });

      // user2 should now be able to rename the group
      const res = await request(groupController.updateGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { name: 'Renamed By New Admin' },
      });

      expect(res.statusCode).toBe(200);

      const dbGroup = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbGroup.name).toBe('Renamed By New Admin');
    });
  });

  // ===========================================================================
  // 9. User Search
  // ===========================================================================

  describe('User search', () => {
    test('returns matching users with case-insensitive search', async () => {
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'user' },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      expect(results.length).toBeGreaterThan(0);
      // Should find Data.user2 (name='user')
      expect(results.some((u: any) => u.id === Data.user2.id)).toBe(true);
    });

    test('excludes the current user from search results', async () => {
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: Data.user.name },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      expect(results.every((u: any) => u.id !== Data.user.id)).toBe(true);
    });

    test('respects max 20 results limit', async () => {
      // Create 25 additional test users
      const newUsers = Array.from({ length: 25 }, (_, i) => ({
        id: 200 + i,
        name: `searchtest${i}`,
        admin: false,
        password: 'testpass',
        publicReviews: false,
      }));
      await Database.knex('user').insert(newUsers);

      try {
        const res = await request(usersController.search, {
          userId: Data.user.id,
          requestQuery: { query: 'searchtest' },
        });

        expect(res.statusCode).toBe(200);
        const results = res.data as any[];
        expect(results.length).toBeLessThanOrEqual(20);
      } finally {
        // Clean up test users
        await Database.knex('user')
          .where('id', '>=', 200)
          .where('id', '<', 225)
          .delete();
      }
    });

    test('returns only id and name fields', async () => {
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'user' },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      results.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('admin');
      });
    });

    test('returns 400 for empty query', async () => {
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: '' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // 10. Full Lifecycle Flow
  // ===========================================================================

  describe('Full group lifecycle flow', () => {
    test('create → add members → list → detail → update → remove member → delete → verify cleanup', async () => {
      // Step 1: Create group
      const createRes = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Full Lifecycle Group' },
      });
      expect(createRes.statusCode).toBe(200);
      const groupId = (createRes.data as any).id;

      // Step 2: Add members (mock setImmediate to avoid real async work)
      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const addRes1 = await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: Data.user2.id, role: 'viewer' },
        });
        expect(addRes1.statusCode).toBe(200);

        const addRes2 = await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: user3.id, role: 'viewer' },
        });
        expect(addRes2.statusCode).toBe(200);
      } finally {
        global.setImmediate = originalSetImmediate;
      }

      // Step 3: List groups — verify member count
      const listRes = await request(groupController.listGroups, {
        userId: Data.user.id,
      });
      const group = (listRes.data as any[]).find(
        (g: any) => g.id === groupId
      );
      expect(group).toBeDefined();
      expect(group.memberCount).toBe(3);

      // Step 4: Detail — verify all members
      const detailRes = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });
      const detail = detailRes.data as any;
      expect(detail.members).toHaveLength(3);

      // Step 5: Update group name
      const updateRes = await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { name: 'Updated Lifecycle Group' },
      });
      expect(updateRes.statusCode).toBe(200);

      // Step 6: Remove a member
      global.setImmediate = jest.fn((callback) => {
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const removeRes = await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: user3.id },
        });
        expect(removeRes.statusCode).toBe(200);
      } finally {
        global.setImmediate = originalSetImmediate;
      }

      // Verify member count decreased
      const listRes2 = await request(groupController.listGroups, {
        userId: Data.user.id,
      });
      const group2 = (listRes2.data as any[]).find(
        (g: any) => g.id === groupId
      );
      expect(group2.memberCount).toBe(2);

      // Step 7: Delete the group
      let cleanupCallback: (() => void) | null = null;
      global.setImmediate = jest.fn((callback) => {
        cleanupCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const deleteRes = await request(groupController.deleteGroup, {
          userId: Data.user.id,
          pathParams: { groupId },
        });
        expect(deleteRes.statusCode).toBe(200);

        // Verify soft-deleted
        const softDeleted = await Database.knex('userGroup')
          .where('id', groupId)
          .first();
        expect(softDeleted.deletedAt).not.toBeNull();

        // Verify excluded from listing
        const listRes3 = await request(groupController.listGroups, {
          userId: Data.user.id,
        });
        expect(
          (listRes3.data as any[]).every((g: any) => g.id !== groupId)
        ).toBe(true);

        // Step 8: Execute async cleanup
        global.setImmediate = originalSetImmediate;
        expect(cleanupCallback).toBeDefined();
        await (cleanupCallback as () => Promise<void>)();

        // Verify physical cleanup
        const groupRow = await Database.knex('userGroup')
          .where('id', groupId)
          .first();
        expect(groupRow).toBeUndefined();

        const memberRows = await Database.knex('userGroupMember')
          .where('groupId', groupId);
        expect(memberRows).toHaveLength(0);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });

  // ===========================================================================
  // 11. Startup Sweep Cleanup
  // ===========================================================================

  describe('Startup sweep cleanup', () => {
    test('cleanupSoftDeletedGroups finds and cleans stale soft-deleted groups', async () => {
      // Create a group that was soft-deleted more than 1 hour ago
      const staleGroupId = await insertGroup({
        name: 'Stale Group',
        createdBy: Data.user.id,
        deletedAt: Date.now() - 7_200_000, // 2 hours ago
      });
      await insertMember(staleGroupId, Data.user.id, 'admin');
      await Database.knex('groupPlatformRating').insert({
        groupId: staleGroupId,
        mediaItemId: Data.movie.id,
        rating: 7.0,
      });

      // Create a recently soft-deleted group (should NOT be cleaned up)
      const recentGroupId = await insertGroup({
        name: 'Recent Group',
        createdBy: Data.user.id,
        deletedAt: Date.now() - 300_000, // 5 minutes ago
      });
      await insertMember(recentGroupId, Data.user.id, 'admin');

      // Run the startup sweep
      await groupCleanup.cleanupSoftDeletedGroups();

      // Stale group should be physically deleted
      const staleGroup = await Database.knex('userGroup')
        .where('id', staleGroupId)
        .first();
      expect(staleGroup).toBeUndefined();

      const staleCacheRows = await Database.knex('groupPlatformRating')
        .where('groupId', staleGroupId);
      expect(staleCacheRows).toHaveLength(0);

      const staleMemberRows = await Database.knex('userGroupMember')
        .where('groupId', staleGroupId);
      expect(staleMemberRows).toHaveLength(0);

      // Recent group should still exist (not cleaned up yet)
      const recentGroup = await Database.knex('userGroup')
        .where('id', recentGroupId)
        .first();
      expect(recentGroup).toBeDefined();
      expect(recentGroup.deletedAt).not.toBeNull();
    });
  });
});
