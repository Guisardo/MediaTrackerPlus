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
exports.Id = void 0;
class Id {
    constructor(http) {
        /**
         * No description
         *
         * @tags Img
         * @name GetImage
         * @request GET:/img/{id}
         * @secure
         */
        this.getImage = (id, query, params = {}) => this.http.request({
            path: `/img/${id}`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Id = Id;
