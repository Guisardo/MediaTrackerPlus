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

export namespace Id {
  /**
   * No description
   * @tags Img
   * @name GetImage
   * @request GET:/img/{id}
   * @secure
   */
  export namespace GetImage {
    export type RequestParams = {
      id: string;
    };
    export type RequestQuery = {
      size?: ImgSize | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = string;
  }
}
