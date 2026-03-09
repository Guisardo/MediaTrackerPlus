import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('mediaItem', (table) => {
    table.string('creator');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('mediaItem', (table) => {
    table.dropColumn('creator');
  });
}
