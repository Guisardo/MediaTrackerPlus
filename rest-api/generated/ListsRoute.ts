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

import { ListsResponse } from './data-contracts';

export namespace Lists {
  /**
   * No description
   * @tags Lists
   * @name GetUsersLists
   * @request GET:/api/lists
   * @secure
   */
  export namespace GetUsersLists {
    export type RequestParams = {};
    export type RequestQuery = {
      userId?: number | null;
      mediaItemId?: number | null;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListsResponse;
  }
}
