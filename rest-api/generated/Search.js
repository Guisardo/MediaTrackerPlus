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
exports.Search = void 0;
class Search {
    constructor(http) {
        /**
         * No description
         *
         * @tags Search
         * @name Search
         * @request GET:/api/search
         * @secure
         */
        this.search = (query, params = {}) => this.http.request({
            path: `/api/search`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Search = Search;
