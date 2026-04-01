import {
  MediaItemBase,
  mediaItemPosterPath,
  RelatedContentItem,
  RelatedContentMediaType,
} from 'src/entity/mediaItem';
import { SimilarItem } from 'src/metadata/types';
import { logger } from 'src/logger';
import { isAgeEligible } from 'src/utils/ageEligibility';
import { similarItemToExternalIds } from 'src/recommendations/similarItemExternalIds';

const DEFAULT_RELATED_CONTENT_LIMIT = 12;

type SupportedRelatedMediaType = Extract<
  MediaItemBase['mediaType'],
  RelatedContentMediaType
>;

const isSupportedRelatedMediaType = (
  mediaType: MediaItemBase['mediaType']
): mediaType is SupportedRelatedMediaType => {
  return (
    mediaType === 'movie' ||
    mediaType === 'tv' ||
    mediaType === 'book' ||
    mediaType === 'video_game'
  );
};

const toRelatedContentItem = (mediaItem: MediaItemBase): RelatedContentItem | null => {
  if (
    mediaItem.id == null ||
    mediaItem.title == null ||
    !isSupportedRelatedMediaType(mediaItem.mediaType)
  ) {
    return null;
  }

  const hasPoster =
    mediaItem.posterId != null || mediaItem.externalPosterUrl != null;

  return {
    id: mediaItem.id,
    title: mediaItem.title,
    mediaType: mediaItem.mediaType,
    posterSmall: hasPoster ? mediaItemPosterPath(mediaItem.id, 'small') : null,
    releaseDate: mediaItem.releaseDate,
    source: mediaItem.source,
  };
};

export interface RelatedContentServiceDeps {
  findMediaItemByExternalId: (args: {
    id: ReturnType<typeof similarItemToExternalIds>;
    mediaType: SimilarItem['mediaType'];
  }) => Promise<MediaItemBase | undefined>;
  metadataProviders: {
    similar(mediaItem: MediaItemBase): Promise<SimilarItem[]> | null;
  };
}

export class RelatedContentService {
  private readonly findMediaItemByExternalId: RelatedContentServiceDeps['findMediaItemByExternalId'];
  private readonly metadataProviders: RelatedContentServiceDeps['metadataProviders'];

  constructor(deps: RelatedContentServiceDeps) {
    this.findMediaItemByExternalId = deps.findMediaItemByExternalId;
    this.metadataProviders = deps.metadataProviders;
  }

  async relatedContent(args: {
    mediaItem: MediaItemBase;
    viewerAge?: number | null;
    limit?: number;
  }): Promise<RelatedContentItem[]> {
    const { mediaItem, viewerAge, limit = DEFAULT_RELATED_CONTENT_LIMIT } = args;

    let similarItems: SimilarItem[] = [];

    try {
      similarItems = (await this.metadataProviders.similar(mediaItem)) ?? [];
    } catch (error) {
      logger.warn(
        `RelatedContentService: failed to fetch similar items for mediaItemId=${mediaItem.id ?? 'unknown'} source=${mediaItem.source} mediaType=${mediaItem.mediaType}`
      );
      logger.error('RelatedContentService: similarity fetch error', {
        err: error,
      });
      return [];
    }

    if (similarItems.length === 0) {
      return [];
    }

    const dedupedResolvedIds = new Set<number>();
    const relatedContent: RelatedContentItem[] = [];

    for (const candidate of similarItems) {
      if (relatedContent.length >= limit) {
        break;
      }

      try {
        const resolved = await this.findMediaItemByExternalId({
          id: similarItemToExternalIds(candidate),
          mediaType: candidate.mediaType,
        });

        if (resolved?.id == null) {
          continue;
        }

        if (resolved.id === mediaItem.id || dedupedResolvedIds.has(resolved.id)) {
          continue;
        }

        if (!isAgeEligible(viewerAge ?? null, resolved.minimumAge ?? null)) {
          continue;
        }

        const relatedItem = toRelatedContentItem(resolved);

        if (!relatedItem) {
          continue;
        }

        dedupedResolvedIds.add(relatedItem.id);
        relatedContent.push(relatedItem);
      } catch (error) {
        logger.warn(
          `RelatedContentService: failed to resolve similar item externalId="${candidate.externalId}" mediaType="${candidate.mediaType}" for mediaItemId=${mediaItem.id ?? 'unknown'}`
        );
        logger.error('RelatedContentService: related item resolution error', {
          err: error,
        });
      }
    }

    return relatedContent;
  }
}
