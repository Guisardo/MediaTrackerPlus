import { UserRating } from 'src/entity/userRating';
import { Seen } from 'src/entity/seen';
import { TvEpisode } from 'src/entity/tvepisode';
import { TvSeason } from 'src/entity/tvseason';
import { AudibleCountryCode } from 'src/entity/configuration';
import { List } from 'src/entity/list';

export type MediaType = 'tv' | 'movie' | 'book' | 'video_game' | 'audiobook';

export type ExternalIds = {
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: number;
  tvmazeId?: number;
  igdbId?: number;
  openlibraryId?: string;
  audibleId?: string;
  traktId?: number;
  goodreadsId?: number;
};

export type MediaItemBase = ExternalIds & {
  id?: number;
  numberOfSeasons?: number;
  status?: string;
  platform?: string[];
  title: string;
  originalTitle?: string;
  externalPosterUrl?: string;
  externalBackdropUrl?: string;
  posterId?: string;
  backdropId?: string;
  tmdbRating?: number;
  releaseDate?: string;
  overview?: string;
  lastTimeUpdated?: number;
  source: string;
  network?: string;
  url?: string;
  runtime?: number;
  mediaType: MediaType;
  genres?: string[];
  numberOfEpisodes?: number;
  developer?: string;
  director?: string;
  creator?: string;
  publisher?: string;
  authors?: string[];
  narrators?: string[];
  language?: string;
  numberOfPages?: number;
  audibleCountryCode?: AudibleCountryCode;
  needsDetails?: boolean;
  lockedAt?: number;
  platformRating?: number;
};

export type MediaItemBaseWithSeasons = MediaItemBase & {
  seasons?: TvSeason[];
};

export type MediaItemForProvider = Omit<
  MediaItemBase,
  'id' | 'lastTimeUpdated'
> & {
  seasons?: TvSeasonForProvider[];
};

export type TvEpisodeForProvider = Omit<
  TvEpisode,
  'id' | 'tvShowId' | 'seasonId'
>;
export type TvSeasonForProvider = Omit<
  TvSeason,
  'id' | 'tvShowId' | 'episodes'
> & {
  episodes?: TvEpisodeForProvider[];
};

export type MediaItemDetailsResponse = Omit<
  MediaItemBaseWithSeasons,
  'lockedAt'
> & {
  isSearchResult?: boolean;
  hasDetails?: boolean;

  poster?: string | null;
  posterSmall?: string | null;
  backdrop?: string | null;

  seenHistory?: Seen[];
  unseenEpisodesCount?: number;
  userRating?: UserRating | null;
  upcomingEpisode?: TvEpisode | null;
  lastAiredEpisode?: TvEpisode | null;
  nextAiring?: string | null;
  lastAiring?: string | null;
  onWatchlist?: boolean;
  lastSeenAt?: number | null;
  seen?: boolean;
  firstUnwatchedEpisode?: TvEpisode | null;
  progress?: number | null;
  totalRuntime?: number;
  lists: List[];
  metadataLanguage?: string | null;
};

export type MediaItemItemsResponse = Omit<MediaItemBase, 'lockedAt'> & {
  isSearchResult?: boolean;
  hasDetails?: boolean;

  poster?: string | null;
  posterSmall?: string | null;
  backdrop?: string | null;

  seenHistory?: Seen[];
  unseenEpisodesCount?: number;
  userRating?: UserRating | null;
  upcomingEpisode?: TvEpisode | null;
  lastAiredEpisode?: TvEpisode | null;
  nextAiring?: string | null;
  lastAiring?: string | null;
  onWatchlist?: boolean;
  lastSeenAt?: number | null;
  seen?: boolean;
  firstUnwatchedEpisode?: TvEpisode | null;
  progress?: number | null;
  totalRuntime?: number;
  estimatedRating?: number | null;
  platformSeen?: boolean;
  metadataLanguage?: string | null;
};

export const mediaItemColumns = <const>[
  'creator',
  'developer',
  'director',
  'genres',
  'id',
  'igdbId',
  'imdbId',
  'audibleId',
  'lastTimeUpdated',
  'mediaType',
  'network',
  'numberOfSeasons',
  'openlibraryId',
  'originalTitle',
  'overview',
  'platform',
  'publisher',
  'releaseDate',
  'tmdbRating',
  'runtime',
  'source',
  'status',
  'title',
  'tmdbId',
  'tvmazeId',
  'url',
  'needsDetails',
  'authors',
  'narrators',
  'language',
  'goodreadsId',
  'numberOfPages',
  'traktId',
  'audibleCountryCode',
  'tvdbId',
  'externalPosterUrl',
  'externalBackdropUrl',
  'posterId',
  'backdropId',
  'platformRating',
];

export const mediaItemPosterPath = (
  mediaItemId: number,
  size: 'small' | 'original'
) => {
  return `img/poster?${new URLSearchParams({
    mediaItemId: mediaItemId.toString(),
    size: size,
  })}`;
};

export const mediaItemBackdropPath = (mediaItemId: number) => {
  return `img/backdrop?${new URLSearchParams({
    mediaItemId: mediaItemId.toString(),
  })}`;
};

export const seasonPosterPath = (
  seasonId: number,
  size: 'small' | 'original'
) => {
  return `img/poster?${new URLSearchParams({
    seasonId: seasonId.toString(),
    size: size,
  })}`;
};
