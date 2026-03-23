import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('mediaItem', (table) => {
    table.integer('minimumAge').nullable();
    table.string('contentRatingSystem').nullable();
    table.string('contentRatingRegion').nullable();
    table.string('contentRatingLabel').nullable();
    table.text('contentRatingDescriptors').nullable();
    table.text('parentalGuidanceSummary').nullable();
    table.text('parentalGuidanceCategories').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('mediaItem', (table) => {
    table.dropColumn('minimumAge');
    table.dropColumn('contentRatingSystem');
    table.dropColumn('contentRatingRegion');
    table.dropColumn('contentRatingLabel');
    table.dropColumn('contentRatingDescriptors');
    table.dropColumn('parentalGuidanceSummary');
    table.dropColumn('parentalGuidanceCategories');
  });
}
