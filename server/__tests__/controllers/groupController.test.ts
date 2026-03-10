import { GroupController } from 'src/controllers/group';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * GroupController tests.
 *
 * Covers:
 *  - createGroup: creates group and auto-assigns creator as admin
 *  - createGroup: validates non-empty name
 *  - listGroups: returns groups the user belongs to with role and member count
 *  - listGroups: filters out soft-deleted groups
 *  - getGroup: returns group details with member list for members
 *  - getGroup: returns 403 for non-members
 *  - getGroup: returns 404 for non-existent or soft-deleted groups
 *  - updateGroup: admin can rename group and updatedAt is set
 *  - updateGroup: returns 403 for non-admin (viewer)
 *  - updateGroup: validates non-empty name
 *  - deleteGroup: soft-deletes the group by setting deletedAt
 *  - deleteGroup: returns 403 for non-admin
 */
describe('GroupController', () => {
  let groupController: GroupController;

  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
  });

  beforeEach(() => {
    groupController = new GroupController();
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // Helper to create a group directly in DB
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

  afterEach(async () => {
    await Database.knex('userGroupMember').delete();
    await Database.knex('userGroup').delete();
  });

  // ---------------------------------------------------------------------------
  // createGroup
  // ---------------------------------------------------------------------------

  describe('createGroup', () => {
    test('returns HTTP 200 with the created group on success', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'My Group' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('id');
      expect(data.name).toBe('My Group');
      expect(data.createdBy).toBe(Data.user.id);
    });

    test('persists the group in the database', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Persistent Group' },
      });

      const created = res.data as any;
      const dbRow = await Database.knex('userGroup')
        .where('id', created.id)
        .first();

      expect(dbRow).toBeDefined();
      expect(dbRow.name).toBe('Persistent Group');
      expect(dbRow.deletedAt).toBeNull();
    });

    test('auto-assigns creator as admin member', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: 'Admin Group' },
      });

      const created = res.data as any;
      const membership = await Database.knex('userGroupMember')
        .where('groupId', created.id)
        .where('userId', Data.user.id)
        .first();

      expect(membership).toBeDefined();
      expect(membership.role).toBe('admin');
    });

    test('trims whitespace from the group name', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: '  Trimmed Name  ' },
      });

      expect(res.statusCode).toBe(200);
      const created = res.data as any;
      expect(created.name).toBe('Trimmed Name');
    });

    test('returns HTTP 400 when name is empty string', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when name is whitespace only', async () => {
      const res = await request(groupController.createGroup, {
        userId: Data.user.id,
        requestBody: { name: '   ' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // listGroups
  // ---------------------------------------------------------------------------

  describe('listGroups', () => {
    test('returns groups the user belongs to with role and member count', async () => {
      const groupId = await insertGroup({
        name: 'Test Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(res.statusCode).toBe(200);
      const groups = res.data as any[];
      expect(groups.length).toBe(1);
      expect(groups[0].id).toBe(groupId);
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].role).toBe('admin');
      expect(groups[0].memberCount).toBe(2);
    });

    test('returns empty array when user has no groups', async () => {
      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual([]);
    });

    test('filters out soft-deleted groups', async () => {
      const activeGroupId = await insertGroup({
        name: 'Active Group',
        createdBy: Data.user.id,
      });
      const deletedGroupId = await insertGroup({
        name: 'Deleted Group',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(activeGroupId, Data.user.id, 'admin');
      await insertMember(deletedGroupId, Data.user.id, 'admin');

      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(res.statusCode).toBe(200);
      const groups = res.data as any[];
      expect(groups.length).toBe(1);
      expect(groups[0].id).toBe(activeGroupId);
    });

    test('does not include groups the user is not a member of', async () => {
      const groupId = await insertGroup({
        name: 'Other User Group',
        createdBy: Data.user2.id,
      });
      await insertMember(groupId, Data.user2.id, 'admin');

      const res = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      expect(res.statusCode).toBe(200);
      const groups = res.data as any[];
      expect(groups.every((g: any) => g.id !== groupId)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getGroup
  // ---------------------------------------------------------------------------

  describe('getGroup', () => {
    test('returns group details with member list for a member', async () => {
      const groupId = await insertGroup({
        name: 'Detail Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.id).toBe(groupId);
      expect(data.name).toBe('Detail Group');
      expect(data.role).toBe('admin');
      expect(Array.isArray(data.members)).toBe(true);
      expect(data.members.length).toBe(2);
    });

    test('member list includes user id, name, role', async () => {
      const groupId = await insertGroup({
        name: 'Members Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      const data = res.data as any;
      const user2Member = data.members.find(
        (m: any) => m.userId === Data.user2.id
      );
      expect(user2Member).toBeDefined();
      expect(user2Member.name).toBe(Data.user2.name);
      expect(user2Member.role).toBe('viewer');
    });

    test('returns HTTP 403 for non-members', async () => {
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

    test('returns HTTP 404 for a non-existent group', async () => {
      const res = await request(groupController.getGroup, {
        userId: Data.user.id,
        pathParams: { groupId: 999999 },
      });

      expect(res.statusCode).toBe(404);
    });

    test('returns HTTP 404 for a soft-deleted group', async () => {
      const groupId = await insertGroup({
        name: 'Deleted Group',
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

  // ---------------------------------------------------------------------------
  // updateGroup
  // ---------------------------------------------------------------------------

  describe('updateGroup', () => {
    test('admin can rename the group and updatedAt is set', async () => {
      const beforeUpdate = Date.now();
      const groupId = await insertGroup({
        name: 'Original Name',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { name: 'Updated Name' },
      });

      expect(res.statusCode).toBe(200);

      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbRow.name).toBe('Updated Name');
      expect(dbRow.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    });

    test('returns HTTP 403 when viewer tries to update group name', async () => {
      const groupId = await insertGroup({
        name: 'Admin Only Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { name: 'Hijacked Name' },
      });

      expect(res.statusCode).toBe(403);

      // Name should be unchanged
      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbRow.name).toBe('Admin Only Group');
    });

    test('returns HTTP 403 when non-member tries to update group name', async () => {
      const groupId = await insertGroup({
        name: 'Some Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.updateGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { name: 'Stolen Name' },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns HTTP 400 when new name is empty', async () => {
      const groupId = await insertGroup({
        name: 'Valid Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { name: '   ' },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 404 for non-existent group', async () => {
      const res = await request(groupController.updateGroup, {
        userId: Data.user.id,
        pathParams: { groupId: 999999 },
        requestBody: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteGroup
  // ---------------------------------------------------------------------------

  describe('deleteGroup', () => {
    test('admin can soft-delete the group by setting deletedAt', async () => {
      const beforeDelete = Date.now();
      const groupId = await insertGroup({
        name: 'To Be Deleted',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.deleteGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(200);

      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbRow).toBeDefined();
      expect(dbRow.deletedAt).toBeGreaterThanOrEqual(beforeDelete);
    });

    test('soft-deleted group is excluded from group listings', async () => {
      const groupId = await insertGroup({
        name: 'Will Be Deleted',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      await request(groupController.deleteGroup, {
        userId: Data.user.id,
        pathParams: { groupId },
      });

      const listRes = await request(groupController.listGroups, {
        userId: Data.user.id,
      });

      const groups = listRes.data as any[];
      expect(groups.every((g: any) => g.id !== groupId)).toBe(true);
    });

    test('returns HTTP 403 when viewer tries to delete the group', async () => {
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

      // Group should still exist and not be soft-deleted
      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbRow.deletedAt).toBeNull();
    });

    test('returns HTTP 403 when non-member tries to delete the group', async () => {
      const groupId = await insertGroup({
        name: 'Other Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.deleteGroup, {
        userId: Data.user2.id,
        pathParams: { groupId },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns HTTP 404 for a non-existent group', async () => {
      const res = await request(groupController.deleteGroup, {
        userId: Data.user.id,
        pathParams: { groupId: 999999 },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
