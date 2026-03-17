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

export namespace Rating {
  /**
   * No description
   * @tags Rating
   * @name Add
   * @request PUT:/api/rating
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      rating?: number | null;
      review?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
