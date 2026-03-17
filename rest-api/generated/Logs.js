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
exports.Logs = void 0;
class Logs {
    constructor(http) {
        /**
         * No description
         *
         * @tags Logs
         * @name Get
         * @request GET:/api/logs
         * @secure
         */
        this.get = (query, params = {}) => this.http.request({
            path: `/api/logs`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Logs = Logs;
