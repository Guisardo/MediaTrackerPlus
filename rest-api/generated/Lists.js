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
exports.Lists = void 0;
class Lists {
    constructor(http) {
        /**
         * No description
         *
         * @tags Lists
         * @name GetUsersLists
         * @request GET:/api/lists
         * @secure
         */
        this.getUsersLists = (query, params = {}) => this.http.request({
            path: `/api/lists`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Lists = Lists;
