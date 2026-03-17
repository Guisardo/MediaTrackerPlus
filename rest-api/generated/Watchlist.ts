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

import { HttpClient, RequestParams } from './http-client';

export class Watchlist<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Watchlist
   * @name Add
   * @request PUT:/api/watchlist
   * @secure
   */
  add = (
    query: {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/watchlist`,
      method: 'PUT',
      query: query,
      secure: true,
      ...params,
    });
  /**
   * No description
   *
   * @tags Watchlist
   * @name Delete
   * @request DELETE:/api/watchlist
   * @secure
   */
  delete = (
    query: {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/watchlist`,
      method: 'DELETE',
      query: query,
      secure: true,
      ...params,
    });
}
