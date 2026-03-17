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
exports.Seen = void 0;
const http_client_1 = require("./http-client");
class Seen {
    constructor(http) {
        /**
         * No description
         *
         * @tags Seen
         * @name Add
         * @request PUT:/api/seen
         * @secure
         */
        this.add = (query, params = {}) => this.http.request({
            path: `/api/seen`,
            method: 'PUT',
            query: query,
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Seen
         * @name AddByExternalId
         * @request PUT:/api/seen/by-external-id
         * @secure
         */
        this.addByExternalId = (data, params = {}) => this.http.request({
            path: `/api/seen/by-external-id`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags Seen
         * @name DeleteById
         * @request DELETE:/api/seen/{seenId}
         * @secure
         */
        this.deleteById = (seenId, params = {}) => this.http.request({
            path: `/api/seen/${seenId}`,
            method: 'DELETE',
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Seen
         * @name Delete
         * @request DELETE:/api/seen/
         * @secure
         */
        this.delete = (query, params = {}) => this.http.request({
            path: `/api/seen/`,
            method: 'DELETE',
            query: query,
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.Seen = Seen;
