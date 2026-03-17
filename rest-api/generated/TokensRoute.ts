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

export namespace Tokens {
  /**
   * @description Add token
   * @tags Token
   * @name Add
   * @request PUT:/api/tokens
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      description: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      token: string;
    };
  }

  /**
   * @description Delete token
   * @tags Token
   * @name Delete
   * @request DELETE:/api/tokens
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      description: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * @description Get all tokens
   * @tags Token
   * @name Get
   * @request GET:/api/tokens
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = string[];
  }
}
