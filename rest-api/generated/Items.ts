/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import { FacetsResponse, MediaItemItemsResponse, MediaItemOrderBy, MediaType, SortOrder } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Items<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description Get items
   *
   * @tags Items
   * @name Paginated
   * @request GET:/api/items/paginated
   * @secure
   */
  paginated = (
    query?: {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
      page?: number | null;
      mediaType?: MediaType | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<
      {
        data: MediaItemItemsResponse[];
        page: number;
        totalPages: number;
        from: number;
        to: number;
        total: number;
      },
      any
    >({
      path: `/api/items/paginated`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * @description Get facet counts
   *
   * @tags Items
   * @name Facets
   * @request GET:/api/items/facets
   * @secure
   */
  facets = (
    query?: {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<FacetsResponse, any>({
      path: `/api/items/facets`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * @description Get items
   *
   * @tags Items
   * @name Get
   * @request GET:/api/items
   * @secure
   */
  get = (
    query?: {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<MediaItemItemsResponse[], any>({
      path: `/api/items`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * @description Get items
   *
   * @tags Items
   * @name Random
   * @request GET:/api/items/random
   * @secure
   */
  random = (
    query?: {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<MediaItemItemsResponse[], any>({
      path: `/api/items/random`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
