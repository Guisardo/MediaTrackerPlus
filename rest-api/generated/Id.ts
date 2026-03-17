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

import { ImgSize } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Id<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Img
   * @name GetImage
   * @request GET:/img/{id}
   * @secure
   */
  getImage = (
    id: string,
    query?: {
      size?: ImgSize | null;
    },
    params: RequestParams = {}
  ) =>
    this.http.request<string, any>({
      path: `/img/${id}`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
}
