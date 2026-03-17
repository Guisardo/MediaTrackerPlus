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
exports.Users = void 0;
class Users {
    constructor(http) {
        /**
         * No description
         *
         * @tags User
         * @name Search
         * @request GET:/api/users/search
         * @secure
         */
        this.search = (query, params = {}) => this.http.request({
            path: `/api/users/search`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Users = Users;
