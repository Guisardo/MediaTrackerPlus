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
exports.Progress = void 0;
const http_client_1 = require("./http-client");
class Progress {
    constructor(http) {
        /**
         * No description
         *
         * @tags Progress
         * @name Add
         * @request PUT:/api/progress
         * @secure
         */
        this.add = (query, params = {}) => this.http.request({
            path: `/api/progress`,
            method: 'PUT',
            query: query,
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Progress
         * @name AddByExternalId
         * @request PUT:/api/progress/by-external-id
         * @secure
         */
        this.addByExternalId = (data, params = {}) => this.http.request({
            path: `/api/progress/by-external-id`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags Progress
         * @name DeleteById
         * @request DELETE:/api/progress/{progressId}
         * @secure
         */
        this.deleteById = (progressId, params = {}) => this.http.request({
            path: `/api/progress/${progressId}`,
            method: 'DELETE',
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.Progress = Progress;
