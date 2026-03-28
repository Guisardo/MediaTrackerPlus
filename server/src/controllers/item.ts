import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { MediaItemDetailsResponse } from 'src/entity/mediaItem';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { updateMediaItem } from 'src/updateMetadata';
import { resolveLocale } from 'src/localeResolver';
import { getMetadataLanguages } from 'src/metadataLanguages';
import { userRepository } from 'src/repository/user';
import { computeViewerAge, isAgeEligible } from 'src/utils/ageEligibility';
import { toCodedRequestErrorObject } from 'src/requestError';

/**
 * Resolves the language to use for metadata overlay, implementing three-tier fallback:
 * 1. Exact locale match from Accept-Language header against METADATA_LANGUAGES
 * 2. First language in METADATA_LANGUAGES as fallback when no exact match
 * 3. null when METADATA_LANGUAGES is empty (no translations configured)
 */
function resolveMetadataLanguage(
  acceptLanguageHeader: string | undefined
): string | null {
  const availableLanguages = getMetadataLanguages();
  if (availableLanguages.length === 0) {
    return null;
  }

  const exactMatch = resolveLocale(acceptLanguageHeader, availableLanguages);
  if (exactMatch) {
    return exactMatch;
  }

  // Tier 2 fallback: use first configured language
  return availableLanguages[0] ?? null;
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

    const language = resolveMetadataLanguage(
      req.headers['accept-language']
    );

    const details = await mediaItemRepository.details({
      mediaItemId: mediaItemId,
      userId: userId,
      language: language,
    });

    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(details);
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
