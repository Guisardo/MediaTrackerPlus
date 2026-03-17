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

import { ContentType, HttpClient, RequestParams } from './http-client';

export class Rating<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Rating
   * @name Add
   * @request PUT:/api/rating
   * @secure
   */
  add = (
    data: {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      rating?: number | null;
      review?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/rating`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
      ...params,
    });
}
