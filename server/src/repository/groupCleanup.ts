import { Database } from 'src/dbconfig';
import { logger } from 'src/logger';

/**
 * Performs the physical cleanup of a soft-deleted group within a single database transaction.
 *
 * Deletes (in order):
 *  1. All `groupPlatformRating` rows for the group (cached ratings)
 *  2. All `userGroupMember` rows for the group (memberships)
 *  3. The `userGroup` row itself (the physical delete)
 *
 * This function is idempotent — if the group was already physically deleted, it is a no-op.
 *
 * @param groupId - The ID of the soft-deleted group to clean up.
 */
export async function cleanupSoftDeletedGroup(groupId: number): Promise<void> {
  await Database.knex.transaction(async (trx) => {
    // Delete cached group platform ratings
    await trx('groupPlatformRating').where('groupId', groupId).delete();

    // Delete all group memberships
    await trx('userGroupMember').where('groupId', groupId).delete();

    // Physically delete the soft-deleted group row
    await trx('userGroup').where('id', groupId).delete();
  });
}

/**
 * Startup sweep: finds all soft-deleted groups older than 1 hour and physically
 * deletes them via `cleanupSoftDeletedGroup`. Groups soft-deleted less than 1 hour
 * ago are intentionally skipped to avoid racing with an in-flight async cleanup
 * from the same soft-delete request.
 *
 * Errors for individual groups are logged and do NOT abort the sweep — each group
 * is retried on the next startup.
 */
export async function cleanupSoftDeletedGroups(): Promise<void> {
  const oneHourAgo = Date.now() - 3_600_000;

  const staleGroups = await Database.knex('userGroup')
    .whereNotNull('deletedAt')
    .where('deletedAt', '<', oneHourAgo)
    .select('id');

  if (staleGroups.length === 0) {
    return;
  }

  logger.info(
    `Startup sweep: found ${staleGroups.length} soft-deleted group(s) to clean up`
  );

  for (const group of staleGroups) {
    const groupId = group.id as number;

    try {
      await cleanupSoftDeletedGroup(groupId);
      logger.info(`Startup sweep: cleaned up soft-deleted group ${groupId}`);
    } catch (err) {
      logger.error(`Startup sweep: failed to clean up soft-deleted group ${groupId}`, {
        err,
        groupId,
      });
    }
  }
}
