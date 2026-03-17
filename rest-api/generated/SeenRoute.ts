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

export namespace Seen {
  /**
   * No description
   * @tags Seen
   * @name Add
   * @request PUT:/api/seen
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      lastSeenEpisodeId?: number | null;
      lastSeenAt?: LastSeenAt | null;
      date?: number | null;
      duration?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Seen
   * @name AddByExternalId
   * @request PUT:/api/seen/by-external-id
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
      };
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      duration?: number | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Seen
   * @name DeleteById
   * @request DELETE:/api/seen/{seenId}
   * @secure
   */
  export namespace DeleteById {
    export type RequestParams = {
      seenId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Seen
   * @name Delete
   * @request DELETE:/api/seen/
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
