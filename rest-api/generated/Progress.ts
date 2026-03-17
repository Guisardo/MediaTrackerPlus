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

import { MediaType } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Progress<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Progress
   * @name Add
   * @request PUT:/api/progress
   * @secure
   */
  add = (
    query: {
      mediaItemId: number;
      episodeId?: number | null;
      date?: number | null;
      action?: 'paused' | 'playing' | null;
      duration?: number | null;
      progress?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/progress`,
      method: 'PUT',
      query: query,
      secure: true,
      ...params,
    });
  /**
   * No description
   *
   * @tags Progress
   * @name AddByExternalId
   * @request PUT:/api/progress/by-external-id
   * @secure
   */
  addByExternalId = (
    data: {
      mediaType: MediaType;
      id: {
        imdbId?: string | null;
        tmdbId?: number | null;
        audibleId?: string | null;
        igdbId?: number | null;
      };
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      action?: 'paused' | 'playing' | null;
      progress?: number | null;
      duration?: number | null;
      device?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/progress/by-external-id`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags Progress
   * @name DeleteById
   * @request DELETE:/api/progress/{progressId}
   * @secure
   */
  deleteById = (progressId: number, params: RequestParams = {}) =>
    this.http.request<any, any>({
      path: `/api/progress/${progressId}`,
      method: 'DELETE',
      secure: true,
      ...params,
    });
}
