/**
 * RecommendationService — central orchestrator for the upnext recommendation pipeline.
 *
 * Dispatches a rating event to the correct similarity API client by media type,
 * then writes the results to the user's watchlist via WatchlistWriter.
 *
 * All errors from API clients or WatchlistWriter are caught, logged at ERROR level
 * with full stack traces, and swallowed — the caller is never interrupted by
 * recommendation failures.
 *
 * Design: Constructor injection of all dependencies (TmdbSimilarClient,
 * IgdbSimilarClient, OpenLibrarySimilarClient, WatchlistWriter, mediaItem lookup)
 * makes every branch testable without touching the real database or external APIs.
 */

import { logger } from 'src/logger';
import { MediaItemBase, MediaType } from 'src/entity/mediaItem';
import { TmdbSimilarClient } from 'src/services/recommendations/TmdbSimilarClient';
import { IgdbSimilarClient } from 'src/services/recommendations/IgdbSimilarClient';
import {
  OpenLibrarySimilarClient
} from 'src/services/recommendations/OpenLibrarySimilarClient';
import {
  WatchlistWriter,
  WriteResult,
} from 'src/services/recommendations/WatchlistWriter';
import { SimilarItem } from 'src/services/recommendations/types';

/**
 * Dependencies injected into RecommendationService for testability.
 *
 * @property tmdbClient - Client for fetching similar movies and TV shows.
 * @property igdbClient - Client for fetching similar games.
 * @property openLibraryClient - Client for fetching similar books.
 * @property watchlistWriter - Writes similar items to the user's watchlist.
 * @property findMediaItemById - Resolves a mediaItemId to a MediaItemBase record.
 *   Returns undefined when the item does not exist.
 */
export interface RecommendationServiceDeps {
  tmdbClient: TmdbSimilarClient;
  igdbClient: IgdbSimilarClient;
  openLibraryClient: OpenLibrarySimilarClient;
  watchlistWriter: WatchlistWriter;
  findMediaItemById: (
    mediaItemId: number
  ) => Promise<MediaItemBase | undefined>;
}

/**
 * Central orchestrator that dispatches rating events to the appropriate
 * similarity API client and coordinates writing results to the watchlist.
 *
 * Supported media types:
 *   - 'movie' and 'tv' → TmdbSimilarClient (uses tmdbId)
 *   - 'video_game'      → IgdbSimilarClient (uses igdbId)
 *   - 'book'            → OpenLibrarySimilarClient (uses openlibraryId)
 *   - 'audiobook'       → no-op (unsupported, logged at INFO)
 *
 * The estimatedRating passed to WatchlistWriter.write() is equal to the
 * trigger rating value, following the PRD specification.
 */
export class RecommendationService {
  private readonly tmdbClient: TmdbSimilarClient;
  private readonly igdbClient: IgdbSimilarClient;
  private readonly openLibraryClient: OpenLibrarySimilarClient;
  private readonly watchlistWriter: WatchlistWriter;
  private readonly findMediaItemById: RecommendationServiceDeps['findMediaItemById'];

  /**
   * @param deps - All dependencies injected for testability.
   */
  constructor(deps: RecommendationServiceDeps) {
    this.tmdbClient = deps.tmdbClient;
    this.igdbClient = deps.igdbClient;
    this.openLibraryClient = deps.openLibraryClient;
    this.watchlistWriter = deps.watchlistWriter;
    this.findMediaItemById = deps.findMediaItemById;
  }

  /**
   * Process a rating event: fetch similar items for the rated media item
   * and write them to the user's watchlist with the trigger rating as estimatedRating.
   *
   * This method NEVER throws — all errors are caught and logged at ERROR level
   * so the caller (RatingController) can fire-and-forget safely.
   *
   * @param userId - The user who submitted the rating.
   * @param mediaItemId - The rated media item's database ID.
   * @param rating - The numeric rating value (used as estimatedRating for recommendations).
   */
  async processRating(
    userId: number,
    mediaItemId: number,
    rating: number
  ): Promise<void> {
    try {
      await this.executeProcessRating(userId, mediaItemId, rating);
    } catch (err) {
      logger.error('RecommendationService: Unhandled error in processRating', {
        err,
      });
    }
  }

  /**
   * Internal implementation of processRating.
   *
   * Separated from processRating so that error swallowing is isolated at the
   * public interface boundary and not mixed with business logic.
   *
   * @throws Any error from mediaItem lookup, API clients, or WatchlistWriter.
   */
  private async executeProcessRating(
    userId: number,
    mediaItemId: number,
    rating: number
  ): Promise<void> {
    // Resolve mediaItemId to its full record (needed for mediaType and external IDs)
    const mediaItem = await this.findMediaItemById(mediaItemId);

    if (!mediaItem) {
      logger.warn(
        `RecommendationService: mediaItemId=${mediaItemId} not found — skipping recommendation pipeline`
      );
      return;
    }

    const { mediaType } = mediaItem;

    logger.info(
      `RecommendationService: processRating start — userId=${userId}, mediaItemId=${mediaItemId}, mediaType=${mediaType}, rating=${rating}`
    );

    // Dispatch to the appropriate similarity client based on media type
    const similarItems = await this.fetchSimilarItems(mediaItem, rating);

    logger.info(
      `RecommendationService: fetched ${similarItems.length} similar items for mediaItemId=${mediaItemId}`
    );

    // Write similar items to the user's watchlist using the rating as estimatedRating
    const writeResult = await this.watchlistWriter.write(
      userId,
      similarItems,
      rating
    );

    logger.info(
      `RecommendationService: processRating complete — userId=${userId}, mediaItemId=${mediaItemId}, ` +
        `apiResultCount=${similarItems.length}, added=${writeResult.added}, ` +
        `updated=${writeResult.updated}, skipped=${writeResult.skipped}`
    );
  }

  /**
   * Dispatch to the appropriate similarity API client based on media type.
   *
   * Returns an empty array for unsupported media types (e.g., 'audiobook')
   * after logging at INFO level.
   *
   * @param mediaItem - The full MediaItemBase record (needed for external IDs).
   * @param rating - The trigger rating (unused here but kept for symmetry with the calling context).
   * @returns Array of SimilarItem records from the appropriate API client.
   */
  private async fetchSimilarItems(
    mediaItem: MediaItemBase,
    _rating: number
  ): Promise<SimilarItem[]> {
    const { mediaType } = mediaItem;

    switch (mediaType as MediaType) {
      case 'movie':
      case 'tv': {
        if (!mediaItem.tmdbId) {
          logger.warn(
            `RecommendationService: mediaItemId=${mediaItem.id} is ${mediaType} but has no tmdbId — skipping`
          );
          return [];
        }
        return await this.tmdbClient.fetchSimilar(
          mediaItem.tmdbId,
          mediaType as 'movie' | 'tv'
        );
      }

      case 'video_game': {
        if (!mediaItem.igdbId) {
          logger.warn(
            `RecommendationService: mediaItemId=${mediaItem.id} is video_game but has no igdbId — skipping`
          );
          return [];
        }
        return await this.igdbClient.fetchSimilar(mediaItem.igdbId);
      }

      case 'book': {
        if (!mediaItem.openlibraryId) {
          logger.warn(
            `RecommendationService: mediaItemId=${mediaItem.id} is book but has no openlibraryId — skipping`
          );
          return [];
        }
        return await this.openLibraryClient.fetchSimilar(
          mediaItem.openlibraryId
        );
      }

      case 'audiobook': {
        logger.info(
          `RecommendationService: mediaType=audiobook is not supported by the recommendation engine — skipping`
        );
        return [];
      }

      default: {
        logger.warn(
          `RecommendationService: Unknown mediaType="${mediaType as string}" for mediaItemId=${mediaItem.id} — skipping`
        );
        return [];
      }
    }
  }
}
