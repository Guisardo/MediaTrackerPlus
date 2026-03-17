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

import { MediaItemItemsResponse, MediaType } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Search<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Search
   * @name Search
   * @request GET:/api/search
   * @secure
   */
  search = (
    query: {
      q: string;
      mediaType: MediaType;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<MediaItemItemsResponse[], any>({
      path: `/api/search`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
