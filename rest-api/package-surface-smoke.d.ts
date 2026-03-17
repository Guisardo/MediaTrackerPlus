import type {
  Api,
  ApiConfig,
  HttpClient,
  Items,
  MediaType,
  RequestError,
  Statistics,
} from './index';

declare const api: Api;
declare const apiConfig: ApiConfig;
declare const httpClient: HttpClient;

export type PackageSurfaceSmokeTest = [
  Api extends HttpClient ? true : never,
  ConstructorParameters<typeof import('./index').Api>[0],
  typeof api,
  typeof apiConfig,
  typeof httpClient,
  Api['group'],
  Api['importTrakttv'],
  Api['items'],
  Api['statistics'],
  Items.Paginated.RequestQuery,
  MediaType,
  RequestError,
  Statistics.Summary.ResponseBody,
];
