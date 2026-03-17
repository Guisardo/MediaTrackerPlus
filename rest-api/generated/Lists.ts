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
import { HttpClient, RequestParams } from './http-client';

export class Lists<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Lists
   * @name GetUsersLists
   * @request GET:/api/lists
   * @secure
   */
  getUsersLists = (
    query?: {
      userId?: number | null;
      mediaItemId?: number | null;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListsResponse, any>({
      path: `/api/lists`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
