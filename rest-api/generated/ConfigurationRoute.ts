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

export namespace Configuration {
  /**
   * No description
   * @tags Configuration
   * @name Update
   * @request PATCH:/api/configuration
   * @secure
   */
  export namespace Update {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      enableRegistration?: boolean | null;
      tmdbLang?: TmdbLang | null;
      audibleLang?: AudibleCountryCode | null;
      serverLang?: ServerLang | null;
      igdbClientId?: string | null;
      igdbClientSecret?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Configuration
   * @name Get
   * @request GET:/api/configuration
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }
}
