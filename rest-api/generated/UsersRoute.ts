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

import { Array } from './data-contracts';

export namespace Users {
  /**
   * No description
   * @tags User
   * @name Search
   * @request GET:/api/users/search
   * @secure
   */
  export namespace Search {
    export type RequestParams = {};
    export type RequestQuery = {
      query: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = Array;
  }
}
