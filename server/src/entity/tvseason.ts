import { UserRating } from 'src/entity/userRating';
import { TvEpisode } from 'src/entity/tvepisode';

export type TvSeason = {
  id?: number;
  description?: string | null;
  numberOfEpisodes?: number;
  externalPosterUrl?: string | null;
  posterId?: string | null;
  poster?: string | null;
  releaseDate?: string | null;
  tvShowId?: number;
  tmdbId?: number;
  title: string;
  seasonNumber: number;
  tvmazeId?: number;
  episodes?: TvEpisode[];
  userRating?: UserRating | null;
  seen?: boolean;
  posterSmall?: string | null;
  isSpecialSeason: boolean;
  tvdbId?: number;
  traktId?: number;
  onWatchlist?: boolean;
  totalRuntime?: number;
  lastSeenAt?: number | null;
  unseenEpisodesCount?: number;
  metadataLanguage?: string | null;
};

export const tvSeasonColumns = <const>[
  'description',
  'id',
  'isSpecialSeason',
  'numberOfEpisodes',
  'externalPosterUrl',
  'posterId',
  'releaseDate',
  'seasonNumber',
  'title',
  'tmdbId',
  'tvShowId',
  'tvdbId',
  'traktId',
];

export class TvSeasonFilters {
  public static nonSpecialSeason = (season: TvSeason) => {
    return !season.isSpecialSeason;
  };

  public static seasonNumber = (season: TvSeason) => {
    return season.seasonNumber;
  };
}
