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

import { MediaItemItemsResponse, MediaType } from './data-contracts';

export namespace Search {
  /**
   * No description
   * @tags Search
   * @name Search
   * @request GET:/api/search
   * @secure
   */
  export namespace Search {
    export type RequestParams = {};
    export type RequestQuery = {
      q: string;
      mediaType: MediaType;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }
}
