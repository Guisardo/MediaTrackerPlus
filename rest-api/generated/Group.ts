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

import { GroupDetailResponse, GroupResponse, UserGroupRole } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Group<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Group
   * @name CreateGroup
   * @request POST:/api/group
   * @secure
   */
  createGroup = (
    data: {
      name: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<
      {
        id: number;
        name: string;
        createdBy: number;
        createdAt: number;
      },
      any
    >({
      path: `/api/group`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  listGroups = (params: RequestParams = {}) =>
    this.http.request<GroupResponse[], any>({
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
  getGroup = (groupId: number, params: RequestParams = {}) =>
    this.http.request<GroupDetailResponse, any>({
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
  updateGroup = (
    groupId: number,
    data: {
      name: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/group/${groupId}`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  deleteGroup = (groupId: number, params: RequestParams = {}) =>
    this.http.request<any, any>({
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
  addGroupMember = (
    groupId: number,
    data: {
      userId: number;
      role: UserGroupRole;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/group/${groupId}/member`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  removeGroupMember = (groupId: number, userId: number, params: RequestParams = {}) =>
    this.http.request<any, any>({
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
  updateGroupMemberRole = (
    groupId: number,
    userId: number,
    data: {
      role: UserGroupRole;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/group/${groupId}/member/${userId}`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
      ...params,
    });
}
