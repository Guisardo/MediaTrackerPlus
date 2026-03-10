import { Database } from 'src/dbconfig';
import { User } from 'src/entity/user';
import { UserGroup, UserGroupMember, UserGroupRole } from 'src/entity/userGroup';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { logger } from 'src/logger';
import { recalculateAllGroupPlatformRatings } from 'src/repository/groupPlatformRatingCache';
import { cleanupSoftDeletedGroup } from 'src/repository/groupCleanup';

interface GroupResponse {
  id: number;
  name: string;
  createdBy: number;
  createdAt: number;
  updatedAt: number | null;
  role: UserGroupRole;
  memberCount: number;
}

interface GroupMemberResponse {
  id: number;
  userId: number;
  name: string;
  role: UserGroupRole;
  addedAt: number;
}

interface GroupDetailResponse {
  id: number;
  name: string;
  createdBy: number;
  createdAt: number;
  updatedAt: number | null;
  role: UserGroupRole;
  members: GroupMemberResponse[];
}

/**
 * Returns the authenticated user's role in a group, or null if not a member.
 * Also returns null if the group is soft-deleted or doesn't exist.
 */
async function getUserRoleInGroup(
  groupId: number,
  userId: number
): Promise<UserGroupRole | null> {
  const membership = await Database.knex<UserGroupMember>('userGroupMember')
    .join('userGroup', 'userGroupMember.groupId', 'userGroup.id')
    .where('userGroupMember.groupId', groupId)
    .where('userGroupMember.userId', userId)
    .whereNull('userGroup.deletedAt')
    .select('userGroupMember.role')
    .first();

  return membership ? (membership.role as UserGroupRole) : null;
}

/**
 * @openapi_tags Group
 */
export class GroupController {
  /**
   * @openapi_operationId createGroup
   */
  createGroup = createExpressRoute<{
    method: 'post';
    path: '/api/group';
    requestBody: {
      name: string;
    };
    responseBody: {
      id: number;
      name: string;
      createdBy: number;
      createdAt: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { name } = req.body;

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.sendStatus(400);
      return;
    }

    const trimmedName = name.trim();
    const now = Date.now();

    const [groupId] = await Database.knex('userGroup').insert({
      name: trimmedName,
      createdBy: userId,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    await Database.knex('userGroupMember').insert({
      groupId: groupId,
      userId: userId,
      role: 'admin',
      addedAt: now,
    });

    res.json({
      id: groupId,
      name: trimmedName,
      createdBy: userId,
      createdAt: now,
    });
  });

  /**
   * @openapi_operationId listGroups
   */
  listGroups = createExpressRoute<{
    method: 'get';
    path: '/api/group';
    responseBody: GroupResponse[];
  }>(async (req, res) => {
    const userId = Number(req.user);

    const groups = await Database.knex<UserGroup>('userGroup')
      .join('userGroupMember', 'userGroup.id', 'userGroupMember.groupId')
      .where('userGroupMember.userId', userId)
      .whereNull('userGroup.deletedAt')
      .select(
        'userGroup.id',
        'userGroup.name',
        'userGroup.createdBy',
        'userGroup.createdAt',
        'userGroup.updatedAt',
        'userGroupMember.role'
      );

    const groupIds = groups.map((g: any) => g.id);

    if (groupIds.length === 0) {
      res.json([]);
      return;
    }

    const memberCounts = await Database.knex('userGroupMember')
      .whereIn('groupId', groupIds)
      .groupBy('groupId')
      .select('groupId')
      .count('id as memberCount');

    const countMap = new Map<number, number>();
    for (const row of memberCounts) {
      countMap.set(Number((row as any).groupId), Number((row as any).memberCount));
    }

    const result: GroupResponse[] = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      createdBy: g.createdBy,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      role: g.role as UserGroupRole,
      memberCount: countMap.get(g.id) ?? 0,
    }));

    res.json(result);
  });

  /**
   * @openapi_operationId getGroup
   */
  getGroup = createExpressRoute<{
    method: 'get';
    path: '/api/group/:groupId';
    pathParams: {
      groupId: number;
    };
    responseBody: GroupDetailResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { groupId } = req.params;

    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    const userRole = await getUserRoleInGroup(groupId, userId);

    if (!userRole) {
      res.sendStatus(403);
      return;
    }

    const members = await Database.knex<UserGroupMember>('userGroupMember')
      .join('user', 'userGroupMember.userId', 'user.id')
      .where('userGroupMember.groupId', groupId)
      .select(
        'userGroupMember.id',
        'userGroupMember.userId',
        'user.name',
        'userGroupMember.role',
        'userGroupMember.addedAt'
      );

    const response: GroupDetailResponse = {
      id: group.id,
      name: group.name,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      role: userRole,
      members: members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role as UserGroupRole,
        addedAt: m.addedAt,
      })),
    };

    res.json(response);
  });

  /**
   * @openapi_operationId updateGroup
   */
  updateGroup = createExpressRoute<{
    method: 'put';
    path: '/api/group/:groupId';
    pathParams: {
      groupId: number;
    };
    requestBody: {
      name: string;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { groupId } = req.params;
    const { name } = req.body;

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.sendStatus(400);
      return;
    }

    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    const userRole = await getUserRoleInGroup(groupId, userId);

    if (userRole !== 'admin') {
      res.sendStatus(403);
      return;
    }

    await Database.knex('userGroup').where('id', groupId).update({
      name: name.trim(),
      updatedAt: Date.now(),
    });

    res.sendStatus(200);
  });

  /**
   * @openapi_operationId deleteGroup
   */
  deleteGroup = createExpressRoute<{
    method: 'delete';
    path: '/api/group/:groupId';
    pathParams: {
      groupId: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { groupId } = req.params;

    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    const userRole = await getUserRoleInGroup(groupId, userId);

    if (userRole !== 'admin') {
      res.sendStatus(403);
      return;
    }

    await Database.knex('userGroup').where('id', groupId).update({
      deletedAt: Date.now(),
    });

    res.sendStatus(200);

    // Fire-and-forget post-response cleanup using setImmediate.
    // Executes AFTER the response is sent, so HTTP latency is unaffected.
    // Performs the actual transactional cleanup: delete groupPlatformRating,
    // userGroupMember, and the userGroup row itself.
    // If this fails, the soft-deleted group remains eligible for the startup sweep.
    setImmediate(() => {
      cleanupSoftDeletedGroup(groupId).catch((err) => {
        logger.error('Failed to clean up soft-deleted group', {
          err,
          groupId,
        });
      });
    });
  });

  /**
   * @openapi_operationId addGroupMember
   */
  addGroupMember = createExpressRoute<{
    method: 'post';
    path: '/api/group/:groupId/member';
    pathParams: {
      groupId: number;
    };
    requestBody: {
      userId: number;
      role: UserGroupRole;
    };
  }>(async (req, res) => {
    const requestUserId = Number(req.user);
    const { groupId } = req.params;
    const { userId: targetUserId, role } = req.body;

    // Validate role
    if (role !== 'admin' && role !== 'viewer') {
      res.sendStatus(400);
      return;
    }

    // Verify group exists and is not soft-deleted
    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    // Verify requester is admin
    const requesterRole = await getUserRoleInGroup(groupId, requestUserId);

    if (requesterRole !== 'admin') {
      res.sendStatus(403);
      return;
    }

    // Verify target user exists
    const targetUser = await Database.knex<User>('user')
      .where('id', targetUserId)
      .first();

    if (!targetUser) {
      res.sendStatus(404);
      return;
    }

    // Check for duplicate membership
    const existingMembership = await Database.knex<UserGroupMember>(
      'userGroupMember'
    )
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .first();

    if (existingMembership) {
      res.sendStatus(409);
      return;
    }

    await Database.knex('userGroupMember').insert({
      groupId,
      userId: targetUserId,
      role,
      addedAt: Date.now(),
    });

    res.sendStatus(200);

    // Fire-and-forget post-response work using setImmediate.
    // Executes AFTER the response is sent, so HTTP latency is unaffected.
    // Triggered whenever a member is added to a group.
    setImmediate(() => {
      recalculateAllGroupPlatformRatings(groupId).catch((err) => {
        logger.error('Failed to recalculate group platform ratings after member add', {
          err,
          groupId,
          targetUserId,
        });
      });
    });
  });

  /**
   * @openapi_operationId removeGroupMember
   */
  removeGroupMember = createExpressRoute<{
    method: 'delete';
    path: '/api/group/:groupId/member/:userId';
    pathParams: {
      groupId: number;
      userId: number;
    };
  }>(async (req, res) => {
    const requestUserId = Number(req.user);
    const { groupId, userId: targetUserId } = req.params;

    // Verify group exists and is not soft-deleted
    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    // Verify requester is admin
    const requesterRole = await getUserRoleInGroup(groupId, requestUserId);

    if (requesterRole !== 'admin') {
      res.sendStatus(403);
      return;
    }

    // Verify target user is a member
    const targetMembership = await Database.knex<UserGroupMember>(
      'userGroupMember'
    )
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .first();

    if (!targetMembership) {
      res.sendStatus(404);
      return;
    }

    // Check if target is the sole admin and other members exist
    if (targetMembership.role === 'admin') {
      const adminCount = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('role', 'admin')
        .count('id as count')
        .first();

      const memberCount = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .count('id as count')
        .first();

      const numAdmins = Number((adminCount as any).count);
      const numMembers = Number((memberCount as any).count);

      // If this is the sole admin and there are other members, soft-delete the group
      if (numAdmins === 1 && numMembers > 1) {
        await Database.knex('userGroup').where('id', groupId).update({
          deletedAt: Date.now(),
        });

        res.sendStatus(200);

        // Fire-and-forget post-response cleanup using setImmediate.
        // Same transactional cleanup as the explicit DELETE /api/group/:groupId path.
        // If this fails, the soft-deleted group remains eligible for the startup sweep.
        setImmediate(() => {
          cleanupSoftDeletedGroup(groupId).catch((err) => {
            logger.error(
              'Failed to clean up soft-deleted group after sole-admin removal',
              {
                err,
                groupId,
              }
            );
          });
        });

        return;
      }
    }

    // Remove the member
    await Database.knex('userGroupMember')
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .delete();

    res.sendStatus(200);

    // Fire-and-forget post-response work using setImmediate.
    // Executes AFTER the response is sent, so HTTP latency is unaffected.
    // Triggered whenever a member is removed from a group.
    setImmediate(() => {
      recalculateAllGroupPlatformRatings(groupId).catch((err) => {
        logger.error('Failed to recalculate group platform ratings after member remove', {
          err,
          groupId,
          targetUserId,
        });
      });
    });
  });

  /**
   * @openapi_operationId updateGroupMemberRole
   */
  updateGroupMemberRole = createExpressRoute<{
    method: 'put';
    path: '/api/group/:groupId/member/:userId';
    pathParams: {
      groupId: number;
      userId: number;
    };
    requestBody: {
      role: UserGroupRole;
    };
  }>(async (req, res) => {
    const requestUserId = Number(req.user);
    const { groupId, userId: targetUserId } = req.params;
    const { role } = req.body;

    // Validate role
    if (role !== 'admin' && role !== 'viewer') {
      res.sendStatus(400);
      return;
    }

    // Verify group exists and is not soft-deleted
    const group = await Database.knex<UserGroup>('userGroup')
      .where('id', groupId)
      .whereNull('deletedAt')
      .first();

    if (!group) {
      res.sendStatus(404);
      return;
    }

    // Verify requester is admin
    const requesterRole = await getUserRoleInGroup(groupId, requestUserId);

    if (requesterRole !== 'admin') {
      res.sendStatus(403);
      return;
    }

    // Verify target user is a member
    const targetMembership = await Database.knex<UserGroupMember>(
      'userGroupMember'
    )
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .first();

    if (!targetMembership) {
      res.sendStatus(404);
      return;
    }

    // Prevent demoting the last admin if other members exist
    if (targetMembership.role === 'admin' && role === 'viewer') {
      const adminCount = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .where('role', 'admin')
        .count('id as count')
        .first();

      const memberCount = await Database.knex('userGroupMember')
        .where('groupId', groupId)
        .count('id as count')
        .first();

      const numAdmins = Number((adminCount as any).count);
      const numMembers = Number((memberCount as any).count);

      // Cannot demote the last admin if other members exist
      if (numAdmins === 1 && numMembers > 1) {
        res.sendStatus(400);
        return;
      }
    }

    await Database.knex('userGroupMember')
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .update({ role });

    res.sendStatus(200);
  });
}
