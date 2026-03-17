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

export namespace Items {
  /**
   * @description Get items
   * @tags Items
   * @name Paginated
   * @request GET:/api/items/paginated
   * @secure
   */
  export namespace Paginated {
    export type RequestParams = {};
    export type RequestQuery = {
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
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      data: MediaItemItemsResponse[];
      page: number;
      totalPages: number;
      from: number;
      to: number;
      total: number;
    };
  }

  /**
   * @description Get facet counts
   * @tags Items
   * @name Facets
   * @request GET:/api/items/facets
   * @secure
   */
  export namespace Facets {
    export type RequestParams = {};
    export type RequestQuery = {
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
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = FacetsResponse;
  }

  /**
   * @description Get items
   * @tags Items
   * @name Get
   * @request GET:/api/items
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
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
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }

  /**
   * @description Get items
   * @tags Items
   * @name Random
   * @request GET:/api/items/random
   * @secure
   */
  export namespace Random {
    export type RequestParams = {};
    export type RequestQuery = {
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
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }
}
