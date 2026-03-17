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

import { GetCalendarItemsResponse } from './data-contracts';

export namespace Calendar {
  /**
   * No description
   * @tags Calendar
   * @name Get
   * @request GET:/api/calendar
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Date string in ISO 8601 format
       * @example "2022-05-21"
       */
      start?: string | null;
      /**
       * Date string in ISO 8601 format
       * @example "2022-05-21T23:37:36+00:00"
       */
      end?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetCalendarItemsResponse;
  }
}
