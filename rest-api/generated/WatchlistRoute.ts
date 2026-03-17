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

export namespace Watchlist {
  /**
   * No description
   * @tags Watchlist
   * @name Add
   * @request PUT:/api/watchlist
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Watchlist
   * @name Delete
   * @request DELETE:/api/watchlist
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
