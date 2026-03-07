/**
 * recommendationService — central orchestrator for the upnext recommendation pipeline.
 */

import { logger } from 'src/logger';
import { MediaItemBase } from 'src/entity/mediaItem';
import { WatchlistWriter } from 'src/services/recommendations/watchlistWriter';
import { SimilarItem } from 'src/services/recommendations/types';

export interface SimilarityProviders {
  similar(mediaItem: MediaItemBase): Promise<SimilarItem[]> | null;
}

export interface RecommendationServiceDeps {
  metadataProviders: SimilarityProviders;
  watchlistWriter: WatchlistWriter;
  findMediaItemById: (mediaItemId: number) => Promise<MediaItemBase | undefined>;
}

export class RecommendationService {
  private readonly metadataProviders: SimilarityProviders;
  private readonly watchlistWriter: WatchlistWriter;
  private readonly findMediaItemById: RecommendationServiceDeps['findMediaItemById'];

  constructor(deps: RecommendationServiceDeps) {
    this.metadataProviders = deps.metadataProviders;
    this.watchlistWriter = deps.watchlistWriter;
    this.findMediaItemById = deps.findMediaItemById;
  }

  async processRating(userId: number, mediaItemId: number, rating: number): Promise<void> {
    try {
      await this.executeProcessRating(userId, mediaItemId, rating);
    } catch (err) {
      logger.error('RecommendationService: Unhandled error in processRating', { err });
    }
  }

  private async executeProcessRating(userId: number, mediaItemId: number, rating: number): Promise<void> {
    const mediaItem = await this.findMediaItemById(mediaItemId);

    if (!mediaItem) {
      logger.warn(`RecommendationService: mediaItemId=${mediaItemId} not found — skipping recommendation pipeline`);
      return;
    }

    const { mediaType } = mediaItem;

    logger.info(`RecommendationService: processRating start — userId=${userId}, mediaItemId=${mediaItemId}, mediaType=${mediaType}, rating=${rating}`);

    const similarItems = (await this.metadataProviders.similar(mediaItem)) ?? [];

    logger.info(`RecommendationService: fetched ${similarItems.length} similar items for mediaItemId=${mediaItemId}`);

    const writeResult = await this.watchlistWriter.write(userId, similarItems, rating);

    logger.info(
      `RecommendationService: processRating complete — userId=${userId}, mediaItemId=${mediaItemId}, ` +
        `apiResultCount=${similarItems.length}, added=${writeResult.added}, ` +
        `updated=${writeResult.updated}, skipped=${writeResult.skipped}`
    );
  }
}
