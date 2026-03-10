import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Step 1: Calculate platformRating from listItem.estimatedRating for all items
  // that have at least one estimatedRating set across any user's list.
  // platformRating is now the average of estimatedRating values across all users
  // who have the item in their watchlist with an AI-estimated score.
  await knex.raw(`
    UPDATE "mediaItem"
    SET "platformRating" = (
      SELECT AVG("estimatedRating")
      FROM "listItem"
      WHERE "listItem"."mediaItemId" = "mediaItem"."id"
        AND "listItem"."estimatedRating" IS NOT NULL
    )
    WHERE "id" IN (
      SELECT DISTINCT "mediaItemId"
      FROM "listItem"
      WHERE "estimatedRating" IS NOT NULL
    )
  `);

  // Step 2: Seed platformRating from tmdbRating for items with no estimatedRating yet.
  // This gives new or lightly-used instances a meaningful initial ordering until real
  // estimatedRating values accumulate from the recommendation system.
  // The seeded value will be overwritten by recalculatePlatformRating() the first time
  // the recommendation system sets an estimatedRating for the item.
  await knex.raw(`
    UPDATE "mediaItem"
    SET "platformRating" = "tmdbRating"
    WHERE "platformRating" IS NULL
      AND "tmdbRating" IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Cannot safely revert: after migration, seeded values (from tmdbRating) and real
  // user-average values are indistinguishable in the column. No-op rollback.
  // To fully revert, drop and re-add the platformRating column via the parent migration.
}
