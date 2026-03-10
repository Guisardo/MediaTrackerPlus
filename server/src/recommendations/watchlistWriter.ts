/**
 * watchlistWriter — adds recommended items to a user's watchlist with
 * estimatedRating, using Knex transactions and a minimum-wins update strategy.
 */

import { Knex } from 'knex';
import { Database } from 'src/dbconfig';
import { List, ListItem } from 'src/entity/list';
import { Seen } from 'src/entity/seen';
import { UserRating } from 'src/entity/userRating';
import { ExternalIds, MediaType } from 'src/entity/mediaItem';
import { logger } from 'src/logger';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { recalculateGroupPlatformRatingsForUser } from 'src/repository/groupPlatformRatingCache';
import { SimilarItem } from 'src/metadata/types';

const toExternalIds = (item: SimilarItem): ExternalIds => {
  switch (item.mediaType) {
    case 'movie':
    case 'tv':
      return { tmdbId: Number(item.externalId) };
    case 'video_game':
      return { igdbId: Number(item.externalId) };
    case 'book':
      return { openlibraryId: item.externalId };
  }
};

export interface WriteResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface WatchlistWriterDeps {
  findMediaItemByExternalId: (args: {
    id: ExternalIds;
    mediaType: MediaType;
  }) => Promise<{ id?: number } | undefined>;
  knex?: Knex;
}

export class WatchlistWriter {
  private readonly findMediaItemByExternalId: WatchlistWriterDeps['findMediaItemByExternalId'];
  private readonly getKnex: () => Knex;

  constructor(deps: WatchlistWriterDeps) {
    this.findMediaItemByExternalId = deps.findMediaItemByExternalId;
    this.getKnex = deps.knex ? () => deps.knex! : () => Database.knex;
  }

  async write(userId: number, items: SimilarItem[], estimatedRating: number): Promise<WriteResult> {
    const result: WriteResult = { added: 0, updated: 0, skipped: 0 };

    for (const item of items) {
      const outcome = await this.processItem(userId, item, estimatedRating);
      switch (outcome) {
        case 'added': result.added++; break;
        case 'updated': result.updated++; break;
        case 'skipped': result.skipped++; break;
      }
    }

    return result;
  }

  private async processItem(userId: number, item: SimilarItem, estimatedRating: number): Promise<'added' | 'updated' | 'skipped'> {
    const mediaItem = await this.findMediaItemByExternalId({
      id: toExternalIds(item),
      mediaType: item.mediaType as MediaType,
    });

    if (!mediaItem || mediaItem.id === undefined) {
      logger.warn(
        `WatchlistWriter: findMediaItemByExternalId returned undefined for ` +
          `externalId="${item.externalId}" mediaType="${item.mediaType}" — skipping`
      );
      return 'skipped';
    }

    const mediaItemId = mediaItem.id;

    const outcome = await this.getKnex().transaction(async (trx) => {
      const watchlist = await trx<List>('list').where({ userId, isWatchlist: true }).first();

      if (!watchlist) {
        logger.warn(`WatchlistWriter: No watchlist found for userId=${userId} — skipping item "${item.title}"`);
        return 'skipped';
      }

      const listId = watchlist.id;

      const userRating = await trx<UserRating>('userRating')
        .where({ userId, mediaItemId, seasonId: null, episodeId: null })
        .first();

      if (userRating) {
        logger.debug(`WatchlistWriter: mediaItemId=${mediaItemId} already rated by userId=${userId} — skipping`);
        return 'skipped';
      }

      const seen = await trx<Seen>('seen').where({ userId, mediaItemId }).whereNull('episodeId').first();

      if (seen) {
        logger.debug(`WatchlistWriter: mediaItemId=${mediaItemId} already watched by userId=${userId} — skipping`);
        return 'skipped';
      }

      const existingListItem = await trx<ListItem>('listItem').where({ listId, mediaItemId }).first();

      if (!existingListItem) {
        await trx('listItem').insert({ listId, mediaItemId, addedAt: new Date().getTime(), estimatedRating });
        logger.debug(`WatchlistWriter: Added mediaItemId=${mediaItemId} to watchlist for userId=${userId} with estimatedRating=${estimatedRating}`);
        return 'added';
      }

      const currentEstimatedRating = existingListItem.estimatedRating;

      if (currentEstimatedRating === undefined || currentEstimatedRating === null) {
        await trx('listItem').where({ id: existingListItem.id }).update({ estimatedRating });
        logger.debug(`WatchlistWriter: Updated mediaItemId=${mediaItemId} estimatedRating from null to ${estimatedRating} for userId=${userId}`);
        return 'updated';
      }

      if (estimatedRating < currentEstimatedRating) {
        await trx('listItem').where({ id: existingListItem.id }).update({ estimatedRating });
        logger.debug(`WatchlistWriter: Updated mediaItemId=${mediaItemId} estimatedRating from ${currentEstimatedRating} to ${estimatedRating} for userId=${userId} (minimum-wins)`);
        return 'updated';
      }

      logger.debug(`WatchlistWriter: Keeping mediaItemId=${mediaItemId} estimatedRating=${currentEstimatedRating} (incoming=${estimatedRating} is not lower) for userId=${userId}`);
      return 'skipped';
    });

    if (outcome === 'added' || outcome === 'updated') {
      setImmediate(() => {
        mediaItemRepository
          .recalculatePlatformRating(mediaItemId)
          .catch((err) => {
            logger.error(
              'WatchlistWriter: Unhandled error in platformRating recalculation',
              { err, mediaItemId }
            );
          });
      });
      setImmediate(() => {
        recalculateGroupPlatformRatingsForUser(userId, mediaItemId).catch(
          (err) => {
            logger.error(
              'WatchlistWriter: Unhandled error in groupPlatformRating recalculation',
              { err, userId, mediaItemId }
            );
          }
        );
      });
    }

    return outcome;
  }
}
