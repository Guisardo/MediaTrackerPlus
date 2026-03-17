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
exports.List = void 0;
const http_client_1 = require("./http-client");
class List {
    constructor(http) {
        /**
         * No description
         *
         * @tags List
         * @name AddList
         * @request PUT:/api/list
         * @secure
         */
        this.addList = (data, params = {}) => this.http.request({
            path: `/api/list`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags List
         * @name UpdateList
         * @request PATCH:/api/list
         * @secure
         */
        this.updateList = (data, params = {}) => this.http.request({
            path: `/api/list`,
            method: 'PATCH',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags List
         * @name GetList
         * @request GET:/api/list
         * @secure
         */
        this.getList = (query, params = {}) => this.http.request({
            path: `/api/list`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags List
         * @name DeleteList
         * @request DELETE:/api/list
         * @secure
         */
        this.deleteList = (query, params = {}) => this.http.request({
            path: `/api/list`,
            method: 'DELETE',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags List
         * @name GetListItems
         * @request GET:/api/list/items
         * @secure
         */
        this.getListItems = (query, params = {}) => this.http.request({
            path: `/api/list/items`,
            method: 'GET',
            query: query,
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.List = List;
