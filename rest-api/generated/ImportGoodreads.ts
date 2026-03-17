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

import { GoodreadsImport } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class ImportGoodreads<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags GoodreadsImport
   * @name Import
   * @request POST:/api/import-goodreads
   * @secure
   */
  import = (
    data: {
      url: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<GoodreadsImport, any>({
      path: `/api/import-goodreads`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
