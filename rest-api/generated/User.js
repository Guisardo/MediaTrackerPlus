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
exports.User = void 0;
const http_client_1 = require("./http-client");
class User {
    constructor(http) {
        /**
         * No description
         *
         * @tags User
         * @name Get
         * @request GET:/api/user
         * @secure
         */
        this.get = (params = {}) => this.http.request({
            path: `/api/user`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name Logout
         * @request GET:/api/user/logout
         * @secure
         */
        this.logout = (params = {}) => this.http.request({
            path: `/api/user/logout`,
            method: 'GET',
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name Login
         * @request POST:/api/user/login
         * @secure
         */
        this.login = (data, params = {}) => this.http.request({
            path: `/api/user/login`,
            method: 'POST',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name Register
         * @request POST:/api/user/register
         * @secure
         */
        this.register = (data, params = {}) => this.http.request({
            path: `/api/user/register`,
            method: 'POST',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name GetNotificationCredentials
         * @request GET:/api/user/notification-credentials
         * @secure
         */
        this.getNotificationCredentials = (params = {}) => this.http.request({
            path: `/api/user/notification-credentials`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name UpdateNotificationCredentials
         * @request PUT:/api/user/notification-credentials
         * @secure
         */
        this.updateNotificationCredentials = (data, params = {}) => this.http.request({
            path: `/api/user/notification-credentials`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name Update
         * @request PUT:/api/user/settings
         * @secure
         */
        this.update = (data, params = {}) => this.http.request({
            path: `/api/user/settings`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name UpdatePassword
         * @request PUT:/api/user/password
         * @secure
         */
        this.updatePassword = (data, params = {}) => this.http.request({
            path: `/api/user/password`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags User
         * @name GetById
         * @request GET:/api/user/{userId}
         * @secure
         */
        this.getById = (userId, params = {}) => this.http.request({
            path: `/api/user/${userId}`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        this.http = http;
    }
}
exports.User = User;
