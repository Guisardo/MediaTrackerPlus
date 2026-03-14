import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create mediaItemTranslation table
  const hasMediaItemTranslation = await knex.schema.hasTable('mediaItemTranslation');
  if (!hasMediaItemTranslation) {
    await knex.schema.createTable('mediaItemTranslation', (table) => {
      table.increments('id').primary();
      table
        .integer('mediaItemId')
        .notNullable()
        .references('id')
        .inTable('mediaItem')
        .onDelete('cascade');
      table.string('language').notNullable();
      table.string('title').nullable();
      table.text('overview').nullable();
      table.jsonb('genres').nullable();
      table.unique(['mediaItemId', 'language']);
      table.index('mediaItemId');
    });
  }

  // Create seasonTranslation table
  const hasSeasonTranslation = await knex.schema.hasTable('seasonTranslation');
  if (!hasSeasonTranslation) {
    await knex.schema.createTable('seasonTranslation', (table) => {
      table.increments('id').primary();
      table
        .integer('seasonId')
        .notNullable()
        .references('id')
        .inTable('season')
        .onDelete('cascade');
      table.string('language').notNullable();
      table.string('title').nullable();
      table.text('description').nullable();
      table.unique(['seasonId', 'language']);
      table.index('seasonId');
    });
  }

  // Create episodeTranslation table
  const hasEpisodeTranslation = await knex.schema.hasTable('episodeTranslation');
  if (!hasEpisodeTranslation) {
    await knex.schema.createTable('episodeTranslation', (table) => {
      table.increments('id').primary();
      table
        .integer('episodeId')
        .notNullable()
        .references('id')
        .inTable('episode')
        .onDelete('cascade');
      table.string('language').notNullable();
      table.string('title').nullable();
      table.text('description').nullable();
      table.unique(['episodeId', 'language']);
      table.index('episodeId');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse dependency order (children first)
  const hasEpisodeTranslation = await knex.schema.hasTable('episodeTranslation');
  if (hasEpisodeTranslation) {
    await knex.schema.dropTable('episodeTranslation');
  }

  const hasSeasonTranslation = await knex.schema.hasTable('seasonTranslation');
  if (hasSeasonTranslation) {
    await knex.schema.dropTable('seasonTranslation');
  }

  const hasMediaItemTranslation = await knex.schema.hasTable('mediaItemTranslation');
  if (hasMediaItemTranslation) {
    await knex.schema.dropTable('mediaItemTranslation');
  }
}
