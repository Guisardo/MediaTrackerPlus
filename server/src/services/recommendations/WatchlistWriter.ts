/**
 * WatchlistWriter — adds recommended items to a user's watchlist with
 * estimatedRating, using Knex transactions and a minimum-wins update strategy.
 *
 * For each SimilarItem the writer:
 *  1. Resolves the external ID to a mediaItem row via findMediaItemByExternalId
 *  2. Within a transaction, checks whether the item already exists on the watchlist
 *  3. Applies one of four outcomes:
 *     - NEW: insert with estimatedRating
 *     - WATCHED/RATED: skip (user has already engaged with the item)
 *     - EXISTING, lower incoming rating: update estimatedRating to the new value
 *     - EXISTING, incoming rating >= current: keep current estimatedRating
 *
 * All decisions are logged at DEBUG level.
 */

import { Knex } from 'knex';
import { Database } from 'src/dbconfig';
import { List, ListItem } from 'src/entity/list';
import { Seen } from 'src/entity/seen';
import { UserRating } from 'src/entity/userRating';
import { ExternalIds, MediaType } from 'src/entity/mediaItem';
import { logger } from 'src/logger';
import { SimilarItem } from 'src/services/recommendations/types';

/**
 * Maps the SimilarItem.mediaType union to the internal MediaType used by
 * findMediaItemByExternalId and the mediaItem table.
 *
 * SimilarItem uses 'game'; the database uses 'video_game'.
 */
const toInternalMediaType = (
  mediaType: SimilarItem['mediaType']
): MediaType => {
  switch (mediaType) {
    case 'game':
      return 'video_game';
    case 'movie':
      return 'movie';
    case 'tv':
      return 'tv';
    case 'book':
      return 'book';
  }
};

/**
 * Builds the ExternalIds object that findMediaItemByExternalId expects,
 * based on the SimilarItem's mediaType and externalId.
 *
 * - movie/tv: externalId is a TMDB numeric ID
 * - game:     externalId is an IGDB numeric ID
 * - book:     externalId is an OpenLibrary work key (string)
 */
const toExternalIds = (item: SimilarItem): ExternalIds => {
  switch (item.mediaType) {
    case 'movie':
    case 'tv':
      return { tmdbId: Number(item.externalId) };
    case 'game':
      return { igdbId: Number(item.externalId) };
    case 'book':
      return { openlibraryId: item.externalId };
  }
};

/**
 * Result counters returned by WatchlistWriter.write() for observability.
 * Used by RecommendationService to log pipeline metrics.
 */
export interface WriteResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Dependencies injected into WatchlistWriter for testability.
 *
 * @property findMediaItemByExternalId - Resolves an external API ID to a
 *   persisted mediaItem row. Returns undefined when the import pipeline fails.
 * @property knex - Optional Knex instance override (defaults to Database.knex).
 */
export interface WatchlistWriterDeps {
  findMediaItemByExternalId: (args: {
    id: ExternalIds;
    mediaType: MediaType;
  }) => Promise<{ id?: number } | undefined>;
  knex?: Knex;
}

/**
 * Adds recommended SimilarItem records to a user's watchlist, storing
 * the trigger rating as estimatedRating.
 *
 * Concurrency-safe: each item is checked and inserted/updated inside a
 * Knex transaction so concurrent processRating invocations cannot produce
 * duplicate listItem rows.
 */
export class WatchlistWriter {
  private readonly findMediaItemByExternalId: WatchlistWriterDeps['findMediaItemByExternalId'];
  private readonly getKnex: () => Knex;

  /**
   * @param deps - Injected dependencies.
   *   - findMediaItemByExternalId: Resolves external IDs to mediaItem rows.
   *   - knex: Optional Knex instance (defaults to Database.knex at call time).
   */
  constructor(deps: WatchlistWriterDeps) {
    this.findMediaItemByExternalId = deps.findMediaItemByExternalId;
    // Defer Database.knex access to call time so tests can override it
    this.getKnex = deps.knex ? () => deps.knex! : () => Database.knex;
  }

  /**
   * Write a batch of SimilarItems to the user's watchlist.
   *
   * @param userId - The user whose watchlist is being populated.
   * @param items - Similar items returned by an API client.
   * @param estimatedRating - The trigger rating value to assign to new items.
   * @returns Counters of items added, updated, and skipped.
   */
  async write(
    userId: number,
    items: SimilarItem[],
    estimatedRating: number
  ): Promise<WriteResult> {
    const result: WriteResult = { added: 0, updated: 0, skipped: 0 };

    for (const item of items) {
      const outcome = await this.processItem(userId, item, estimatedRating);

      switch (outcome) {
        case 'added':
          result.added++;
          break;
        case 'updated':
          result.updated++;
          break;
        case 'skipped':
          result.skipped++;
          break;
      }
    }

    return result;
  }

  /**
   * Process a single SimilarItem: resolve to mediaItem, then transactionally
   * check-and-upsert on the user's watchlist.
   *
   * @returns The outcome: 'added', 'updated', or 'skipped'.
   */
  private async processItem(
    userId: number,
    item: SimilarItem,
    estimatedRating: number
  ): Promise<'added' | 'updated' | 'skipped'> {
    // Step 1: Resolve SimilarItem to a mediaItem row
    const mediaItem = await this.findMediaItemByExternalId({
      id: toExternalIds(item),
      mediaType: toInternalMediaType(item.mediaType),
    });

    if (!mediaItem || mediaItem.id === undefined) {
      logger.warn(
        `WatchlistWriter: findMediaItemByExternalId returned undefined for ` +
          `externalId="${item.externalId}" mediaType="${item.mediaType}" — skipping`
      );
      return 'skipped';
    }

    const mediaItemId = mediaItem.id;

    // Step 2: Transactional check-and-upsert
    return await this.getKnex().transaction(async (trx) => {
      // Find the user's watchlist
      const watchlist = await trx<List>('list')
        .where({ userId, isWatchlist: true })
        .first();

      if (!watchlist) {
        logger.warn(
          `WatchlistWriter: No watchlist found for userId=${userId} — skipping item "${item.title}"`
        );
        return 'skipped';
      }

      const listId = watchlist.id;

      // Check if user has already rated this media item (at the media-item level)
      const userRating = await trx<UserRating>('userRating')
        .where({
          userId,
          mediaItemId,
          seasonId: null,
          episodeId: null,
        })
        .first();

      if (userRating) {
        logger.debug(
          `WatchlistWriter: mediaItemId=${mediaItemId} already rated by userId=${userId} — skipping`
        );
        return 'skipped';
      }

      // Check if user has watched this media item (at the media-item level)
      const seen = await trx<Seen>('seen')
        .where({
          userId,
          mediaItemId,
        })
        .whereNull('episodeId')
        .first();

      if (seen) {
        logger.debug(
          `WatchlistWriter: mediaItemId=${mediaItemId} already watched by userId=${userId} — skipping`
        );
        return 'skipped';
      }

      // Check if item already exists on the watchlist
      const existingListItem = await trx<ListItem>('listItem')
        .where({
          listId,
          mediaItemId,
        })
        .first();

      if (!existingListItem) {
        // NEW: Insert with estimatedRating
        await trx('listItem').insert({
          listId,
          mediaItemId,
          addedAt: new Date().getTime(),
          estimatedRating,
        });

        logger.debug(
          `WatchlistWriter: Added mediaItemId=${mediaItemId} to watchlist ` +
            `for userId=${userId} with estimatedRating=${estimatedRating}`
        );
        return 'added';
      }

      // Item exists on watchlist — apply minimum-wins update strategy
      const currentEstimatedRating = existingListItem.estimatedRating;

      if (
        currentEstimatedRating === undefined ||
        currentEstimatedRating === null
      ) {
        // No estimatedRating yet — set it
        await trx('listItem')
          .where({ id: existingListItem.id })
          .update({ estimatedRating });

        logger.debug(
          `WatchlistWriter: Updated mediaItemId=${mediaItemId} estimatedRating ` +
            `from null to ${estimatedRating} for userId=${userId}`
        );
        return 'updated';
      }

      if (estimatedRating < currentEstimatedRating) {
        // New value is lower — update (minimum-wins)
        await trx('listItem')
          .where({ id: existingListItem.id })
          .update({ estimatedRating });

        logger.debug(
          `WatchlistWriter: Updated mediaItemId=${mediaItemId} estimatedRating ` +
            `from ${currentEstimatedRating} to ${estimatedRating} for userId=${userId} (minimum-wins)`
        );
        return 'updated';
      }

      // Existing estimatedRating is <= incoming — keep it
      logger.debug(
        `WatchlistWriter: Keeping mediaItemId=${mediaItemId} estimatedRating=${currentEstimatedRating} ` +
          `(incoming=${estimatedRating} is not lower) for userId=${userId}`
      );
      return 'skipped';
    });
  }
}
