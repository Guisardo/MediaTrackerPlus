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

import { MediaItemDetailsResponse } from './data-contracts';

export namespace Details {
  /**
   * No description
   * @tags MediaItem
   * @name Get
   * @request GET:/api/details/{mediaItemId}
   * @secure
   */
  export namespace Get {
    export type RequestParams = {
      mediaItemId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemDetailsResponse;
  }

  /**
   * No description
   * @tags MediaItem
   * @name UpdateMetadata
   * @request GET:/api/details/update-metadata/{mediaItemId}
   * @secure
   */
  export namespace UpdateMetadata {
    export type RequestParams = {
      mediaItemId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
