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

export namespace Group {
  /**
   * No description
   * @tags Group
   * @name CreateGroup
   * @request POST:/api/group
   * @secure
   */
  export namespace CreateGroup {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      name: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
      id: number;
      name: string;
      createdBy: number;
      createdAt: number;
    };
  }

  /**
   * No description
   * @tags Group
   * @name ListGroups
   * @request GET:/api/group
   * @secure
   */
  export namespace ListGroups {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GroupResponse[];
  }

  /**
   * No description
   * @tags Group
   * @name GetGroup
   * @request GET:/api/group/{groupId}
   * @secure
   */
  export namespace GetGroup {
    export type RequestParams = {
      groupId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GroupDetailResponse;
  }

  /**
   * No description
   * @tags Group
   * @name UpdateGroup
   * @request PUT:/api/group/{groupId}
   * @secure
   */
  export namespace UpdateGroup {
    export type RequestParams = {
      groupId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = {
      name: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Group
   * @name DeleteGroup
   * @request DELETE:/api/group/{groupId}
   * @secure
   */
  export namespace DeleteGroup {
    export type RequestParams = {
      groupId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Group
   * @name AddGroupMember
   * @request POST:/api/group/{groupId}/member
   * @secure
   */
  export namespace AddGroupMember {
    export type RequestParams = {
      groupId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = {
      userId: number;
      role: UserGroupRole;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Group
   * @name RemoveGroupMember
   * @request DELETE:/api/group/{groupId}/member/{userId}
   * @secure
   */
  export namespace RemoveGroupMember {
    export type RequestParams = {
      groupId: number;
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags Group
   * @name UpdateGroupMemberRole
   * @request PUT:/api/group/{groupId}/member/{userId}
   * @secure
   */
  export namespace UpdateGroupMemberRole {
    export type RequestParams = {
      groupId: number;
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = {
      role: UserGroupRole;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
