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

import { AudibleCountryCode, ServerLang, TmdbLang } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Configuration<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Configuration
   * @name Update
   * @request PATCH:/api/configuration
   * @secure
   */
  update = (
    data: {
      enableRegistration?: boolean | null;
      tmdbLang?: TmdbLang | null;
      audibleLang?: AudibleCountryCode | null;
      serverLang?: ServerLang | null;
      igdbClientId?: string | null;
      igdbClientSecret?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/configuration`,
      method: 'PATCH',
      body: data,
      secure: true,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags Configuration
   * @name Get
   * @request GET:/api/configuration
   * @secure
   */
  get = (params: RequestParams = {}) =>
    this.http.request<
      {
        enableRegistration: boolean;
        tmdbLang?: TmdbLang | null;
        audibleLang?: AudibleCountryCode | null;
        serverLang?: ServerLang | null;
        igdbClientId?: string | null;
        igdbClientSecret?: string | null;
      } & {
        noUsers: boolean;
        demo: boolean;
        version: string;
      },
      any
    >({
      path: `/api/configuration`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
}
