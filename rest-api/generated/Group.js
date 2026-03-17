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
exports.Group = void 0;
const http_client_1 = require("./http-client");
class Group {
    constructor(http) {
        /**
         * No description
         *
         * @tags Group
         * @name CreateGroup
         * @request POST:/api/group
         * @secure
         */
        this.createGroup = (data, params = {}) => this.http.request({
            path: `/api/group`,
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
         * @tags Group
         * @name ListGroups
         * @request GET:/api/group
         * @secure
         */
        this.listGroups = (params = {}) => this.http.request({
            path: `/api/group`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name GetGroup
         * @request GET:/api/group/{groupId}
         * @secure
         */
        this.getGroup = (groupId, params = {}) => this.http.request({
            path: `/api/group/${groupId}`,
            method: 'GET',
            secure: true,
            format: 'json',
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name UpdateGroup
         * @request PUT:/api/group/{groupId}
         * @secure
         */
        this.updateGroup = (groupId, data, params = {}) => this.http.request({
            path: `/api/group/${groupId}`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name DeleteGroup
         * @request DELETE:/api/group/{groupId}
         * @secure
         */
        this.deleteGroup = (groupId, params = {}) => this.http.request({
            path: `/api/group/${groupId}`,
            method: 'DELETE',
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name AddGroupMember
         * @request POST:/api/group/{groupId}/member
         * @secure
         */
        this.addGroupMember = (groupId, data, params = {}) => this.http.request({
            path: `/api/group/${groupId}/member`,
            method: 'POST',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name RemoveGroupMember
         * @request DELETE:/api/group/{groupId}/member/{userId}
         * @secure
         */
        this.removeGroupMember = (groupId, userId, params = {}) => this.http.request({
            path: `/api/group/${groupId}/member/${userId}`,
            method: 'DELETE',
            secure: true,
            ...params,
        });
        /**
         * No description
         *
         * @tags Group
         * @name UpdateGroupMemberRole
         * @request PUT:/api/group/{groupId}/member/{userId}
         * @secure
         */
        this.updateGroupMemberRole = (groupId, userId, data, params = {}) => this.http.request({
            path: `/api/group/${groupId}/member/${userId}`,
            method: 'PUT',
            body: data,
            secure: true,
            type: http_client_1.ContentType.Json,
            ...params,
        });
        this.http = http;
    }
}
exports.Group = Group;
