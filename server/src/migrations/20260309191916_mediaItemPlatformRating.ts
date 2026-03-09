import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('mediaItem', 'platformRating');

  if (!hasColumn) {
    await knex.schema.alterTable('mediaItem', (table) => {
      table.float('platformRating').nullable();
    });

    // Backfill: Calculate average rating from user ratings where neither episodeId nor seasonId is set
    await knex.raw(`
      UPDATE "mediaItem"
      SET "platformRating" = (
        SELECT AVG("rating")
        FROM "userRating"
        WHERE "userRating"."mediaItemId" = "mediaItem"."id"
          AND "userRating"."episodeId" IS NULL
          AND "userRating"."seasonId" IS NULL
      )
      WHERE "id" IN (
        SELECT DISTINCT "mediaItemId"
        FROM "userRating"
        WHERE "episodeId" IS NULL
          AND "seasonId" IS NULL
      )
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('mediaItem', 'platformRating');

  if (hasColumn) {
    await knex.schema.alterTable('mediaItem', (table) => {
      table.dropColumn('platformRating');
    });
  }
}
