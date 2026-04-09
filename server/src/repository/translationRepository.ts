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
  tableName:
    | 'mediaItemTranslation'
    | 'seasonTranslation'
    | 'episodeTranslation',
  rows: Record<string, unknown>[],
  conflictColumns: string[]
): Promise<void> => {
  for (const chunk of chunkRows(rows, TRANSLATION_UPSERT_BATCH_SIZE)) {
    await Database.knex(tableName)
      .insert(chunk)
      .onConflict(conflictColumns)
      .merge();
  }
};

const dedupeLanguages = (languages: readonly string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const language of languages) {
    const normalized = language.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(language);
  }

  return deduped;
};

const selectPreferredTranslations = <T extends { language: string }>(
  rows: T[],
  getEntityId: (row: T) => number,
  languages: readonly string[]
): Map<number, T> => {
  const normalizedLanguages = dedupeLanguages(languages);
  const languagePriority = new Map(
    normalizedLanguages.map((language, index) => [
      language.toLowerCase(),
      index,
    ])
  );
  const selected = new Map<number, { priority: number; row: T }>();

  for (const row of rows) {
    const priority = languagePriority.get(row.language.toLowerCase());
    if (priority === undefined) {
      continue;
    }

    const entityId = getEntityId(row);
    const existing = selected.get(entityId);
    if (!existing || priority < existing.priority) {
      selected.set(entityId, { priority, row });
    }
  }

  return new Map(
    Array.from(selected.entries()).map(([entityId, value]) => [
      entityId,
      value.row,
    ])
  );
};

/**
 * Fetches media item translations for a list of media item IDs, selecting the
 * first available translation from the ordered list of preferred languages.
 */
export const getMediaItemTranslations = async (
  mediaItemIds: number[],
  languages: readonly string[]
): Promise<Map<number, MediaItemTranslation>> => {
  const normalizedLanguages = dedupeLanguages(languages);

  if (mediaItemIds.length === 0 || normalizedLanguages.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<MediaItemTranslation>('mediaItemTranslation')
    .whereIn('mediaItemId', mediaItemIds)
    .whereIn('language', normalizedLanguages)
    .select('*');

  return selectPreferredTranslations(
    rows,
    (row) => row.mediaItemId,
    normalizedLanguages
  );
};

/**
 * Fetches season translations for a list of season IDs, selecting the first
 * available translation from the ordered list of preferred languages.
 */
export const getSeasonTranslations = async (
  seasonIds: number[],
  languages: readonly string[]
): Promise<Map<number, SeasonTranslation>> => {
  const normalizedLanguages = dedupeLanguages(languages);

  if (seasonIds.length === 0 || normalizedLanguages.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<SeasonTranslation>('seasonTranslation')
    .whereIn('seasonId', seasonIds)
    .whereIn('language', normalizedLanguages)
    .select('*');

  return selectPreferredTranslations(
    rows,
    (row) => row.seasonId,
    normalizedLanguages
  );
};

/**
 * Fetches episode translations for a list of episode IDs, selecting the first
 * available translation from the ordered list of preferred languages.
 */
export const getEpisodeTranslations = async (
  episodeIds: number[],
  languages: readonly string[]
): Promise<Map<number, EpisodeTranslation>> => {
  const normalizedLanguages = dedupeLanguages(languages);

  if (episodeIds.length === 0 || normalizedLanguages.length === 0) {
    return new Map();
  }

  const rows = await Database.knex<EpisodeTranslation>('episodeTranslation')
    .whereIn('episodeId', episodeIds)
    .whereIn('language', normalizedLanguages)
    .select('*');

  return selectPreferredTranslations(
    rows,
    (row) => row.episodeId,
    normalizedLanguages
  );
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
