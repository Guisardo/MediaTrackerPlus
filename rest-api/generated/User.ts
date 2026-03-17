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
import { ContentType, HttpClient, RequestParams } from './http-client';

export class User<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags User
   * @name Get
   * @request GET:/api/user
   * @secure
   */
  get = (params: RequestParams = {}) =>
    this.http.request<UserResponse | null, any>({
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
  logout = (params: RequestParams = {}) =>
    this.http.request<any, any>({
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
  login = (
    data: {
      username: string;
      password: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/user/login`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  register = (
    data: {
      username: string;
      password: string;
      confirmPassword: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<UserResponse | RequestError, any>({
      path: `/api/user/register`,
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
   * @tags User
   * @name GetNotificationCredentials
   * @request GET:/api/user/notification-credentials
   * @secure
   */
  getNotificationCredentials = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
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
  updateNotificationCredentials = (data: NotificationPlatformsResponseType, params: RequestParams = {}) =>
    this.http.request<any, any>({
      path: `/api/user/notification-credentials`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  update = (
    data: {
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
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/user/settings`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  updatePassword = (
    data: {
      currentPassword: string;
      newPassword: string;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<any, any>({
      path: `/api/user/password`,
      method: 'PUT',
      body: data,
      secure: true,
      type: ContentType.Json,
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
  getById = (userId: number, params: RequestParams = {}) =>
    this.http.request<
      {
        id: number;
        name: string;
      } | null,
      any
    >({
      path: `/api/user/${userId}`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
}
