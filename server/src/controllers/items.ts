import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import {
  FacetQueryArgs,
  GetItemsArgs,
  mediaItemRepository,
  Pagination,
} from 'src/repository/mediaItem';
import { MediaItemItemsResponse } from 'src/entity/mediaItem';
import { FacetsResponse } from 'src/knex/queries/items';
import { Database } from 'src/dbconfig';
import { UserGroupMember } from 'src/entity/userGroup';
import { resolveLocale } from 'src/localeResolver';
import { getMetadataLanguages } from 'src/metadataLanguages';

export type GetItemsRequest = Omit<
  GetItemsArgs,
  'userId' | 'mediaType' | 'mediaItemIds' | 'language'
> &
  Partial<Pick<GetItemsArgs, 'mediaType'>>;

export type GetFacetsRequest = Omit<FacetQueryArgs, 'userId'>;

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
 * Validates the groupId for a given userId.
 *
 * Returns:
 *  - { groupId: number } if the user is a member of a non-deleted group
 *  - { groupId: undefined } if the group is soft-deleted (silent fallback to all-users)
 *  - { groupId: null } if the user is NOT a member (caller should return 403)
 *  - { groupId: undefined } if groupId is undefined (no groupId provided)
 */
async function validateGroupMembership(
  groupId: number | undefined,
  userId: number
): Promise<{ valid: true; resolvedGroupId: number | undefined } | { valid: false }> {
  if (groupId === undefined) {
    return { valid: true, resolvedGroupId: undefined };
  }

  // Check if the group exists (including soft-deleted state) and if the user is a member
  const result = await Database.knex('userGroup')
    .leftJoin<UserGroupMember>('userGroupMember', (qb) => {
      qb.on('userGroupMember.groupId', 'userGroup.id').andOnVal(
        'userGroupMember.userId',
        userId
      );
    })
    .where('userGroup.id', groupId)
    .select('userGroup.deletedAt', 'userGroupMember.userId as memberUserId')
    .first();

  if (!result) {
    // Group doesn't exist — fall back silently (treat as if no groupId)
    return { valid: true, resolvedGroupId: undefined };
  }

  if (result.deletedAt !== null && result.deletedAt !== undefined) {
    // Soft-deleted group — fall back silently to all-users behavior
    return { valid: true, resolvedGroupId: undefined };
  }

  if (result.memberUserId === null || result.memberUserId === undefined) {
    // Active group but user is not a member — return 403
    return { valid: false };
  }

  return { valid: true, resolvedGroupId: groupId };
}

export class ItemsController {
  /**
   * @description Get items
   * @openapi_tags Items
   * @openapi_operationId paginated
   */
  getPaginated = createExpressRoute<{
    method: 'get';
    path: '/api/items/paginated';
    requestQuery: GetItemsRequest;
    responseBody: Pagination<MediaItemItemsResponse>;
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      filter,
      mediaType,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      page,
      year,
      genre,
      onlySeenItems,
      onlyOnWatchlist,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      selectRandom,
      genres,
      languages,
      creators,
      publishers,
      mediaTypes,
      yearMin,
      yearMax,
      ratingMin,
      ratingMax,
      status,
    } = req.query;

    const orderBy = req.query.orderBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';

    const rawGroupId = req.query.groupId;
    const parsedGroupId =
      rawGroupId !== undefined && !isNaN(Number(rawGroupId))
        ? Number(rawGroupId)
        : undefined;

    if (typeof page !== 'number' || page <= 0) {
      res.sendStatus(400);
      return;
    }

    const membershipResult = await validateGroupMembership(parsedGroupId, userId);
    if (!membershipResult.valid) {
      res.sendStatus(403);
      return;
    }

    const language = resolveMetadataLanguage(req.headers['accept-language']);

    const result = await mediaItemRepository.items({
      userId,
      orderBy,
      sortOrder,
      page,
      ...(mediaType !== undefined ? { mediaType } : {}),
      ...(filter !== undefined ? { filter } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(genre !== undefined ? { genre } : {}),
      ...(onlySeenItems !== undefined ? { onlySeenItems } : {}),
      ...(onlyOnWatchlist !== undefined ? { onlyOnWatchlist } : {}),
      ...(onlyWithNextEpisodesToWatch !== undefined
        ? { onlyWithNextEpisodesToWatch }
        : {}),
      ...(onlyWithNextAiring !== undefined ? { onlyWithNextAiring } : {}),
      ...(onlyWithUserRating !== undefined ? { onlyWithUserRating } : {}),
      ...(onlyWithoutUserRating !== undefined
        ? { onlyWithoutUserRating }
        : {}),
      ...(onlyWithProgress !== undefined ? { onlyWithProgress } : {}),
      ...(genres !== undefined ? { genres } : {}),
      ...(languages !== undefined ? { languages } : {}),
      ...(creators !== undefined ? { creators } : {}),
      ...(publishers !== undefined ? { publishers } : {}),
      ...(mediaTypes !== undefined ? { mediaTypes } : {}),
      ...(yearMin !== undefined ? { yearMin } : {}),
      ...(yearMax !== undefined ? { yearMax } : {}),
      ...(ratingMin !== undefined ? { ratingMin } : {}),
      ...(ratingMax !== undefined ? { ratingMax } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(membershipResult.resolvedGroupId !== undefined
        ? { groupId: membershipResult.resolvedGroupId }
        : {}),
      ...(language !== null ? { language } : {}),
    });

    res.json(result);
  });

  /**
   * @description Get facet counts
   * @openapi_tags Items
   * @openapi_operationId facets
   */
  getFacets = createExpressRoute<{
    method: 'get';
    path: '/api/items/facets';
    requestQuery: GetFacetsRequest;
    responseBody: FacetsResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      mediaType,
      filter,
      genres,
      languages,
      creators,
      publishers,
      mediaTypes,
      yearMin,
      yearMax,
      ratingMin,
      ratingMax,
      status,
      onlyOnWatchlist,
      onlySeenItems,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      orderBy,
    } = req.query;

    const rawGroupId = req.query.groupId;
    const parsedGroupId =
      rawGroupId !== undefined && !isNaN(Number(rawGroupId))
        ? Number(rawGroupId)
        : undefined;

    const membershipResult = await validateGroupMembership(parsedGroupId, userId);
    if (!membershipResult.valid) {
      res.sendStatus(403);
      return;
    }

    const result = await mediaItemRepository.facets({
      userId,
      ...(mediaType !== undefined ? { mediaType } : {}),
      ...(filter !== undefined ? { filter } : {}),
      ...(genres !== undefined ? { genres } : {}),
      ...(languages !== undefined ? { languages } : {}),
      ...(creators !== undefined ? { creators } : {}),
      ...(publishers !== undefined ? { publishers } : {}),
      ...(mediaTypes !== undefined ? { mediaTypes } : {}),
      ...(yearMin !== undefined ? { yearMin } : {}),
      ...(yearMax !== undefined ? { yearMax } : {}),
      ...(ratingMin !== undefined ? { ratingMin } : {}),
      ...(ratingMax !== undefined ? { ratingMax } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(onlyOnWatchlist !== undefined ? { onlyOnWatchlist } : {}),
      ...(onlySeenItems !== undefined ? { onlySeenItems } : {}),
      ...(onlyWithNextAiring !== undefined ? { onlyWithNextAiring } : {}),
      ...(onlyWithNextEpisodesToWatch !== undefined
        ? { onlyWithNextEpisodesToWatch }
        : {}),
      ...(onlyWithUserRating !== undefined ? { onlyWithUserRating } : {}),
      ...(onlyWithoutUserRating !== undefined
        ? { onlyWithoutUserRating }
        : {}),
      ...(onlyWithProgress !== undefined ? { onlyWithProgress } : {}),
      ...(orderBy !== undefined ? { orderBy } : {}),
      ...(membershipResult.resolvedGroupId !== undefined
        ? { groupId: membershipResult.resolvedGroupId }
        : {}),
    });

    res.json(result);
  });

  /**
   * @description Get items
   * @openapi_tags Items
   * @openapi_operationId get
   */
  get = createExpressRoute<{
    method: 'get';
    path: '/api/items';
    requestQuery: Omit<GetItemsRequest, 'page'>;
    responseBody: MediaItemItemsResponse[];
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      filter,
      mediaType,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      onlySeenItems,
      onlyOnWatchlist,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      selectRandom,
    } = req.query;

    const orderBy = req.query.orderBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';

    const rawGroupId = req.query.groupId;
    const parsedGroupId =
      rawGroupId !== undefined && !isNaN(Number(rawGroupId))
        ? Number(rawGroupId)
        : undefined;

    const membershipResult = await validateGroupMembership(parsedGroupId, userId);
    if (!membershipResult.valid) {
      res.sendStatus(403);
      return;
    }

    const language = resolveMetadataLanguage(req.headers['accept-language']);

    const result = await mediaItemRepository.items({
      userId: userId,
      mediaType: mediaType,
      orderBy: orderBy,
      sortOrder: sortOrder,
      filter: filter,
      onlySeenItems: onlySeenItems,
      onlyOnWatchlist: onlyOnWatchlist,
      onlyWithNextEpisodesToWatch: onlyWithNextEpisodesToWatch,
      onlyWithNextAiring: onlyWithNextAiring,
      onlyWithUserRating: onlyWithUserRating,
      onlyWithoutUserRating: onlyWithoutUserRating,
      onlyWithProgress: onlyWithProgress,
      groupId: membershipResult.resolvedGroupId,
      language: language,
    });

    res.json(result);
  });

  /**
   * @description Get items
   * @openapi_tags Items
   * @openapi_operationId random
   */
  getRandom = createExpressRoute<{
    method: 'get';
    path: '/api/items/random';
    requestQuery: Omit<GetItemsRequest, 'page'>;
    responseBody: MediaItemItemsResponse[];
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      filter,
      mediaType,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      onlySeenItems,
      onlyOnWatchlist,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      selectRandom,
    } = req.query;

    const orderBy = req.query.orderBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';

    const rawGroupId = req.query.groupId;
    const parsedGroupId =
      rawGroupId !== undefined && !isNaN(Number(rawGroupId))
        ? Number(rawGroupId)
        : undefined;

    const membershipResult = await validateGroupMembership(parsedGroupId, userId);
    if (!membershipResult.valid) {
      res.sendStatus(403);
      return;
    }

    const language = resolveMetadataLanguage(req.headers['accept-language']);

    const result = await mediaItemRepository.items({
      userId: userId,
      mediaType: mediaType,
      orderBy: orderBy,
      sortOrder: sortOrder,
      filter: filter,
      onlySeenItems: onlySeenItems,
      onlyOnWatchlist: onlyOnWatchlist,
      onlyWithNextEpisodesToWatch: onlyWithNextEpisodesToWatch,
      onlyWithNextAiring: onlyWithNextAiring,
      onlyWithUserRating: onlyWithUserRating,
      onlyWithoutUserRating: onlyWithoutUserRating,
      onlyWithProgress: onlyWithProgress,
      selectRandom: selectRandom,
      groupId: membershipResult.resolvedGroupId,
      language: language,
    });

    res.json(result);
  });
}
