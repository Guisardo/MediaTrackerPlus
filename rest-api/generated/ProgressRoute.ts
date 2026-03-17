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

export namespace Progress {
  /**
   * No description
   * @tags Progress
   * @name Add
   * @request PUT:/api/progress
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      episodeId?: number | null;
      date?: number | null;
      action?: 'paused' | 'playing' | null;
      duration?: number | null;
      progress?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Progress
   * @name AddByExternalId
   * @request PUT:/api/progress/by-external-id
   * @secure
   */
  export namespace AddByExternalId {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Progress
   * @name DeleteById
   * @request DELETE:/api/progress/{progressId}
   * @secure
   */
  export namespace DeleteById {
    export type RequestParams = {
      progressId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
