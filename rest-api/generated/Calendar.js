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
exports.Calendar = void 0;
class Calendar {
    constructor(http) {
        /**
         * No description
         *
         * @tags Calendar
         * @name Get
         * @request GET:/api/calendar
         * @secure
         */
        this.get = (query, params = {}) => this.http.request({
            path: `/api/calendar`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Calendar = Calendar;
