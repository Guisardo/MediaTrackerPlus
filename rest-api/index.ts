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

export type GetCalendarItemsResponse = {
  releaseDate: string;
  mediaItem: {
    id: number;
    title: string;
    releaseDate: string;
    mediaType: MediaType;
    seen?: boolean | null;
  };
  episode: {
    id: number;
    title: string;
    episodeNumber: number;
    seasonNumber: number;
    releaseDate: string;
    isSpecialEpisode: boolean;
    seen: boolean;
  };
}[];

export type MediaType = 'audiobook' | 'book' | 'movie' | 'tv' | 'video_game';

export type TmdbLang =
  | 'aa'
  | 'ab'
  | 'af'
  | 'am'
  | 'ar'
  | 'as'
  | 'ay'
  | 'az'
  | 'ba'
  | 'be'
  | 'bg'
  | 'bh'
  | 'bi'
  | 'bn'
  | 'bo'
  | 'br'
  | 'ca'
  | 'co'
  | 'cs'
  | 'cy'
  | 'da'
  | 'de'
  | 'dz'
  | 'el'
  | 'en'
  | 'eo'
  | 'es'
  | 'et'
  | 'eu'
  | 'fa'
  | 'fi'
  | 'fj'
  | 'fo'
  | 'fr'
  | 'fy'
  | 'ga'
  | 'gd'
  | 'gl'
  | 'gn'
  | 'gu'
  | 'ha'
  | 'he'
  | 'hi'
  | 'hr'
  | 'hu'
  | 'hy'
  | 'ia'
  | 'id'
  | 'ie'
  | 'ik'
  | 'is'
  | 'it'
  | 'iu'
  | 'ja'
  | 'jw'
  | 'ka'
  | 'kk'
  | 'kl'
  | 'km'
  | 'kn'
  | 'ko'
  | 'ks'
  | 'ku'
  | 'ky'
  | 'la'
  | 'ln'
  | 'lo'
  | 'lt'
  | 'lv'
  | 'mg'
  | 'mi'
  | 'mk'
  | 'ml'
  | 'mn'
  | 'mo'
  | 'mr'
  | 'ms'
  | 'mt'
  | 'my'
  | 'na'
  | 'ne'
  | 'nl'
  | 'no'
  | 'oc'
  | 'om'
  | 'or'
  | 'pa'
  | 'pl'
  | 'ps'
  | 'pt'
  | 'qu'
  | 'rm'
  | 'rn'
  | 'ro'
  | 'ru'
  | 'rw'
  | 'sa'
  | 'sd'
  | 'sg'
  | 'sh'
  | 'si'
  | 'sk'
  | 'sl'
  | 'sm'
  | 'sn'
  | 'so'
  | 'sq'
  | 'sr'
  | 'ss'
  | 'st'
  | 'su'
  | 'sv'
  | 'sw'
  | 'ta'
  | 'te'
  | 'tg'
  | 'th'
  | 'ti'
  | 'tk'
  | 'tl'
  | 'tn'
  | 'to'
  | 'tr'
  | 'ts'
  | 'tt'
  | 'tw'
  | 'ug'
  | 'uk'
  | 'ur'
  | 'uz'
  | 'vi'
  | 'vo'
  | 'wo'
  | 'xh'
  | 'yi'
  | 'yo'
  | 'za'
  | 'zh'
  | 'zu';

export type AudibleCountryCode = 'au' | 'ca' | 'de' | 'es' | 'fr' | 'in' | 'it' | 'jp' | 'uk' | 'us';

export type ServerLang = 'da' | 'de' | 'en' | 'es' | 'fr' | 'ko' | 'pt';

export interface GroupResponse {
  id: number;
  name: string;
  createdBy: number;
  createdAt: number;
  updatedAt?: number | null;
  role: UserGroupRole;
  memberCount: number;
}

export type UserGroupRole = 'admin' | 'viewer';

export interface GroupDetailResponse {
  id: number;
  name: string;
  createdBy: number;
  createdAt: number;
  updatedAt?: number | null;
  role: UserGroupRole;
  members: GroupMemberResponse[];
}

export interface GroupMemberResponse {
  id: number;
  userId: number;
  name: string;
  role: UserGroupRole;
  addedAt: number;
}

export type ImgSize = 'original' | 'small';

export type MediaItemDetailsResponse = {
  id?: number | null;
  releaseDate?: string | null;
  posterId?: string | null;
  backdropId?: string | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  tvmazeId?: number | null;
  igdbId?: number | null;
  openlibraryId?: string | null;
  audibleId?: string | null;
  traktId?: number | null;
  goodreadsId?: number | null;
  numberOfSeasons?: number | null;
  status?: string | null;
  platform?: string[] | null;
  title: string;
  originalTitle?: string | null;
  externalPosterUrl?: string | null;
  externalBackdropUrl?: string | null;
  tmdbRating?: number | null;
  overview?: string | null;
  lastTimeUpdated?: number | null;
  source: string;
  network?: string | null;
  url?: string | null;
  runtime?: number | null;
  mediaType: MediaType;
  genres?: string[] | null;
  numberOfEpisodes?: number | null;
  developer?: string | null;
  director?: string | null;
  creator?: string | null;
  publisher?: string | null;
  authors?: string[] | null;
  narrators?: string[] | null;
  language?: string | null;
  numberOfPages?: number | null;
  audibleCountryCode?: AudibleCountryCode | null;
  needsDetails?: boolean | null;
  platformRating?: number | null;
  seasons?: TvSeason[] | null;
} & {
  isSearchResult?: boolean | null;
  hasDetails?: boolean | null;
  poster?: string | null;
  posterSmall?: string | null;
  backdrop?: string | null;
  seenHistory?: Seen[] | null;
  unseenEpisodesCount?: number | null;
  userRating?: UserRating | null;
  upcomingEpisode?: TvEpisode | null;
  lastAiredEpisode?: TvEpisode | null;
  nextAiring?: string | null;
  lastAiring?: string | null;
  onWatchlist?: boolean | null;
  lastSeenAt?: number | null;
  seen?: boolean | null;
  firstUnwatchedEpisode?: TvEpisode | null;
  progress?: number | null;
  totalRuntime?: number | null;
  lists: List[];
  metadataLanguage?: string | null;
};

export interface TvSeason {
  id?: number | null;
  description?: string | null;
  numberOfEpisodes?: number | null;
  externalPosterUrl?: string | null;
  posterId?: string | null;
  poster?: string | null;
  releaseDate?: string | null;
  tvShowId?: number | null;
  tmdbId?: number | null;
  title: string;
  seasonNumber: number;
  tvmazeId?: number | null;
  episodes?: TvEpisode[] | null;
  userRating?: UserRating | null;
  seen?: boolean | null;
  posterSmall?: string | null;
  isSpecialSeason: boolean;
  tvdbId?: number | null;
  traktId?: number | null;
  onWatchlist?: boolean | null;
  totalRuntime?: number | null;
  lastSeenAt?: number | null;
  unseenEpisodesCount?: number | null;
  metadataLanguage?: string | null;
}

export interface TvEpisode {
  id?: number | null;
  title: string;
  description?: string | null;
  episodeNumber: number;
  seasonNumber: number;
  releaseDate?: string | null;
  tvShowId?: number | null;
  seasonId?: number | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  runtime?: number | null;
  seenHistory?: Seen[] | null;
  userRating?: UserRating | null;
  lastSeenAt?: number | null;
  seasonAndEpisodeNumber?: number | null;
  seen?: boolean | null;
  tvShow?: MediaItemItemsResponse | null;
  isSpecialEpisode: boolean;
  tvdbId?: number | null;
  traktId?: number | null;
  onWatchlist?: boolean | null;
  metadataLanguage?: string | null;
}

export interface Seen {
  id?: number | null;
  date?: number | null;
  mediaItemId: number;
  seasonId?: number | null;
  episodeId?: number | null;
  userId: number;
  duration?: number | null;
}

export interface UserRating {
  id?: number | null;
  mediaItemId: number;
  date: number;
  userId: number;
  rating?: number | null;
  review?: string | null;
  episodeId?: number | null;
  seasonId?: number | null;
}

export type MediaItemItemsResponse = {
  id?: number | null;
  releaseDate?: string | null;
  posterId?: string | null;
  backdropId?: string | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  tvmazeId?: number | null;
  igdbId?: number | null;
  openlibraryId?: string | null;
  audibleId?: string | null;
  traktId?: number | null;
  goodreadsId?: number | null;
  numberOfSeasons?: number | null;
  status?: string | null;
  platform?: string[] | null;
  title: string;
  originalTitle?: string | null;
  externalPosterUrl?: string | null;
  externalBackdropUrl?: string | null;
  tmdbRating?: number | null;
  overview?: string | null;
  lastTimeUpdated?: number | null;
  source: string;
  network?: string | null;
  url?: string | null;
  runtime?: number | null;
  mediaType: MediaType;
  genres?: string[] | null;
  numberOfEpisodes?: number | null;
  developer?: string | null;
  director?: string | null;
  creator?: string | null;
  publisher?: string | null;
  authors?: string[] | null;
  narrators?: string[] | null;
  language?: string | null;
  numberOfPages?: number | null;
  audibleCountryCode?: AudibleCountryCode | null;
  needsDetails?: boolean | null;
  platformRating?: number | null;
} & {
  isSearchResult?: boolean | null;
  hasDetails?: boolean | null;
  poster?: string | null;
  posterSmall?: string | null;
  backdrop?: string | null;
  seenHistory?: Seen[] | null;
  unseenEpisodesCount?: number | null;
  userRating?: UserRating | null;
  upcomingEpisode?: TvEpisode | null;
  lastAiredEpisode?: TvEpisode | null;
  nextAiring?: string | null;
  lastAiring?: string | null;
  onWatchlist?: boolean | null;
  lastSeenAt?: number | null;
  seen?: boolean | null;
  firstUnwatchedEpisode?: TvEpisode | null;
  progress?: number | null;
  totalRuntime?: number | null;
  estimatedRating?: number | null;
  platformSeen?: boolean | null;
  metadataLanguage?: string | null;
};

export interface List {
  id: number;
  name: string;
  description?: string | null;
  privacy: ListPrivacy;
  sortBy?: ListSortBy | null;
  sortOrder?: ListSortOrder | null;
  createdAt: number;
  updatedAt: number;
  userId: number;
  allowComments?: boolean | null;
  displayNumbers?: boolean | null;
  isWatchlist: boolean;
  traktId?: number | null;
}

export type ListPrivacy = 'friends' | 'private' | 'public';

export type ListSortBy =
  | 'my-rating'
  | 'next-airing'
  | 'platform-recommended'
  | 'recently-added'
  | 'recently-aired'
  | 'recently-watched'
  | 'recommended'
  | 'release-date'
  | 'runtime'
  | 'title';

export type ListSortOrder = 'asc' | 'desc';

export type GetItemsRequest = {
  groupId?: number | null;
  filter?: string | null;
  status?: string | null;
  genres?: string | null;
  orderBy?: MediaItemOrderBy | null;
  sortOrder?: SortOrder | null;
  onlyOnWatchlist?: boolean | null;
  onlySeenItems?: boolean | null;
  onlyWithNextEpisodesToWatch?: boolean | null;
  onlyWithNextAiring?: boolean | null;
  onlyWithUserRating?: boolean | null;
  onlyWithoutUserRating?: boolean | null;
  selectRandom?: boolean | null;
  year?: string | null;
  genre?: string | null;
  languages?: string | null;
  creators?: string | null;
  publishers?: string | null;
  mediaTypes?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
  onlyWithProgress?: boolean | null;
  page?: number | null;
} & {
  mediaType?: MediaType | null;
};

export type MediaItemOrderBy =
  | 'lastAiring'
  | 'lastSeen'
  | 'mediaType'
  | 'nextAiring'
  | 'platformRecommended'
  | 'progress'
  | 'recommended'
  | 'releaseDate'
  | 'status'
  | 'title'
  | 'unseenEpisodes';

export type SortOrder = 'asc' | 'desc';

export interface GetFacetsRequest {
  groupId?: number | null;
  filter?: string | null;
  status?: string | null;
  mediaType?: MediaType | null;
  genres?: string | null;
  orderBy?: MediaItemOrderBy | null;
  onlyOnWatchlist?: boolean | null;
  onlySeenItems?: boolean | null;
  onlyWithNextEpisodesToWatch?: boolean | null;
  onlyWithNextAiring?: boolean | null;
  onlyWithUserRating?: boolean | null;
  onlyWithoutUserRating?: boolean | null;
  languages?: string | null;
  creators?: string | null;
  publishers?: string | null;
  mediaTypes?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
  onlyWithProgress?: boolean | null;
}

export interface FacetsResponse {
  genres: FacetOption[];
  years: FacetOption[];
  languages: FacetOption[];
  creators: FacetOption[];
  publishers: FacetOption[];
  mediaTypes: FacetOption[];
}

export interface FacetOption {
  value: string;
  count: number;
}

export type ListDetailsResponse = {
  id: number;
  isWatchlist: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  traktId?: number | null;
  sortOrder?: ListSortOrder | null;
  description?: string | null;
  privacy: ListPrivacy;
  sortBy?: ListSortBy | null;
  allowComments?: boolean | null;
  displayNumbers?: boolean | null;
} & {
  totalRuntime: number;
  user: {
    id: number;
    username: string;
  };
};

export type ListItemsResponse = {
  id: number;
  listedAt: string;
  estimatedRating?: number | null;
  type: 'audiobook' | 'book' | 'episode' | 'movie' | 'season' | 'tv' | 'video_game';
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason | null;
  episode?: TvEpisode | null;
}[];

export type ListsResponse = ListsItemResponse[];

export type ListsItemResponse = {
  id: number;
  isWatchlist: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  traktId?: number | null;
  sortOrder?: ListSortOrder | null;
  description?: string | null;
  privacy: ListPrivacy;
  sortBy?: ListSortBy | null;
  allowComments?: boolean | null;
  displayNumbers?: boolean | null;
} & {
  itemsCount: number;
  user: {
    id: number;
    name: string;
  };
};

export interface LogLevels {
  error?: boolean | null;
  warn?: boolean | null;
  info?: boolean | null;
  debug?: boolean | null;
  http?: boolean | null;
}

export type LogEntry =
  | {
      message: string;
      id: string;
      level: string;
      stack?: string | null;
      timestamp: string;
    }
  | ({
      message: string;
      id: string;
      level: string;
      stack?: string | null;
      timestamp: string;
    } & HttpLogEntry)
  | ({
      message: string;
      id: string;
      level: string;
      stack?: string | null;
      timestamp: string;
    } & ValidationErrorLogEntry);

export interface HttpLogEntry {
  type: 'http';
  url: string;
  method: string;
  ip: string;
  httpVersion: string;
  statusCode: number;
  responseSize: number;
  duration: number;
}

export interface ValidationErrorLogEntry {
  type: 'validationError';
  message: string;
  error: string;
  body?: object | null;
  method: string;
  url: string;
}

export type LastSeenAt = 'custom_date' | 'now' | 'release_date' | 'unknown';

export interface StatisticsSummaryResponse {
  tv: {
    numberOfPages?: number | null;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
  movie: {
    numberOfPages?: number | null;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
  book: {
    numberOfPages?: number | null;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
  video_game: {
    numberOfPages?: number | null;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
  audiobook: {
    numberOfPages?: number | null;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
}

export interface GenreSummeryResponse {
  tv: {
    genre: string;
    count: number;
  }[];
  movie: {
    genre: string;
    count: number;
  }[];
  book: {
    genre: string;
    count: number;
  }[];
  video_game: {
    genre: string;
    count: number;
  }[];
  audiobook: {
    genre: string;
    count: number;
  }[];
}

export interface UserResponse {
  id: number;
  name: string;
  admin?: boolean | null;
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
}

export interface RequestError {
  errorMessage: string;
  MediaTrackerError: true;
}

export type NotificationPlatformsResponseType =
  | {
      platformName: 'gotify';
      credentials: {
        url: string;
        token: string;
        priority: string;
      };
    }
  | {
      platformName: 'Discord';
      credentials: {
        url: string;
      };
    }
  | {
      platformName: 'Pushbullet';
      credentials: {
        token: string;
      };
    }
  | {
      platformName: 'Pushover';
      credentials: {
        key: string;
      };
    }
  | {
      platformName: 'Pushsafer';
      credentials: {
        key: string;
      };
    }
  | {
      platformName: 'ntfy';
      credentials: {
        url: string;
        priority: string;
        topic: string;
      };
    };

export type Array = {
  id: number;
  name: string;
}[];

export interface GoodreadsImport {
  read: number;
  toRead: number;
  currentlyReading: number;
  ratings: number;
}

export type ImportState =
  | 'error'
  | 'exporting'
  | 'imported'
  | 'importing'
  | 'uninitialized'
  | 'updating-metadata'
  | 'waiting-for-authentication';

export interface TraktTvImportSummary {
  watchlist: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  seen: {
    movies: number;
    episodes: number;
  };
  ratings: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  lists: {
    listName: string;
    listId: string;
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  }[];
}

export interface TraktTvImportNotImportedItems {
  watchlist: {
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  };
  seen: {
    movies: TraktTvNotImportedMovie[];
    episodes: TraktTvNotImportedEpisode[];
  };
  ratings: {
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  };
  lists: {
    listName: string;
    listId: string;
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  }[];
}

export interface TraktTvNotImportedMovie {
  title: string;
  year: number;
  traktTvLink: string;
}

export interface TraktTvNotImportedTvShow {
  title: string;
  year: number;
  traktTvLink: string;
}

export interface TraktTvNotImportedSeason {
  show: {
    title: string;
    year: number;
  };
  season: {
    seasonNumber: number;
  };
  traktTvLink: string;
}

export interface TraktTvNotImportedEpisode {
  show: {
    title: string;
    year: number;
  };
  episode: {
    episodeNumber: number;
    seasonNumber: number;
  };
  traktTvLink: string;
}

export namespace Calendar {
  /**
   * No description
   * @tags Calendar
   * @name Get
   * @request GET:/api/calendar
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Date string in ISO 8601 format
       * @example "2022-05-21"
       */
      start?: string | null;
      /**
       * Date string in ISO 8601 format
       * @example "2022-05-21T23:37:36+00:00"
       */
      end?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetCalendarItemsResponse;
  }
}

export namespace Configuration {
  /**
   * No description
   * @tags Configuration
   * @name Update
   * @request PATCH:/api/configuration
   * @secure
   */
  export namespace Update {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      enableRegistration?: boolean | null;
      tmdbLang?: TmdbLang | null;
      audibleLang?: AudibleCountryCode | null;
      serverLang?: ServerLang | null;
      igdbClientId?: string | null;
      igdbClientSecret?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Configuration
   * @name Get
   * @request GET:/api/configuration
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      enableRegistration: boolean;
      tmdbLang?: TmdbLang | null;
      audibleLang?: AudibleCountryCode | null;
      serverLang?: ServerLang | null;
      igdbClientId?: string | null;
      igdbClientSecret?: string | null;
    } & {
      noUsers: boolean;
      demo: boolean;
      version: string;
    };
  }
}

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

export namespace Details {
  /**
   * No description
   * @tags MediaItem
   * @name Get
   * @request GET:/api/details/{mediaItemId}
   * @secure
   */
  export namespace Get {
    export type RequestParams = {
      mediaItemId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemDetailsResponse;
  }
  /**
   * No description
   * @tags MediaItem
   * @name UpdateMetadata
   * @request GET:/api/details/update-metadata/{mediaItemId}
   * @secure
   */
  export namespace UpdateMetadata {
    export type RequestParams = {
      mediaItemId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Items {
  /**
   * @description Get items
   * @tags Items
   * @name Paginated
   * @request GET:/api/items/paginated
   * @secure
   */
  export namespace Paginated {
    export type RequestParams = {};
    export type RequestQuery = {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
      page?: number | null;
      mediaType?: MediaType | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      data: MediaItemItemsResponse[];
      page: number;
      totalPages: number;
      from: number;
      to: number;
      total: number;
    };
  }
  /**
   * @description Get facet counts
   * @tags Items
   * @name Facets
   * @request GET:/api/items/facets
   * @secure
   */
  export namespace Facets {
    export type RequestParams = {};
    export type RequestQuery = {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = FacetsResponse;
  }
  /**
   * @description Get items
   * @tags Items
   * @name Get
   * @request GET:/api/items
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }
  /**
   * @description Get items
   * @tags Items
   * @name Random
   * @request GET:/api/items/random
   * @secure
   */
  export namespace Random {
    export type RequestParams = {};
    export type RequestQuery = {
      groupId?: number | null;
      filter?: string | null;
      status?: string | null;
      mediaType?: MediaType | null;
      genres?: string | null;
      orderBy?: MediaItemOrderBy | null;
      sortOrder?: SortOrder | null;
      onlyOnWatchlist?: boolean | null;
      onlySeenItems?: boolean | null;
      onlyWithNextEpisodesToWatch?: boolean | null;
      onlyWithNextAiring?: boolean | null;
      onlyWithUserRating?: boolean | null;
      onlyWithoutUserRating?: boolean | null;
      selectRandom?: boolean | null;
      year?: string | null;
      genre?: string | null;
      languages?: string | null;
      creators?: string | null;
      publishers?: string | null;
      mediaTypes?: string | null;
      yearMin?: number | null;
      yearMax?: number | null;
      ratingMin?: number | null;
      ratingMax?: number | null;
      onlyWithProgress?: boolean | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }
}

export namespace List {
  /**
   * No description
   * @tags List
   * @name AddList
   * @request PUT:/api/list
   * @secure
   */
  export namespace AddList {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = List;
  }
  /**
   * No description
   * @tags List
   * @name UpdateList
   * @request PATCH:/api/list
   * @secure
   */
  export namespace UpdateList {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      id: number;
      name: string;
      description?: string | null;
      privacy?: ListPrivacy | null;
      sortBy?: ListSortBy | null;
      sortOrder?: ListSortOrder | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = List;
  }
  /**
   * No description
   * @tags List
   * @name GetList
   * @request GET:/api/list
   * @secure
   */
  export namespace GetList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListDetailsResponse;
  }
  /**
   * No description
   * @tags List
   * @name DeleteList
   * @request DELETE:/api/list
   * @secure
   */
  export namespace DeleteList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListDetailsResponse;
  }
  /**
   * No description
   * @tags List
   * @name GetListItems
   * @request GET:/api/list/items
   * @secure
   */
  export namespace GetListItems {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      sortBy?: ListSortBy | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListItemsResponse;
  }
}

export namespace ListItem {
  /**
   * No description
   * @tags List Item
   * @name Add
   * @request PUT:/api/list-item
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags List Item
   * @name RemoveItemFromList
   * @request DELETE:/api/list-item
   * @secure
   */
  export namespace RemoveItemFromList {
    export type RequestParams = {};
    export type RequestQuery = {
      listId: number;
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Lists {
  /**
   * No description
   * @tags Lists
   * @name GetUsersLists
   * @request GET:/api/lists
   * @secure
   */
  export namespace GetUsersLists {
    export type RequestParams = {};
    export type RequestQuery = {
      userId?: number | null;
      mediaItemId?: number | null;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListsResponse;
  }
}

export namespace Logs {
  /**
   * No description
   * @tags Logs
   * @name Get
   * @request GET:/api/logs
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {
      error?: boolean | null;
      warn?: boolean | null;
      info?: boolean | null;
      debug?: boolean | null;
      http?: boolean | null;
      count?: number | null;
      from?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = LogEntry[];
  }
}

export namespace Plex {
  /**
   * No description
   * @tags Lists
   * @name PlexWebhook
   * @request POST:/api/plex
   * @secure
   */
  export namespace PlexWebhook {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Progress {
  /**
   * No description
   * @tags Progress
   * @name Add
   * @request PUT:/api/progress
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      episodeId?: number | null;
      date?: number | null;
      action?: 'paused' | 'playing' | null;
      duration?: number | null;
      progress?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Progress
   * @name AddByExternalId
   * @request PUT:/api/progress/by-external-id
   * @secure
   */
  export namespace AddByExternalId {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      mediaType: MediaType;
      id: {
        imdbId?: string | null;
        tmdbId?: number | null;
        audibleId?: string | null;
        igdbId?: number | null;
      };
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      action?: 'paused' | 'playing' | null;
      progress?: number | null;
      duration?: number | null;
      device?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Progress
   * @name DeleteById
   * @request DELETE:/api/progress/{progressId}
   * @secure
   */
  export namespace DeleteById {
    export type RequestParams = {
      progressId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Rating {
  /**
   * No description
   * @tags Rating
   * @name Add
   * @request PUT:/api/rating
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      rating?: number | null;
      review?: string | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Search {
  /**
   * No description
   * @tags Search
   * @name Search
   * @request GET:/api/search
   * @secure
   */
  export namespace Search {
    export type RequestParams = {};
    export type RequestQuery = {
      q: string;
      mediaType: MediaType;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MediaItemItemsResponse[];
  }
}

export namespace Seen {
  /**
   * No description
   * @tags Seen
   * @name Add
   * @request PUT:/api/seen
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
      lastSeenEpisodeId?: number | null;
      lastSeenAt?: LastSeenAt | null;
      date?: number | null;
      duration?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Seen
   * @name AddByExternalId
   * @request PUT:/api/seen/by-external-id
   * @secure
   */
  export namespace AddByExternalId {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      mediaType: MediaType;
      id: {
        imdbId?: string | null;
        tmdbId?: number | null;
      };
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      duration?: number | null;
    };
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Seen
   * @name DeleteById
   * @request DELETE:/api/seen/{seenId}
   * @secure
   */
  export namespace DeleteById {
    export type RequestParams = {
      seenId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Seen
   * @name Delete
   * @request DELETE:/api/seen/
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace Statistics {
  /**
   * No description
   * @tags Statistics
   * @name Summary
   * @request GET:/api/statistics/summary
   * @secure
   */
  export namespace Summary {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = StatisticsSummaryResponse;
  }
  /**
   * No description
   * @tags Statistics
   * @name StatisticsSeeninyearList
   * @request GET:/api/statistics/seeninyear
   * @secure
   */
  export namespace StatisticsSeeninyearList {
    export type RequestParams = {};
    export type RequestQuery = {
      year?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = StatisticsSummaryResponse;
  }
  /**
   * No description
   * @tags Statistics
   * @name StatisticsGenresinyearList
   * @request GET:/api/statistics/genresinyear
   * @secure
   */
  export namespace StatisticsGenresinyearList {
    export type RequestParams = {};
    export type RequestQuery = {
      year?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GenreSummeryResponse;
  }
}

export namespace Tokens {
  /**
   * @description Add token
   * @tags Token
   * @name Add
   * @request PUT:/api/tokens
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      description: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      token: string;
    };
  }
  /**
   * @description Delete token
   * @tags Token
   * @name Delete
   * @request DELETE:/api/tokens
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      description: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * @description Get all tokens
   * @tags Token
   * @name Get
   * @request GET:/api/tokens
   * @secure
   */
  export namespace Get {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = string[];
  }
}

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

export namespace Users {
  /**
   * No description
   * @tags User
   * @name Search
   * @request GET:/api/users/search
   * @secure
   */
  export namespace Search {
    export type RequestParams = {};
    export type RequestQuery = {
      query: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = Array;
  }
}

export namespace Watchlist {
  /**
   * No description
   * @tags Watchlist
   * @name Add
   * @request PUT:/api/watchlist
   * @secure
   */
  export namespace Add {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
  /**
   * No description
   * @tags Watchlist
   * @name Delete
   * @request DELETE:/api/watchlist
   * @secure
   */
  export namespace Delete {
    export type RequestParams = {};
    export type RequestQuery = {
      mediaItemId: number;
      seasonId?: number | null;
      episodeId?: number | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export namespace ImportGoodreads {
  /**
   * No description
   * @tags GoodreadsImport
   * @name Import
   * @request POST:/api/import-goodreads
   * @secure
   */
  export namespace Import {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      url: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = GoodreadsImport;
  }
}

export namespace ImportTrakttv {
  /**
   * No description
   * @tags TraktTvImport
   * @name State
   * @request GET:/api/import-trakttv/state
   * @secure
   */
  export namespace State {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      state: ImportState;
      progress?: number | null;
      exportSummary?: TraktTvImportSummary | null;
      importSummary?: TraktTvImportSummary | null;
      notImportedItems?: TraktTvImportNotImportedItems | null;
      error?: string | null;
    };
  }
  /**
   * No description
   * @tags TraktTvImport
   * @name StateStream
   * @request GET:/api/import-trakttv/state-stream
   * @secure
   */
  export namespace StateStream {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      state: ImportState;
      progress?: number | null;
      exportSummary?: TraktTvImportSummary | null;
      importSummary?: TraktTvImportSummary | null;
      notImportedItems?: TraktTvImportNotImportedItems | null;
      error?: string | null;
    };
  }
  /**
   * No description
   * @tags TraktTvImport
   * @name DeviceToken
   * @request GET:/api/import-trakttv/device-token
   * @secure
   */
  export namespace DeviceToken {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      userCode: string;
      verificationUrl: string;
    };
  }
  /**
   * No description
   * @tags TraktTvImport
   * @name StartOver
   * @request GET:/api/import-trakttv/start-over
   * @secure
   */
  export namespace StartOver {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>;

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = 'application/json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
  Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = '';
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: 'same-origin',
    headers: {},
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === 'number' ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join('&');
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => 'undefined' !== typeof query[key]);
    return keys
      .map((key) => (Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)))
      .join('&');
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : '';
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string') ? JSON.stringify(input) : input,
    [ContentType.Text]: (input: any) => (input !== null && typeof input !== 'string' ? JSON.stringify(input) : input),
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === 'object' && property !== null
            ? JSON.stringify(property)
            : `${property}`
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<T> => {
    const secureParams =
      ((typeof secure === 'boolean' ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(`${baseUrl || this.baseUrl || ''}${path}${queryString ? `?${queryString}` : ''}`, {
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type && type !== ContentType.FormData ? { 'Content-Type': type } : {}),
      },
      signal: cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal,
      body: typeof body === 'undefined' || body === null ? null : payloadFormatter(body),
    }).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data.data;
    });
  };
}

/**
 * @title MediaTracker
 * @version 0.1.0
 * @license MIT (https://opensource.org/licenses/MIT)
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  calendar = {
    /**
     * No description
     *
     * @tags Calendar
     * @name Get
     * @request GET:/api/calendar
     * @secure
     */
    get: (
      query?: {
        /**
         * Date string in ISO 8601 format
         * @example "2022-05-21"
         */
        start?: string | null;
        /**
         * Date string in ISO 8601 format
         * @example "2022-05-21T23:37:36+00:00"
         */
        end?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<GetCalendarItemsResponse, any>({
        path: `/api/calendar`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  configuration = {
    /**
     * No description
     *
     * @tags Configuration
     * @name Update
     * @request PATCH:/api/configuration
     * @secure
     */
    update: (
      data: {
        enableRegistration?: boolean | null;
        tmdbLang?: TmdbLang | null;
        audibleLang?: AudibleCountryCode | null;
        serverLang?: ServerLang | null;
        igdbClientId?: string | null;
        igdbClientSecret?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/configuration`,
        method: 'PATCH',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Configuration
     * @name Get
     * @request GET:/api/configuration
     * @secure
     */
    get: (params: RequestParams = {}) =>
      this.request<
        {
          enableRegistration: boolean;
          tmdbLang?: TmdbLang | null;
          audibleLang?: AudibleCountryCode | null;
          serverLang?: ServerLang | null;
          igdbClientId?: string | null;
          igdbClientSecret?: string | null;
        } & {
          noUsers: boolean;
          demo: boolean;
          version: string;
        },
        any
      >({
        path: `/api/configuration`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  group = {
    /**
     * No description
     *
     * @tags Group
     * @name CreateGroup
     * @request POST:/api/group
     * @secure
     */
    createGroup: (
      data: {
        name: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
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
      }),

    /**
     * No description
     *
     * @tags Group
     * @name ListGroups
     * @request GET:/api/group
     * @secure
     */
    listGroups: (params: RequestParams = {}) =>
      this.request<GroupResponse[], any>({
        path: `/api/group`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name GetGroup
     * @request GET:/api/group/{groupId}
     * @secure
     */
    getGroup: (groupId: number, params: RequestParams = {}) =>
      this.request<GroupDetailResponse, any>({
        path: `/api/group/${groupId}`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name UpdateGroup
     * @request PUT:/api/group/{groupId}
     * @secure
     */
    updateGroup: (
      groupId: number,
      data: {
        name: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/group/${groupId}`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name DeleteGroup
     * @request DELETE:/api/group/{groupId}
     * @secure
     */
    deleteGroup: (groupId: number, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/group/${groupId}`,
        method: 'DELETE',
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name AddGroupMember
     * @request POST:/api/group/{groupId}/member
     * @secure
     */
    addGroupMember: (
      groupId: number,
      data: {
        userId: number;
        role: UserGroupRole;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/group/${groupId}/member`,
        method: 'POST',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name RemoveGroupMember
     * @request DELETE:/api/group/{groupId}/member/{userId}
     * @secure
     */
    removeGroupMember: (groupId: number, userId: number, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/group/${groupId}/member/${userId}`,
        method: 'DELETE',
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Group
     * @name UpdateGroupMemberRole
     * @request PUT:/api/group/{groupId}/member/{userId}
     * @secure
     */
    updateGroupMemberRole: (
      groupId: number,
      userId: number,
      data: {
        role: UserGroupRole;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/group/${groupId}/member/${userId}`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  id = {
    /**
     * No description
     *
     * @tags Img
     * @name GetImage
     * @request GET:/img/{id}
     * @secure
     */
    getImage: (
      id: string,
      query?: {
        size?: ImgSize | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<string, any>({
        path: `/img/${id}`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  details = {
    /**
     * No description
     *
     * @tags MediaItem
     * @name Get
     * @request GET:/api/details/{mediaItemId}
     * @secure
     */
    get: (mediaItemId: number, params: RequestParams = {}) =>
      this.request<MediaItemDetailsResponse, any>({
        path: `/api/details/${mediaItemId}`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags MediaItem
     * @name UpdateMetadata
     * @request GET:/api/details/update-metadata/{mediaItemId}
     * @secure
     */
    updateMetadata: (mediaItemId: number, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/details/update-metadata/${mediaItemId}`,
        method: 'GET',
        secure: true,
        ...params,
      }),
  };
  items = {
    /**
     * @description Get items
     *
     * @tags Items
     * @name Paginated
     * @request GET:/api/items/paginated
     * @secure
     */
    paginated: (
      query?: {
        groupId?: number | null;
        filter?: string | null;
        status?: string | null;
        genres?: string | null;
        orderBy?: MediaItemOrderBy | null;
        sortOrder?: SortOrder | null;
        onlyOnWatchlist?: boolean | null;
        onlySeenItems?: boolean | null;
        onlyWithNextEpisodesToWatch?: boolean | null;
        onlyWithNextAiring?: boolean | null;
        onlyWithUserRating?: boolean | null;
        onlyWithoutUserRating?: boolean | null;
        selectRandom?: boolean | null;
        year?: string | null;
        genre?: string | null;
        languages?: string | null;
        creators?: string | null;
        publishers?: string | null;
        mediaTypes?: string | null;
        yearMin?: number | null;
        yearMax?: number | null;
        ratingMin?: number | null;
        ratingMax?: number | null;
        onlyWithProgress?: boolean | null;
        page?: number | null;
        mediaType?: MediaType | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          data: MediaItemItemsResponse[];
          page: number;
          totalPages: number;
          from: number;
          to: number;
          total: number;
        },
        any
      >({
        path: `/api/items/paginated`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get facet counts
     *
     * @tags Items
     * @name Facets
     * @request GET:/api/items/facets
     * @secure
     */
    facets: (
      query?: {
        groupId?: number | null;
        filter?: string | null;
        status?: string | null;
        mediaType?: MediaType | null;
        genres?: string | null;
        orderBy?: MediaItemOrderBy | null;
        onlyOnWatchlist?: boolean | null;
        onlySeenItems?: boolean | null;
        onlyWithNextEpisodesToWatch?: boolean | null;
        onlyWithNextAiring?: boolean | null;
        onlyWithUserRating?: boolean | null;
        onlyWithoutUserRating?: boolean | null;
        languages?: string | null;
        creators?: string | null;
        publishers?: string | null;
        mediaTypes?: string | null;
        yearMin?: number | null;
        yearMax?: number | null;
        ratingMin?: number | null;
        ratingMax?: number | null;
        onlyWithProgress?: boolean | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<FacetsResponse, any>({
        path: `/api/items/facets`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get items
     *
     * @tags Items
     * @name Get
     * @request GET:/api/items
     * @secure
     */
    get: (
      query?: {
        groupId?: number | null;
        filter?: string | null;
        status?: string | null;
        mediaType?: MediaType | null;
        genres?: string | null;
        orderBy?: MediaItemOrderBy | null;
        sortOrder?: SortOrder | null;
        onlyOnWatchlist?: boolean | null;
        onlySeenItems?: boolean | null;
        onlyWithNextEpisodesToWatch?: boolean | null;
        onlyWithNextAiring?: boolean | null;
        onlyWithUserRating?: boolean | null;
        onlyWithoutUserRating?: boolean | null;
        selectRandom?: boolean | null;
        year?: string | null;
        genre?: string | null;
        languages?: string | null;
        creators?: string | null;
        publishers?: string | null;
        mediaTypes?: string | null;
        yearMin?: number | null;
        yearMax?: number | null;
        ratingMin?: number | null;
        ratingMax?: number | null;
        onlyWithProgress?: boolean | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<MediaItemItemsResponse[], any>({
        path: `/api/items`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get items
     *
     * @tags Items
     * @name Random
     * @request GET:/api/items/random
     * @secure
     */
    random: (
      query?: {
        groupId?: number | null;
        filter?: string | null;
        status?: string | null;
        mediaType?: MediaType | null;
        genres?: string | null;
        orderBy?: MediaItemOrderBy | null;
        sortOrder?: SortOrder | null;
        onlyOnWatchlist?: boolean | null;
        onlySeenItems?: boolean | null;
        onlyWithNextEpisodesToWatch?: boolean | null;
        onlyWithNextAiring?: boolean | null;
        onlyWithUserRating?: boolean | null;
        onlyWithoutUserRating?: boolean | null;
        selectRandom?: boolean | null;
        year?: string | null;
        genre?: string | null;
        languages?: string | null;
        creators?: string | null;
        publishers?: string | null;
        mediaTypes?: string | null;
        yearMin?: number | null;
        yearMax?: number | null;
        ratingMin?: number | null;
        ratingMax?: number | null;
        onlyWithProgress?: boolean | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<MediaItemItemsResponse[], any>({
        path: `/api/items/random`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  list = {
    /**
     * No description
     *
     * @tags List
     * @name AddList
     * @request PUT:/api/list
     * @secure
     */
    addList: (
      data: {
        name: string;
        description?: string | null;
        privacy?: ListPrivacy | null;
        sortBy?: ListSortBy | null;
        sortOrder?: ListSortOrder | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<List, any>({
        path: `/api/list`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags List
     * @name UpdateList
     * @request PATCH:/api/list
     * @secure
     */
    updateList: (
      data: {
        id: number;
        name: string;
        description?: string | null;
        privacy?: ListPrivacy | null;
        sortBy?: ListSortBy | null;
        sortOrder?: ListSortOrder | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<List, any>({
        path: `/api/list`,
        method: 'PATCH',
        body: data,
        secure: true,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags List
     * @name GetList
     * @request GET:/api/list
     * @secure
     */
    getList: (
      query: {
        listId: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<ListDetailsResponse, any>({
        path: `/api/list`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags List
     * @name DeleteList
     * @request DELETE:/api/list
     * @secure
     */
    deleteList: (
      query: {
        listId: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<ListDetailsResponse, any>({
        path: `/api/list`,
        method: 'DELETE',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags List
     * @name GetListItems
     * @request GET:/api/list/items
     * @secure
     */
    getListItems: (
      query: {
        listId: number;
        sortBy?: ListSortBy | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<ListItemsResponse, any>({
        path: `/api/list/items`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  listItem = {
    /**
     * No description
     *
     * @tags List Item
     * @name Add
     * @request PUT:/api/list-item
     * @secure
     */
    add: (
      query: {
        listId: number;
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/list-item`,
        method: 'PUT',
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags List Item
     * @name RemoveItemFromList
     * @request DELETE:/api/list-item
     * @secure
     */
    removeItemFromList: (
      query: {
        listId: number;
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/list-item`,
        method: 'DELETE',
        query: query,
        secure: true,
        ...params,
      }),
  };
  lists = {
    /**
     * No description
     *
     * @tags Lists
     * @name GetUsersLists
     * @request GET:/api/lists
     * @secure
     */
    getUsersLists: (
      query?: {
        userId?: number | null;
        mediaItemId?: number | null;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<ListsResponse, any>({
        path: `/api/lists`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  logs = {
    /**
     * No description
     *
     * @tags Logs
     * @name Get
     * @request GET:/api/logs
     * @secure
     */
    get: (
      query?: {
        error?: boolean | null;
        warn?: boolean | null;
        info?: boolean | null;
        debug?: boolean | null;
        http?: boolean | null;
        count?: number | null;
        from?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<LogEntry[], any>({
        path: `/api/logs`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  plex = {
    /**
     * No description
     *
     * @tags Lists
     * @name PlexWebhook
     * @request POST:/api/plex
     * @secure
     */
    plexWebhook: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/plex`,
        method: 'POST',
        secure: true,
        ...params,
      }),
  };
  progress = {
    /**
     * No description
     *
     * @tags Progress
     * @name Add
     * @request PUT:/api/progress
     * @secure
     */
    add: (
      query: {
        mediaItemId: number;
        episodeId?: number | null;
        date?: number | null;
        action?: 'paused' | 'playing' | null;
        duration?: number | null;
        progress?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/progress`,
        method: 'PUT',
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Progress
     * @name AddByExternalId
     * @request PUT:/api/progress/by-external-id
     * @secure
     */
    addByExternalId: (
      data: {
        mediaType: MediaType;
        id: {
          imdbId?: string | null;
          tmdbId?: number | null;
          audibleId?: string | null;
          igdbId?: number | null;
        };
        seasonNumber?: number | null;
        episodeNumber?: number | null;
        action?: 'paused' | 'playing' | null;
        progress?: number | null;
        duration?: number | null;
        device?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/progress/by-external-id`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Progress
     * @name DeleteById
     * @request DELETE:/api/progress/{progressId}
     * @secure
     */
    deleteById: (progressId: number, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/progress/${progressId}`,
        method: 'DELETE',
        secure: true,
        ...params,
      }),
  };
  rating = {
    /**
     * No description
     *
     * @tags Rating
     * @name Add
     * @request PUT:/api/rating
     * @secure
     */
    add: (
      data: {
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
        rating?: number | null;
        review?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/rating`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  search = {
    /**
     * No description
     *
     * @tags Search
     * @name Search
     * @request GET:/api/search
     * @secure
     */
    search: (
      query: {
        q: string;
        mediaType: MediaType;
      },
      params: RequestParams = {}
    ) =>
      this.request<MediaItemItemsResponse[], any>({
        path: `/api/search`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  seen = {
    /**
     * No description
     *
     * @tags Seen
     * @name Add
     * @request PUT:/api/seen
     * @secure
     */
    add: (
      query: {
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
        lastSeenEpisodeId?: number | null;
        lastSeenAt?: LastSeenAt | null;
        date?: number | null;
        duration?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/seen`,
        method: 'PUT',
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Seen
     * @name AddByExternalId
     * @request PUT:/api/seen/by-external-id
     * @secure
     */
    addByExternalId: (
      data: {
        mediaType: MediaType;
        id: {
          imdbId?: string | null;
          tmdbId?: number | null;
        };
        seasonNumber?: number | null;
        episodeNumber?: number | null;
        duration?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/seen/by-external-id`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Seen
     * @name DeleteById
     * @request DELETE:/api/seen/{seenId}
     * @secure
     */
    deleteById: (seenId: number, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/seen/${seenId}`,
        method: 'DELETE',
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Seen
     * @name Delete
     * @request DELETE:/api/seen/
     * @secure
     */
    delete: (
      query: {
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/seen/`,
        method: 'DELETE',
        query: query,
        secure: true,
        ...params,
      }),
  };
  statistics = {
    /**
     * No description
     *
     * @tags Statistics
     * @name Summary
     * @request GET:/api/statistics/summary
     * @secure
     */
    summary: (params: RequestParams = {}) =>
      this.request<StatisticsSummaryResponse, any>({
        path: `/api/statistics/summary`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Statistics
     * @name StatisticsSeeninyearList
     * @request GET:/api/statistics/seeninyear
     * @secure
     */
    statisticsSeeninyearList: (
      query?: {
        year?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<StatisticsSummaryResponse, any>({
        path: `/api/statistics/seeninyear`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Statistics
     * @name StatisticsGenresinyearList
     * @request GET:/api/statistics/genresinyear
     * @secure
     */
    statisticsGenresinyearList: (
      query?: {
        year?: string | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<GenreSummeryResponse, any>({
        path: `/api/statistics/genresinyear`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  tokens = {
    /**
     * @description Add token
     *
     * @tags Token
     * @name Add
     * @request PUT:/api/tokens
     * @secure
     */
    add: (
      query: {
        description: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          token: string;
        },
        any
      >({
        path: `/api/tokens`,
        method: 'PUT',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete token
     *
     * @tags Token
     * @name Delete
     * @request DELETE:/api/tokens
     * @secure
     */
    delete: (
      query: {
        description: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/tokens`,
        method: 'DELETE',
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * @description Get all tokens
     *
     * @tags Token
     * @name Get
     * @request GET:/api/tokens
     * @secure
     */
    get: (params: RequestParams = {}) =>
      this.request<string[], any>({
        path: `/api/tokens`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  user = {
    /**
     * No description
     *
     * @tags User
     * @name Get
     * @request GET:/api/user
     * @secure
     */
    get: (params: RequestParams = {}) =>
      this.request<UserResponse | null, any>({
        path: `/api/user`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name Logout
     * @request GET:/api/user/logout
     * @secure
     */
    logout: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/user/logout`,
        method: 'GET',
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name Login
     * @request POST:/api/user/login
     * @secure
     */
    login: (
      data: {
        username: string;
        password: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/user/login`,
        method: 'POST',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name Register
     * @request POST:/api/user/register
     * @secure
     */
    register: (
      data: {
        username: string;
        password: string;
        confirmPassword: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<UserResponse | RequestError, any>({
        path: `/api/user/register`,
        method: 'POST',
        body: data,
        secure: true,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name GetNotificationCredentials
     * @request GET:/api/user/notification-credentials
     * @secure
     */
    getNotificationCredentials: (params: RequestParams = {}) =>
      this.request<
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
      }),

    /**
     * No description
     *
     * @tags User
     * @name UpdateNotificationCredentials
     * @request PUT:/api/user/notification-credentials
     * @secure
     */
    updateNotificationCredentials: (data: NotificationPlatformsResponseType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/user/notification-credentials`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name Update
     * @request PUT:/api/user/settings
     * @secure
     */
    update: (
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
      this.request<any, any>({
        path: `/api/user/settings`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UpdatePassword
     * @request PUT:/api/user/password
     * @secure
     */
    updatePassword: (
      data: {
        currentPassword: string;
        newPassword: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/user/password`,
        method: 'PUT',
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name GetById
     * @request GET:/api/user/{userId}
     * @secure
     */
    getById: (userId: number, params: RequestParams = {}) =>
      this.request<
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
      }),
  };
  users = {
    /**
     * No description
     *
     * @tags User
     * @name Search
     * @request GET:/api/users/search
     * @secure
     */
    search: (
      query: {
        query: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<Array, any>({
        path: `/api/users/search`,
        method: 'GET',
        query: query,
        secure: true,
        format: 'json',
        ...params,
      }),
  };
  watchlist = {
    /**
     * No description
     *
     * @tags Watchlist
     * @name Add
     * @request PUT:/api/watchlist
     * @secure
     */
    add: (
      query: {
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/watchlist`,
        method: 'PUT',
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Watchlist
     * @name Delete
     * @request DELETE:/api/watchlist
     * @secure
     */
    delete: (
      query: {
        mediaItemId: number;
        seasonId?: number | null;
        episodeId?: number | null;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/watchlist`,
        method: 'DELETE',
        query: query,
        secure: true,
        ...params,
      }),
  };
  importGoodreads = {
    /**
     * No description
     *
     * @tags GoodreadsImport
     * @name Import
     * @request POST:/api/import-goodreads
     * @secure
     */
    import: (
      data: {
        url: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<GoodreadsImport, any>({
        path: `/api/import-goodreads`,
        method: 'POST',
        body: data,
        secure: true,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  importTrakttv = {
    /**
     * No description
     *
     * @tags TraktTvImport
     * @name State
     * @request GET:/api/import-trakttv/state
     * @secure
     */
    state: (params: RequestParams = {}) =>
      this.request<
        {
          state: ImportState;
          progress?: number | null;
          exportSummary?: TraktTvImportSummary | null;
          importSummary?: TraktTvImportSummary | null;
          notImportedItems?: TraktTvImportNotImportedItems | null;
          error?: string | null;
        },
        any
      >({
        path: `/api/import-trakttv/state`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags TraktTvImport
     * @name StateStream
     * @request GET:/api/import-trakttv/state-stream
     * @secure
     */
    stateStream: (params: RequestParams = {}) =>
      this.request<
        {
          state: ImportState;
          progress?: number | null;
          exportSummary?: TraktTvImportSummary | null;
          importSummary?: TraktTvImportSummary | null;
          notImportedItems?: TraktTvImportNotImportedItems | null;
          error?: string | null;
        },
        any
      >({
        path: `/api/import-trakttv/state-stream`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags TraktTvImport
     * @name DeviceToken
     * @request GET:/api/import-trakttv/device-token
     * @secure
     */
    deviceToken: (params: RequestParams = {}) =>
      this.request<
        {
          userCode: string;
          verificationUrl: string;
        },
        any
      >({
        path: `/api/import-trakttv/device-token`,
        method: 'GET',
        secure: true,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags TraktTvImport
     * @name StartOver
     * @request GET:/api/import-trakttv/start-over
     * @secure
     */
    startOver: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/import-trakttv/start-over`,
        method: 'GET',
        secure: true,
        ...params,
      }),
  };
}
