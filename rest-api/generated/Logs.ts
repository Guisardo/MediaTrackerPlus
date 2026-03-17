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
import { HttpClient, RequestParams } from './http-client';

export class Logs<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Logs
   * @name Get
   * @request GET:/api/logs
   * @secure
   */
  get = (
    query?: {
      error?: boolean | null;
      warn?: boolean | null;
      info?: boolean | null;
      debug?: boolean | null;
      http?: boolean | null;
      count?: number | null;
      from?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<LogEntry[], any>({
      path: `/api/logs`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
