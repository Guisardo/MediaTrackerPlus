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

import { List, ListDetailsResponse, ListItemsResponse, ListPrivacy, ListSortBy, ListSortOrder } from './data-contracts';

export namespace List {
  /**
   * No description
   * @tags List
   * @name AddList
   * @request PUT:/api/list
   * @secure
   */
  export namespace AddList {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = List;
  }

  /**
   * No description
   * @tags List
   * @name UpdateList
   * @request PATCH:/api/list
   * @secure
   */
  export namespace UpdateList {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      id: number;
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = List;
  }

  /**
   * No description
   * @tags List
   * @name GetList
   * @request GET:/api/list
   * @secure
   */
  export namespace GetList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListDetailsResponse;
  }

  /**
   * No description
   * @tags List
   * @name DeleteList
   * @request DELETE:/api/list
   * @secure
   */
  export namespace DeleteList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListDetailsResponse;
  }

  /**
   * No description
   * @tags List
   * @name GetListItems
   * @request GET:/api/list/items
   * @secure
   */
  export namespace GetListItems {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      sortBy?: ListSortBy | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListItemsResponse;
  }
}
