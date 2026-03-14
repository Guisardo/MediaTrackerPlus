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

export interface SeasonTranslationData {
  title?: string | null;
  description?: string | null;
}

/**
 * Upserts a translation row for a season.
 * Uses onConflict(['seasonId', 'language']).merge() to update existing rows.
 */
export const upsertSeasonTranslation = async (
  seasonId: number,
  language: string,
  data: SeasonTranslationData
): Promise<void> => {
  const row: Record<string, unknown> = {
    seasonId,
    language,
    title: data.title ?? null,
    description: data.description ?? null,
  };

  await Database.knex('seasonTranslation')
    .insert(row)
    .onConflict(['seasonId', 'language'])
    .merge();
};

export interface EpisodeTranslationData {
  title?: string | null;
  description?: string | null;
}

/**
 * Upserts a translation row for an episode.
 * Uses onConflict(['episodeId', 'language']).merge() to update existing rows.
 */
export const upsertEpisodeTranslation = async (
  episodeId: number,
  language: string,
  data: EpisodeTranslationData
): Promise<void> => {
  const row: Record<string, unknown> = {
    episodeId,
    language,
    title: data.title ?? null,
    description: data.description ?? null,
  };

  await Database.knex('episodeTranslation')
    .insert(row)
    .onConflict(['episodeId', 'language'])
    .merge();
};
