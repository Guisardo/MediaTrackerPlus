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

import { ImportState, TraktTvImportNotImportedItems, TraktTvImportSummary } from './data-contracts';

export namespace ImportTrakttv {
  /**
   * No description
   * @tags TraktTvImport
   * @name State
   * @request GET:/api/import-trakttv/state
   * @secure
   */
  export namespace State {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      state: ImportState;
      progress?: number | null;
      exportSummary?: TraktTvImportSummary | null;
      importSummary?: TraktTvImportSummary | null;
      notImportedItems?: TraktTvImportNotImportedItems | null;
      error?: string | null;
    };
  }

  /**
   * No description
   * @tags TraktTvImport
   * @name StateStream
   * @request GET:/api/import-trakttv/state-stream
   * @secure
   */
  export namespace StateStream {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      state: ImportState;
      progress?: number | null;
      exportSummary?: TraktTvImportSummary | null;
      importSummary?: TraktTvImportSummary | null;
      notImportedItems?: TraktTvImportNotImportedItems | null;
      error?: string | null;
    };
  }

  /**
   * No description
   * @tags TraktTvImport
   * @name DeviceToken
   * @request GET:/api/import-trakttv/device-token
   * @secure
   */
  export namespace DeviceToken {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      userCode: string;
      verificationUrl: string;
    };
  }

  /**
   * No description
   * @tags TraktTvImport
   * @name StartOver
   * @request GET:/api/import-trakttv/start-over
   * @secure
   */
  export namespace StartOver {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
