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

import { Array } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Users<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags User
   * @name Search
   * @request GET:/api/users/search
   * @secure
   */
  search = (
    query: {
      query: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<Array, any>({
      path: `/api/users/search`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
