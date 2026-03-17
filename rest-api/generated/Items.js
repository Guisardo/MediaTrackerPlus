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
exports.Items = void 0;
class Items {
    constructor(http) {
        /**
         * @description Get items
         *
         * @tags Items
         * @name Paginated
         * @request GET:/api/items/paginated
         * @secure
         */
        this.paginated = (query, params = {}) => this.http.request({
            path: `/api/items/paginated`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * @description Get facet counts
         *
         * @tags Items
         * @name Facets
         * @request GET:/api/items/facets
         * @secure
         */
        this.facets = (query, params = {}) => this.http.request({
            path: `/api/items/facets`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * @description Get items
         *
         * @tags Items
         * @name Get
         * @request GET:/api/items
         * @secure
         */
        this.get = (query, params = {}) => this.http.request({
            path: `/api/items`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * @description Get items
         *
         * @tags Items
         * @name Random
         * @request GET:/api/items/random
         * @secure
         */
        this.random = (query, params = {}) => this.http.request({
            path: `/api/items/random`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.Items = Items;
