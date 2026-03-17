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
exports.ImportGoodreads = void 0;
const http_client_1 = require("./http-client");
class ImportGoodreads {
    constructor(http) {
        /**
         * No description
         *
         * @tags GoodreadsImport
         * @name Import
         * @request POST:/api/import-goodreads
         * @secure
         */
        this.import = (data, params = {}) => this.http.request({
            path: `/api/import-goodreads`,
            method: 'POST',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.ImportGoodreads = ImportGoodreads;
