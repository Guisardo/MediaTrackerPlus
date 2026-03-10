import { Database } from 'src/dbconfig';
import { logger } from 'src/logger';

/**
 * Group Platform Rating Cache
 *
 * Provides functions to compute and store the average estimated rating for a
 * user group, so the Platform Recommended sort query can use cached values
 * instead of computing on the fly.
 *
 * The 3-table join path is:
 *   listItem.listId -> list.id, list.userId -> userGroupMember.userId
 *                                              (filtered by userGroupMember.groupId)
 *
 * listItem has no direct userId column, so we must join through the list table
 * to identify which user owns the list item.
 *
 * All functions are designed to be called via setImmediate() for fire-and-forget
 * usage after HTTP responses are sent, consistent with the existing
 * recalculatePlatformRating pattern in mediaItem.ts.
 *
 * All upsert operations use INSERT ... ON CONFLICT ... DO UPDATE (Knex
 * onConflict().merge()) to handle concurrent recalculations safely.
 */

/**
 * Recalculates the group platform rating cache for a single (groupId, mediaItemId) pair.
 *
 * Computes AVG(listItem.estimatedRating) across all group members who have a
 * non-null estimatedRating for the given media item, using the join path:
 *   listItem -> list (via listId) -> userGroupMember (via list.userId = ugm.userId AND ugm.groupId)
 *
 * If no group members have an estimatedRating for the media item, the cached
 * rating is set to NULL (clearing any stale value).
 *
 * @param groupId - The ID of the user group.
 * @param mediaItemId - The ID of the media item whose group cache should be refreshed.
 */
export async function recalculateGroupPlatformRating(
  groupId: number,
  mediaItemId: number
): Promise<void> {
  const knex = Database.knex;

  // Compute the average estimatedRating for this group + media item
  const result = await knex('listItem')
    .join('list', 'listItem.listId', 'list.id')
    .join('userGroupMember', function () {
      this.on('list.userId', '=', 'userGroupMember.userId').andOn(
        'userGroupMember.groupId',
        '=',
        knex.raw('?', [groupId])
      );
    })
    .where('listItem.mediaItemId', mediaItemId)
    .whereNotNull('listItem.estimatedRating')
    .avg('listItem.estimatedRating as avgRating')
    .first();

  const avgRating =
    result?.avgRating != null ? Number(result.avgRating) : null;

  if (avgRating != null) {
    // Upsert: insert or update the cached rating
    await knex('groupPlatformRating')
      .insert({
        groupId,
        mediaItemId,
        rating: avgRating,
      })
      .onConflict(['groupId', 'mediaItemId'])
      .merge(['rating']);
  } else {
    // No members have ratings — delete the cache row if it exists
    // (clearing stale cache)
    await knex('groupPlatformRating')
      .where({ groupId, mediaItemId })
      .delete();
  }
}

/**
 * Recalculates the group platform rating cache for ALL media items in a group.
 *
 * Uses a single bulk query to compute AVG(estimatedRating) per mediaItemId
 * for all media items where at least one group member has an estimatedRating.
 * Then performs a bulk upsert into groupPlatformRating.
 *
 * Also cleans up groupPlatformRating rows for this group where no members
 * have ratings anymore (stale cache entries).
 *
 * @param groupId - The ID of the user group whose cache should be fully refreshed.
 */
export async function recalculateAllGroupPlatformRatings(
  groupId: number
): Promise<void> {
  const knex = Database.knex;

  // Step 1: Compute AVG(estimatedRating) per mediaItemId for all media items
  // where at least one group member has an estimatedRating
  const avgRatings: Array<{ mediaItemId: number; avgRating: number }> =
    await knex('listItem')
      .join('list', 'listItem.listId', 'list.id')
      .join('userGroupMember', function () {
        this.on('list.userId', '=', 'userGroupMember.userId').andOn(
          'userGroupMember.groupId',
          '=',
          knex.raw('?', [groupId])
        );
      })
      .whereNotNull('listItem.estimatedRating')
      .groupBy('listItem.mediaItemId')
      .select(
        'listItem.mediaItemId',
        knex.raw('AVG("listItem"."estimatedRating") as "avgRating"')
      );

  // Step 2: Clean up all existing cache rows for this group that are no longer valid
  // (media items where no group member has an estimatedRating anymore)
  const validMediaItemIds = avgRatings.map((r) => r.mediaItemId);

  if (validMediaItemIds.length > 0) {
    // Delete cache rows for this group that are NOT in the valid set
    await knex('groupPlatformRating')
      .where('groupId', groupId)
      .whereNotIn('mediaItemId', validMediaItemIds)
      .delete();
  } else {
    // No valid ratings at all — clear all cache rows for this group
    await knex('groupPlatformRating').where('groupId', groupId).delete();
  }

  // Step 3: Bulk upsert the computed averages
  if (avgRatings.length > 0) {
    const rows = avgRatings.map((r) => ({
      groupId,
      mediaItemId: r.mediaItemId,
      rating: Number(r.avgRating),
    }));

    await knex('groupPlatformRating')
      .insert(rows)
      .onConflict(['groupId', 'mediaItemId'])
      .merge(['rating']);
  }
}

/**
 * Recalculates the group platform rating cache for a specific media item
 * across ALL groups that a given user belongs to.
 *
 * This is triggered when a user's estimatedRating changes (e.g., via
 * watchlistWriter, import pipelines, or watchlist item removal) so that
 * every group the user belongs to gets an updated cache entry for that item.
 *
 * @param userId - The ID of the user whose group memberships should be updated.
 * @param mediaItemId - The ID of the media item whose cache should be refreshed.
 */
export async function recalculateGroupPlatformRatingsForUser(
  userId: number,
  mediaItemId: number
): Promise<void> {
  const knex = Database.knex;

  // Find all groups the user belongs to
  const memberships: Array<{ groupId: number }> = await knex(
    'userGroupMember'
  )
    .where('userId', userId)
    .select('groupId');

  // Recalculate the cache for each group
  await Promise.all(
    memberships.map((m) =>
      recalculateGroupPlatformRating(m.groupId, mediaItemId).catch((err) => {
        logger.error(
          'Failed to recalculate group platform rating for group',
          {
            err,
            groupId: m.groupId,
            mediaItemId,
            userId,
          }
        );
      })
    )
  );
}
