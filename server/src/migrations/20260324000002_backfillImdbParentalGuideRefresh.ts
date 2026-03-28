import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex('mediaItem')
    .whereIn('mediaType', ['movie', 'tv'])
    .whereNotNull('imdbId')
    .where((qb) =>
      qb
        .whereNull('parentalGuidanceCategories')
        .orWhere('parentalGuidanceCategories', '')
    )
    .update({
      needsDetails: true,
    });
}

export async function down(): Promise<void> {
  // Intentionally left blank: reverting the refresh marker would discard the
  // one-time repair trigger for existing stale metadata rows.
}
