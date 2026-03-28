import { Knex } from 'knex';
import { Database } from 'src/dbconfig';
import {
  List,
  ListItem,
  ListPrivacy,
  ListSortBy,
  ListSortOrder,
} from 'src/entity/list';
import { MediaItemItemsResponse, MediaType } from 'src/entity/mediaItem';
import { Progress } from 'src/entity/progress';
import { Seen } from 'src/entity/seen';
import { TvEpisode } from 'src/entity/tvepisode';
import { TvSeason } from 'src/entity/tvseason';
import { UserRating } from 'src/entity/userRating';
import { repository } from 'src/repository/repository';
import { applyAgeGatingFilter } from 'src/utils/ageEligibility';

export type ListDetailsResponse = Omit<List, 'userId'> & {
  totalRuntime: number;
  user: {
    id: number;
    username: string;
  };
};

export type ListItemsResponse = {
  id: number;
  listedAt: string;
  estimatedRating?: number;
  type: MediaType | 'season' | 'episode';
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}[];

// ---------------------------------------------------------------------------
// Private row-mapping helpers for ListRepository.items()
// ---------------------------------------------------------------------------

/**
 * Maps raw DB columns for a nullable episode sub-object (firstUnwatchedEpisode,
 * lastAiredEpisode, upcomingEpisode) that appears on both mediaItem and season.
 * Returns undefined when the presence-check field is null/falsy.
 */
const mapEpisodeSubObject = (
  row: Record<string, any>,
  prefix: string,
  tvShowId: number | null,
  presenceField?: string
): Record<string, any> | undefined => {
  const checkField = presenceField ?? `${prefix}.id`;
  if (row[checkField] === null || row[checkField] === undefined) {
    return undefined;
  }

  return {
    description: row[`${prefix}.description`],
    episodeNumber: row[`${prefix}.episodeNumber`],
    id: row[`${prefix}.id`],
    imdbId: row[`${prefix}.imdbId`],
    isSpecialEpisode: Boolean(row[`${prefix}.isSpecialEpisode`]),
    releaseDate: row[`${prefix}.releaseDate`],
    runtime: row[`${prefix}.runtime`] || null,
    seasonId: row[`${prefix}.seasonId`],
    seasonNumber: row[`${prefix}.seasonNumber`],
    title: row[`${prefix}.title`],
    tmdbId: row[`${prefix}.tmdbId`],
    traktId: row[`${prefix}.traktId`],
    tvdbId: row[`${prefix}.tvdbId`],
    tvShowId: row[`${prefix}.tvShowId`] ?? tvShowId,
  };
};

/**
 * Maps all `mediaItem.*` columns from a raw DB row into the MediaItemItemsResponse
 * shape expected by the API.
 */
const mapMediaItemFields = (
  row: Record<string, any>,
  userId: number
): Record<string, any> => {
  const mediaItemId: number = row['listItem.mediaItemId'];
  const isTv: boolean = row['mediaItem.mediaType'] === 'tv';

  return {
    airedEpisodesCount: row['mediaItem.airedEpisodesCount'],
    backdrop: row['mediaItem.backdropId']
      ? `/img/${row['mediaItem.backdropId']}`
      : undefined,
    genres: row['mediaItem.genres']?.split(',')?.sort(),
    id: mediaItemId,
    imdbId: row['mediaItem.imdbId'],
    lastTimeUpdated: row['mediaItem.lastTimeUpdated'],
    mediaType: row['mediaItem.mediaType'],
    network: row['mediaItem.network'],
    overview: row['mediaItem.overview'],
    poster: row['mediaItem.posterId']
      ? `/img/${row['mediaItem.posterId']}`
      : undefined,
    posterSmall: row['mediaItem.posterId']
      ? `/img/${row['mediaItem.posterId']}?size=small`
      : undefined,
    releaseDate: row['mediaItem.releaseDate'],
    runtime: row['mediaItem.runtime'] || null,
    source: row['mediaItem.source'],
    progress: row['mediaItem.progress'],
    status: row['mediaItem.status']?.toLowerCase(),
    title: row['mediaItem.title'],
    tmdbId: row['mediaItem.tmdbId'],
    tmdbRating: row['mediaItem.tmdbRating'] ?? undefined,
    platformRating: row['mediaItem.platformRating'] ?? undefined,
    platformSeen: Boolean(row['mediaItem.platformSeen']),
    traktId: row['mediaItem.traktId'],
    tvdbId: row['mediaItem.tvdbId'],
    url: row['mediaItem.url'],
    userRating: row['mediaItem.userRating.rating']
      ? {
          mediaItemId,
          date: row['mediaItem.userRating.date'],
          rating: row['mediaItem.userRating.rating'],
          userId,
        }
      : undefined,
    lastSeenAt: row['mediaItem.lastSeenAt'],
    totalRuntime:
      (isTv ? row['mediaItem.totalRuntime'] : row['mediaItem.runtime']) || null,
    seen: isTv
      ? row['mediaItem.airedEpisodesCount'] -
          row['mediaItem.seenEpisodesCount'] ===
        0
      : Boolean(row['mediaItem.lastSeen.mediaItemId']),
    seenEpisodesCount: row['mediaItem.seenEpisodesCount'],
    unseenEpisodesCount:
      isTv && row['mediaItem.airedEpisodesCount']
        ? row['mediaItem.airedEpisodesCount'] -
          row['mediaItem.seenEpisodesCount']
        : undefined,
    onWatchlist: Boolean(row['mediaItem.watchlist.id']),
    firstUnwatchedEpisode: mapEpisodeSubObject(
      row,
      'mediaItem.firstUnwatchedEpisode',
      mediaItemId
    ),
    lastAiredEpisode: mapEpisodeSubObject(
      row,
      'mediaItem.lastAiredEpisode',
      mediaItemId
    ),
    upcomingEpisode: mapEpisodeSubObject(
      row,
      'mediaItem.upcomingEpisode',
      mediaItemId
    ),
  };
};

/**
 * Maps all `season.*` columns from a raw DB row into the season sub-object.
 * Returns undefined when the list item does not reference a season.
 */
const mapSeasonFields = (
  row: Record<string, any>,
  userId: number
): Record<string, any> | undefined => {
  const seasonId: number | null = row['listItem.seasonId'];

  if (!seasonId) {
    return undefined;
  }

  const mediaItemId: number = row['listItem.mediaItemId'];

  return {
    id: seasonId,
    isSpecialSeason: Boolean(row['season.isSpecialSeason']),
    airedEpisodesCount: row['season.airedEpisodesCount'],
    seenEpisodesCount: row['season.seenEpisodesCount'],
    unseenEpisodesCount: row['season.airedEpisodesCount']
      ? row['season.airedEpisodesCount'] - row['season.seenEpisodesCount']
      : undefined,
    seen:
      row['season.airedEpisodesCount'] - row['season.seenEpisodesCount'] === 0,
    releaseDate: row['season.releaseDate'],
    seasonNumber: row['season.seasonNumber'],
    title: row['season.title'],
    tmdbId: row['season.tmdbId'],
    traktId: row['season.traktId'],
    tvdbId: row['season.tvdbId'],
    tvShowId: mediaItemId,
    totalRuntime: row['season.totalRuntime'] || null,
    userRating: row['season.userRating.rating']
      ? {
          mediaItemId,
          seasonId,
          date: row['season.userRating.date'],
          rating: row['season.userRating.rating'],
          userId,
        }
      : undefined,
    onWatchlist: Boolean(row['season.watchlist.id']),
    lastSeenAt: row['season.lastSeenAt'],
    // Presence is checked by episodeNumber rather than id for firstUnwatchedEpisode.
    firstUnwatchedEpisode: mapEpisodeSubObject(
      row,
      'season.firstUnwatchedEpisode',
      null,
      'season.firstUnwatchedEpisode.episodeNumber'
    ),
    lastAiredEpisode: mapEpisodeSubObject(
      row,
      'season.lastAiredEpisode',
      mediaItemId
    ),
  };
};

/**
 * Maps all `episode.*` columns from a raw DB row into the episode sub-object.
 * Returns undefined when the list item does not reference an episode.
 */
const mapEpisodeFields = (
  row: Record<string, any>,
  userId: number
): Record<string, any> | undefined => {
  const episodeId: number | null = row['listItem.episodeId'];

  if (!episodeId) {
    return undefined;
  }

  const mediaItemId: number = row['listItem.mediaItemId'];

  return {
    episodeNumber: row['episode.episodeNumber'],
    id: episodeId,
    imdbId: row['episode.imdbId'],
    isSpecialEpisode: Boolean(row['episode.isSpecialEpisode']),
    releaseDate: row['episode.releaseDate'],
    seasonNumber: row['episode.seasonNumber'],
    title: row['episode.title'],
    tmdbId: row['episode.tmdbId'],
    traktId: row['episode.traktId'],
    tvdbId: row['episode.tvdbId'],
    tvShowId: mediaItemId,
    seasonAndEpisodeNumber: row['episode.seasonAndEpisodeNumber'],
    progress: row['episode.progress'],
    runtime: row['episode.runtime'] || null,
    userRating: row['episode.userRating.rating']
      ? {
          mediaItemId,
          episodeId,
          date: row['episode.userRating.date'],
          rating: row['episode.userRating.rating'],
          userId,
        }
      : undefined,
    onWatchlist: Boolean(row['episode.watchlist.id']),
    lastSeenAt: row['episode.lastSeenAt'],
    seen: Boolean(row['episode.lastSeenAt']),
  };
};

/**
 * Transforms a single raw DB row (produced by ListRepository.items()) into the
 * ListItemsResponse element shape. Extracted to keep items() at low cyclomatic
 * complexity — all branching detail lives in the dedicated sub-mappers above.
 */
const mapListItemRow = (
  listItem: Record<string, any>,
  userId: number
): ListItemsResponse[number] => {
  const seasonFields = mapSeasonFields(listItem, userId);
  const episodeFields = mapEpisodeFields(listItem, userId);

  return {
    id: Number(listItem['listItem.id']),
    listedAt: new Date(listItem['listItem.addedAt']).toISOString(),
    estimatedRating: listItem['listItem.estimatedRating'] ?? undefined,
    type: listItem['listItem.seasonId']
      ? 'season'
      : listItem['listItem.episodeId']
      ? 'episode'
      : listItem['mediaItem.mediaType'],
    mediaItem: mapMediaItemFields(listItem, userId) as MediaItemItemsResponse,
    ...(seasonFields ? { season: seasonFields as TvSeason } : {}),
    ...(episodeFields ? { episode: episodeFields as TvEpisode } : {}),
  };
};

// ---------------------------------------------------------------------------

class ListRepository extends repository<List>({
  tableName: 'list',
  primaryColumnName: 'id',
}) {
  public override async update(args: Partial<List>): Promise<Partial<List> | undefined> {
    const { userId, name, description, privacy, sortBy, sortOrder, id } = args;

    if (id == undefined || userId == undefined) {
      throw new Error('id and userId are required params');
    }

    if (name?.trim().length === 0) {
      return;
    }

    const updatedAt = new Date().getTime();
    return await Database.knex.transaction(async (trx) => {
      const list = await trx<List>('list').where('id', id).first();

      if (!list) {
        return;
      }

      if (list.userId !== userId) {
        return;
      }

      const listWithTheSameName = await trx<List>('list')
        .where('userId', userId)
        .where('name', name)
        .whereNot('id', id)
        .first();

      if (listWithTheSameName) {
        return;
      }

      await trx<List>('list')
        .update({
          ...(list.isWatchlist ? {} : { name: name }),
          privacy: privacy,
          description: description,
          updatedAt: updatedAt,
          sortBy: sortBy,
          sortOrder: sortOrder,
        })
        .where('id', id);

      return await trx<List>('list').where('id', id).first();
    });
  }

  public override async create(args: {
    name: string;
    description?: string;
    privacy?: ListPrivacy;
    sortBy?: ListSortBy;
    sortOrder?: ListSortOrder;
    userId: number;
    isWatchlist?: boolean;
    traktId?: number;
  }): Promise<List | undefined> {
    const {
      userId,
      name,
      description,
      privacy,
      sortBy,
      sortOrder,
      isWatchlist,
      traktId,
    } = args;

    if (name.trim().length === 0) {
      return;
    }

    const createdAt = new Date().getTime();

    const [res] = await Database.knex<List>('list').insert(
      {
        userId: userId,
        name: name,
        privacy: privacy || 'private',
        description: description,
        sortBy: sortBy || 'platform-recommended',
        sortOrder: sortOrder || 'desc',
        createdAt: createdAt,
        updatedAt: createdAt,
        isWatchlist: isWatchlist || false,
        traktId: traktId,
      },
      '*'
    );

    return {
      ...res,
      displayNumbers: Boolean(res.displayNumbers),
      allowComments: Boolean(res.allowComments),
      isWatchlist: Boolean(res.isWatchlist),
    };
  }

  public override async delete(args: {
    listId: number;
    userId: number;
  }): Promise<number> {
    const { listId, userId } = args;

    return await Database.knex.transaction(async (trx) => {
      const list = await trx<List>('list')
        .where('userId', userId)
        .where('id', listId)
        .where('isWatchlist', false)
        .first();

      if (!list) {
        return 0;
      }

      await trx<ListItem>('listItem').delete().where('listId', listId);
      return await trx<ListItem>('list').delete().where('id', listId);
    });
  }

  public async details(args: {
    listId: number;
    userId: number;
  }): Promise<ListDetailsResponse | undefined> {
    const { listId, userId } = args;

    const res = await Database.knex('list')
      .select('list.*', 'user.name AS user.name')
      .where('list.id', listId)
      .where((qb) =>
        qb.where('list.userId', userId).orWhere('list.privacy', 'public')
      )
      .select({
        totalRuntime: Database.knex('list')
          .leftJoin('listItem', 'listItem.listId', 'list.id')
          .leftJoin('mediaItem', 'mediaItem.id', 'listItem.mediaItemId')
          .leftJoin('episode', 'episode.id', 'listItem.episodeId')
          .leftJoin(
            (qb) =>
              qb
                .select('seasonId')
                .sum({
                  runtime: Database.knex.raw(`
                CASE
                  WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                  ELSE "mediaItem"."runtime"
                END`),
                })
                .from('season')
                .leftJoin('mediaItem', 'mediaItem.id', 'season.tvShowId')
                .leftJoin('episode', 'episode.seasonId', 'season.id')
                .groupBy('seasonId')
                .as('seasonRuntime'),
            'seasonRuntime.seasonId',
            'listItem.seasonId'
          )
          .leftJoin(
            (qb) =>
              qb
                .select('tvShowId')
                .sum({
                  runtime: Database.knex.raw(`
                CASE
                  WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                  ELSE "mediaItem"."runtime"
                END`),
                })
                .from('episode')
                .leftJoin('mediaItem', 'mediaItem.id', 'episode.tvShowId')
                .groupBy('tvShowId')
                .as('showRuntime'),
            'showRuntime.tvShowId',
            'listItem.mediaItemId'
          )
          .sum({
            totalRuntime: Database.knex.raw(`
                CASE
                    WHEN "listItem"."episodeId" IS NOT NULL THEN CASE
                        WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                        ELSE "mediaItem"."runtime"
                    END
                    WHEN "listItem"."seasonId" IS NOT NULL THEN "seasonRuntime"."runtime"
                    ELSE CASE
                        WHEN "mediaItem"."mediaType" = 'tv' THEN "showRuntime"."runtime"
                        ELSE "mediaItem"."runtime"
                    END
                END`),
          })
          .where('list.id', listId),
      })
      .leftJoin('user', 'user.id', 'list.userId')
      .first();

    if (!res) {
      return;
    }

    return {
      id: res.id,
      createdAt: res.createdAt,
      isWatchlist: Boolean(res.isWatchlist),
      allowComments: Boolean(res.allowComments),
      displayNumbers: Boolean(res.displayNumbers),
      name: res.name,
      privacy: res.privacy,
      totalRuntime: res.totalRuntime,
      updatedAt: res.updatedAt,
      description: res.description,
      sortBy: res.sortBy,
      sortOrder: res.sortOrder,
      traktId: res.traktId,
      user: {
        id: res.userId,
        username: res['user.name'],
      },
    };
  }

  public async items(args: {
    listId: number;
    userId: number;
    sortBy?: ListSortBy;
    viewerAge?: number | null;
  }): Promise<ListItemsResponse> {
    const { listId, userId, sortBy: sortByArg, viewerAge } = args;

    const { id: watchlistId } = await Database.knex('list')
      .select('id')
      .where('userId', userId)
      .where('isWatchlist', true)
      .first();

    // Use the caller-provided sortBy when available (reflects current UI selection
    // which may differ from the persisted list.sortBy), falling back to the stored value.
    const list = await Database.knex<List>('list').where('id', listId).first();
    const effectiveSortBy = sortByArg ?? list?.sortBy;
    const isPlatformRecommended = effectiveSortBy === 'platform-recommended';

    const currentDateString = new Date().toISOString();

    const res = await Database.knex<ListItem>('listItem')
      .select({
        'episode.episodeNumber': 'episode.episodeNumber',
        'episode.imdbId': 'episode.imdbId',
        'episode.isSpecialEpisode': 'episode.isSpecialEpisode',
        'episode.lastSeenAt': 'episodeLastSeen.lastSeenAt',
        'episode.releaseDate': 'episode.releaseDate',
        'episode.progress': 'episodeProgress.progress',
        'episode.seasonNumber': 'episode.seasonNumber',
        'episode.seasonAndEpisodeNumber': 'episode.seasonAndEpisodeNumber',
        'episode.title': 'episode.title',
        'episode.runtime': 'episode.runtime',
        'episode.tmdbId': 'episode.tmdbId',
        'episode.traktId': 'episode.traktId',
        'episode.tvdbId': 'episode.tvdbId',
        'episode.userRating.date': 'episodeRating.date',
        'episode.userRating.rating': 'episodeRating.rating',
        'episode.watchlist.id': 'episodeWatchlist.id',
        'listItem.addedAt': 'listItem.addedAt',
        'listItem.episodeId': 'listItem.episodeId',
        'listItem.estimatedRating': 'listItem.estimatedRating',
        'listItem.id': 'listItem.id',
        'listItem.mediaItemId': 'listItem.mediaItemId',
        'listItem.seasonId': 'listItem.seasonId',
        'mediaItem.airedEpisodesCount': 'mediaItemAiredEpisodes.count',
        'mediaItem.posterId': 'mediaItem.posterId',
        'mediaItem.backdropId': 'mediaItem.backdropId',
        'mediaItem.firstUnwatchedEpisode.description':
          'mediaItemFirstUnwatchedEpisode.description',
        'mediaItem.firstUnwatchedEpisode.episodeNumber':
          'mediaItemFirstUnwatchedEpisode.episodeNumber',
        'mediaItem.firstUnwatchedEpisode.id':
          'mediaItemFirstUnwatchedEpisode.id',
        'mediaItem.firstUnwatchedEpisode.imdbId':
          'mediaItemFirstUnwatchedEpisode.imdbId',
        'mediaItem.firstUnwatchedEpisode.isSpecialEpisode':
          'mediaItemFirstUnwatchedEpisode.isSpecialEpisode',
        'mediaItem.firstUnwatchedEpisode.releaseDate':
          'mediaItemFirstUnwatchedEpisode.releaseDate',
        'mediaItem.firstUnwatchedEpisode.runtime':
          'mediaItemFirstUnwatchedEpisode.runtime',
        'mediaItem.firstUnwatchedEpisode.seasonId':
          'mediaItemFirstUnwatchedEpisode.seasonId',
        'mediaItem.firstUnwatchedEpisode.seasonNumber':
          'mediaItemFirstUnwatchedEpisode.seasonNumber',
        'mediaItem.firstUnwatchedEpisode.title':
          'mediaItemFirstUnwatchedEpisode.title',
        'mediaItem.firstUnwatchedEpisode.tmdbId':
          'mediaItemFirstUnwatchedEpisode.tmdbId',
        'mediaItem.firstUnwatchedEpisode.traktId':
          'mediaItemFirstUnwatchedEpisode.traktId',
        'mediaItem.firstUnwatchedEpisode.tvdbId':
          'mediaItemFirstUnwatchedEpisode.tvdbId',
        'mediaItem.firstUnwatchedEpisode.tvShowId':
          'mediaItemFirstUnwatchedEpisode.tvShowId',
        'mediaItem.lastAiredEpisode.id': 'mediaItemLastAiredEpisode.id',
        'mediaItem.lastAiredEpisode.description':
          'mediaItemLastAiredEpisode.description',
        'mediaItem.lastAiredEpisode.episodeNumber':
          'mediaItemLastAiredEpisode.episodeNumber',
        'mediaItem.lastAiredEpisode.imdbId': 'mediaItemLastAiredEpisode.imdbId',
        'mediaItem.lastAiredEpisode.isSpecialEpisode':
          'mediaItemLastAiredEpisode.isSpecialEpisode',
        'mediaItem.lastAiredEpisode.releaseDate':
          'mediaItemLastAiredEpisode.releaseDate',
        'mediaItem.lastAiredEpisode.runtime':
          'mediaItemLastAiredEpisode.runtime',
        'mediaItem.lastAiredEpisode.seasonId':
          'mediaItemLastAiredEpisode.seasonId',
        'mediaItem.lastAiredEpisode.seasonNumber':
          'mediaItemLastAiredEpisode.seasonNumber',
        'mediaItem.lastAiredEpisode.title': 'mediaItemLastAiredEpisode.title',
        'mediaItem.lastAiredEpisode.tmdbId': 'mediaItemLastAiredEpisode.tmdbId',
        'mediaItem.lastAiredEpisode.traktId':
          'mediaItemLastAiredEpisode.traktId',
        'mediaItem.lastAiredEpisode.tvdbId': 'mediaItemLastAiredEpisode.tvdbId',

        'mediaItem.upcomingEpisode.id': 'mediaItemUpcomingEpisode.id',
        'mediaItem.upcomingEpisode.description':
          'mediaItemUpcomingEpisode.description',
        'mediaItem.upcomingEpisode.episodeNumber':
          'mediaItemUpcomingEpisode.episodeNumber',
        'mediaItem.upcomingEpisode.imdbId': 'mediaItemUpcomingEpisode.imdbId',
        'mediaItem.upcomingEpisode.isSpecialEpisode':
          'mediaItemUpcomingEpisode.isSpecialEpisode',
        'mediaItem.upcomingEpisode.releaseDate':
          'mediaItemUpcomingEpisode.releaseDate',
        'mediaItem.upcomingEpisode.runtime': 'mediaItemUpcomingEpisode.runtime',
        'mediaItem.upcomingEpisode.seasonId':
          'mediaItemUpcomingEpisode.seasonId',
        'mediaItem.upcomingEpisode.seasonNumber':
          'mediaItemUpcomingEpisode.seasonNumber',
        'mediaItem.upcomingEpisode.title': 'mediaItemUpcomingEpisode.title',
        'mediaItem.upcomingEpisode.tmdbId': 'mediaItemUpcomingEpisode.tmdbId',
        'mediaItem.upcomingEpisode.traktId': 'mediaItemUpcomingEpisode.traktId',
        'mediaItem.upcomingEpisode.tvdbId': 'mediaItemUpcomingEpisode.tvdbId',

        'mediaItem.genres': 'mediaItem.genres',
        'mediaItem.id': 'mediaItem.id',
        'mediaItem.imdbId': 'mediaItem.imdbId',
        'mediaItem.lastSeenAt': 'mediaItemLastSeen.lastSeenAt',
        'mediaItem.lastSeen.mediaItemId': 'mediaItemLastSeen.mediaItemId',
        'mediaItem.lastTimeUpdated': 'mediaItem.lastTimeUpdated',
        'mediaItem.mediaType': 'mediaItem.mediaType',
        'mediaItem.network': 'mediaItem.network',
        'mediaItem.overview': 'mediaItem.overview',
        'mediaItem.progress': 'mediaItemProgress.progress',
        'mediaItem.releaseDate': 'mediaItem.releaseDate',
        'mediaItem.runtime': 'mediaItem.runtime',
        'mediaItem.seenEpisodesCount':
          'mediaItemSeenEpisodes.seenEpisodesCount',
        'mediaItem.status': 'mediaItem.status',
        'mediaItem.source': 'mediaItem.source',
        'mediaItem.title': 'mediaItem.title',
        'mediaItem.tmdbId': 'mediaItem.tmdbId',
        'mediaItem.tmdbRating': 'mediaItem.tmdbRating',
        'mediaItem.platformRating': 'mediaItem.platformRating',
        'mediaItem.platformSeen': 'platformSeenItems.platformSeen',
        'mediaItem.totalRuntime': 'mediaItemTotalRuntime.totalRuntime',
        'mediaItem.traktId': 'mediaItem.traktId',
        'mediaItem.tvdbId': 'mediaItem.tvdbId',
        'mediaItem.url': 'mediaItem.url',
        'mediaItem.userRating.date': 'mediaItemRating.date',
        'mediaItem.userRating.rating': 'mediaItemRating.rating',
        'mediaItem.watchlist.id': 'mediaItemWatchlist.id',
        'season.airedEpisodesCount': 'seasonAiredEpisodes.count',
        'season.firstUnwatchedEpisode.description':
          'seasonFirstUnwatchedEpisode.description',
        'season.firstUnwatchedEpisode.episodeNumber':
          'seasonFirstUnwatchedEpisode.episodeNumber',
        'season.firstUnwatchedEpisode.id': 'seasonFirstUnwatchedEpisode.id',
        'season.firstUnwatchedEpisode.imdbId':
          'seasonFirstUnwatchedEpisode.imdbId',
        'season.firstUnwatchedEpisode.isSpecialEpisode':
          'seasonFirstUnwatchedEpisode.isSpecialEpisode',
        'season.firstUnwatchedEpisode.releaseDate':
          'seasonFirstUnwatchedEpisode.releaseDate',
        'season.firstUnwatchedEpisode.runtime':
          'seasonFirstUnwatchedEpisode.runtime',
        'season.firstUnwatchedEpisode.seasonId':
          'seasonFirstUnwatchedEpisode.seasonId',
        'season.firstUnwatchedEpisode.seasonNumber':
          'seasonFirstUnwatchedEpisode.seasonNumber',
        'season.firstUnwatchedEpisode.title':
          'seasonFirstUnwatchedEpisode.title',
        'season.firstUnwatchedEpisode.tmdbId':
          'seasonFirstUnwatchedEpisode.tmdbId',
        'season.firstUnwatchedEpisode.traktId':
          'seasonFirstUnwatchedEpisode.traktId',
        'season.firstUnwatchedEpisode.tvdbId':
          'seasonFirstUnwatchedEpisode.tvdbId',
        'season.firstUnwatchedEpisode.tvShowId':
          'seasonFirstUnwatchedEpisode.tvShowId',
        'season.lastAiredEpisode.id': 'seasonLastAiredEpisode.id',
        'season.lastAiredEpisode.description':
          'seasonLastAiredEpisode.description',
        'season.lastAiredEpisode.episodeNumber':
          'seasonLastAiredEpisode.episodeNumber',
        'season.lastAiredEpisode.imdbId': 'seasonLastAiredEpisode.imdbId',
        'season.lastAiredEpisode.isSpecialEpisode':
          'seasonLastAiredEpisode.isSpecialEpisode',
        'season.lastAiredEpisode.releaseDate':
          'seasonLastAiredEpisode.releaseDate',
        'season.lastAiredEpisode.runtime': 'seasonLastAiredEpisode.runtime',
        'season.lastAiredEpisode.seasonId': 'seasonLastAiredEpisode.seasonId',
        'season.lastAiredEpisode.seasonNumber':
          'seasonLastAiredEpisode.seasonNumber',
        'season.lastAiredEpisode.title': 'seasonLastAiredEpisode.title',
        'season.lastAiredEpisode.tmdbId': 'seasonLastAiredEpisode.tmdbId',
        'season.lastAiredEpisode.traktId': 'seasonLastAiredEpisode.traktId',
        'season.lastAiredEpisode.tvdbId': 'seasonLastAiredEpisode.tvdbId',
        'season.isSpecialSeason': 'season.isSpecialSeason',
        'season.lastSeenAt': 'seasonLastSeen.lastSeenAt',
        'season.releaseDate': 'season.releaseDate',
        'season.seasonNumber': 'season.seasonNumber',
        'season.seenEpisodesCount': 'seasonSeenEpisodes.seenEpisodesCount',
        'season.title': 'season.title',
        'season.tmdbId': 'season.tmdbId',
        'season.traktId': 'season.traktId',
        'season.tvdbId': 'season.tvdbId',
        'season.userRating.date': 'seasonRating.date',
        'season.userRating.rating': 'seasonRating.rating',
        'season.totalRuntime': 'seasonTotalRuntime.totalRuntime',
        'season.watchlist.id': 'seasonWatchlist.id',
      })
      .modify((qb) => {
        if (isPlatformRecommended) {
          // For platform-recommended sort, surface items from ALL users' lists so that
          // every platform member sees a mixed-content view regardless of what they
          // personally have added.  We deduplicate by mediaItemId (keeping the lowest
          // id representative row) and restrict to top-level media items only (no
          // season or episode entries).
          qb.whereNull('listItem.seasonId')
            .whereNull('listItem.episodeId')
            .whereRaw(`"listItem"."id" = (
              SELECT MIN("li2"."id") FROM "listItem" "li2"
              WHERE "li2"."mediaItemId" = "listItem"."mediaItemId"
                AND "li2"."seasonId" IS NULL
                AND "li2"."episodeId" IS NULL
            )`);
        } else {
          qb.where('listItem.listId', listId);
        }
      })
      .leftJoin('mediaItem', 'mediaItem.id', 'listItem.mediaItemId')
      .leftJoin('season', 'season.id', 'listItem.seasonId')
      .leftJoin('episode', 'episode.id', 'listItem.episodeId')
      // MediaItem: watchlist
      .leftJoin<ListItem>(
        (qb) =>
          qb
            .from('listItem')
            .whereNull('listItem.seasonId')
            .whereNull('listItem.episodeId')
            .where('listItem.listId', watchlistId)
            .as('mediaItemWatchlist'),
        'mediaItemWatchlist.mediaItemId',
        'listItem.mediaItemId'
      )
      // Season: watchlist
      .leftJoin<ListItem>(
        (qb) =>
          qb
            .from('listItem')
            .whereNotNull('listItem.seasonId')
            .whereNull('listItem.episodeId')
            .where('listItem.listId', watchlistId)
            .as('seasonWatchlist'),
        'seasonWatchlist.seasonId',
        'listItem.seasonId'
      )
      // Episode: watchlist
      .leftJoin<ListItem>(
        (qb) =>
          qb
            .from('listItem')
            .whereNotNull('listItem.episodeId')
            .where('listItem.listId', watchlistId)
            .as('episodeWatchlist'),
        'episodeWatchlist.episodeId',
        'listItem.episodeId'
      )
      // Episode: last seen at
      .leftJoin(
        (qb) =>
          qb
            .select('episodeId')
            .max('date', { as: 'lastSeenAt' })
            .from('seen')
            .where('userId', userId)
            .groupBy('episodeId')
            .as('episodeLastSeen'),
        'episodeLastSeen.episodeId',
        'listItem.episodeId'
      )
      // Season: last seen at
      .leftJoin(
        (qb) =>
          qb
            .select({ episode_seasonId: 'episode.seasonId' })
            .max('date', { as: 'lastSeenAt' })
            .from('seen')
            .leftJoin('episode', 'episode.id', 'seen.episodeId')
            .where('userId', userId)
            .groupBy('episode_seasonId')
            .as('seasonLastSeen'),
        'seasonLastSeen.episode_seasonId',
        'listItem.seasonId'
      )
      // MediaItem: last seen at
      .leftJoin(
        (qb) =>
          qb
            .select('mediaItemId')
            .max('date', { as: 'lastSeenAt' })
            .from('seen')
            .where('userId', userId)
            .groupBy('mediaItemId')
            .as('mediaItemLastSeen'),
        'mediaItemLastSeen.mediaItemId',
        'listItem.mediaItemId'
      )
      // MediaItem: platform-seen flag — true if any platform user has fully watched this item.
      // Non-TV: any seen entry with episodeId IS NULL.
      // TV: any user has seen all non-special episodes (seenCount >= totalCount, count > 0).
      .joinRaw(`LEFT JOIN (
        SELECT "mediaItemId", 1 AS "platformSeen"
        FROM "seen"
        WHERE "episodeId" IS NULL
        UNION
        SELECT "mediaItemId", 1 AS "platformSeen"
        FROM (
          SELECT s."mediaItemId", s."userId", COUNT(DISTINCT s."episodeId") AS "seenCount"
          FROM "seen" s
          JOIN "episode" e ON e."id" = s."episodeId"
          WHERE e."isSpecialEpisode" = 0
          GROUP BY s."mediaItemId", s."userId"
          HAVING COUNT(DISTINCT s."episodeId") > 0
            AND COUNT(DISTINCT s."episodeId") >= (
              SELECT COUNT(*) FROM "episode" e2
              WHERE e2."tvShowId" = s."mediaItemId"
                AND e2."isSpecialEpisode" = 0
            )
        ) AS "completedShows"
      ) AS "platformSeenItems" ON "platformSeenItems"."mediaItemId" = "listItem"."mediaItemId"`)
      // MediaItem: total runtime
      .leftJoin(
        (qb) =>
          qb
            .select('tvShowId')
            .leftJoin('mediaItem', 'mediaItem.id', 'tvShowId')
            .sum({
              totalRuntime: Database.knex.raw(`
                CASE
                  WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                  ELSE "mediaItem"."runtime"
                END`),
            })
            .from('episode')
            .groupBy('tvShowId')
            .where('episode.releaseDate', '<', currentDateString)
            .where('episode.isSpecialEpisode', false)
            .as('mediaItemTotalRuntime'),
        'mediaItemTotalRuntime.tvShowId',
        'listItem.mediaItemId'
      )
      // Season: total runtime
      .leftJoin(
        (qb) =>
          qb
            .select('seasonId')
            .leftJoin('mediaItem', 'mediaItem.id', 'tvShowId')
            .sum({
              totalRuntime: Database.knex.raw(`
                CASE
                  WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                  ELSE "mediaItem"."runtime"
                END`),
            })
            .from('episode')
            .groupBy('seasonId')
            .where('episode.isSpecialEpisode', false)
            .where('episode.releaseDate', '<', currentDateString)
            .as('seasonTotalRuntime'),
        'seasonTotalRuntime.seasonId',
        'listItem.seasonId'
      )
      // MediaItem: aired episodes count
      .leftJoin(
        (qb) =>
          qb
            .select('tvShowId')
            .count({ count: '*' })
            .from('episode')
            .groupBy('tvShowId')
            .where('episode.isSpecialEpisode', false)
            .where('releaseDate', '<', currentDateString)
            .as('mediaItemAiredEpisodes'),
        'mediaItemAiredEpisodes.tvShowId',
        'listItem.mediaItemId'
      )
      // Season: aired episodes count
      .leftJoin(
        (qb) =>
          qb
            .select('seasonId')
            .count({ count: '*' })
            .from('episode')
            .groupBy('seasonId')
            .where('episode.isSpecialEpisode', false)
            .where('releaseDate', '<', currentDateString)
            .as('seasonAiredEpisodes'),
        'seasonAiredEpisodes.seasonId',
        'listItem.seasonId'
      )
      // MediaItem: user rating
      .leftJoin<UserRating>(
        (qb) =>
          qb
            .from('userRating')
            .whereNotNull('userRating.rating')
            .orWhereNotNull('userRating.review')
            .as('mediaItemRating'),
        (qb) =>
          qb
            .on('mediaItemRating.mediaItemId', 'listItem.mediaItemId')
            .andOnVal('mediaItemRating.userId', userId)
            .andOnNull('mediaItemRating.episodeId')
            .andOnNull('mediaItemRating.seasonId')
      )
      // Season: user rating
      .leftJoin<UserRating>(
        (qb) =>
          qb
            .from('userRating')
            .whereNotNull('userRating.rating')
            .orWhereNotNull('userRating.review')
            .as('seasonRating'),
        (qb) =>
          qb
            .andOnVal('seasonRating.userId', userId)
            .andOnNull('seasonRating.episodeId')
            .andOn('seasonRating.seasonId', 'listItem.seasonId')
      )
      // Episode: user rating
      .leftJoin<UserRating>(
        (qb) =>
          qb
            .from('userRating')
            .whereNotNull('userRating.rating')
            .orWhereNotNull('userRating.review')
            .as('episodeRating'),
        (qb) =>
          qb
            .andOnVal('episodeRating.userId', userId)
            .andOn('episodeRating.episodeId', 'listItem.episodeId')
            .andOnNull('episodeRating.seasonId')
      )
      // MediaItem: seen episodes count
      .leftJoin<Seen>(
        (qb) =>
          qb
            .select('mediaItemId')
            .count('*', { as: 'seenEpisodesCount' })
            .from((qb: Knex.QueryBuilder) =>
              qb
                .select('mediaItemId')
                .from<Seen>('seen')
                .where('userId', userId)
                .whereNotNull('episodeId')
                .groupBy('mediaItemId', 'episodeId')
                .leftJoin('episode', 'episode.id', 'seen.episodeId')
                .where('episode.isSpecialEpisode', false)
                .as('seen')
            )
            .groupBy('mediaItemId')
            .as('mediaItemSeenEpisodes'),
        'mediaItemSeenEpisodes.mediaItemId',
        'listItem.mediaItemId'
      )
      // Season: seen episodes count
      .leftJoin<Seen>(
        (qb) =>
          qb
            .select('mediaItemId')
            .count('*', { as: 'seenEpisodesCount' })
            .from((qb: Knex.QueryBuilder) =>
              qb
                .select('mediaItemId')
                .from<Seen>('seen')
                .where('userId', userId)
                .whereNotNull('episodeId')
                .groupBy('mediaItemId', 'episodeId')
                .leftJoin('episode', 'episode.id', 'seen.episodeId')
                .where('episode.isSpecialEpisode', false)
                .as('seen')
            )
            .groupBy('mediaItemId')
            .as('seasonSeenEpisodes'),
        'seasonSeenEpisodes.mediaItemId',
        'listItem.mediaItemId'
      )
      // MediaItem: first unwatched episode
      .leftJoin(
        (qb) =>
          qb
            .from('episode')
            .select('tvShowId')
            .min('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .leftJoin(
              (qb) => qb.from<Seen>('seen').where('userId', userId).as('seen'),
              'seen.episodeId',
              'episode.id'
            )
            .where('episode.isSpecialEpisode', false)
            .whereNot('episode.releaseDate', '')
            .whereNot('episode.releaseDate', null)
            .where('episode.releaseDate', '<=', currentDateString)
            .whereNull('seen.userId')
            .groupBy('tvShowId')
            .as('mediaItemFirstUnwatchedEpisodeHelper'),
        'mediaItemFirstUnwatchedEpisodeHelper.tvShowId',
        'listItem.mediaItemId'
      )
      .leftJoin(
        Database.knex.ref('episode').as('mediaItemFirstUnwatchedEpisode'),
        (qb) =>
          qb
            .on(
              'mediaItemFirstUnwatchedEpisode.tvShowId',
              'listItem.mediaItemId'
            )
            .andOn(
              'mediaItemFirstUnwatchedEpisode.seasonAndEpisodeNumber',
              'mediaItemFirstUnwatchedEpisodeHelper.seasonAndEpisodeNumber'
            )
      )
      // Season: first unwatched episode
      .leftJoin(
        (qb) =>
          qb
            .from('episode')
            .select('seasonId')
            .min('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .leftJoin(
              (qb) => qb.from<Seen>('seen').where('userId', userId).as('seen'),
              'seen.episodeId',
              'episode.id'
            )
            .where('episode.isSpecialEpisode', false)
            .whereNot('episode.releaseDate', '')
            .whereNot('episode.releaseDate', null)
            .where('episode.releaseDate', '<=', currentDateString)
            .whereNull('seen.userId')
            .groupBy('seasonId')
            .as('seasonFirstUnwatchedEpisodeHelper'),
        'seasonFirstUnwatchedEpisodeHelper.seasonId',
        'listItem.seasonId'
      )
      .leftJoin(
        Database.knex.ref('episode').as('seasonFirstUnwatchedEpisode'),
        (qb) =>
          qb
            .on('seasonFirstUnwatchedEpisode.seasonId', 'listItem.seasonId')
            .andOn(
              'seasonFirstUnwatchedEpisode.seasonAndEpisodeNumber',
              'seasonFirstUnwatchedEpisodeHelper.seasonAndEpisodeNumber'
            )
      )
      // MediaItem: progress
      .leftJoin<Progress>(
        (qb) =>
          qb
            .from<Progress>('progress')
            .where('userId', userId)
            .where('episodeId', null)
            .as('mediaItemProgress'),
        'mediaItemProgress.mediaItemId',
        'listItem.mediaItemId'
      )
      // Episode: progress
      .leftJoin<Progress>(
        (qb) =>
          qb
            .from<Progress>('progress')
            .where('userId', userId)
            .whereNotNull('episodeId')
            .as('episodeProgress'),
        'episodeProgress.episodeId',
        'listItem.episodeId'
      )
      // MediaItem: last aired episode
      .leftJoin<TvEpisode>(
        (qb) =>
          qb
            .from<TvEpisode>('episode')
            .select('tvShowId')
            .max('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .where('isSpecialEpisode', false)
            .where('releaseDate', '<', currentDateString)
            .groupBy('tvShowId')
            .as('mediaItemLastAiredEpisodeHelper'),
        'mediaItemLastAiredEpisodeHelper.tvShowId',
        'listItem.mediaItemId'
      )
      .leftJoin<TvEpisode>(
        Database.knex.ref('episode').as('mediaItemLastAiredEpisode'),
        (qb) =>
          qb
            .on('mediaItemLastAiredEpisode.tvShowId', 'listItem.mediaItemId')
            .andOn(
              'mediaItemLastAiredEpisode.seasonAndEpisodeNumber',
              'mediaItemLastAiredEpisodeHelper.seasonAndEpisodeNumber'
            )
      )
      // Season: last aired episode
      .leftJoin<TvEpisode>(
        (qb) =>
          qb
            .from<TvEpisode>('episode')
            .select('tvShowId')
            .max('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .where('isSpecialEpisode', false)
            .where('releaseDate', '<', currentDateString)
            .groupBy('tvShowId')
            .as('seasonLastAiredEpisodeHelper'),
        'seasonLastAiredEpisodeHelper.tvShowId',
        'listItem.mediaItemId'
      )
      .leftJoin<TvEpisode>(
        Database.knex.ref('episode').as('seasonLastAiredEpisode'),
        (qb) =>
          qb
            .on('seasonLastAiredEpisode.tvShowId', 'listItem.mediaItemId')
            .andOn(
              'seasonLastAiredEpisode.seasonAndEpisodeNumber',
              'seasonLastAiredEpisodeHelper.seasonAndEpisodeNumber'
            )
      )
      // MediaItem: upcoming episode
      .leftJoin<TvEpisode>(
        (qb) =>
          qb
            .from<TvEpisode>('episode')
            .select('tvShowId')
            .min('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .where('isSpecialEpisode', false)
            .where('releaseDate', '>=', currentDateString)
            .groupBy('tvShowId')
            .as('mediaItemUpcomingEpisodeHelper'),
        'mediaItemUpcomingEpisodeHelper.tvShowId',
        'listItem.mediaItemId'
      )
      .leftJoin<TvEpisode>(
        Database.knex.ref('episode').as('mediaItemUpcomingEpisode'),
        (qb) =>
          qb
            .on('mediaItemUpcomingEpisode.tvShowId', 'listItem.mediaItemId')
            .andOn(
              'mediaItemUpcomingEpisode.seasonAndEpisodeNumber',
              'mediaItemUpcomingEpisodeHelper.seasonAndEpisodeNumber'
            )
      )
      // Age gating: exclude items whose minimumAge exceeds the viewer's age.
      .modify((qb: Knex.QueryBuilder) => {
        applyAgeGatingFilter(qb, viewerAge ?? null);
      })
      .orderBy('listItem.id', 'asc');

    return res.map((listItem: Record<string, any>) =>
      mapListItemRow(listItem, userId)
    );
  }
}

export const listRepository = new ListRepository();
