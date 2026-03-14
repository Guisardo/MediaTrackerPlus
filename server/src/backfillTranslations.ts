import { Database } from 'src/dbconfig';
import { logger } from 'src/logger';
import { createLock } from 'src/lock';
import { getMetadataLanguages, toTmdbLang, IGDB_REGION_MAP } from 'src/metadataLanguages';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import {
  upsertMediaItemTranslation,
  upsertSeasonTranslation,
  upsertEpisodeTranslation,
} from 'src/repository/translationRepository';
import { MediaItemBase, MediaItemBaseWithSeasons } from 'src/entity/mediaItem';
import { TvSeason } from 'src/entity/tvseason';

const BACKFILL_BATCH_SIZE = 50;
const INTER_BATCH_DELAY_MS = 35_000;

/**
 * Detects whether a translation backfill is needed by comparing configured
 * metadata languages against existing translations in the database.
 *
 * Two scenarios trigger a backfill:
 * 1. Initial deployment: mediaItemTranslation table is empty but mediaItem rows exist
 *    → ALL configured languages need backfilling
 * 2. Incremental language addition: translations exist for some languages but not all
 *    configured languages → only missing languages need backfilling
 *
 * @returns Array of language codes that need backfilling, or empty array if none needed
 */
export async function detectBackfillNeeded(): Promise<string[]> {
  const configuredLanguages = getMetadataLanguages();

  const mediaItemCount = await Database.knex('mediaItem').count('* as count').first();
  const totalItems = Number(mediaItemCount?.count ?? 0);

  if (totalItems === 0) {
    logger.info('Backfill check: no media items in database, skipping backfill');
    return [];
  }

  const existingLanguagesRows = await Database.knex('mediaItemTranslation')
    .distinct('language')
    .select('language');

  const existingLanguages = new Set(
    existingLanguagesRows.map((row: { language: string }) => row.language)
  );

  if (existingLanguages.size === 0) {
    // Initial deployment: translation table is empty but items exist
    logger.info(
      `Backfill check: initial deployment detected — translation table is empty with ${totalItems} media items. ` +
      `All configured languages need backfilling: [${configuredLanguages.join(', ')}]`
    );
    return configuredLanguages;
  }

  // Incremental check: find languages in config that aren't in the translation table
  const missingLanguages = configuredLanguages.filter(
    (lang) => !existingLanguages.has(lang)
  );

  if (missingLanguages.length > 0) {
    logger.info(
      `Backfill check: new languages detected — missing translations for: [${missingLanguages.join(', ')}]. ` +
      `Existing languages: [${[...existingLanguages].join(', ')}]`
    );
  } else {
    logger.info(
      'Backfill check: all configured languages have translations, no backfill needed'
    );
  }

  return missingLanguages;
}

/**
 * Processes a single media item: fetches localized details for each missing language
 * and upserts translations for the media item, its seasons, and its episodes.
 *
 * @param mediaItem - The media item to backfill translations for
 * @param missingLanguages - Languages that need translation population
 */
async function backfillItemTranslations(
  mediaItem: MediaItemBase,
  missingLanguages: string[]
): Promise<void> {
  const metadataProvider = metadataProviders.get(
    mediaItem.mediaType,
    mediaItem.source
  );

  if (!metadataProvider) {
    logger.warn(
      `Backfill: no metadata provider '${mediaItem.source}' for media type '${mediaItem.mediaType}' — skipping item ${mediaItem.id} (${mediaItem.title})`
    );
    return;
  }

  // Build season/episode ID lookup maps for TV shows
  let seasonIdByNumber: Map<number, number> | undefined;
  let episodeIdBySeasonAndEpisode: Map<string, number> | undefined;

  if (mediaItem.mediaType === 'tv') {
    const seasons = await mediaItemRepository.seasonsWithEpisodes(mediaItem);
    seasonIdByNumber = new Map<number, number>();
    episodeIdBySeasonAndEpisode = new Map<string, number>();

    for (const season of seasons) {
      if (season.id != null) {
        seasonIdByNumber.set(season.seasonNumber, season.id);
      }
      if (season.episodes) {
        for (const episode of season.episodes) {
          if (episode.id != null) {
            episodeIdBySeasonAndEpisode.set(
              `${episode.seasonNumber}:${episode.episodeNumber}`,
              episode.id
            );
          }
        }
      }
    }
  }

  // Fetch and upsert localized details for each missing language
  if (metadataProvider.localizedDetails != null) {
    for (const language of missingLanguages) {
      try {
        const localizedData = await metadataProvider.localizedDetails(
          mediaItem,
          language
        );
        if (localizedData) {
          await upsertMediaItemTranslation(mediaItem.id, language, {
            title: localizedData.title ?? null,
            overview: localizedData.overview ?? null,
            genres: localizedData.genres ?? null,
          });

          // Upsert season/episode translations for TV shows
          if (
            mediaItem.mediaType === 'tv' &&
            localizedData.seasons &&
            seasonIdByNumber &&
            episodeIdBySeasonAndEpisode
          ) {
            for (const season of localizedData.seasons) {
              const seasonId = seasonIdByNumber.get(season.seasonNumber);
              if (seasonId != null) {
                await upsertSeasonTranslation(seasonId, language, {
                  title: season.title ?? null,
                  description: season.description ?? null,
                });
              }

              if (season.episodes) {
                for (const episode of season.episodes) {
                  const episodeId = episodeIdBySeasonAndEpisode.get(
                    `${episode.seasonNumber}:${episode.episodeNumber}`
                  );
                  if (episodeId != null) {
                    await upsertEpisodeTranslation(episodeId, language, {
                      title: episode.title ?? null,
                      description: episode.description ?? null,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error(
          `Backfill: failed to fetch localized details for mediaItem ${mediaItem.id} (${mediaItem.title}) in language '${language}': ${error}`,
          { err: error }
        );
      }
    }
  }

  // IGDB game localizations: single fetch per item, map regions to ISO codes
  if (metadataProvider.fetchGameLocalizations != null) {
    try {
      const localizations = await metadataProvider.fetchGameLocalizations(mediaItem);

      for (const localization of localizations) {
        const regionLanguages = IGDB_REGION_MAP[localization.regionId];

        if (regionLanguages === undefined) {
          continue;
        }

        const targetLanguages: string[] =
          regionLanguages === 'all'
            ? missingLanguages
            : (regionLanguages as string[]).filter((lang) =>
                missingLanguages.includes(lang)
              );

        for (const lang of targetLanguages) {
          await upsertMediaItemTranslation(mediaItem.id, lang, {
            title: localization.name || null,
            overview: null,
            genres: null,
          });
        }
      }
    } catch (error) {
      logger.error(
        `Backfill: failed to fetch game localizations for mediaItem ${mediaItem.id} (${mediaItem.title}): ${error}`,
        { err: error }
      );
    }
  }
}

/**
 * Core backfill orchestrator. Processes all media items in batches,
 * fetching and upserting translations for each missing language.
 *
 * @param missingLanguages - Languages that need translation population
 */
async function runBackfill(missingLanguages: string[]): Promise<void> {
  if (missingLanguages.length === 0) {
    return;
  }

  logger.info(
    `Backfill translations: starting backfill for languages [${missingLanguages.join(', ')}]`
  );

  const totalCountResult = await Database.knex('mediaItem')
    .count('* as count')
    .first();
  const totalItems = Number(totalCountResult?.count ?? 0);

  let processed = 0;
  let offset = 0;

  while (offset < totalItems) {
    const batch = await Database.knex<MediaItemBase>('mediaItem')
      .select('*')
      .orderBy('id', 'asc')
      .limit(BACKFILL_BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) {
      break;
    }

    for (const mediaItem of batch) {
      try {
        await backfillItemTranslations(mediaItem, missingLanguages);
        processed++;
      } catch (error) {
        logger.error(
          `Backfill: failed to process mediaItem ${mediaItem.id} (${mediaItem.title}): ${error}`,
          { err: error }
        );
        processed++;
      }
    }

    logger.info(
      `Backfilling translations: ${processed}/${totalItems} items completed`
    );

    offset += BACKFILL_BATCH_SIZE;

    // Inter-batch delay to respect TMDB rate limits
    if (offset < totalItems) {
      await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
    }
  }

  logger.info(
    `Backfill translations: completed — ${processed}/${totalItems} items processed for languages [${missingLanguages.join(', ')}]`
  );
}

/**
 * Locked backfill function — prevents concurrent backfill runs.
 * Uses a separate lock from the updateMetadata lock.
 */
const lockedBackfill = createLock(async function backfillTranslations(): Promise<void> {
  const missingLanguages = await detectBackfillNeeded();

  if (missingLanguages.length === 0) {
    return;
  }

  await runBackfill(missingLanguages);
});

/**
 * Entry point: detects whether backfill is needed and starts it in the background
 * without blocking server startup. Uses setImmediate() to defer execution.
 */
export function startBackfillIfNeeded(): void {
  setImmediate(async () => {
    try {
      await lockedBackfill();
    } catch (error) {
      logger.error(
        `Backfill translations: unexpected error during backfill: ${error}`,
        { err: error }
      );
    }
  });
}

// Exported for testing purposes
export { BACKFILL_BATCH_SIZE, INTER_BATCH_DELAY_MS, runBackfill, backfillItemTranslations };
