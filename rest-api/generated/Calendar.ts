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
import { HttpClient, RequestParams } from './http-client';

export class Calendar<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Calendar
   * @name Get
   * @request GET:/api/calendar
   * @secure
   */
  get = (
    query?: {
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
    },
    params: RequestParams = {}
  ) =>
    this.http.request<GetCalendarItemsResponse, any>({
      path: `/api/calendar`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
