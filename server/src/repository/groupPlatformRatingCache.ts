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
 * Computes AVG across all group-member rating signals, mirroring the global
 * recalculatePlatformRating logic but scoped to group members:
 *   1. userRating.rating — explicit item-level ratings (episodeId IS NULL AND seasonId IS NULL),
 *      matching the same filter used by the global platformRating computation.
 *   2. listItem.estimatedRating — AI-estimated ratings from the recommendation pipeline,
 *      accessed via the 3-table join: listItem -> list -> userGroupMember.
 *
 * Both sources contribute equally to the AVG. If no group members have any rating
 * signal for the media item, the cached rating is deleted (clearing any stale value).
 *
 * @param groupId - The ID of the user group.
 * @param mediaItemId - The ID of the media item whose group cache should be refreshed.
 */
export async function recalculateGroupPlatformRating(
  groupId: number,
  mediaItemId: number
): Promise<void> {
  const knex = Database.knex;

  // Compute the average of all group-member rating signals using a UNION ALL subquery.
  // The UNION ALL combines two independent sources for the same media item:
  //   - Explicit user ratings (userRating table, item-level only)
  //   - AI-estimated ratings (listItem table, via the list ownership join)
  // Using knex.raw for the UNION ALL subquery because knex's query builder does not
  // cleanly express AVG over a UNION ALL without a raw subquery wrapper.
  const rows: Array<{ avgRating: string | number | null }> = await knex.raw(
    `SELECT AVG(r) AS "avgRating" FROM (
      SELECT ur."rating" AS r
      FROM "userRating" ur
      JOIN "userGroupMember" ugm ON ugm."userId" = ur."userId" AND ugm."groupId" = ?
      WHERE ur."mediaItemId" = ?
        AND ur."rating" IS NOT NULL
        AND ur."episodeId" IS NULL
        AND ur."seasonId" IS NULL
      UNION ALL
      SELECT li."estimatedRating" AS r
      FROM "listItem" li
      JOIN "list" l ON li."listId" = l."id"
      JOIN "userGroupMember" ugm ON ugm."userId" = l."userId" AND ugm."groupId" = ?
      WHERE li."mediaItemId" = ?
        AND li."estimatedRating" IS NOT NULL
    ) AS combined_ratings`,
    [groupId, mediaItemId, groupId, mediaItemId]
  );

  const avgRating =
    rows[0]?.avgRating != null ? Number(rows[0].avgRating) : null;

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
 * Uses a single bulk query to compute AVG across both rating signals per mediaItemId:
 *   1. userRating.rating — explicit item-level ratings from group members
 *   2. listItem.estimatedRating — AI-estimated ratings from group members
 * Both sources are combined via UNION ALL before computing the per-item AVG.
 *
 * Also cleans up groupPlatformRating rows for this group where no members
 * have any rating signal anymore (stale cache entries).
 *
 * @param groupId - The ID of the user group whose cache should be fully refreshed.
 */
export async function recalculateAllGroupPlatformRatings(
  groupId: number
): Promise<void> {
  const knex = Database.knex;

  // Step 1: Compute AVG of all rating signals per mediaItemId for group members.
  // UNION ALL combines userRating (explicit) + listItem.estimatedRating (AI-estimated).
  const avgRatings: Array<{ mediaItemId: number; avgRating: string | number }> =
    await knex.raw(
      `SELECT "mediaItemId", AVG(r) AS "avgRating"
       FROM (
         SELECT ur."mediaItemId", ur."rating" AS r
         FROM "userRating" ur
         JOIN "userGroupMember" ugm ON ugm."userId" = ur."userId" AND ugm."groupId" = ?
         WHERE ur."rating" IS NOT NULL
           AND ur."episodeId" IS NULL
           AND ur."seasonId" IS NULL
         UNION ALL
         SELECT li."mediaItemId", li."estimatedRating" AS r
         FROM "listItem" li
         JOIN "list" l ON li."listId" = l."id"
         JOIN "userGroupMember" ugm ON ugm."userId" = l."userId" AND ugm."groupId" = ?
         WHERE li."estimatedRating" IS NOT NULL
       ) AS combined
       GROUP BY "mediaItemId"`,
      [groupId, groupId]
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

  // Step 3: Bulk upsert the computed averages.
  // Chunked to respect SQLite's SQLITE_LIMIT_COMPOUND_SELECT limit of 500 terms:
  // Knex's bulk insert generates one UNION ALL SELECT term per row, so batches
  // larger than 500 rows throw "too many terms in compound SELECT".
  if (avgRatings.length > 0) {
    const rows = avgRatings.map((r) => ({
      groupId,
      mediaItemId: r.mediaItemId,
      rating: Number(r.avgRating),
    }));

    const SQLITE_COMPOUND_SELECT_LIMIT = 500;
    for (let i = 0; i < rows.length; i += SQLITE_COMPOUND_SELECT_LIMIT) {
      const chunk = rows.slice(i, i + SQLITE_COMPOUND_SELECT_LIMIT);
      await knex('groupPlatformRating')
        .insert(chunk)
        .onConflict(['groupId', 'mediaItemId'])
        .merge(['rating']);
    }
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
