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

import { NotificationPlatformsResponseType, RequestError, UserResponse } from './data-contracts';

export namespace User {
  /**
   * No description
   * @tags User
   * @name Get
   * @request GET:/api/user
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = UserResponse | null;
  }

  /**
   * No description
   * @tags User
   * @name Logout
   * @request GET:/api/user/logout
   * @secure
   */
  export namespace Logout {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags User
   * @name Login
   * @request POST:/api/user/login
   * @secure
   */
  export namespace Login {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      username: string;
      password: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags User
   * @name Register
   * @request POST:/api/user/register
   * @secure
   */
  export namespace Register {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      username: string;
      password: string;
      confirmPassword: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = UserResponse | RequestError;
  }

  /**
   * No description
   * @tags User
   * @name GetNotificationCredentials
   * @request GET:/api/user/notification-credentials
   * @secure
   */
  export namespace GetNotificationCredentials {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      gotify?: {
        url: string;
        token: string;
        priority: string;
      } | null;
      Discord?: {
        url: string;
      } | null;
      Pushbullet?: {
        token: string;
      } | null;
      Pushover?: {
        key: string;
      } | null;
      Pushsafer?: {
        key: string;
      } | null;
      ntfy?: {
        url: string;
        priority: string;
        topic: string;
      } | null;
    };
  }

  /**
   * No description
   * @tags User
   * @name UpdateNotificationCredentials
   * @request PUT:/api/user/notification-credentials
   * @secure
   */
  export namespace UpdateNotificationCredentials {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = NotificationPlatformsResponseType;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags User
   * @name Update
   * @request PUT:/api/user/settings
   * @secure
   */
  export namespace Update {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      name?: string | null;
      publicReviews?: boolean | null;
      sendNotificationWhenStatusChanges?: boolean | null;
      sendNotificationWhenReleaseDateChanges?: boolean | null;
      sendNotificationWhenNumberOfSeasonsChanges?: boolean | null;
      sendNotificationForReleases?: boolean | null;
      sendNotificationForEpisodesReleases?: boolean | null;
      notificationPlatform?: 'Discord' | 'Pushbullet' | 'Pushover' | 'Pushsafer' | 'gotify' | 'ntfy' | null;
      hideOverviewForUnseenSeasons?: boolean | null;
      hideEpisodeTitleForUnseenEpisodes?: boolean | null;
      addRecommendedToWatchlist?: boolean | null;
      dateOfBirth?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags User
   * @name UpdatePassword
   * @request PUT:/api/user/password
   * @secure
   */
  export namespace UpdatePassword {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      currentPassword: string;
      newPassword: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }

  /**
   * No description
   * @tags User
   * @name GetById
   * @request GET:/api/user/{userId}
   * @secure
   */
  export namespace GetById {
    export type RequestParams = {
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      id: number;
      name: string;
    } | null;
  }
}
