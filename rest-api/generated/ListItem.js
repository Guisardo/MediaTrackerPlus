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
exports.ListItem = void 0;
class ListItem {
    constructor(http) {
        /**
         * No description
         *
         * @tags List Item
         * @name Add
         * @request PUT:/api/list-item
         * @secure
         */
        this.add = (query, params = {}) => this.http.request({
            path: `/api/list-item`,
            method: 'PUT',
            query: query,
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags List Item
         * @name RemoveItemFromList
         * @request DELETE:/api/list-item
         * @secure
         */
        this.removeItemFromList = (query, params = {}) => this.http.request({
            path: `/api/list-item`,
            method: 'DELETE',
            query: query,
            secure: true,
            ...params,
        });
        this.http = http;
    }
}
exports.ListItem = ListItem;
