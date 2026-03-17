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

import { HttpClient, RequestParams } from './http-client';

export class Tokens<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description Add token
   *
   * @tags Token
   * @name Add
   * @request PUT:/api/tokens
   * @secure
   */
  add = (
    query: {
      description: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<
      {
        token: string;
      },
      any
    >({
      path: `/api/tokens`,
      method: 'PUT',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * @description Delete token
   *
   * @tags Token
   * @name Delete
   * @request DELETE:/api/tokens
   * @secure
   */
  delete = (
    query: {
      description: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/tokens`,
      method: 'DELETE',
      query: query,
      secure: true,
      ...params,
    });
  /**
   * @description Get all tokens
   *
   * @tags Token
   * @name Get
   * @request GET:/api/tokens
   * @secure
   */
  get = (params: RequestParams = {}) =>
    this.http.request<string[], any>({
      path: `/api/tokens`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
}
