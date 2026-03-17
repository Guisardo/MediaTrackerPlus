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
exports.Rating = void 0;
const http_client_1 = require("./http-client");
class Rating {
    constructor(http) {
        /**
         * No description
         *
         * @tags Rating
         * @name Add
         * @request PUT:/api/rating
         * @secure
         */
        this.add = (data, params = {}) => this.http.request({
            path: `/api/rating`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        this.http = http;
    }
}
exports.Rating = Rating;
