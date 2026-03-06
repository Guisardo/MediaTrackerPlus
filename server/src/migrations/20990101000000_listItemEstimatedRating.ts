import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('listItem', 'estimatedRating');

  if (!hasColumn) {
    await knex.schema.alterTable('listItem', (table) => {
      table.float('estimatedRating').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('listItem', 'estimatedRating');

  if (hasColumn) {
    await knex.schema.alterTable('listItem', (table) => {
      table.dropColumn('estimatedRating');
    });
  }
}
