import { Database } from 'src/dbconfig';

export interface MediaItemTranslation {
  id: number;
  mediaItemId: number;
  language: string;
  title: string | null;
  overview: string | null;
  genres: string | null;
}

export interface SeasonTranslation {
  id: number;
  seasonId: number;
  language: string;
  title: string | null;
  description: string | null;
}

export interface EpisodeTranslation {
  id: number;
  episodeId: number;
  language: string;
  title: string | null;
  description: string | null;
}

/**
 * Fetches media item translations for a list of media item IDs and a specific language.
 * Returns a map from mediaItemId to translation row.
 */
export const getMediaItemTranslations = async (
  mediaItemIds: number[],
  language: string
): Promise<Map<number, MediaItemTranslation>> => {
  if (mediaItemIds.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<MediaItemTranslation>('mediaItemTranslation')
    .whereIn('mediaItemId', mediaItemIds)
    .where('language', language)
    .select('*');

  const map = new Map<number, MediaItemTranslation>();
  for (const row of rows) {
    map.set(row.mediaItemId, row);
  }
  return map;
};

/**
 * Fetches season translations for a list of season IDs and a specific language.
 * Returns a map from seasonId to translation row.
 */
export const getSeasonTranslations = async (
  seasonIds: number[],
  language: string
): Promise<Map<number, SeasonTranslation>> => {
  if (seasonIds.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<SeasonTranslation>('seasonTranslation')
    .whereIn('seasonId', seasonIds)
    .where('language', language)
    .select('*');

  const map = new Map<number, SeasonTranslation>();
  for (const row of rows) {
    map.set(row.seasonId, row);
  }
  return map;
};

/**
 * Fetches episode translations for a list of episode IDs and a specific language.
 * Returns a map from episodeId to translation row.
 */
export const getEpisodeTranslations = async (
  episodeIds: number[],
  language: string
): Promise<Map<number, EpisodeTranslation>> => {
  if (episodeIds.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<EpisodeTranslation>('episodeTranslation')
    .whereIn('episodeId', episodeIds)
    .where('language', language)
    .select('*');

  const map = new Map<number, EpisodeTranslation>();
  for (const row of rows) {
    map.set(row.episodeId, row);
  }
  return map;
};

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
