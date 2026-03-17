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
exports.Configuration = void 0;
const http_client_1 = require("./http-client");
class Configuration {
    constructor(http) {
        /**
         * No description
         *
         * @tags Configuration
         * @name Update
         * @request PATCH:/api/configuration
         * @secure
         */
        this.update = (data, params = {}) => this.http.request({
            path: `/api/configuration`,
            method: 'PATCH',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags Configuration
         * @name Get
         * @request GET:/api/configuration
         * @secure
         */
        this.get = (params = {}) => this.http.request({
            path: `/api/configuration`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Configuration = Configuration;
