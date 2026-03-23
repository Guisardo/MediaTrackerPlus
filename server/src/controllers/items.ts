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
import { userRepository } from 'src/repository/user';
import { computeViewerAge } from 'src/utils/ageEligibility';

export type GetItemsRequest = Omit<
  GetItemsArgs,
  'userId' | 'mediaType' | 'mediaItemIds' | 'language' | 'viewerAge'
> &
  Partial<Pick<GetItemsArgs, 'mediaType'>>;

export type GetFacetsRequest = Omit<FacetQueryArgs, 'userId' | 'viewerAge'>;

type MembershipValidationResult =
  | { valid: true; resolvedGroupId: number | undefined }
  | { valid: false };

type ValidItemsRequestContext = {
  valid: true;
  userId: number;
  orderBy: GetItemsArgs['orderBy'];
  sortOrder: GetItemsArgs['sortOrder'];
  resolvedGroupId: number | undefined;
  language: string | null;
  viewerAge: number | null;
};

type ValidFacetsRequestContext = {
  valid: true;
  userId: number;
  resolvedGroupId: number | undefined;
  viewerAge: number | null;
};

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
): Promise<MembershipValidationResult> {
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

function parseGroupId(rawGroupId: unknown): number | undefined {
  if (rawGroupId === undefined) {
    return undefined;
  }

  const parsedGroupId = Number(rawGroupId);

  return Number.isNaN(parsedGroupId) ? undefined : parsedGroupId;
}

async function buildItemsRequestContext(args: {
  user: unknown;
  query: Pick<GetItemsRequest, 'groupId' | 'orderBy' | 'sortOrder'>;
  acceptLanguageHeader: string | undefined;
}): Promise<ValidItemsRequestContext | { valid: false }> {
  const { user, query, acceptLanguageHeader } = args;
  const userId = Number(user);
  const membershipResult = await validateGroupMembership(
    parseGroupId(query.groupId),
    userId
  );

  if (!membershipResult.valid) {
    return { valid: false };
  }

  const selfUser = await userRepository.findOneSelf({ id: userId });
  const viewerAge = computeViewerAge(selfUser?.dateOfBirth);

  return {
    valid: true,
    userId,
    orderBy: query.orderBy || 'title',
    sortOrder: query.sortOrder || 'asc',
    resolvedGroupId: membershipResult.resolvedGroupId,
    language: resolveMetadataLanguage(acceptLanguageHeader),
    viewerAge,
  };
}

async function buildFacetsRequestContext(args: {
  user: unknown;
  query: Pick<GetFacetsRequest, 'groupId'>;
}): Promise<ValidFacetsRequestContext | { valid: false }> {
  const userId = Number(args.user);
  const membershipResult = await validateGroupMembership(
    parseGroupId(args.query.groupId),
    userId
  );

  if (!membershipResult.valid) {
    return { valid: false };
  }

  const selfUser = await userRepository.findOneSelf({ id: userId });
  const viewerAge = computeViewerAge(selfUser?.dateOfBirth);

  return {
    valid: true,
    userId,
    resolvedGroupId: membershipResult.resolvedGroupId,
    viewerAge,
  };
}

function buildBaseItemsArgs(
  query: GetItemsRequest,
  context: ValidItemsRequestContext
) {
  return {
    userId: context.userId,
    mediaType: query.mediaType,
    orderBy: context.orderBy,
    sortOrder: context.sortOrder,
    filter: query.filter,
    onlySeenItems: query.onlySeenItems,
    onlyOnWatchlist: query.onlyOnWatchlist,
    onlyWithNextEpisodesToWatch: query.onlyWithNextEpisodesToWatch,
    onlyWithNextAiring: query.onlyWithNextAiring,
    onlyWithUserRating: query.onlyWithUserRating,
    onlyWithoutUserRating: query.onlyWithoutUserRating,
    onlyWithProgress: query.onlyWithProgress,
    groupId: context.resolvedGroupId,
    language: context.language,
    viewerAge: context.viewerAge,
  };
}

function buildPaginatedItemsArgs(
  query: GetItemsRequest & Pick<GetItemsArgs, 'page'>,
  context: ValidItemsRequestContext
): GetItemsArgs & Pick<GetItemsArgs, 'page'> {
  return {
    ...buildBaseItemsArgs(query, context),
    page: query.page,
    year: query.year,
    genre: query.genre,
    genres: query.genres,
    languages: query.languages,
    creators: query.creators,
    publishers: query.publishers,
    mediaTypes: query.mediaTypes,
    yearMin: query.yearMin,
    yearMax: query.yearMax,
    ratingMin: query.ratingMin,
    ratingMax: query.ratingMax,
    status: query.status,
  };
}

function buildRandomItemsArgs(
  query: GetItemsRequest,
  context: ValidItemsRequestContext
) {
  return {
    ...buildBaseItemsArgs(query, context),
    selectRandom: query.selectRandom,
  };
}

function buildFacetArgs(
  query: GetFacetsRequest,
  context: ValidFacetsRequestContext
): FacetQueryArgs {
  return {
    userId: context.userId,
    mediaType: query.mediaType,
    filter: query.filter,
    genres: query.genres,
    languages: query.languages,
    creators: query.creators,
    publishers: query.publishers,
    mediaTypes: query.mediaTypes,
    yearMin: query.yearMin,
    yearMax: query.yearMax,
    ratingMin: query.ratingMin,
    ratingMax: query.ratingMax,
    status: query.status,
    onlyOnWatchlist: query.onlyOnWatchlist,
    onlySeenItems: query.onlySeenItems,
    onlyWithNextAiring: query.onlyWithNextAiring,
    onlyWithNextEpisodesToWatch: query.onlyWithNextEpisodesToWatch,
    onlyWithUserRating: query.onlyWithUserRating,
    onlyWithoutUserRating: query.onlyWithoutUserRating,
    onlyWithProgress: query.onlyWithProgress,
    orderBy: query.orderBy,
    groupId: context.resolvedGroupId,
    viewerAge: context.viewerAge,
  };
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
    if (typeof req.query.page !== 'number' || req.query.page <= 0) {
      res.sendStatus(400);
      return;
    }

    const context = await buildItemsRequestContext({
      user: req.user,
      query: req.query,
      acceptLanguageHeader: req.headers['accept-language'],
    });

    if (!context.valid) {
      res.sendStatus(403);
      return;
    }

    const result = (await mediaItemRepository.items(
      buildPaginatedItemsArgs(
        req.query as GetItemsRequest & Pick<GetItemsArgs, 'page'>,
        context
      )
    )) as unknown as Pagination<MediaItemItemsResponse>;

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
    const context = await buildFacetsRequestContext({
      user: req.user,
      query: req.query,
    });

    if (!context.valid) {
      res.sendStatus(403);
      return;
    }

    const result = await mediaItemRepository.facets(
      buildFacetArgs(req.query, context)
    );

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
    const context = await buildItemsRequestContext({
      user: req.user,
      query: req.query,
      acceptLanguageHeader: req.headers['accept-language'],
    });

    if (!context.valid) {
      res.sendStatus(403);
      return;
    }

    const result = await mediaItemRepository.items(
      buildBaseItemsArgs(req.query, context)
    );

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
    const context = await buildItemsRequestContext({
      user: req.user,
      query: req.query,
      acceptLanguageHeader: req.headers['accept-language'],
    });

    if (!context.valid) {
      res.sendStatus(403);
      return;
    }

    const result = await mediaItemRepository.items(
      buildRandomItemsArgs(req.query, context)
    );

    res.json(result);
  });
}
