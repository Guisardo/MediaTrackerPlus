import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import {
  FacetQueryArgs,
  GetItemsArgs,
  mediaItemRepository,
  Pagination,
} from 'src/repository/mediaItem';
import { MediaItemItemsResponse } from 'src/entity/mediaItem';
import { FacetsResponse } from 'src/knex/queries/items';

export type GetItemsRequest = Omit<
  GetItemsArgs,
  'userId' | 'mediaType' | 'mediaItemIds'
> &
  Partial<Pick<GetItemsArgs, 'mediaType'>>;

export type GetFacetsRequest = Omit<FacetQueryArgs, 'userId'>;


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

    if (page <= 0) {
      res.status(400);
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
    });

    res.json(result);
  });
}
