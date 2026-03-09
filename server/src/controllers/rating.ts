import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import type { RecommendationService } from 'src/recommendations/recommendationService';
import { UserRating } from 'src/entity/userRating';
import { userRatingRepository } from 'src/repository/userRating';
import { logger } from 'src/logger';
import { Config } from 'src/config';
import { seenRepository } from 'src/repository/seen';
import { Seen } from 'src/entity/seen';
import { TvEpisodeFilters } from 'src/entity/tvepisode';
import { tvEpisodeRepository } from 'src/repository/episode';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { listItemRepository } from 'src/repository/listItemRepository';
import { userRepository } from 'src/repository/user';
import { Database } from 'src/dbconfig';

/**
 * Lazy-initialized singleton for RecommendationService.
 * Instantiated on first rating event and cached for reuse.
 */
let recommendationService: RecommendationService | null = null;

async function getRecommendationService(): Promise<RecommendationService> {
  if (recommendationService) {
    return recommendationService;
  }

  const { metadataProviders } = await import('src/metadata/metadataProviders');
  const { findMediaItemByExternalId } = await import('src/metadata/findByExternalId');
  const { mediaItemRepository: lazyMediaItemRepository } = await import('src/repository/mediaItem');
  const { RecommendationService } = await import('src/recommendations/recommendationService');
  const { WatchlistWriter } = await import('src/recommendations/watchlistWriter');

  recommendationService = new RecommendationService({
    metadataProviders,
    watchlistWriter: new WatchlistWriter({
      findMediaItemByExternalId,
    }),
    findMediaItemById: (mediaItemId: number) =>
      lazyMediaItemRepository.findOne({ id: mediaItemId }),
  });

  return recommendationService;
}

/**
 * Automatically creates a seen entry for the rated content if none exists yet.
 *
 * Handles all content types:
 * - Episode: creates a single seen entry for the episode.
 * - Season: creates seen entries for all non-special, released episodes in the
 *   season that the user has not already seen.
 * - TV show (no seasonId/episodeId): creates seen entries for all non-special,
 *   released episodes across the entire show that the user has not already seen.
 * - Non-TV media item (movie, book, game, etc.): creates a single seen entry
 *   and removes the item from the user's watchlist.
 *
 * No duplicate seen entries are created: each case checks for existing records
 * before inserting.
 */
async function autoMarkAsSeen({
  userId,
  mediaItemId,
  seasonId,
  episodeId,
}: {
  userId: number;
  mediaItemId: number;
  seasonId?: number;
  episodeId?: number;
}): Promise<void> {
  const now = Date.now();

  if (episodeId) {
    const alreadySeen = await seenRepository.findOne({ userId, episodeId });
    if (!alreadySeen) {
      logger.debug(
        `autoMarkAsSeen: marking episode ${episodeId} as seen for user ${userId}`
      );
      await seenRepository.create({
        userId,
        mediaItemId,
        episodeId,
        date: now,
      });
    }
    return;
  }

  if (seasonId) {
    const episodes = await tvEpisodeRepository.find({ seasonId });
    const filteredEpisodes = episodes
      .filter(TvEpisodeFilters.nonSpecialEpisodes)
      .filter(TvEpisodeFilters.releasedEpisodes);

    if (filteredEpisodes.length === 0) {
      return;
    }

    const alreadySeenEpisodeIds = new Set(
      (
        await Database.knex<Seen>('seen')
          .where('userId', userId)
          .whereIn(
            'episodeId',
            filteredEpisodes.map((e) => e.id)
          )
          .select('episodeId')
      ).map((s) => s.episodeId)
    );

    const unseenEpisodes = filteredEpisodes.filter(
      (episode) => !alreadySeenEpisodeIds.has(episode.id)
    );

    if (unseenEpisodes.length > 0) {
      logger.debug(
        `autoMarkAsSeen: marking ${unseenEpisodes.length} episodes in season ${seasonId} as seen for user ${userId}`
      );
      await seenRepository.createMany(
        unseenEpisodes.map(
          (episode): Seen => ({
            userId,
            mediaItemId,
            episodeId: episode.id,
            date: now,
          })
        )
      );
    }
    return;
  }

  const mediaItem = await mediaItemRepository.findOne({ id: mediaItemId });

  if (!mediaItem) {
    logger.warn(
      `autoMarkAsSeen: media item ${mediaItemId} not found for user ${userId}`,
      { userId, mediaItemId }
    );
    return;
  }

  if (mediaItem.mediaType === 'tv') {
    const episodes = await tvEpisodeRepository.find({ tvShowId: mediaItemId });
    const filteredEpisodes = episodes
      .filter(TvEpisodeFilters.nonSpecialEpisodes)
      .filter(TvEpisodeFilters.releasedEpisodes);

    if (filteredEpisodes.length === 0) {
      return;
    }

    const alreadySeenEpisodeIds = new Set(
      (
        await Database.knex<Seen>('seen')
          .where('userId', userId)
          .whereIn(
            'episodeId',
            filteredEpisodes.map((e) => e.id)
          )
          .select('episodeId')
      ).map((s) => s.episodeId)
    );

    const unseenEpisodes = filteredEpisodes.filter(
      (episode) => !alreadySeenEpisodeIds.has(episode.id)
    );

    if (unseenEpisodes.length > 0) {
      logger.debug(
        `autoMarkAsSeen: marking ${unseenEpisodes.length} episodes of TV show ${mediaItemId} as seen for user ${userId}`
      );
      await seenRepository.createMany(
        unseenEpisodes.map(
          (episode): Seen => ({
            userId,
            mediaItemId,
            episodeId: episode.id,
            date: now,
          })
        )
      );
    }
  } else {
    const alreadySeen = await Database.knex<Seen>('seen')
      .where('userId', userId)
      .where('mediaItemId', mediaItemId)
      .whereNull('episodeId')
      .first();

    if (!alreadySeen) {
      logger.debug(
        `autoMarkAsSeen: marking media item ${mediaItemId} as seen for user ${userId}`
      );
      await seenRepository.create({
        userId,
        mediaItemId,
        episodeId: null,
        date: now,
      });

      await listItemRepository.removeItem({
        userId,
        mediaItemId,
        watchlist: true,
      });
    }
  }
}

/**
 * @openapi_tags Rating
 */
export class RatingController {
  /**
   * @openapi_operationId add
   */
  add = createExpressRoute<{
    path: '/api/rating';
    method: 'put';
    requestBody: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
      rating?: number;
      review?: string;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { mediaItemId, seasonId, episodeId, rating, review } = req.body;

    const userRating: UserRating = {
      date: new Date().getTime(),
      mediaItemId: mediaItemId,
      episodeId: episodeId || null,
      seasonId: seasonId || null,
      review: review,
      userId: userId,
      rating: rating,
    };

    await userRatingRepository.updateOrCreate({
      where: {
        userId: userId,
        mediaItemId: mediaItemId,
        seasonId: seasonId || null,
        episodeId: episodeId || null,
      },
      value: userRating,
    });

    if (rating !== undefined && rating !== null) {
      try {
        await autoMarkAsSeen({
          userId,
          mediaItemId,
          seasonId,
          episodeId,
        });
      } catch (err) {
        logger.error(
          'Failed to auto-mark content as seen after rating',
          {
            err,
            userId,
            mediaItemId,
            seasonId,
            episodeId,
          }
        );
      }
    }

    res.send();

    // Fire-and-forget platformRating cache update via setImmediate.
    // Only fires for media-level ratings (not episode- or season-level),
    // and only when a numeric rating value is present (review-only writes
    // don't change the average, so no recalculation is needed).
    // This executes AFTER the response is sent, so HTTP latency is unaffected.
    if (!episodeId && !seasonId && rating !== undefined) {
      setImmediate(() => {
        mediaItemRepository
          .recalculatePlatformRating(mediaItemId)
          .catch((err) => {
            logger.error('Unhandled error in platformRating recalculation', {
              err,
              mediaItemId,
            });
          });
      });
    }

    // Fire-and-forget recommendation pipeline using setImmediate.
    // Only triggered when a numeric rating is provided.
    // This executes AFTER the response is sent, so HTTP latency is unaffected.
    if (rating !== undefined) {
      setImmediate(() => {
        userRepository
          .findOne({ id: userId })
          .then((user) => {
            if (user.addRecommendedToWatchlist === false) {
              return;
            }
            return getRecommendationService().then((service) =>
              service.processRating(userId, mediaItemId, rating)
            );
          })
          .catch((err) => {
            logger.error('Unhandled error in recommendation pipeline', { err });
          });
      });
    }
  });
}
