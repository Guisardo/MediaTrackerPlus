import { Database } from 'src/dbconfig';

export interface MediaItemTranslationData {
  title?: string | null;
  overview?: string | null;
  genres?: string[] | null;
}

/**
 * Upserts a translation row for a media item.
 * Uses onConflict(['mediaItemId', 'language']).merge() to update existing rows.
 */
export const upsertMediaItemTranslation = async (
  mediaItemId: number,
  language: string,
  data: MediaItemTranslationData
): Promise<void> => {
  const row: Record<string, unknown> = {
    mediaItemId,
    language,
    title: data.title ?? null,
    overview: data.overview ?? null,
    genres: data.genres != null ? JSON.stringify(data.genres) : null,
  };

  await Database.knex('mediaItemTranslation')
    .insert(row)
    .onConflict(['mediaItemId', 'language'])
    .merge();
};
