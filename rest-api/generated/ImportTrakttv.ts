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
import { HttpClient, RequestParams } from './http-client';

export class ImportTrakttv<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags TraktTvImport
   * @name State
   * @request GET:/api/import-trakttv/state
   * @secure
   */
  state = (params: RequestParams = {}) =>
    this.http.request<
      {
        state: ImportState;
        progress?: number | null;
        exportSummary?: TraktTvImportSummary | null;
        importSummary?: TraktTvImportSummary | null;
        notImportedItems?: TraktTvImportNotImportedItems | null;
        error?: string | null;
      },
      any
    >({
      path: `/api/import-trakttv/state`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags TraktTvImport
   * @name StateStream
   * @request GET:/api/import-trakttv/state-stream
   * @secure
   */
  stateStream = (params: RequestParams = {}) =>
    this.http.request<
      {
        state: ImportState;
        progress?: number | null;
        exportSummary?: TraktTvImportSummary | null;
        importSummary?: TraktTvImportSummary | null;
        notImportedItems?: TraktTvImportNotImportedItems | null;
        error?: string | null;
      },
      any
    >({
      path: `/api/import-trakttv/state-stream`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags TraktTvImport
   * @name DeviceToken
   * @request GET:/api/import-trakttv/device-token
   * @secure
   */
  deviceToken = (params: RequestParams = {}) =>
    this.http.request<
      {
        userCode: string;
        verificationUrl: string;
      },
      any
    >({
      path: `/api/import-trakttv/device-token`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags TraktTvImport
   * @name StartOver
   * @request GET:/api/import-trakttv/start-over
   * @secure
   */
  startOver = (params: RequestParams = {}) =>
    this.http.request<any, any>({
      path: `/api/import-trakttv/start-over`,
      method: 'GET',
      secure: true,
      ...params,
    });
}
