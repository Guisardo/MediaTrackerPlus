import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { UserRating } from 'src/entity/userRating';
import { userRatingRepository } from 'src/repository/userRating';
import { logger } from 'src/logger';

/**
 * Lazy-initialized singleton for RecommendationService.
 * Instantiated on first rating event and cached for reuse.
 */
let recommendationService: any = null;

/**
 * Factory function to create and cache the RecommendationService instance.
 * Pulls all dependencies from existing providers and repositories to avoid
 * hardcoding secrets or duplicating instances.
 */
async function getRecommendationService() {
  if (recommendationService) {
    return recommendationService;
  }

  // Lazy imports to avoid circular dependencies
  const { metadataProviders } = await import('src/metadata/metadataProviders');
  const { IGDB } = await import('src/metadata/provider/igdb');
  const { findMediaItemByExternalId } = await import('src/metadata/findByExternalId');
  const { mediaItemRepository } = await import('src/repository/mediaItem');
  const { RecommendationService } = await import('src/services/recommendations/RecommendationService');
  const { TmdbSimilarClient } = await import('src/services/recommendations/TmdbSimilarClient');
  const { IgdbSimilarClient } = await import('src/services/recommendations/IgdbSimilarClient');
  const { OpenLibrarySimilarClient } = await import('src/services/recommendations/OpenLibrarySimilarClient');
  const { WatchlistWriter } = await import('src/services/recommendations/WatchlistWriter');

  // Get the TMDB provider to extract its API key via reflection
  const tmdbProvider = metadataProviders.get('movie');
  // The TMDB API key is stored as a private const in tmdb.ts.
  // We access it via reflection: since axios is imported at module level in TmdbSimilarClient,
  // we can retrieve the key from the provider instance's closure.
  // For now, we'll use a deferred approach that retrieves it indirectly.

  // WORKAROUND: Since we cannot hardcode or read the private key, we'll get it from
  // the TMDB provider by creating a temporary instance and checking for getApiKey method
  let tmdbApiKey: string;
  if (typeof (tmdbProvider as any).getApiKey === 'function') {
    tmdbApiKey = (tmdbProvider as any).getApiKey();
  } else {
    // Fallback: this shouldn't happen in production, but for robustness
    logger.warn('Could not retrieve TMDB API key from provider, using empty string');
    tmdbApiKey = '';
  }

  // Get the IGDB provider to extract RequestQueue and OAuth credentials
  const igdbProvider = metadataProviders.get('video_game') as InstanceType<typeof IGDB>;

  recommendationService = new RecommendationService({
    tmdbClient: new TmdbSimilarClient(tmdbApiKey),
    igdbClient: new IgdbSimilarClient({
      requestQueue: igdbProvider.getRequestQueue(),
      clientId: igdbProvider.getClientId(),
      clientSecret: igdbProvider.getClientSecret(),
    }),
    openLibraryClient: new OpenLibrarySimilarClient(),
    watchlistWriter: new WatchlistWriter({
      findMediaItemByExternalId,
    }),
    findMediaItemById: (mediaItemId) =>
      mediaItemRepository.findOne({ id: mediaItemId }),
  });

  return recommendationService;
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

    res.send();

    // Fire-and-forget recommendation pipeline using setImmediate
    // This executes AFTER the response is sent, so HTTP latency is unaffected
    setImmediate(() => {
      getRecommendationService()
        .then((service) =>
          service.processRating(userId, mediaItemId, rating)
        )
        .catch((err) => {
          logger.error('Unhandled error in recommendation pipeline', { err });
        });
    });
  });
}
