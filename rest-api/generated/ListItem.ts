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

export class ListItem<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags List Item
   * @name Add
   * @request PUT:/api/list-item
   * @secure
   */
  add = (
    query: {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/list-item`,
      method: 'PUT',
      query: query,
      secure: true,
      ...params,
    });
  /**
   * No description
   *
   * @tags List Item
   * @name RemoveItemFromList
   * @request DELETE:/api/list-item
   * @secure
   */
  removeItemFromList = (
    query: {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/list-item`,
      method: 'DELETE',
      query: query,
      secure: true,
      ...params,
    });
}
