import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { MediaItemDetailsResponse } from 'src/entity/mediaItem';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { updateMediaItem } from 'src/updateMetadata';
import { resolveMetadataLanguagePreferences } from 'src/localeResolver';
import { getMetadataLanguages } from 'src/metadataLanguages';
import { userRepository } from 'src/repository/user';
import { computeViewerAge, isAgeEligible } from 'src/utils/ageEligibility';
import { toCodedRequestErrorObject } from 'src/requestError';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { logger } from 'src/logger';
import { findMediaItemByExternalId } from 'src/metadata/findByExternalId';
import { RelatedContentService } from 'src/recommendations/relatedContentService';

const relatedContentService = new RelatedContentService({
  metadataProviders,
  findMediaItemByExternalId,
});

async function enrichDetailsWithTrailers(
  details: MediaItemDetailsResponse,
  language: string | null
): Promise<MediaItemDetailsResponse> {
  if (!language) {
    return details;
  }

  try {
    const trailers = await metadataProviders.trailers(details, language);
    if (trailers != null && trailers.length > 0) {
      return {
        ...details,
        trailers,
      };
    }
  } catch (error) {
    logger.warn(
      `MediaItemController.details: failed to fetch trailers for mediaItemId=${details.id ?? 'unknown'} source=${details.source} mediaType=${details.mediaType}`
    );
    logger.error('MediaItemController.details: trailer enrichment error', {
      err: error,
    });
  }

  return details;
}

async function enrichDetailsWithRelatedContent(
  details: MediaItemDetailsResponse,
  viewerAge: number | null | undefined
): Promise<MediaItemDetailsResponse> {
  try {
    const relatedContent = await relatedContentService.relatedContent({
      mediaItem: details,
      viewerAge,
    });

    if (relatedContent.length > 0) {
      return {
        ...details,
        relatedContent,
      };
    }
  } catch (error) {
    logger.warn(
      `MediaItemController.details: failed to enrich related content for mediaItemId=${details.id ?? 'unknown'} source=${details.source} mediaType=${details.mediaType}`
    );
    logger.error('MediaItemController.details: related content enrichment error', {
      err: error,
    });
  }

  return details;
}

/**
 * @openapi_tags MediaItem
 */
export class MediaItemController {
  /**
   * @openapi_operationId get
   */
  details = createExpressRoute<{
    method: 'get';
    path: '/api/details/:mediaItemId';
    pathParams: {
      mediaItemId: number;
    };
    responseBody: MediaItemDetailsResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { mediaItemId } = req.params;

    const mediaItem = await mediaItemRepository.findOne({
      id: mediaItemId,
    });

    if (!mediaItem) {
      res.status(404).send();
      return;
    }

    if (mediaItem.needsDetails == true) {
      await updateMediaItem(mediaItem);
    }

    // Age gating: check AFTER needsDetails refresh so stale items cannot
    // bypass restriction once parental metadata is populated.
    // Re-fetch minimumAge because updateMediaItem may have changed it.
    const refreshedItem = mediaItem.needsDetails
      ? await mediaItemRepository.findOne({ id: mediaItemId })
      : mediaItem;

    const selfUser = await userRepository.findOneSelf({ id: userId });
    const viewerAge = computeViewerAge(selfUser?.dateOfBirth);

    if (!isAgeEligible(viewerAge, refreshedItem?.minimumAge ?? null)) {
      res.status(403).send(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toCodedRequestErrorObject('This content is age-restricted.', 'AGE_RESTRICTED') as any
      );
      return;
    }

    const metadataLanguageResolution = resolveMetadataLanguagePreferences(
      req.headers['accept-language'],
      getMetadataLanguages()
    );
    const primaryLanguage = metadataLanguageResolution.primary;

    const details = await mediaItemRepository.details({
      mediaItemId: mediaItemId,
      userId: userId,
      metadataLanguagePreferences: metadataLanguageResolution.candidates,
    });

    const detailsWithTrailers = await enrichDetailsWithTrailers(
      details,
      primaryLanguage
    );
    const enrichedDetails = await enrichDetailsWithRelatedContent(
      detailsWithTrailers,
      viewerAge
    );

    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(enrichedDetails);
  });

  /**
   * @openapi_operationId updateMetadata
   */
  updateMetadata = createExpressRoute<{
    method: 'get';
    path: '/api/details/update-metadata/:mediaItemId';
    pathParams: {
      mediaItemId: number;
    };
  }>(async (req, res) => {
    const { mediaItemId } = req.params;

    const mediaItem = await mediaItemRepository.findOne({
      id: mediaItemId,
    });

    if (!mediaItem) {
      res.status(404).send();
      return;
    }

    await updateMediaItem(mediaItem);

    res.sendStatus(200);
  });
}
