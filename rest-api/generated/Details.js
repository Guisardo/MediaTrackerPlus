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
exports.Details = void 0;
class Details {
    constructor(http) {
        /**
         * No description
         *
         * @tags MediaItem
         * @name Get
         * @request GET:/api/details/{mediaItemId}
         * @secure
         */
        this.get = (mediaItemId, params = {}) => this.http.request({
            path: `/api/details/${mediaItemId}`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags MediaItem
         * @name UpdateMetadata
         * @request GET:/api/details/update-metadata/{mediaItemId}
         * @secure
         */
        this.updateMetadata = (mediaItemId, params = {}) => this.http.request({
            path: `/api/details/update-metadata/${mediaItemId}`,
            method: 'GET',
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.Details = Details;
