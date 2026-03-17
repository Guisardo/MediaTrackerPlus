import type { ApiConfig } from './generated/http-client';
import { HttpClient } from './generated/http-client';
import type { List as ListModel, Seen as SeenModel } from './generated/data-contracts';

import { Calendar as CalendarApi } from './generated/Calendar';
import { Configuration as ConfigurationApi } from './generated/Configuration';
import { Details as DetailsApi } from './generated/Details';
import { Group as GroupApi } from './generated/Group';
import { Id as IdApi } from './generated/Id';
import { ImportGoodreads as ImportGoodreadsApi } from './generated/ImportGoodreads';
import { ImportTrakttv as ImportTrakttvApi } from './generated/ImportTrakttv';
import { Items as ItemsApi } from './generated/Items';
import { List as ListApi } from './generated/List';
import { ListItem as ListItemApi } from './generated/ListItem';
import { Lists as ListsApi } from './generated/Lists';
import { Logs as LogsApi } from './generated/Logs';
import { Plex as PlexApi } from './generated/Plex';
import { Progress as ProgressApi } from './generated/Progress';
import { Rating as RatingApi } from './generated/Rating';
import { Search as SearchApi } from './generated/Search';
import { Seen as SeenApi } from './generated/Seen';
import { Statistics as StatisticsApi } from './generated/Statistics';
import { Tokens as TokensApi } from './generated/Tokens';
import { User as UserApi } from './generated/User';
import { Users as UsersApi } from './generated/Users';
import { Watchlist as WatchlistApi } from './generated/Watchlist';

export * from './generated/data-contracts';
export * from './generated/http-client';
export * from './generated/CalendarRoute';
export * from './generated/ConfigurationRoute';
export * from './generated/DetailsRoute';
export * from './generated/GroupRoute';
export * from './generated/IdRoute';
export * from './generated/ImportGoodreadsRoute';
export * from './generated/ImportTrakttvRoute';
export * from './generated/ItemsRoute';
export * from './generated/ListItemRoute';
export * from './generated/ListsRoute';
export * from './generated/LogsRoute';
export * from './generated/PlexRoute';
export * from './generated/ProgressRoute';
export * from './generated/RatingRoute';
export * from './generated/SearchRoute';
export * from './generated/StatisticsRoute';
export * from './generated/TokensRoute';
export * from './generated/UserRoute';
export * from './generated/UsersRoute';
export * from './generated/WatchlistRoute';

export interface List extends ListModel {}

export namespace List {
  export namespace AddList {
    export type RequestParams = import('./generated/ListRoute').List.AddList.RequestParams;
    export type RequestQuery = import('./generated/ListRoute').List.AddList.RequestQuery;
    export type RequestBody = import('./generated/ListRoute').List.AddList.RequestBody;
    export type RequestHeaders = import('./generated/ListRoute').List.AddList.RequestHeaders;
    export type ResponseBody = import('./generated/ListRoute').List.AddList.ResponseBody;
  }

  export namespace UpdateList {
    export type RequestParams = import('./generated/ListRoute').List.UpdateList.RequestParams;
    export type RequestQuery = import('./generated/ListRoute').List.UpdateList.RequestQuery;
    export type RequestBody = import('./generated/ListRoute').List.UpdateList.RequestBody;
    export type RequestHeaders = import('./generated/ListRoute').List.UpdateList.RequestHeaders;
    export type ResponseBody = import('./generated/ListRoute').List.UpdateList.ResponseBody;
  }

  export namespace GetList {
    export type RequestParams = import('./generated/ListRoute').List.GetList.RequestParams;
    export type RequestQuery = import('./generated/ListRoute').List.GetList.RequestQuery;
    export type RequestBody = import('./generated/ListRoute').List.GetList.RequestBody;
    export type RequestHeaders = import('./generated/ListRoute').List.GetList.RequestHeaders;
    export type ResponseBody = import('./generated/ListRoute').List.GetList.ResponseBody;
  }

  export namespace DeleteList {
    export type RequestParams = import('./generated/ListRoute').List.DeleteList.RequestParams;
    export type RequestQuery = import('./generated/ListRoute').List.DeleteList.RequestQuery;
    export type RequestBody = import('./generated/ListRoute').List.DeleteList.RequestBody;
    export type RequestHeaders = import('./generated/ListRoute').List.DeleteList.RequestHeaders;
    export type ResponseBody = import('./generated/ListRoute').List.DeleteList.ResponseBody;
  }

  export namespace GetListItems {
    export type RequestParams = import('./generated/ListRoute').List.GetListItems.RequestParams;
    export type RequestQuery = import('./generated/ListRoute').List.GetListItems.RequestQuery;
    export type RequestBody = import('./generated/ListRoute').List.GetListItems.RequestBody;
    export type RequestHeaders = import('./generated/ListRoute').List.GetListItems.RequestHeaders;
    export type ResponseBody = import('./generated/ListRoute').List.GetListItems.ResponseBody;
  }
}

export interface Seen extends SeenModel {}

export namespace Seen {
  export namespace Add {
    export type RequestParams = import('./generated/SeenRoute').Seen.Add.RequestParams;
    export type RequestQuery = import('./generated/SeenRoute').Seen.Add.RequestQuery;
    export type RequestBody = import('./generated/SeenRoute').Seen.Add.RequestBody;
    export type RequestHeaders = import('./generated/SeenRoute').Seen.Add.RequestHeaders;
    export type ResponseBody = import('./generated/SeenRoute').Seen.Add.ResponseBody;
  }

  export namespace AddByExternalId {
    export type RequestParams = import('./generated/SeenRoute').Seen.AddByExternalId.RequestParams;
    export type RequestQuery = import('./generated/SeenRoute').Seen.AddByExternalId.RequestQuery;
    export type RequestBody = import('./generated/SeenRoute').Seen.AddByExternalId.RequestBody;
    export type RequestHeaders = import('./generated/SeenRoute').Seen.AddByExternalId.RequestHeaders;
    export type ResponseBody = import('./generated/SeenRoute').Seen.AddByExternalId.ResponseBody;
  }

  export namespace DeleteById {
    export type RequestParams = import('./generated/SeenRoute').Seen.DeleteById.RequestParams;
    export type RequestQuery = import('./generated/SeenRoute').Seen.DeleteById.RequestQuery;
    export type RequestBody = import('./generated/SeenRoute').Seen.DeleteById.RequestBody;
    export type RequestHeaders = import('./generated/SeenRoute').Seen.DeleteById.RequestHeaders;
    export type ResponseBody = import('./generated/SeenRoute').Seen.DeleteById.ResponseBody;
  }

  export namespace Delete {
    export type RequestParams = import('./generated/SeenRoute').Seen.Delete.RequestParams;
    export type RequestQuery = import('./generated/SeenRoute').Seen.Delete.RequestQuery;
    export type RequestBody = import('./generated/SeenRoute').Seen.Delete.RequestBody;
    export type RequestHeaders = import('./generated/SeenRoute').Seen.Delete.RequestHeaders;
    export type ResponseBody = import('./generated/SeenRoute').Seen.Delete.ResponseBody;
  }
}

export class Api<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  calendar = new CalendarApi<SecurityDataType>(this);
  configuration = new ConfigurationApi<SecurityDataType>(this);
  group = new GroupApi<SecurityDataType>(this);
  id = new IdApi<SecurityDataType>(this);
  details = new DetailsApi<SecurityDataType>(this);
  items = new ItemsApi<SecurityDataType>(this);
  list = new ListApi<SecurityDataType>(this);
  listItem = new ListItemApi<SecurityDataType>(this);
  lists = new ListsApi<SecurityDataType>(this);
  logs = new LogsApi<SecurityDataType>(this);
  plex = new PlexApi<SecurityDataType>(this);
  progress = new ProgressApi<SecurityDataType>(this);
  rating = new RatingApi<SecurityDataType>(this);
  search = new SearchApi<SecurityDataType>(this);
  seen = new SeenApi<SecurityDataType>(this);
  statistics = new StatisticsApi<SecurityDataType>(this);
  tokens = new TokensApi<SecurityDataType>(this);
  user = new UserApi<SecurityDataType>(this);
  users = new UsersApi<SecurityDataType>(this);
  watchlist = new WatchlistApi<SecurityDataType>(this);
  importGoodreads = new ImportGoodreadsApi<SecurityDataType>(this);
  importTrakttv = new ImportTrakttvApi<SecurityDataType>(this);

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    super(apiConfig);
  }
}
