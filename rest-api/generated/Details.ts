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

import { MediaItemDetailsResponse } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Details<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags MediaItem
   * @name Get
   * @request GET:/api/details/{mediaItemId}
   * @secure
   */
  get = (mediaItemId: number, params: RequestParams = {}) =>
    this.http.request<MediaItemDetailsResponse, any>({
      path: `/api/details/${mediaItemId}`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags MediaItem
   * @name UpdateMetadata
   * @request GET:/api/details/update-metadata/{mediaItemId}
   * @secure
   */
  updateMetadata = (mediaItemId: number, params: RequestParams = {}) =>
    this.http.request<any, any>({
      path: `/api/details/update-metadata/${mediaItemId}`,
      method: 'GET',
      secure: true,
      ...params,
    });
}
