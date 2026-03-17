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
