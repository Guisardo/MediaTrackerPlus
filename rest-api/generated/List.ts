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

import { List as ListModel, ListDetailsResponse, ListItemsResponse, ListPrivacy, ListSortBy, ListSortOrder } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class List<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags List
   * @name AddList
   * @request PUT:/api/list
   * @secure
   */
  addList = (
    data: {
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListModel, any>({
      path: `/api/list`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags List
   * @name UpdateList
   * @request PATCH:/api/list
   * @secure
   */
  updateList = (
    data: {
      id: number;
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListModel, any>({
      path: `/api/list`,
      method: 'PATCH',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags List
   * @name GetList
   * @request GET:/api/list
   * @secure
   */
  getList = (
    query: {
      listId: number;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListDetailsResponse, any>({
      path: `/api/list`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags List
   * @name DeleteList
   * @request DELETE:/api/list
   * @secure
   */
  deleteList = (
    query: {
      listId: number;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListDetailsResponse, any>({
      path: `/api/list`,
      method: 'DELETE',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags List
   * @name GetListItems
   * @request GET:/api/list/items
   * @secure
   */
  getListItems = (
    query: {
      listId: number;
      sortBy?: ListSortBy | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<ListItemsResponse, any>({
      path: `/api/list/items`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
