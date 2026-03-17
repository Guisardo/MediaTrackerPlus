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

import { GenreSummeryResponse, StatisticsSummaryResponse } from './data-contracts';

export namespace Statistics {
  /**
   * No description
   * @tags Statistics
   * @name Summary
   * @request GET:/api/statistics/summary
   * @secure
   */
  export namespace Summary {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = StatisticsSummaryResponse;
  }

  /**
   * No description
   * @tags Statistics
   * @name StatisticsSeeninyearList
   * @request GET:/api/statistics/seeninyear
   * @secure
   */
  export namespace StatisticsSeeninyearList {
    export type RequestParams = {};
    export type RequestQuery = {
      year?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = StatisticsSummaryResponse;
  }

  /**
   * No description
   * @tags Statistics
   * @name StatisticsGenresinyearList
   * @request GET:/api/statistics/genresinyear
   * @secure
   */
  export namespace StatisticsGenresinyearList {
    export type RequestParams = {};
    export type RequestQuery = {
      year?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GenreSummeryResponse;
  }
}
