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
exports.Watchlist = void 0;
class Watchlist {
    constructor(http) {
        /**
         * No description
         *
         * @tags Watchlist
         * @name Add
         * @request PUT:/api/watchlist
         * @secure
         */
        this.add = (query, params = {}) => this.http.request({
            path: `/api/watchlist`,
            method: 'PUT',
            query: query,
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Watchlist
         * @name Delete
         * @request DELETE:/api/watchlist
         * @secure
         */
        this.delete = (query, params = {}) => this.http.request({
            path: `/api/watchlist`,
            method: 'DELETE',
            query: query,
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.Watchlist = Watchlist;
