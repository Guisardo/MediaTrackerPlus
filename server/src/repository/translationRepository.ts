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

const TRANSLATION_UPSERT_BATCH_SIZE = 200;

const chunkRows = <T>(rows: T[], chunkSize: number): T[][] => {
  if (rows.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
};

const upsertRowsInBatches = async (
  tableName: 'mediaItemTranslation' | 'seasonTranslation' | 'episodeTranslation',
  rows: Record<string, unknown>[],
  conflictColumns: string[]
): Promise<void> => {
  for (const chunk of chunkRows(rows, TRANSLATION_UPSERT_BATCH_SIZE)) {
    await Database.knex(tableName).insert(chunk).onConflict(conflictColumns).merge();
  }
};

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

export interface MediaItemTranslationUpsertRow {
  mediaItemId: number;
  language: string;
  title: string | null;
  overview: string | null;
  genres: string[] | null;
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
  await upsertMediaItemTranslations([
    {
      mediaItemId,
      language,
      title: data.title ?? null,
      overview: data.overview ?? null,
      genres: data.genres ?? null,
    },
  ]);
};

export const upsertMediaItemTranslations = async (
  rows: MediaItemTranslationUpsertRow[]
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  await upsertRowsInBatches(
    'mediaItemTranslation',
    rows.map((row) => ({
      mediaItemId: row.mediaItemId,
      language: row.language,
      title: row.title,
      overview: row.overview,
      genres: row.genres != null ? JSON.stringify(row.genres) : null,
    })),
    ['mediaItemId', 'language']
  );
};

export interface SeasonTranslationData {
  title?: string | null;
  description?: string | null;
}

export interface SeasonTranslationUpsertRow {
  seasonId: number;
  language: string;
  title: string | null;
  description: string | null;
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
  await upsertSeasonTranslations([
    {
      seasonId,
      language,
      title: data.title ?? null,
      description: data.description ?? null,
    },
  ]);
};

export const upsertSeasonTranslations = async (
  rows: SeasonTranslationUpsertRow[]
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  await upsertRowsInBatches(
    'seasonTranslation',
    rows.map((row) => ({
      seasonId: row.seasonId,
      language: row.language,
      title: row.title,
      description: row.description,
    })),
    ['seasonId', 'language']
  );
};

export interface EpisodeTranslationData {
  title?: string | null;
  description?: string | null;
}

export interface EpisodeTranslationUpsertRow {
  episodeId: number;
  language: string;
  title: string | null;
  description: string | null;
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
  await upsertEpisodeTranslations([
    {
      episodeId,
      language,
      title: data.title ?? null,
      description: data.description ?? null,
    },
  ]);
};

export const upsertEpisodeTranslations = async (
  rows: EpisodeTranslationUpsertRow[]
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  await upsertRowsInBatches(
    'episodeTranslation',
    rows.map((row) => ({
      episodeId: row.episodeId,
      language: row.language,
      title: row.title,
      description: row.description,
    })),
    ['episodeId', 'language']
  );
};
