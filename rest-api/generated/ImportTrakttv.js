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
exports.ImportTrakttv = void 0;
class ImportTrakttv {
    constructor(http) {
        /**
         * No description
         *
         * @tags TraktTvImport
         * @name State
         * @request GET:/api/import-trakttv/state
         * @secure
         */
        this.state = (params = {}) => this.http.request({
            path: `/api/import-trakttv/state`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags TraktTvImport
         * @name StateStream
         * @request GET:/api/import-trakttv/state-stream
         * @secure
         */
        this.stateStream = (params = {}) => this.http.request({
            path: `/api/import-trakttv/state-stream`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags TraktTvImport
         * @name DeviceToken
         * @request GET:/api/import-trakttv/device-token
         * @secure
         */
        this.deviceToken = (params = {}) => this.http.request({
            path: `/api/import-trakttv/device-token`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags TraktTvImport
         * @name StartOver
         * @request GET:/api/import-trakttv/start-over
         * @secure
         */
        this.startOver = (params = {}) => this.http.request({
            path: `/api/import-trakttv/start-over`,
            method: 'GET',
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.ImportTrakttv = ImportTrakttv;
