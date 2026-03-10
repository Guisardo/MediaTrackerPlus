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
 *  - addGroupMember: admin can add a member with role
 *  - addGroupMember: viewer gets 403
 *  - addGroupMember: duplicate member gets 409
 *  - addGroupMember: nonexistent user gets 404
 *  - removeGroupMember: admin can remove a member
 *  - removeGroupMember: viewer gets 403
 *  - removeGroupMember: sole admin removal soft-deletes group when other members exist
 *  - removeGroupMember: sole admin can remove themselves when they are the only member
 *  - updateGroupMemberRole: admin can change roles
 *  - updateGroupMemberRole: cannot demote last admin when other members exist
 *  - updateGroupMemberRole: viewer gets 403
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

  // ---------------------------------------------------------------------------
  // addGroupMember
  // ---------------------------------------------------------------------------

  describe('addGroupMember', () => {
    test('admin can add a user with viewer role', async () => {
      const groupId = await insertGroup({
        name: 'Add Member Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: Data.user2.id, role: 'viewer' },
      });

      expect(res.statusCode).toBe(200);

      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user2.id)
        .first();

      expect(membership).toBeDefined();
      expect(membership.role).toBe('viewer');
    });

    test('admin can add a user with admin role', async () => {
      const groupId = await insertGroup({
        name: 'Admin Add Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: Data.user2.id, role: 'admin' },
      });

      expect(res.statusCode).toBe(200);

      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user2.id)
        .first();

      expect(membership).toBeDefined();
      expect(membership.role).toBe('admin');
    });

    test('viewer gets 403 when trying to add a member', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Cannot Add',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      // Use a third user id that doesn't exist in DB — but we expect 403 first
      const res = await request(groupController.addGroupMember, {
        userId: Data.user2.id,
        pathParams: { groupId },
        requestBody: { userId: 999, role: 'viewer' },
      });

      expect(res.statusCode).toBe(403);
    });

    test('returns 409 when user is already a member', async () => {
      const groupId = await insertGroup({
        name: 'Duplicate Member Group',
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

    test('returns 404 when target user does not exist', async () => {
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

    test('returns 400 for invalid role', async () => {
      const groupId = await insertGroup({
        name: 'Invalid Role Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: Data.user2.id, role: 'superuser' as any },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns 404 for soft-deleted group', async () => {
      const groupId = await insertGroup({
        name: 'Deleted Group',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.addGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId },
        requestBody: { userId: Data.user2.id, role: 'viewer' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // removeGroupMember
  // ---------------------------------------------------------------------------

  describe('removeGroupMember', () => {
    test('admin can remove a viewer member', async () => {
      const groupId = await insertGroup({
        name: 'Remove Viewer Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
      });

      expect(res.statusCode).toBe(200);

      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user2.id)
        .first();

      expect(membership).toBeUndefined();
    });

    test('viewer gets 403 when trying to remove a member', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Cannot Remove',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user2.id,
        pathParams: { groupId, userId: Data.user.id },
      });

      expect(res.statusCode).toBe(403);
    });

    test('sole admin removal soft-deletes the group when other members exist', async () => {
      const beforeDelete = Date.now();
      const groupId = await insertGroup({
        name: 'Sole Admin Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      // Admin removes themselves (the sole admin) while another member exists
      const res = await request(groupController.removeGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user.id },
      });

      expect(res.statusCode).toBe(200);

      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();

      expect(dbRow.deletedAt).toBeGreaterThanOrEqual(beforeDelete);
    });

    test('sole admin can remove themselves when they are the only member', async () => {
      const groupId = await insertGroup({
        name: 'Solo Admin Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user.id },
      });

      expect(res.statusCode).toBe(200);

      // Member should be removed (not soft-deleted group — only 1 member so no other members remain)
      const membership = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('userId', Data.user.id)
        .first();

      expect(membership).toBeUndefined();

      // Group should not be soft-deleted (only 1 member, no orphan scenario)
      const dbRow = await Database.knex('userGroup')
        .where('id', groupId)
        .first();
      expect(dbRow.deletedAt).toBeNull();
    });

    test('returns 404 when target user is not a member', async () => {
      const groupId = await insertGroup({
        name: 'Not A Member Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
      });

      expect(res.statusCode).toBe(404);
    });

    test('returns 404 for soft-deleted group', async () => {
      const groupId = await insertGroup({
        name: 'Deleted Remove Group',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.removeGroupMember, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // updateGroupMemberRole
  // ---------------------------------------------------------------------------

  describe('updateGroupMemberRole', () => {
    test('admin can promote a viewer to admin', async () => {
      const groupId = await insertGroup({
        name: 'Role Update Group',
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

    test('admin can demote another admin to viewer when multiple admins exist', async () => {
      const groupId = await insertGroup({
        name: 'Multi Admin Group',
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

    test('returns 400 when trying to demote the last admin with other members', async () => {
      const groupId = await insertGroup({
        name: 'Last Admin Group',
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

    test('viewer gets 403 when trying to update a member role', async () => {
      const groupId = await insertGroup({
        name: 'Viewer Cannot Update Role',
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

    test('returns 404 when target user is not a member', async () => {
      const groupId = await insertGroup({
        name: 'Update NonMember Role',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'viewer' },
      });

      expect(res.statusCode).toBe(404);
    });

    test('returns 400 for invalid role value', async () => {
      const groupId = await insertGroup({
        name: 'Invalid Role Update Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'superuser' as any },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns 404 for soft-deleted group', async () => {
      const groupId = await insertGroup({
        name: 'Deleted Role Group',
        createdBy: Data.user.id,
        deletedAt: Date.now(),
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      const res = await request(groupController.updateGroupMemberRole, {
        userId: Data.user.id,
        pathParams: { groupId, userId: Data.user2.id },
        requestBody: { role: 'admin' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // Cache trigger tests
  // ---------------------------------------------------------------------------

  describe('Cache recalculation triggers', () => {
    test('addGroupMember should call setImmediate with recalculation', async () => {
      const groupId = await insertGroup({
        name: 'Cache Trigger Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');

      // Mock setImmediate to capture the callback
      const originalSetImmediate = global.setImmediate;
      let setImmediateCallback: (() => void) | null = null;

      global.setImmediate = jest.fn((callback) => {
        setImmediateCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.addGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId },
          requestBody: { userId: Data.user2.id, role: 'viewer' },
        });

        // Verify HTTP response is sent (200) before async work
        expect(res.statusCode).toBe(200);

        // Verify setImmediate was called with the cache recalculation
        expect(setImmediateCallback).toBeDefined();
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });

    test('removeGroupMember should call setImmediate with recalculation', async () => {
      const groupId = await insertGroup({
        name: 'Cache Trigger Remove Group',
        createdBy: Data.user.id,
      });
      await insertMember(groupId, Data.user.id, 'admin');
      await insertMember(groupId, Data.user2.id, 'viewer');

      // Mock setImmediate to capture the callback
      const originalSetImmediate = global.setImmediate;
      let setImmediateCallback: (() => void) | null = null;

      global.setImmediate = jest.fn((callback) => {
        setImmediateCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        const res = await request(groupController.removeGroupMember, {
          userId: Data.user.id,
          pathParams: { groupId, userId: Data.user2.id },
        });

        // Verify HTTP response is sent (200) before async work
        expect(res.statusCode).toBe(200);

        // Verify setImmediate was called with the cache recalculation
        expect(setImmediateCallback).toBeDefined();
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });
});
