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

import { LogEntry } from './data-contracts';

export namespace Logs {
  /**
   * No description
   * @tags Logs
   * @name Get
   * @request GET:/api/logs
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
      error?: boolean | null;
      warn?: boolean | null;
      info?: boolean | null;
      debug?: boolean | null;
      http?: boolean | null;
      count?: number | null;
      from?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = LogEntry[];
  }
}
