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
exports.Tokens = void 0;
class Tokens {
    constructor(http) {
        /**
         * @description Add token
         *
         * @tags Token
         * @name Add
         * @request PUT:/api/tokens
         * @secure
         */
        this.add = (query, params = {}) => this.http.request({
            path: `/api/tokens`,
            method: 'PUT',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * @description Delete token
         *
         * @tags Token
         * @name Delete
         * @request DELETE:/api/tokens
         * @secure
         */
        this.delete = (query, params = {}) => this.http.request({
            path: `/api/tokens`,
            method: 'DELETE',
            query: query,
            secure: true,
            ...params,
        });
        /**
         * @description Get all tokens
         *
         * @tags Token
         * @name Get
         * @request GET:/api/tokens
         * @secure
         */
        this.get = (params = {}) => this.http.request({
            path: `/api/tokens`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Tokens = Tokens;
