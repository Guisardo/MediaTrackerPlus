import urljoin from 'url-join';
import path from 'path';
import axios from 'axios';

import { MediaItemForProvider, ExternalIds } from 'src/entity/mediaItem';
import { MetadataProvider } from 'src/metadata/metadataProvider';
import { GlobalConfiguration } from 'src/repository/globalSettings';
import { Config } from 'src/config';
import { logger } from 'src/logger';
import { SimilarItem } from 'src/metadata/types';
import { definedOrNull, definedOrUndefined } from 'src/repository/repository';
import {
  normalizeParentalData,
  ProviderCertification,
} from 'src/metadata/parentalMetadata';

const TMDB_API_KEY = Config.TMDB_API_KEY;

/**
 * Converts null, undefined, or empty string values to null.
 * Used for TMDB API response fields where an empty string from the API
 * should be treated as absent (null) rather than as a meaningful value.
 */
const emptyOrNullToNull = <T>(value: T | null | undefined): T | null =>
  value == null || value === '' ? null : value;

/** Minimum vote count required to include a TMDB similar item in results. */
const TMDB_SIMILAR_MINIMUM_VOTE_COUNT = 10;

type PosterSize =
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'original';

const getPosterUrl = (p: string, size: PosterSize = 'original') => {
  return urljoin('https://image.tmdb.org/t/p/', size, path.basename(p));
};

/**
 * Maps a TMDB movie release region to the appropriate content rating system.
 *
 * TMDB movie certifications use region-specific systems. US uses MPAA,
 * GB uses BBFC, AU uses ACB, DE uses FSK. For unrecognized regions, the
 * label is tested against MPAA as a fallback since TMDB US ratings are the
 * most common.
 */
const tmdbMovieRatingSystemForRegion = (
  region: string,
  _label: string
): string | null => {
  switch (region) {
    case 'US':
      return 'MPAA';
    case 'GB':
      return 'BBFC';
    case 'AU':
      return 'ACB';
    case 'DE':
      return 'FSK';
    default:
      return null;
  }
};

/**
 * Maps a TMDB TV content rating region to the appropriate rating system.
 *
 * TMDB TV content ratings use region-specific systems. US uses the TV-PG
 * system (TV-Y, TV-G, TV-PG, TV-14, TV-MA), GB uses BBFC, AU uses ACB,
 * DE uses FSK.
 */
const tmdbTvRatingSystemForRegion = (
  region: string,
  _label: string
): string | null => {
  switch (region) {
    case 'US':
      return 'TV-PG';
    case 'GB':
      return 'BBFC';
    case 'AU':
      return 'ACB';
    case 'DE':
      return 'FSK';
    default:
      return null;
  }
};

abstract class TMDb extends MetadataProvider {
  readonly name = 'tmdb';

  protected async fetchTmdbSimilar(
    tmdbId: number,
    mediaType: 'movie' | 'tv'
  ): Promise<SimilarItem[]> {
    const endpointPath = `/3/${mediaType}/${tmdbId}/similar`;
    const url = `https://api.themoviedb.org${endpointPath}`;

    let response: { data: TMDbApi.SimilarResponse; status: number };

    try {
      response = await axios.get<TMDbApi.SimilarResponse>(url, {
        params: { api_key: TMDB_API_KEY },
      });
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; headers?: Record<string, string> };
      };
      const status = axiosError?.response?.status;

      if (status === 429) {
        const retryAfter = axiosError?.response?.headers?.['retry-after'];
        logger.warn(
          `TMDB rate limit hit on ${endpointPath}. Retry-After: ${retryAfter ?? 'unknown'}`
        );
        return [];
      }

      throw new Error(
        `TMDB API request failed with HTTP ${status ?? 'unknown'} for ${endpointPath}`
      );
    }

    return response.data.results
      .filter((item) => item.vote_count >= TMDB_SIMILAR_MINIMUM_VOTE_COUNT)
      .map((item): SimilarItem | null => {
        const title = mediaType === 'movie' ? item.title : item.name;

        if (!title) {
          return null;
        }

        let externalRating: number | null = item.vote_average;

        if (externalRating === 0) {
          externalRating = null;
        }

        if (
          externalRating !== null &&
          (externalRating < 0 || externalRating > 10)
        ) {
          externalRating = null;
        }

        return {
          externalId: String(item.id),
          mediaType,
          title,
          externalRating,
        };
      })
      .filter((item): item is SimilarItem => item !== null);
  }

  protected mapItem(
    response:
      | Partial<TMDbApi.TvDetailsResponse>
      | Partial<TMDbApi.MovieDetailsResponse>
  ): MediaItemForProvider {
    return {
      source: this.name,
      mediaType: this.mediaType,
      title: '',
      externalBackdropUrl: response.backdrop_path
        ? getPosterUrl(response.backdrop_path)
        : definedOrUndefined(response.backdrop_path),
      externalPosterUrl: response.poster_path
        ? getPosterUrl(response.poster_path)
        : definedOrUndefined(response.poster_path),
      tmdbId: response.id,
      overview: definedOrUndefined(response.overview),
      status: definedOrUndefined(response.status),
      url: definedOrUndefined(response.homepage),
      genres: response.genres?.map((genre) => genre.name),
    };
  }
}

export class TMDbMovie extends TMDb {
  readonly mediaType = 'movie';

  override async search(query: string): Promise<MediaItemForProvider[]> {
    const res = await axios.get<TMDbApi.MovieSearchResponse>(
      'https://api.themoviedb.org/3/search/movie',
      {
        params: {
          api_key: TMDB_API_KEY,
          query: query,
          language: GlobalConfiguration.configuration.tmdbLang,
        },
      }
    );
    return res.data.results.map((item) => ({
      ...this.mapMovie(item),
      needsDetails: true,
    }));
  }

  override async details(mediaItem: ExternalIds): Promise<MediaItemForProvider> {
    if (!mediaItem.tmdbId) {
      throw new Error('TMDbMovie.details requires a tmdbId');
    }

    const res = await axios.get<TMDbApi.MovieDetailsResponse>(
      `https://api.themoviedb.org/3/movie/${mediaItem.tmdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          language: GlobalConfiguration.configuration.tmdbLang,
          append_to_response: 'credits,release_dates',
        },
      }
    );

    const movie = this.mapMovie(res.data);
    movie.needsDetails = false;

    return movie;
  }

  override async similar(ids: ExternalIds): Promise<SimilarItem[]> {
    if (!ids.tmdbId) {
      logger.warn(`TMDbMovie.similar: no tmdbId provided — returning empty results`);
      return [];
    }
    return this.fetchTmdbSimilar(ids.tmdbId, 'movie');
  }

  override async localizedDetails(
    ids: ExternalIds,
    language: string
  ): Promise<MediaItemForProvider | undefined> {
    if (!ids.tmdbId) {
      return undefined;
    }

    const res = await axios.get<TMDbApi.MovieDetailsResponse>(
      `https://api.themoviedb.org/3/movie/${ids.tmdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          language: language,
        },
      }
    );

    const movie = this.mapMovie(res.data);

    // Localized details must NOT set originalTitle — preserve base details() responsibility
    delete movie.originalTitle;

    // Convert empty strings to null
    if (movie.title === '') movie.title = null as unknown as string;
    if (movie.overview === '') movie.overview = null as unknown as string;
    if (movie.genres != null && movie.genres.length === 0)
      movie.genres = null as unknown as string[];

    return movie;
  }

  async findByImdbId(imdbId: string): Promise<MediaItemForProvider | undefined> {
    const res = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
      params: {
        api_key: TMDB_API_KEY,
        external_source: 'imdb_id',
        language: GlobalConfiguration.configuration.tmdbLang,
      },
    });

    if (res.data.movie_results?.length === 0) {
      return undefined;
    }

    return {
      ...this.mapMovie(res.data.movie_results[0]),
      imdbId: imdbId,
      needsDetails: true,
    };
  }

  async findByTmdbId(tmdbId: number): Promise<MediaItemForProvider> {
    return this.details({ tmdbId: tmdbId });
  }

  private mapMovie(item: Partial<TMDbApi.MovieDetailsResponse>) {
    const movie = this.mapItem(item);
    movie.imdbId = item.imdb_id || undefined;
    movie.originalTitle = definedOrUndefined(item.original_title);
    movie.releaseDate = definedOrUndefined(item.release_date);
    movie.title = item.title ?? item.original_title ?? '';
    movie.runtime = item.runtime;
    movie.tmdbRating = item.vote_average;
    movie.director =
      item.credits?.crew
        ?.filter((c) => c.job === 'Director')
        .map((c) => c.name)
        .join(', ') || undefined;

    // Normalize parental metadata from release_dates certifications.
    // TMDB returns release_dates as a map of region → array of release entries,
    // where each entry may have a certification string and descriptors.
    const certifications: ProviderCertification[] = [];
    if (item.release_dates?.results) {
      for (const regionEntry of item.release_dates.results) {
        const region = regionEntry.iso_3166_1;
        for (const release of regionEntry.release_dates) {
          if (!release.certification || release.certification.trim() === '') {
            continue;
          }
          const cert = release.certification.trim();
          // Determine the rating system for this region.
          // US theatrical releases use MPAA; GB uses BBFC; AU uses ACB; others mapped by label.
          const system = tmdbMovieRatingSystemForRegion(region, cert);
          if (!system) {
            continue;
          }
          certifications.push({
            region,
            system,
            label: cert,
            descriptors:
              release.descriptors && release.descriptors.length > 0
                ? release.descriptors
                : null,
          });
        }
      }
    }

    const parental = normalizeParentalData(certifications, {
      adultFlag: item.adult === true,
    });

    movie.minimumAge = parental.minimumAge;
    movie.contentRatingSystem = parental.contentRatingSystem;
    movie.contentRatingRegion = parental.contentRatingRegion;
    movie.contentRatingLabel = parental.contentRatingLabel;
    movie.contentRatingDescriptors = parental.contentRatingDescriptors;
    movie.parentalGuidanceSummary = parental.parentalGuidanceSummary;
    movie.parentalGuidanceCategories = parental.parentalGuidanceCategories;

    return movie;
  }
}

export class TMDbTv extends TMDb {
  readonly mediaType = 'tv';

  override async search(query: string): Promise<MediaItemForProvider[]> {
    const res = await axios.get<TMDbApi.TvSearchResponse>(
      'https://api.themoviedb.org/3/search/tv',
      {
        params: {
          api_key: TMDB_API_KEY,
          query: query,
          language: GlobalConfiguration.configuration.tmdbLang,
        },
      }
    );

    return res.data.results.map((item) => ({
      ...this.mapTvShow(item),
      needsDetails: true,
    }));
  }

  override async details(mediaItem: ExternalIds): Promise<MediaItemForProvider> {
    if (!mediaItem.tmdbId) {
      throw new Error('TMDbTv.details requires a tmdbId');
    }

    const res = await axios.get<TMDbApi.TvDetailsResponse>(
      `https://api.themoviedb.org/3/tv/${mediaItem.tmdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          append_to_response: 'external_ids,content_ratings',
          language: GlobalConfiguration.configuration.tmdbLang,
        },
      }
    );

    const tvShow = this.mapTvShow(res.data);

    await Promise.all(
      (tvShow.seasons ?? []).map(async (season) => {
        const res = await axios.get<TMDbApi.SeasonDetailsResponse>(
          `https://api.themoviedb.org/3/tv/${mediaItem.tmdbId}/season/${season.seasonNumber}`,
          {
            params: {
              api_key: TMDB_API_KEY,
              append_to_response: 'external_ids',
              language: GlobalConfiguration.configuration.tmdbLang,
            },
          }
        );

        season.tvdbId = res.data.external_ids?.tvdb_id;
        season.episodes =
          res.data.episodes?.map((item) => this.mapEpisode(item)) || [];
        return season;
      })
    );

    tvShow.needsDetails = false;

    return tvShow;
  }

  override async localizedDetails(
    ids: ExternalIds,
    language: string
  ): Promise<MediaItemForProvider | undefined> {
    if (!ids.tmdbId) {
      return undefined;
    }

    const res = await axios.get<TMDbApi.TvDetailsResponse>(
      `https://api.themoviedb.org/3/tv/${ids.tmdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          language: language,
        },
      }
    );

    const tvShow = this.mapTvShow(res.data);

    await Promise.all(
      (tvShow.seasons ?? []).map(async (season) => {
        try {
          const seasonRes = await axios.get<TMDbApi.SeasonDetailsResponse>(
            `https://api.themoviedb.org/3/tv/${ids.tmdbId}/season/${season.seasonNumber}`,
            {
              params: {
                api_key: TMDB_API_KEY,
                language: language,
              },
            }
          );

          season.episodes =
            seasonRes.data.episodes?.map((item) => this.mapEpisode(item)) || [];
        } catch (error) {
          logger.error(
            `TMDbTv.localizedDetails: failed to fetch season ${season.seasonNumber} for tmdbId ${ids.tmdbId} in language ${language}: ${error}`,
            { err: error }
          );
          season.episodes = [];
        }

        return season;
      })
    );

    // Localized details must NOT set originalTitle — preserve base details() responsibility
    delete tvShow.originalTitle;

    // Convert empty strings to null for title, overview, and genres
    if (tvShow.title === '') tvShow.title = null as unknown as string;
    if (tvShow.overview === '') tvShow.overview = null as unknown as string;
    if (tvShow.genres != null && tvShow.genres.length === 0)
      tvShow.genres = null as unknown as string[];

    // Convert empty strings to null for season and episode fields
    if (tvShow.seasons) {
      for (const season of tvShow.seasons) {
        if (season.title === '') season.title = null as unknown as string;
        if (season.description === '') season.description = null as unknown as string;

        if (season.episodes) {
          for (const episode of season.episodes) {
            if (episode.title === '') episode.title = null as unknown as string;
            if (episode.description === '') episode.description = null as unknown as string;
          }
        }
      }
    }

    return tvShow;
  }

  override async similar(ids: ExternalIds): Promise<SimilarItem[]> {
    if (!ids.tmdbId) {
      logger.warn(`TMDbTv.similar: no tmdbId provided — returning empty results`);
      return [];
    }
    return this.fetchTmdbSimilar(ids.tmdbId, 'tv');
  }

  async findByImdbId(imdbId: string): Promise<MediaItemForProvider | undefined> {
    const res = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
      params: {
        api_key: TMDB_API_KEY,
        external_source: 'imdb_id',
        language: GlobalConfiguration.configuration.tmdbLang,
      },
    });

    if (res.data.tv_results?.length === 0) {
      return undefined;
    }

    return {
      ...this.mapTvShow(res.data.tv_results[0]),
      imdbId: imdbId,
      needsDetails: true,
    };
  }

  async findByTvdbId(tvdbId: number): Promise<MediaItemForProvider | undefined> {
    const res = await axios.get(`https://api.themoviedb.org/3/find/${tvdbId}`, {
      params: {
        api_key: TMDB_API_KEY,
        external_source: 'tvdb_id',
        language: GlobalConfiguration.configuration.tmdbLang,
      },
    });

    if (res.data.tv_results?.length === 0) {
      return undefined;
    }

    return {
      ...this.mapTvShow(res.data.tv_results[0]),
      tvdbId: tvdbId,
      needsDetails: true,
    };
  }

  async findByTmdbId(tmdbId: number): Promise<MediaItemForProvider> {
    return this.details({ tmdbId: tmdbId });
  }

  async findByEpisodeImdbId(episodeImdbId: string) {
    const res = await axios.get(
      `https://api.themoviedb.org/3/find/${episodeImdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          external_source: 'imdb_id',
          language: GlobalConfiguration.configuration.tmdbLang,
        },
      }
    );

    if (res.data.tv_episode_results?.length === 0) {
      return;
    }

    const episode = this.mapEpisode(res.data.tv_episode_results[0]);

    return {
      tvShowTmdbId: res.data.tv_episode_results[0].show_id as number,
      episode: episode,
    };
  }

  async findByEpisodeTvdbId(episodeTvdbId: number) {
    const res = await axios.get(
      `https://api.themoviedb.org/3/find/${episodeTvdbId}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          external_source: 'tvdb_id',
          language: GlobalConfiguration.configuration.tmdbLang,
        },
      }
    );

    if (res.data.tv_episode_results?.length === 0) {
      return;
    }

    const episode = this.mapEpisode(res.data.tv_episode_results[0]);

    return {
      tvShowTmdbId: res.data.tv_episode_results[0].show_id as number,
      episode: episode,
    };
  }

  private mapTvShow(item: Partial<TMDbApi.TvDetailsResponse>) {
    const tvShow = this.mapItem(item);
    tvShow.imdbId = item.external_ids?.imdb_id || undefined;
    tvShow.tvdbId = item.external_ids?.tvdb_id || undefined;
    tvShow.title = item.name ?? item.original_name ?? '';
    tvShow.originalTitle = definedOrUndefined(item.original_name);
    tvShow.releaseDate = definedOrUndefined(item.first_air_date);
    tvShow.numberOfSeasons = item.number_of_seasons;
    tvShow.tmdbRating = item.vote_average;
    tvShow.creator = item.created_by?.map((c) => c.name).join(', ') || undefined;
    tvShow.network = item.networks?.[0]?.name;
    tvShow.runtime = item.episode_run_time?.[0];

    tvShow.seasons = item.seasons?.map((item) => {
      return {
        tmdbId: item.id,
        title: item.name,
        description: emptyOrNullToNull(item.overview),
        externalPosterUrl: item.poster_path
          ? getPosterUrl(item.poster_path)
          : undefined,
        seasonNumber: item.season_number,
        numberOfEpisodes: item.episode_count,
        releaseDate: emptyOrNullToNull(item.air_date),
        isSpecialSeason: item.season_number === 0,
      };
    });

    // Normalize parental metadata from content_ratings.
    // TMDB TV content_ratings returns a list of { iso_3166_1, rating } entries
    // where the rating is a TV content rating label for that country.
    const certifications: ProviderCertification[] = [];
    if (item.content_ratings?.results) {
      for (const entry of item.content_ratings.results) {
        const region = entry.iso_3166_1;
        if (!entry.rating || entry.rating.trim() === '') {
          continue;
        }
        const label = entry.rating.trim();
        const system = tmdbTvRatingSystemForRegion(region, label);
        if (!system) {
          continue;
        }
        certifications.push({ region, system, label });
      }
    }

    const parental = normalizeParentalData(certifications, {
      adultFlag: item.adult === true,
    });

    tvShow.minimumAge = parental.minimumAge;
    tvShow.contentRatingSystem = parental.contentRatingSystem;
    tvShow.contentRatingRegion = parental.contentRatingRegion;
    tvShow.contentRatingLabel = parental.contentRatingLabel;
    tvShow.contentRatingDescriptors = parental.contentRatingDescriptors;
    tvShow.parentalGuidanceSummary = parental.parentalGuidanceSummary;
    tvShow.parentalGuidanceCategories = parental.parentalGuidanceCategories;

    return tvShow;
  }

  private mapEpisode(item: TMDbApi.Episode) {
    return {
      title: item.name,
      description: emptyOrNullToNull(item.overview),
      episodeNumber: item.episode_number,
      seasonNumber: item.season_number,
      releaseDate: emptyOrNullToNull(item.air_date),
      isSpecialEpisode: item.season_number === 0,
      tmdbId: item.id,
    };
  }
}

namespace TMDbApi {
  export interface SimilarResultItem {
    id: number;
    title?: string;
    name?: string;
    vote_average: number;
    vote_count: number;
  }

  export interface SimilarResponse {
    page: number;
    results: SimilarResultItem[];
    total_pages: number;
    total_results: number;
  }

  export interface SeasonDetailsResponse {
    _id: string;
    air_date: string;
    episodes: Episode[];
    name: string;
    overview: string;
    id: number;
    poster_path: string;
    season_number: number;
    external_ids?: {
      freebase_mid?: string;
      freebase_id?: string;
      tvdb_id?: number;
      tvrage_id?: number;
    };
  }

  export interface Episode {
    air_date: string;
    episode_number: number;
    crew: Crew[];
    guest_stars: GuestStar[];
    id: number;
    name: string;
    overview: string;
    production_code: string;
    season_number: number;
    still_path: string;
    vote_average: number;
    vote_count: number;
  }

  export interface Crew {
    department: string;
    job: string;
    credit_id: string;
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path?: string;
  }

  export interface GuestStar {
    credit_id: string;
    order: number;
    character: string;
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path?: string;
  }

  export interface TvDetailsResponse {
    adult?: boolean;
    backdrop_path: string;
    created_by: CreatedBy[];
    episode_run_time: number[];
    first_air_date: string;
    genres: Genre[];
    homepage: string;
    id: number;
    in_production: boolean;
    languages: string[];
    last_air_date: string;
    last_episode_to_air: LastEpisodeToAir;
    name: string;
    next_episode_to_air: unknown;
    networks: Network[];
    number_of_episodes: number;
    number_of_seasons: number;
    origin_country: string[];
    original_language: string;
    original_name: string;
    overview: string;
    popularity: number;
    poster_path: string;
    production_companies: ProductionCompany[];
    production_countries: ProductionCountry[];
    seasons: Season[];
    spoken_languages: SpokenLanguage[];
    status: string;
    tagline: string;
    type: string;
    vote_average: number;
    vote_count: number;
    external_ids?: {
      imdb_id?: string;
      freebase_mid?: string;
      freebase_id?: string;
      tvdb_id?: number;
      tvrage_id?: number;
      facebook_id?: string;
      instagram_id?: string;
      twitter_id?: string;
      id: number;
    };
    content_ratings?: TvContentRatings;
  }

  export interface CreatedBy {
    id: number;
    credit_id: string;
    name: string;
    gender: number;
    profile_path: string;
  }

  export interface LastEpisodeToAir {
    air_date: string;
    episode_number: number;
    id: number;
    name: string;
    overview: string;
    production_code: string;
    season_number: number;
    still_path: string;
    vote_average: number;
    vote_count: number;
  }

  export interface Network {
    name: string;
    id: number;
    logo_path: string;
    origin_country: string;
  }

  export interface Season {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
  }

  export interface TvSearchResponse {
    page: number;
    results: {
      poster_path: string;
      popularity: number;
      id: number;
      backdrop_path: string;
      vote_average: number;
      overview: string;
      first_air_date: string;
      origin_country: string[];
      genre_ids: number[];
      original_language: string;
      vote_count: number;
      name: string;
      original_name: string;
    }[];
    total_results: number;
    total_pages: number;
  }

  export interface MovieSearchResponse {
    page: number;
    results: {
      poster_path?: string;
      adult: boolean;
      overview: string;
      release_date: string;
      genre_ids: number[];
      id: number;
      original_title: string;
      original_language: string;
      title: string;
      backdrop_path?: string;
      popularity: number;
      vote_count: number;
      video: boolean;
      vote_average: number;
    }[];
    total_results: number;
    total_pages: number;
  }

  /** A single release entry within a region's release_dates result. */
  export interface MovieReleaseEntry {
    certification: string;
    descriptors: string[];
    iso_639_1: string;
    note?: string;
    release_date: string;
    /** Release type: 1=Premiere, 2=Limited, 3=Theatrical, 4=Digital, 5=Physical, 6=TV */
    type: number;
  }

  /** A per-region entry in the movie release_dates append_to_response. */
  export interface MovieReleaseDatesRegion {
    iso_3166_1: string;
    release_dates: MovieReleaseEntry[];
  }

  /** The release_dates append_to_response payload for movies. */
  export interface MovieReleaseDates {
    results: MovieReleaseDatesRegion[];
  }

  /** A single content rating entry in the TV content_ratings append_to_response. */
  export interface TvContentRatingEntry {
    descriptors?: string[];
    iso_3166_1: string;
    rating: string;
  }

  /** The content_ratings append_to_response payload for TV shows. */
  export interface TvContentRatings {
    results: TvContentRatingEntry[];
  }

  export interface MovieDetailsResponse {
    adult: boolean;
    backdrop_path: string;
    budget: number;
    genres: Genre[];
    homepage: string;
    id: number;
    imdb_id: string;
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    production_companies: ProductionCompany[];
    production_countries: ProductionCountry[];
    release_date: string;
    revenue: number;
    runtime: number;
    spoken_languages: SpokenLanguage[];
    status: string;
    tagline: string;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
    credits?: { crew: Crew[] };
    release_dates?: MovieReleaseDates;
  }

  export interface Genre {
    id: number;
    name: string;
  }

  export interface ProductionCompany {
    id: number;
    logo_path?: string;
    name: string;
    origin_country: string;
  }

  export interface ProductionCountry {
    iso_3166_1: string;
    name: string;
  }

  export interface SpokenLanguage {
    iso_639_1: string;
    name: string;
  }

  export interface ErrorResponse {
    status_code: number;
    status_message: string;
  }

  export interface Configuration {
    images: Images;
    change_keys: string[];
  }

  export interface Images {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  }

  export interface FindByExternalIds {
    movie_results: MovieSearchResponse[];
    tv_results: TvSearchResponse[];
  }
}
