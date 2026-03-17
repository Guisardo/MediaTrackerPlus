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

export namespace ListItem {
  /**
   * No description
   * @tags List Item
   * @name Add
   * @request PUT:/api/list-item
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags List Item
   * @name RemoveItemFromList
   * @request DELETE:/api/list-item
   * @secure
   */
  export namespace RemoveItemFromList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
