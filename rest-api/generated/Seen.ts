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

import { LastSeenAt, MediaType } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Seen<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Seen
   * @name Add
   * @request PUT:/api/seen
   * @secure
   */
  add = (
    query: {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      lastSeenEpisodeId?: number | null;
      lastSeenAt?: LastSeenAt | null;
      date?: number | null;
      duration?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/seen`,
      method: 'PUT',
      query: query,
      secure: true,
      ...params,
    });
  /**
   * No description
   *
   * @tags Seen
   * @name AddByExternalId
   * @request PUT:/api/seen/by-external-id
   * @secure
   */
  addByExternalId = (
    data: {
      mediaType: MediaType;
      id: {
        imdbId?: string | null;
        tmdbId?: number | null;
      };
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      duration?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/seen/by-external-id`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags Seen
   * @name DeleteById
   * @request DELETE:/api/seen/{seenId}
   * @secure
   */
  deleteById = (seenId: number, params: RequestParams = {}) =>
    this.http.request<any, any>({
      path: `/api/seen/${seenId}`,
      method: 'DELETE',
      secure: true,
      ...params,
    });
  /**
   * No description
   *
   * @tags Seen
   * @name Delete
   * @request DELETE:/api/seen/
   * @secure
   */
  delete = (
    query: {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/seen/`,
      method: 'DELETE',
      query: query,
      secure: true,
      ...params,
    });
}
