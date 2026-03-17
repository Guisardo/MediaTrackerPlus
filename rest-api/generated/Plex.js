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
exports.Plex = void 0;
class Plex {
    constructor(http) {
        /**
         * No description
         *
         * @tags Lists
         * @name PlexWebhook
         * @request POST:/api/plex
         * @secure
         */
        this.plexWebhook = (params = {}) => this.http.request({
            path: `/api/plex`,
            method: 'POST',
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.Plex = Plex;
