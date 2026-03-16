import { parseISO } from 'date-fns';

import { UserRating } from 'src/entity/userRating';
import { Seen } from 'src/entity/seen';
import { MediaItemItemsResponse } from 'src/entity/mediaItem';

export type TvEpisode = {
  id?: number;
  title: string;
  description?: string | null;
  episodeNumber: number;
  seasonNumber: number;
  releaseDate?: string | null;
  tvShowId?: number;
  seasonId?: number;
  tmdbId?: number;
  imdbId?: string;
  runtime?: number;
  seenHistory?: Seen[];
  userRating?: UserRating | null;
  lastSeenAt?: number | null;
  seasonAndEpisodeNumber?: number;
  seen?: boolean;
  tvShow?: MediaItemItemsResponse;
  isSpecialEpisode: boolean;
  tvdbId?: number;
  traktId?: number;
  onWatchlist?: boolean;
  metadataLanguage?: string | null;
};

export const tvEpisodeColumns = <const>[
  'releaseDate',
  'description',
  'episodeNumber',
  'id',
  'imdbId',
  'runtime',
  'seasonId',
  'seasonNumber',
  'title',
  'tmdbId',
  'tvShowId',
  'isSpecialEpisode',
  'seasonAndEpisodeNumber',
  'tvdbId',
  'traktId',
];

export class TvEpisodeFilters {
  public static unwatchedEpisodes = (episode: TvEpisode) => {
    return !episode.seenHistory || episode.seenHistory?.length === 0;
  };

  public static nonSpecialEpisodes = (episode: TvEpisode) => {
    return !episode.isSpecialEpisode;
  };

  public static releasedEpisodes = (episode: TvEpisode) => {
    if (!episode.releaseDate || episode.releaseDate.trim() === '') {
      return false;
    }

    return (
      parseISO(episode.releaseDate) <= new Date()
    );
  };

  public static unreleasedEpisodes = (episode: TvEpisode) => {
    if (!episode.releaseDate || episode.releaseDate.trim() === '') {
      return true;
    }

    return (
      parseISO(episode.releaseDate) > new Date()
    );
  };

  public static withReleaseDateEpisodes = (episode: TvEpisode) => {
    return episode.releaseDate != null && episode.releaseDate.trim() !== '';
  };
}
