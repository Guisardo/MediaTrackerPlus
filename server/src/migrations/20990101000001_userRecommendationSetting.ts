import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('user', 'addRecommendedToWatchlist');
  if (!hasColumn) {
    await knex.schema.alterTable('user', (table) => {
      table.boolean('addRecommendedToWatchlist').defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('user', 'addRecommendedToWatchlist');
  if (hasColumn) {
    await knex.schema.alterTable('user', (table) => {
      table.dropColumn('addRecommendedToWatchlist');
    });
  }
}
