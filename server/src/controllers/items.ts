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

export type GetItemsRequest = Omit<
  GetItemsArgs,
  'userId' | 'mediaType' | 'mediaItemIds'
> &
  Partial<Pick<GetItemsArgs, 'mediaType'>>;

export type GetFacetsRequest = Omit<FacetQueryArgs, 'userId'>;

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

    if (page <= 0) {
      res.status(400);
      return;
    }

    const membershipResult = await validateGroupMembership(parsedGroupId, userId);
    if (!membershipResult.valid) {
      res.sendStatus(403);
      return;
    }

    const result = await mediaItemRepository.items({
      userId: userId,
      mediaType: mediaType,
      orderBy: orderBy,
      sortOrder: sortOrder,
      filter: filter,
      page: page,
      year: year,
      genre: genre,
      onlySeenItems: onlySeenItems,
      onlyOnWatchlist: onlyOnWatchlist,
      onlyWithNextEpisodesToWatch: onlyWithNextEpisodesToWatch,
      onlyWithNextAiring: onlyWithNextAiring,
      onlyWithUserRating: onlyWithUserRating,
      onlyWithoutUserRating: onlyWithoutUserRating,
      onlyWithProgress: onlyWithProgress,
      genres: genres,
      languages: languages,
      creators: creators,
      publishers: publishers,
      mediaTypes: mediaTypes,
      yearMin: yearMin,
      yearMax: yearMax,
      ratingMin: ratingMin,
      ratingMax: ratingMax,
      status: status,
      groupId: membershipResult.resolvedGroupId,
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
      groupId: membershipResult.resolvedGroupId,
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
    });

    res.json(result);
  });
}
