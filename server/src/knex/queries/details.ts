import _ from 'lodash';
import { parseISO } from 'date-fns';

import { MediaItemBase, MediaItemDetailsResponse } from 'src/entity/mediaItem';
import { TvEpisode, TvEpisodeFilters } from 'src/entity/tvepisode';
import { UserRating, UserRatingFilters } from 'src/entity/userRating';
import { TvSeason } from 'src/entity/tvseason';
import { Seen, SeenFilters } from 'src/entity/seen';
import { Database } from 'src/dbconfig';
import { List } from 'src/entity/list';
import { Progress } from 'src/entity/progress';
import { splitCreatorField } from 'src/utils/normalizeCreators';
import {
  getMediaItemTranslations,
  getSeasonTranslations,
  getEpisodeTranslations,
} from 'src/repository/translationRepository';
import {
  deserializeDescriptors,
  deserializeCategories,
} from 'src/metadata/parentalMetadata';

// ---------------------------------------------------------------------------
// Private types
// ---------------------------------------------------------------------------

type DetailsData = {
  mediaItem: MediaItemBase | undefined;
  seasons: TvSeason[];
  episodes: TvEpisode[];
  seenHistory: Seen[];
  userRating: UserRating[];
  lists: (List & { seasonId: number; episodeId: number })[];
  progress: Progress[];
};

type GroupedRatingsAndHistory = {
  groupedSeasonRating: Record<number, UserRating | null>;
  groupedEpisodesRating: Record<number, UserRating | null>;
  groupedEpisodesSeenHistory: Record<number, Seen[]>;
};

type EnrichedSeasonsResult = {
  seasonsWithPosters: (TvSeason & {
    isSpecialSeason: boolean;
    poster: string | null;
    posterSmall: string | null;
    episodes: TvEpisode[];
    userRating: UserRating | null;
    seen: boolean;
  })[];
  firstUnwatchedEpisode: TvEpisode | undefined;
  upcomingEpisode: TvEpisode | undefined;
  lastAiredEpisode: TvEpisode | undefined;
  unseenEpisodesCount: number;
  numberOfEpisodes: number;
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Loads all raw rows needed for the details response in a single transaction.
 */
const fetchDetailsData = async (
  mediaItemId: number,
  userId: number
): Promise<DetailsData> => {
  return Database.knex.transaction(async (trx) => {
    const mediaItem = await trx<MediaItemBase>('mediaItem')
      .where({ id: mediaItemId })
      .first();

    const seasons = await trx<TvSeason>('season')
      .where({ tvShowId: mediaItemId })
      .orderBy('seasonNumber', 'asc');

    const episodes = await trx<TvEpisode>('episode')
      .where({ tvShowId: mediaItemId })
      .orderBy('seasonNumber', 'asc')
      .orderBy('episodeNumber', 'asc');

    const seenHistory = await trx<Seen>('seen')
      .where({ mediaItemId, userId })
      .orderBy('date', 'desc');

    const userRating = await trx<UserRating>('userRating')
      .where({ mediaItemId, userId })
      .orderBy('date', 'desc');

    const lists: (List & {
      seasonId: number;
      episodeId: number;
    })[] = await trx<List>('list')
      .select('list.*', 'seasonId', 'episodeId')
      .innerJoin('listItem', (qb) =>
        qb.onVal('mediaItemId', mediaItemId).on('list.id', 'listItem.listId')
      )
      .where('userId', userId);

    const progress = await trx<Progress>('progress').where({
      mediaItemId,
      episodeId: null,
      userId,
    });

    return { mediaItem, seasons, episodes, seenHistory, userRating, lists, progress };
  });
};

/**
 * Indexes user ratings and seen-history by their respective entity IDs so that
 * individual episode/season objects can be enriched in O(1) lookups.
 */
const groupRatingsAndSeenHistory = (
  userRating: UserRating[],
  seenHistory: Seen[]
): GroupedRatingsAndHistory => {
  const groupedSeasonRating: Record<number, UserRating | null> = {};
  _(userRating)
    .filter(UserRatingFilters.seasonUserRating)
    .groupBy((rating) => rating.seasonId)
    .forEach((ratings, seasonId) => {
      const key = Number(seasonId);
      if (!Number.isNaN(key)) {
        groupedSeasonRating[key] = ratings?.length > 0 ? ratings[0] ?? null : null;
      }
    });

  const groupedEpisodesRating: Record<number, UserRating | null> = {};
  _(userRating)
    .filter(UserRatingFilters.episodeUserRating)
    .groupBy((rating) => rating.episodeId)
    .forEach((ratings, episodeId) => {
      const key = Number(episodeId);
      if (!Number.isNaN(key)) {
        groupedEpisodesRating[key] = ratings?.length > 0 ? ratings[0] ?? null : null;
      }
    });

  const groupedEpisodesSeenHistory: Record<number, Seen[]> = {};
  _(seenHistory)
    .filter(SeenFilters.episodeSeenValue)
    .groupBy((seen) => seen.episodeId)
    .forEach((entries, episodeId) => {
      const key = Number(episodeId);
      if (!Number.isNaN(key)) {
        groupedEpisodesSeenHistory[key] = entries;
      }
    });

  return { groupedSeasonRating, groupedEpisodesRating, groupedEpisodesSeenHistory };
};

/**
 * Strips per-episode user-specific fields (userRating, seenHistory, lastSeenAt)
 * from special episode references. These episode objects were mutated in the
 * episodes.forEach loop with concrete fallback values (null / []) for
 * strict-mode safety, but when surfaced as firstUnwatchedEpisode /
 * upcomingEpisode / lastAiredEpisode they should carry undefined — consistent
 * with the items.ts (mapRawResult) code path which explicitly sets them to
 * undefined.
 */
const stripEpisodeUserFields = (
  episode: TvEpisode | undefined
): TvEpisode | undefined => {
  if (!episode) {
    return undefined;
  }
  return {
    ...episode,
    userRating: undefined,
    seenHistory: undefined,
    lastSeenAt: undefined,
  };
};

/**
 * Mutates each episode in-place to attach user-specific fields, then builds
 * the full seasons array (with posters, seen status, and nested episodes) and
 * derives the episode-level aggregate values used by the response.
 */
const enrichEpisodesAndSeasons = (
  episodes: TvEpisode[],
  seasons: TvSeason[],
  grouped: GroupedRatingsAndHistory
): EnrichedSeasonsResult => {
  const { groupedSeasonRating, groupedEpisodesRating, groupedEpisodesSeenHistory } =
    grouped;

  episodes.forEach((episode) => {
    if (episode.id != null) {
      episode.userRating = groupedEpisodesRating[episode.id] ?? null;
      episode.seenHistory = groupedEpisodesSeenHistory[episode.id] ?? [];
    } else {
      episode.userRating = null;
      episode.seenHistory = [];
    }
    episode.isSpecialEpisode = Boolean(episode.isSpecialEpisode);
    episode.lastSeenAt = _.first(episode.seenHistory)?.date;
    episode.seen = episode.seenHistory.length > 0;
    delete episode.seasonAndEpisodeNumber;
  });

  const groupedEpisodes = _.groupBy(
    episodes.filter((episode) => episode.seasonId != null),
    (episode) => episode.seasonId as number
  );

  const seasonsWithPosters = seasons.map((season) => {
    const seasonEpisodes = season.id != null ? groupedEpisodes[season.id] ?? [] : [];
    const releasedEpisodes = seasonEpisodes
      .filter(TvEpisodeFilters.withReleaseDateEpisodes)
      .filter(TvEpisodeFilters.releasedEpisodes);

    return {
      ...season,
      isSpecialSeason: Boolean(season.isSpecialSeason),
      poster: season.posterId ? `/img/${season.posterId}` : null,
      posterSmall: season.posterId ? `/img/${season.posterId}?size=small` : null,
      episodes: seasonEpisodes,
      userRating: season.id != null ? groupedSeasonRating[season.id] ?? null : null,
      seen:
        releasedEpisodes.length > 0 &&
        releasedEpisodes.filter(TvEpisodeFilters.unwatchedEpisodes).length === 0,
    };
  });

  const firstUnwatchedEpisode = stripEpisodeUserFields(
    _(episodes)
      .filter(TvEpisodeFilters.unwatchedEpisodes)
      .filter(TvEpisodeFilters.releasedEpisodes)
      .filter(TvEpisodeFilters.nonSpecialEpisodes)
      .minBy((episode) => episode.seasonNumber * 1000 + episode.episodeNumber)
  );

  const upcomingEpisode = stripEpisodeUserFields(
    _(episodes)
      .filter(TvEpisodeFilters.withReleaseDateEpisodes)
      .filter(TvEpisodeFilters.nonSpecialEpisodes)
      .filter(TvEpisodeFilters.unreleasedEpisodes)
      .minBy((episode) => parseISO(episode.releaseDate!).getTime())
  );

  const lastAiredEpisode = stripEpisodeUserFields(
    _(episodes)
      .filter(TvEpisodeFilters.withReleaseDateEpisodes)
      .filter(TvEpisodeFilters.nonSpecialEpisodes)
      .filter(TvEpisodeFilters.releasedEpisodes)
      .maxBy((episode) => parseISO(episode.releaseDate!).getTime())
  );

  const unseenEpisodesCount = _(episodes)
    .filter(TvEpisodeFilters.nonSpecialEpisodes)
    .filter(TvEpisodeFilters.withReleaseDateEpisodes)
    .filter(TvEpisodeFilters.releasedEpisodes)
    .filter(TvEpisodeFilters.unwatchedEpisodes)
    .value().length;

  const numberOfEpisodes = _(episodes)
    .filter(TvEpisodeFilters.nonSpecialEpisodes)
    .filter(TvEpisodeFilters.withReleaseDateEpisodes)
    .filter(TvEpisodeFilters.releasedEpisodes)
    .value().length;

  return {
    seasonsWithPosters,
    firstUnwatchedEpisode,
    upcomingEpisode,
    lastAiredEpisode,
    unseenEpisodesCount,
    numberOfEpisodes,
  };
};

/**
 * Resolves the single progress value from the raw progress rows.
 * Returns the highest-progress entry on the most-recent date, or undefined when
 * fully complete (progress === 1).
 */
const resolveProgress = (progress: Progress[]): number | null => {
  const progressGroupedByDate = _(progress).groupBy('date');
  const latestProgressDate = progressGroupedByDate.keys().max();
  const progressValue = _.maxBy(
    latestProgressDate != null
      ? progressGroupedByDate.get(latestProgressDate) ?? []
      : [],
    'progress'
  )?.progress;

  return progressValue !== 1 ? progressValue ?? null : null;
};

/**
 * Overlays translations for a TV show's seasons and their nested episodes.
 * Returns the updated seasons array; the caller reassigns it to the response.
 */
const overlaySeasonAndEpisodeTranslations = async (
  seasons: MediaItemDetailsResponse['seasons'],
  language: string
): Promise<MediaItemDetailsResponse['seasons']> => {
  if (!seasons || seasons.length === 0) {
    return seasons;
  }

  const seasonIds = seasons
    .map((s) => s.id)
    .filter((id): id is number => id != null);

  const allEpisodeIds: number[] = [];
  for (const season of seasons) {
    if (season.episodes) {
      for (const ep of season.episodes) {
        if (ep.id != null) {
          allEpisodeIds.push(ep.id);
        }
      }
    }
  }

  const [seasonTranslationMap, episodeTranslationMap] = await Promise.all([
    getSeasonTranslations(seasonIds, language),
    getEpisodeTranslations(allEpisodeIds, language),
  ]);

  return seasons.map((season) => {
    const seasonTranslation =
      season.id != null ? seasonTranslationMap.get(season.id) : undefined;

    const updatedSeason = { ...season, metadataLanguage: null as string | null };
    if (seasonTranslation) {
      if (seasonTranslation.title != null) {
        updatedSeason.title = seasonTranslation.title;
      }
      if (seasonTranslation.description != null) {
        updatedSeason.description = seasonTranslation.description;
      }
      updatedSeason.metadataLanguage = language;
    }

    if (updatedSeason.episodes) {
      updatedSeason.episodes = updatedSeason.episodes.map((episode) => {
        const episodeTranslation =
          episode.id != null ? episodeTranslationMap.get(episode.id) : undefined;

        if (!episodeTranslation) {
          return { ...episode, metadataLanguage: null as string | null };
        }

        const updatedEpisode = { ...episode, metadataLanguage: null as string | null };
        if (episodeTranslation.title != null) {
          updatedEpisode.title = episodeTranslation.title;
        }
        if (episodeTranslation.description != null) {
          updatedEpisode.description = episodeTranslation.description;
        }
        updatedEpisode.metadataLanguage = language;
        return updatedEpisode;
      });
    }

    return updatedSeason;
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getDetailsKnex = async (params: {
  mediaItemId: number;
  userId: number;
  language?: string | null;
}): Promise<MediaItemDetailsResponse> => {
  const { mediaItemId, userId, language } = params;

  const { mediaItem, seasons, episodes, seenHistory, userRating, lists, progress } =
    await fetchDetailsData(mediaItemId, userId);

  if (!mediaItem) {
    throw new Error(`Media item ${mediaItemId} not found`);
  }

  const grouped = groupRatingsAndSeenHistory(userRating, seenHistory);

  const {
    seasonsWithPosters,
    firstUnwatchedEpisode,
    upcomingEpisode,
    lastAiredEpisode,
    unseenEpisodesCount,
    numberOfEpisodes,
  } = enrichEpisodesAndSeasons(episodes, seasons, grouped);

  const mediaItemLists = lists.filter((row) => !row.seasonId && !row.episodeId);

  const nextAiring =
    mediaItem.mediaType === 'tv' ? upcomingEpisode?.releaseDate : mediaItem.releaseDate;

  const lastAiring =
    mediaItem.mediaType === 'tv' ? lastAiredEpisode?.releaseDate : mediaItem.releaseDate;

  const seen =
    mediaItem.mediaType === 'tv'
      ? numberOfEpisodes > 0 && unseenEpisodesCount === 0
      : seenHistory.length > 0;

  const totalRuntime = episodes?.reduce(
    (sum, episode) => sum + (episode.runtime ?? mediaItem.runtime ?? 0),
    0
  );

  const baseResponse: MediaItemDetailsResponse = {
    ...mediaItem,
    platform: mediaItem.platform
      ? JSON.parse(mediaItem.platform as unknown as string)
      : null,
    hasDetails: true,
    genres: (mediaItem.genres as unknown as string)?.split(','),
    narrators: splitCreatorField((mediaItem.narrators as unknown as string) || null),
    authors: splitCreatorField((mediaItem.authors as unknown as string) || null),
    contentRatingDescriptors: deserializeDescriptors(mediaItem.contentRatingDescriptors),
    parentalGuidanceCategories: deserializeCategories(
      mediaItem.parentalGuidanceCategories
    ),
    progress: resolveProgress(progress),
    seenHistory: seenHistory,
    seen: seen,
    seasons: seasonsWithPosters,
    upcomingEpisode: upcomingEpisode,
    lastAiredEpisode: lastAiredEpisode,
    firstUnwatchedEpisode: firstUnwatchedEpisode,
    userRating: userRating.find(UserRatingFilters.mediaItemUserRating) || null,
    onWatchlist: Boolean(mediaItemLists.find((list) => Boolean(list.isWatchlist))),
    unseenEpisodesCount: unseenEpisodesCount,
    nextAiring: nextAiring,
    lastAiring: lastAiring,
    numberOfEpisodes: numberOfEpisodes,
    lastSeenAt: _.first(seenHistory)?.date || null,
    poster: mediaItem.posterId ? `/img/${mediaItem.posterId}` : null,
    posterSmall: mediaItem.posterId ? `/img/${mediaItem.posterId}?size=small` : null,
    backdrop: mediaItem.backdropId ? `/img/${mediaItem.backdropId}` : null,
    lists: mediaItemLists.map(mapList),
    totalRuntime: totalRuntime || undefined,
    metadataLanguage: null,
  };

  if (!language) {
    return baseResponse;
  }

  // Overlay media-item-level translation
  const translationMap = await getMediaItemTranslations([mediaItemId], language);
  const translation = translationMap.get(mediaItemId);

  if (translation) {
    if (translation.title != null) {
      baseResponse.title = translation.title;
    }
    if (translation.overview != null) {
      baseResponse.overview = translation.overview;
    }
    if (translation.genres != null) {
      try {
        baseResponse.genres = JSON.parse(translation.genres);
      } catch {
        // If genres is not JSON (e.g., stored as CSV string), parse as CSV
        baseResponse.genres = translation.genres.split(',');
      }
    }
    baseResponse.metadataLanguage = language;
  }

  // Overlay season and episode translations for TV shows
  baseResponse.seasons = await overlaySeasonAndEpisodeTranslations(
    baseResponse.seasons,
    language
  );

  return baseResponse;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapList = (row: Record<string, any>): List => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  isWatchlist: Boolean(row.isWatchlist),
  allowComments: Boolean(row.allowComments),
  displayNumbers: Boolean(row.displayNumbers),
  privacy: row.privacy,
  updatedAt: row.updatedAt,
  userId: row.userId,
  description: row.description,
  sortBy: row.sortBy,
  sortOrder: row.sortOrder,
});
