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

import { GoodreadsImport } from './data-contracts';

export namespace ImportGoodreads {
  /**
   * No description
   * @tags GoodreadsImport
   * @name Import
   * @request POST:/api/import-goodreads
   * @secure
   */
  export namespace Import {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      url: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = GoodreadsImport;
  }
}
