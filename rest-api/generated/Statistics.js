"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Statistics = void 0;
class Statistics {
    constructor(http) {
        /**
         * No description
         *
         * @tags Statistics
         * @name Summary
         * @request GET:/api/statistics/summary
         * @secure
         */
        this.summary = (params = {}) => this.http.request({
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
        this.statisticsSeeninyearList = (query, params = {}) => this.http.request({
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
        this.statisticsGenresinyearList = (query, params = {}) => this.http.request({
            path: `/api/statistics/genresinyear`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Statistics = Statistics;
