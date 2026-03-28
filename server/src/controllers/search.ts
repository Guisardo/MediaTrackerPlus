import _ from 'lodash';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';

import { MediaItemItemsResponse, MediaType } from 'src/entity/mediaItem';
import { findMediaItemByExternalId } from 'src/metadata/findByExternalId';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { definedOrUndefined } from 'src/repository/repository';
import { resolveLocale } from 'src/localeResolver';
import { getMetadataLanguages } from 'src/metadataLanguages';
import { userRepository } from 'src/repository/user';
import { computeViewerAge } from 'src/utils/ageEligibility';

const IMDB_ID_PATTERN = /^tt\d{7,8}$/i;

const isImdbId = (query: string): boolean => IMDB_ID_PATTERN.test(query.trim());

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
  return availableLanguages[0];
}

/**
 * @openapi_tags Search
 */
export class SearchController {
  /**
   * @openapi_operationId search
   */
  search = createExpressRoute<{
    method: 'get';
    path: '/api/search';
    responseBody: MediaItemItemsResponse[];
    requestQuery: {
      q: string;
      mediaType: MediaType;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { mediaType, q: query } = req.query;

    if (typeof query !== 'string' || query?.trim()?.length === 0) {
      res.sendStatus(400);
      return;
    }

    const language = resolveMetadataLanguage(req.headers['accept-language']);
    const selfUser = await userRepository.findOneSelf({ id: userId });
    const viewerAge = computeViewerAge(selfUser?.dateOfBirth);

    if (isImdbId(query) && (mediaType === 'movie' || mediaType === 'tv')) {
      const mediaItem = await findMediaItemByExternalId({
        id: { imdbId: query.trim().toLowerCase() },
        mediaType,
      });

      if (!mediaItem) {
        res.send([]);
        return;
      }

      const existingItemsDetails = await mediaItemRepository.items({
        userId: userId,
        mediaItemIds: mediaItem.id != null ? [mediaItem.id] : [],
        language: language,
        viewerAge,
      });

      // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      res.send(existingItemsDetails);
      return;
    }

    if (!metadataProviders.has(mediaType)) {
      throw new Error(`No metadata provider for "${mediaType}"`);
    }

    const metadataProvider = metadataProviders.get(mediaType);
    const searchResult = await metadataProvider.search(query);

    const result = await mediaItemRepository.mergeSearchResultWithExistingItems(
      searchResult,
      mediaType
    );

    const existingItemsDetails = await mediaItemRepository.items({
      userId: userId,
      mediaItemIds: result
        .map((item) => definedOrUndefined(item.id))
        .filter((id): id is number => id !== undefined),
      ...(language != null ? { language } : {}),
      viewerAge,
    });

    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(existingItemsDetails);
  });
}
