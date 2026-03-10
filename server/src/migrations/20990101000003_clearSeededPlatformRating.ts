import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // The previous migration (20990101000002_backfillPlatformRatingEstimates) seeded
  // platformRating = tmdbRating for items that had no estimatedRating at migration time.
  // This seeded value is indistinguishable at sort time from a real community average,
  // which caused seeded items to appear above items with genuine platform ratings.
  //
  // The correct behaviour is:
  //   Tier 1 — items with a real platformRating (backed by at least one estimatedRating):
  //             sorted by the 70/30 blend descending.
  //   Tier 2 — items with no platformRating (null): sorted by tmdbRating descending.
  //
  // By clearing seeded values here, platformRating IS NOT NULL becomes a reliable
  // indicator of "this item has real community rating data", which the sort query
  // (and client-side sort) now depend on to implement the two-tier ordering.
  //
  // recalculatePlatformRating() already sets platformRating = NULL when the AVG of
  // estimatedRating is NULL (no rows), so this migration aligns the stored values with
  // what the live recalculation would produce for these items today.
  await knex.raw(`
    UPDATE "mediaItem"
    SET "platformRating" = NULL
    WHERE "id" NOT IN (
      SELECT DISTINCT "mediaItemId"
      FROM "listItem"
      WHERE "estimatedRating" IS NOT NULL
    )
    AND "platformRating" IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Re-seed platformRating from tmdbRating for items that have no estimatedRating.
  // This restores the state that existed after 20990101000002_backfillPlatformRatingEstimates.
  await knex.raw(`
    UPDATE "mediaItem"
    SET "platformRating" = "tmdbRating"
    WHERE "id" NOT IN (
      SELECT DISTINCT "mediaItemId"
      FROM "listItem"
      WHERE "estimatedRating" IS NOT NULL
    )
    AND "platformRating" IS NULL
    AND "tmdbRating" IS NOT NULL
  `);
}
