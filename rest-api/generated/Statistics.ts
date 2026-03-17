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
import { HttpClient, RequestParams } from './http-client';

export class Statistics<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Statistics
   * @name Summary
   * @request GET:/api/statistics/summary
   * @secure
   */
  summary = (params: RequestParams = {}) =>
    this.http.request<StatisticsSummaryResponse, any>({
      path: `/api/statistics/summary`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags Statistics
   * @name StatisticsSeeninyearList
   * @request GET:/api/statistics/seeninyear
   * @secure
   */
  statisticsSeeninyearList = (
    query?: {
      year?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<StatisticsSummaryResponse, any>({
      path: `/api/statistics/seeninyear`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
   * No description
   *
   * @tags Statistics
   * @name StatisticsGenresinyearList
   * @request GET:/api/statistics/genresinyear
   * @secure
   */
  statisticsGenresinyearList = (
    query?: {
      year?: string | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<GenreSummeryResponse, any>({
      path: `/api/statistics/genresinyear`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
