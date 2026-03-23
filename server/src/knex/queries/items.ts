import {
  MediaItemBase,
  MediaType,
  mediaItemColumns,
  MediaItemItemsResponse,
} from 'src/entity/mediaItem';
import { Database } from 'src/dbconfig';

import { Seen } from 'src/entity/seen';
import { UserRating, userRatingColumns } from 'src/entity/userRating';
import {
  FacetQueryArgs,
  GetItemsArgs,
  Pagination,
} from 'src/repository/mediaItem';
import { TvEpisode, tvEpisodeColumns } from 'src/entity/tvepisode';
import { Knex } from 'knex';
import { List, listItemColumns } from 'src/entity/list';
import { Progress } from 'src/entity/progress';
import { splitCreatorField } from 'src/utils/normalizeCreators';
import { getMediaItemTranslations } from 'src/repository/translationRepository';
import {
  deserializeDescriptors,
  deserializeCategories,
} from 'src/metadata/parentalMetadata';

/**
 * Applies translation overlay to a list of mapped items for a given language.
 * Modifies title, overview, and genres fields where a translation exists.
 * Sets metadataLanguage to the language code when a translation is found.
 */
const applyTranslationOverlay = async (
  items: MediaItemItemsResponse[],
  language: string
): Promise<MediaItemItemsResponse[]> => {
  const ids = items
    .map((item) => item.id)
    .filter((id): id is number => id != null);

  if (ids.length === 0) {
    return items;
  }

  const translationMap = await getMediaItemTranslations(ids, language);

  return items.map((item) => {
    if (item.id == null) {
      return { ...item, metadataLanguage: null };
    }

    const translation = translationMap.get(item.id);
    if (!translation) {
      return { ...item, metadataLanguage: null };
    }

    const updated = { ...item, metadataLanguage: language };
    if (translation.title != null) {
      updated.title = translation.title;
    }
    if (translation.overview != null) {
      updated.overview = translation.overview;
    }
    if (translation.genres != null) {
      try {
        updated.genres = JSON.parse(translation.genres);
      } catch {
        updated.genres = translation.genres.split(',');
      }
    }
    return updated;
  });
};

type LibraryQuery = Knex.QueryBuilder<Record<string, unknown>, unknown[]>;

type GetItemsKnexArgs = GetItemsArgs & {
  language?: string | null;
  year?: string;
};

// Knex returns aliased row objects with dynamic keys and mixed value types here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawMediaItemRow = Record<string, any>;

type SharedLibraryFilterArgs = Pick<
  FacetQueryArgs,
  | 'mediaType'
  | 'filter'
  | 'genres'
  | 'languages'
  | 'creators'
  | 'publishers'
  | 'mediaTypes'
  | 'yearMin'
  | 'yearMax'
  | 'ratingMin'
  | 'ratingMax'
  | 'status'
  | 'onlyOnWatchlist'
  | 'onlySeenItems'
  | 'onlyWithUserRating'
  | 'onlyWithoutUserRating'
>;

const splitCsvFilterValue = (value?: string | null): string[] =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const getWatchlistId = async (userId: number): Promise<number> => {
  const watchlist = await Database.knex('list')
    .select('id')
    .where('userId', userId)
    .where('isWatchlist', true)
    .first();

  if (watchlist === undefined) {
    throw new Error(`user ${userId} has no watchlist`);
  }

  return watchlist.id;
};

const applyMultiValueLikeFilter = (
  query: LibraryQuery,
  column: string,
  rawValue?: string | null
) => {
  const values = splitCsvFilterValue(rawValue);

  if (values.length === 0) {
    return;
  }

  query.andWhere((qb) => {
    values.forEach((value, index) => {
      if (index === 0) {
        qb.where(column, 'LIKE', `%${value}%`);
      } else {
        qb.orWhere(column, 'LIKE', `%${value}%`);
      }
    });
  });
};

const applyWhereInFilter = (
  query: LibraryQuery,
  column: string,
  rawValue?: string | null
) => {
  const values = splitCsvFilterValue(rawValue);

  if (values.length > 0) {
    query.whereIn(column, values);
  }
};

const applyCreatorFilter = (
  query: LibraryQuery,
  rawCreators?: string | null
) => {
  const creators = splitCsvFilterValue(rawCreators);

  if (creators.length === 0) {
    return;
  }

  query.andWhere((qb) => {
    creators.forEach((creator) => {
      qb.orWhere('mediaItem.director', 'LIKE', `%${creator}%`);
      qb.orWhere('mediaItem.creator', 'LIKE', `%${creator}%`);
      qb.orWhere('mediaItem.authors', 'LIKE', `%${creator}%`);
      qb.orWhere('mediaItem.developer', 'LIKE', `%${creator}%`);
    });
  });
};

const applyYearRangeFilter = (
  query: LibraryQuery,
  yearMin?: number | null,
  yearMax?: number | null
) => {
  if (yearMin != null) {
    query.andWhere(
      'mediaItem.releaseDate',
      '>=',
      new Date(yearMin, 0, 1).toISOString()
    );
  }

  if (yearMax != null) {
    query.andWhere(
      'mediaItem.releaseDate',
      '<=',
      new Date(yearMax, 11, 31, 23, 59, 59, 999).toISOString()
    );
  }
};

const applyRatingRangeFilter = (
  query: LibraryQuery,
  ratingMin?: number | null,
  ratingMax?: number | null
) => {
  if (ratingMin != null && ratingMin > 0) {
    query
      .whereNotNull('mediaItem.tmdbRating')
      .andWhere('mediaItem.tmdbRating', '>=', ratingMin);
  }

  if (ratingMax != null) {
    query.andWhere('mediaItem.tmdbRating', '<=', ratingMax);
  }
};

const applyStatusFilter = (
  query: LibraryQuery,
  status: string | undefined,
  lastSeenColumn: string
) => {
  const statusValues = splitCsvFilterValue(status);

  if (statusValues.includes('rated')) {
    query.whereNotNull('userRating.rating');
  }

  if (statusValues.includes('unrated')) {
    query.whereNull('userRating.rating');
  }

  if (statusValues.includes('watchlist')) {
    query.whereNotNull('listItem.mediaItemId');
  }

  if (statusValues.includes('seen')) {
    query.whereNotNull(lastSeenColumn);
  }
};

const applySharedLibraryFilters = (
  query: LibraryQuery,
  args: SharedLibraryFilterArgs,
  options: {
    isPlatformRecommended: boolean;
    lastSeenColumn: string;
  }
) => {
  const { isPlatformRecommended, lastSeenColumn } = options;

  if (args.mediaType) {
    query.andWhere('mediaItem.mediaType', args.mediaType);
  }

  if (args.filter && args.filter.trim().length > 0) {
    query.andWhere('mediaItem.title', 'LIKE', `%${args.filter}%`);
  }

  applyMultiValueLikeFilter(query, 'mediaItem.genres', args.genres);
  applyWhereInFilter(query, 'mediaItem.language', args.languages);
  applyCreatorFilter(query, args.creators);
  applyWhereInFilter(query, 'mediaItem.publisher', args.publishers);
  applyWhereInFilter(query, 'mediaItem.mediaType', args.mediaTypes);
  applyYearRangeFilter(query, args.yearMin, args.yearMax);
  applyRatingRangeFilter(query, args.ratingMin, args.ratingMax);
  applyStatusFilter(query, args.status, lastSeenColumn);

  if (args.onlyOnWatchlist && !isPlatformRecommended) {
    query.whereNotNull('listItem.mediaItemId');
  }

  if (args.onlySeenItems === true) {
    query.whereNotNull(lastSeenColumn);
  }

  if (args.onlyWithUserRating === true) {
    query.whereNotNull('userRating.rating');
  }

  if (args.onlyWithoutUserRating === true) {
    query.whereNull('userRating.rating');
  }
};

const applySeenYearFilter = (
  query: LibraryQuery,
  year: string | undefined,
  yearFilter: string
) => {
  if (!year) {
    return;
  }

  if (yearFilter === 'noyear') {
    query.andWhere(
      Database.knex.raw(
        'strftime(\'%Y\', datetime("lastSeen2"."date" / 1000, \'unixepoch\')) is null'
      )
    );
  } else if (yearFilter !== '') {
    query.andWhere(
      Database.knex.raw(
        'strftime(\'%Y\', datetime("lastSeen2"."date" / 1000, \'unixepoch\')) is not null'
      )
    );
  }
};

const applyPlatformRecommendedExclusions = (
  query: LibraryQuery,
  groupId: number | undefined
) => {
  if (groupId != null) {
    query.whereRaw(
      `NOT (
        "mediaItem"."mediaType" != 'tv'
        AND (
          SELECT COUNT(DISTINCT s."userId")
          FROM "seen" s
          JOIN "userGroupMember" ugm ON ugm."userId" = s."userId" AND ugm."groupId" = ?
          WHERE s."mediaItemId" = "mediaItem"."id"
            AND s."episodeId" IS NULL
        ) > CAST((SELECT COUNT(*) FROM "userGroupMember" WHERE "groupId" = ?) AS REAL) / 2.0
      )`,
      [groupId, groupId]
    );
    query.whereRaw(
      `NOT (
        "mediaItem"."mediaType" = 'tv'
        AND (
          SELECT COUNT(DISTINCT cu."userId")
          FROM (
            SELECT s."userId"
            FROM "seen" s
            JOIN "episode" e ON e."id" = s."episodeId"
            JOIN "userGroupMember" ugm ON ugm."userId" = s."userId" AND ugm."groupId" = ?
            WHERE s."mediaItemId" = "mediaItem"."id"
              AND e."isSpecialEpisode" = 0
            GROUP BY s."userId"
            HAVING COUNT(DISTINCT s."episodeId") >= (
              SELECT COUNT(*)
              FROM "episode" e2
              WHERE e2."tvShowId" = "mediaItem"."id"
                AND e2."isSpecialEpisode" = 0
            )
          ) AS cu
        ) > CAST((SELECT COUNT(*) FROM "userGroupMember" WHERE "groupId" = ?) AS REAL) / 2.0
      )`,
      [groupId, groupId]
    );

    return;
  }

  query.whereRaw(`NOT (
    "mediaItem"."mediaType" != 'tv'
    AND EXISTS (
      SELECT 1 FROM "seen"
      WHERE "seen"."mediaItemId" = "mediaItem"."id"
        AND "seen"."episodeId" IS NULL
    )
  )`);
  query.whereRaw(`NOT (
    "mediaItem"."mediaType" = 'tv'
    AND EXISTS (
      SELECT 1 FROM (
        SELECT s."userId"
        FROM "seen" s
        JOIN "episode" e ON e."id" = s."episodeId"
        WHERE s."mediaItemId" = "mediaItem"."id"
          AND e."isSpecialEpisode" = 0
        GROUP BY s."userId"
        HAVING COUNT(DISTINCT s."episodeId") > 0
          AND COUNT(DISTINCT s."episodeId") >= (
            SELECT COUNT(*)
            FROM "episode" e2
            WHERE e2."tvShowId" = "mediaItem"."id"
              AND e2."isSpecialEpisode" = 0
          )
      ) AS "completed_users"
    )
  )`);
};

const applyNextAiringFilter = (
  query: LibraryQuery,
  args: {
    currentDateString: string;
    mediaType?: MediaType;
    onlyWithNextAiring?: boolean;
  }
) => {
  const { currentDateString, mediaType, onlyWithNextAiring } = args;

  if (!onlyWithNextAiring) {
    return;
  }

  if (mediaType) {
    if (mediaType === 'tv') {
      query.andWhere('upcomingEpisode.releaseDate', '>', currentDateString);
    } else {
      query.andWhere('mediaItem.releaseDate', '>', currentDateString);
    }
  } else {
    query.andWhere((qb) =>
      qb
        .where((nestedQuery) =>
          nestedQuery
            .whereNot('mediaItem.mediaType', 'tv')
            .andWhere('mediaItem.releaseDate', '>', currentDateString)
        )
        .orWhere((nestedQuery) =>
          nestedQuery
            .where('mediaItem.mediaType', 'tv')
            .andWhere('upcomingEpisode.releaseDate', '>', currentDateString)
        )
    );
  }

  query.whereNotNull('listItem.mediaItemId');
};

const applyItemOrdering = (
  query: LibraryQuery,
  args: {
    currentDateString: string;
    groupId: number | undefined;
    orderBy?: GetItemsArgs['orderBy'];
    sortOrder?: GetItemsArgs['sortOrder'];
  }
) => {
  const { currentDateString, groupId, orderBy, sortOrder } = args;

  if (!orderBy || !sortOrder) {
    return;
  }

  if (
    sortOrder.toLowerCase() !== 'asc' &&
    sortOrder.toLowerCase() !== 'desc'
  ) {
    throw new Error('Sort order should by either asc or desc');
  }

  switch (orderBy) {
    case 'title':
      query.orderBy('mediaItem.title', sortOrder);
      break;

    case 'releaseDate':
      query.orderBy('mediaItem.releaseDate', sortOrder);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'status':
      query.orderBy('mediaItem.status', sortOrder);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'mediaType':
      query.orderBy('mediaItem.mediaType', sortOrder);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'unseenEpisodes':
      query.orderBy('unseenEpisodesCount', sortOrder);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'lastSeen':
      query.orderBy('lastSeenAt', sortOrder);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'nextAiring':
      query.orderByRaw(`CASE
                          WHEN "mediaItem"."mediaType" = 'tv' THEN "upcomingEpisode"."releaseDate"
                          ELSE "mediaItem"."releaseDate"
                        END ${sortOrder} NULLS LAST`);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'lastAiring':
      query.orderByRaw(`CASE
                          WHEN "mediaItem"."mediaType" = 'tv' THEN "lastAiredEpisode"."releaseDate"
                          ELSE CASE
                            WHEN "mediaItem"."releaseDate" >= '${currentDateString}' THEN NULL
                            ELSE "mediaItem"."releaseDate"
                          END
                        END ${sortOrder} NULLS LAST`);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'progress':
      query.orderByRaw(`CASE
                          WHEN "mediaItem"."mediaType" = 'tv' THEN "unseenEpisodesCount"
                          ELSE "progress"
                        END ${sortOrder}`);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'recommended':
      query.orderByRaw(
        `CASE WHEN "listItem"."estimatedRating" IS NULL THEN 1 ELSE 0 END ASC`
      );
      query.orderByRaw(`CASE
                          WHEN "listItem"."estimatedRating" IS NOT NULL AND "mediaItem"."tmdbRating" IS NOT NULL
                            THEN ("listItem"."estimatedRating" * 0.6 + "mediaItem"."tmdbRating" * 0.4)
                          ELSE "listItem"."estimatedRating"
                        END DESC NULLS LAST`);
      query.orderBy('mediaItem.title', 'asc');
      break;

    case 'platformRecommended':
      if (groupId != null) {
        query.orderByRaw(`CASE WHEN "gpr"."rating" IS NULL THEN 1 ELSE 0 END ASC`);
        query.orderByRaw(`CASE
                            WHEN "gpr"."rating" IS NOT NULL AND "mediaItem"."tmdbRating" IS NOT NULL
                              THEN ("gpr"."rating" * 0.7 + "mediaItem"."tmdbRating" * 0.3)
                            WHEN "gpr"."rating" IS NOT NULL
                              THEN "gpr"."rating"
                            ELSE "mediaItem"."tmdbRating"
                          END DESC NULLS LAST`);
      } else {
        query.orderByRaw(
          `CASE WHEN "mediaItem"."platformRating" IS NULL THEN 1 ELSE 0 END ASC`
        );
        query.orderByRaw(`CASE
                            WHEN "mediaItem"."platformRating" IS NOT NULL AND "mediaItem"."tmdbRating" IS NOT NULL
                              THEN ("mediaItem"."platformRating" * 0.7 + "mediaItem"."tmdbRating" * 0.3)
                            WHEN "mediaItem"."platformRating" IS NOT NULL
                              THEN "mediaItem"."platformRating"
                            ELSE "mediaItem"."tmdbRating"
                          END DESC NULLS LAST`);
      }
      query.orderBy('mediaItem.title', 'asc');
      break;

    default:
      throw new Error(`Unsupported orderBy value: ${orderBy}`);
  }
};

const mapImagePath = (
  imageId: unknown,
  suffix = ''
): string | null => (imageId ? `/img/${imageId}${suffix}` : null);

const mapUserRating = (row: RawMediaItemRow) =>
  row['userRating.id']
    ? {
        id: row['userRating.id'],
        date: row['userRating.date'],
        mediaItemId: row['userRating.mediaItemId'],
        rating: row['userRating.rating'],
        review: row['userRating.review'],
        userId: row['userRating.userId'],
        episodeId: row['userRating.episodeId'],
        seasonId: row['userRating.seasonId'],
      }
    : undefined;

const mapEpisodeRow = (
  row: RawMediaItemRow,
  prefix: 'firstUnwatchedEpisode' | 'upcomingEpisode' | 'lastAiredEpisode',
  presenceKey: 'id' | 'releaseDate',
  options?: {
    seen?: boolean;
    includeSeen?: boolean;
  }
): TvEpisode | undefined => {
  if (!row[`${prefix}.${presenceKey}`]) {
    return undefined;
  }

  const includeSeen = options?.includeSeen ?? false;

  return {
    id: row[`${prefix}.id`],
    title: row[`${prefix}.title`],
    description: row[`${prefix}.description`],
    episodeNumber: row[`${prefix}.episodeNumber`],
    seasonNumber: row[`${prefix}.seasonNumber`],
    releaseDate: row[`${prefix}.releaseDate`],
    runtime: row[`${prefix}.runtime`],
    tvShowId: row[`${prefix}.tvShowId`],
    tmdbId: row[`${prefix}.tmdbId`],
    imdbId: row[`${prefix}.imdbId`],
    tvdbId: row[`${prefix}.tvdbId`],
    traktId: row[`${prefix}.traktId`],
    seasonId: row[`${prefix}.seasonId`],
    isSpecialEpisode: Boolean(row[`${prefix}.isSpecialEpisode`]),
    userRating: undefined,
    seenHistory: undefined,
    lastSeenAt: undefined,
    ...(includeSeen ? { seen: options?.seen ?? false } : {}),
  };
};

const incrementFacetCount = (map: Map<string, number>, value: string) => {
  map.set(value, (map.get(value) || 0) + 1);
};

const mapToSortedFacetOptions = (map: Map<string, number>): FacetOption[] =>
  Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

export const getItemsKnex = async (
  args: GetItemsKnexArgs
): Promise<Pagination<MediaItemItemsResponse> | MediaItemItemsResponse[]> => {
  const { page, language } = args;
  const { sqlQuery, sqlCountQuery, sqlPaginationQuery } = await getItemsKnexSql(
    args
  );

  if (page) {
    const [resCount, res] = await Database.knex.transaction(async (trx) => {
      const resCount = await sqlCountQuery.transacting(trx);
      const res = await sqlPaginationQuery!.transacting(trx);

      return [resCount, res];
    });

    const itemsPerPage = 40;
    const total = Number(resCount[0].count);
    const from = itemsPerPage * (page - 1);
    const to = Math.min(total, itemsPerPage * page);
    const totalPages = Math.ceil(total / itemsPerPage);

    if (from > total) {
      throw new Error('Invalid page number');
    }

    let data = res.map(mapRawResult);

    if (language) {
      data = await applyTranslationOverlay(data, language);
    }

    return {
      from: from,
      to: to,
      data: data,
      total: total,
      page: page,
      totalPages: totalPages,
    };
  } else {
    const res = await sqlQuery;
    let items = res.map(mapRawResult);

    if (language) {
      items = await applyTranslationOverlay(items, language);
    }

    return items;
  }
};

const getItemsKnexSql = async (args: GetItemsKnexArgs) => {
  const {
    onlyOnWatchlist,
    mediaType,
    userId,
    filter,
    orderBy,
    page,
    onlySeenItems,
    sortOrder,
    onlyWithNextEpisodesToWatch,
    onlyWithNextAiring,
    mediaItemIds,
    onlyWithUserRating,
    onlyWithoutUserRating,
    onlyWithProgress,
    selectRandom,
    year,
    genre,
    genres,
    languages,
    creators,
    publishers,
    mediaTypes,
    yearMin,
    yearMax,
    ratingMin,
    ratingMax,
    status,
    groupId,
  } = args;

  const currentDateString = new Date().toISOString();
  const watchlistId = await getWatchlistId(userId);
  const isPlatformRecommended = orderBy === 'platformRecommended';

  let yearFilter = '';

  if (year) {
    yearFilter = year;
    const pattern = '^[0-9]{4}$';
    const re = new RegExp(pattern);
    if (!year.match(re) && year !== 'allyear' && year !== 'noyear') {
      yearFilter = '';
    }
  }

  const query = Database.knex
    .select(generateColumnNames('firstUnwatchedEpisode', tvEpisodeColumns))
    .select(generateColumnNames('listItem', listItemColumns))
    .select(generateColumnNames('upcomingEpisode', tvEpisodeColumns))
    .select(generateColumnNames('lastAiredEpisode', tvEpisodeColumns))
    .select(generateColumnNames('userRating', userRatingColumns))
    .select(generateColumnNames('mediaItem', mediaItemColumns))
    .select({
      lastSeenAt: 'lastSeen.date',
      'lastSeen2.mediaItemId': 'lastSeen2.mediaItemId',
      numberOfEpisodes: 'numberOfEpisodes',
      unseenEpisodesCount: 'unseenEpisodesCount',
      seenEpisodesCount: 'seenEpisodesCount',
      progress: 'progress.progress',
    })
    .from<MediaItemBase>('mediaItem')
    .leftJoin<Seen>(
      (qb) =>
        qb
          .select('mediaItemId')
          .max('date', { as: 'date' })
          .from<Seen>('seen')
          .where('userId', userId)
          .groupBy('mediaItemId')
          .as('lastSeen'),
      'lastSeen.mediaItemId',
      'mediaItem.id'
    )
    .leftJoin<Seen>(
      (qb) =>
        qb
          .select('mediaItemId')
          .select('date')
          .from<Seen>('seen')
          .where((db) => {
            db.where('userId', userId);
            if (yearFilter === 'noyear') {
              db.andWhere(
                Database.knex.raw(
                  "strftime('%Y', datetime(\"date\" / 1000, 'unixepoch')) is NULL"
                )
              );
            } else if (yearFilter !== '') {
              db.andWhere(
                Database.knex.raw(
                  "strftime('%Y', datetime(\"date\" / 1000, 'unixepoch')) is '" +
                    yearFilter +
                    "'"
                )
              );
            }
          })
          .groupBy('mediaItemId')
          .as('lastSeen2'),
      'lastSeen2.mediaItemId',
      'mediaItem.id'
    )
    // Number of episodes
    .leftJoin<TvEpisode>(
      (qb) =>
        qb
          .select('tvShowId')
          .count('*', { as: 'numberOfEpisodes' })
          .from<TvEpisode>('episode')
          .whereNot('isSpecialEpisode', true)
          .andWhereNot('releaseDate', '')
          .andWhereNot('releaseDate', null)
          .andWhere('releaseDate', '<=', currentDateString)
          .groupBy('tvShowId')
          .as('numberOfEpisodes'),
      'numberOfEpisodes.tvShowId',
      'mediaItem.id'
    )
    // On watchlist
    .leftJoin<List>('listItem', (qb) => {
      qb.on('listItem.mediaItemId', 'mediaItem.id')
        .andOnNull('listItem.seasonId')
        .andOnNull('listItem.episodeId')
        .andOnVal('listItem.listId', watchlistId);
    })
    // Cross-user list membership — used for platform-recommended base filter
    .leftJoin(
      (qb) =>
        qb
          .select('mediaItemId')
          .from('listItem')
          .whereNull('listItem.seasonId')
          .whereNull('listItem.episodeId')
          .groupBy('mediaItemId')
          .as('anyListItem'),
      'anyListItem.mediaItemId',
      'mediaItem.id'
    )
    // Upcoming episode
    .leftJoin<TvEpisode>(
      (qb) =>
        qb
          .from<TvEpisode>('episode')
          .select('tvShowId')
          .min('seasonAndEpisodeNumber', {
            as: 'upcomingEpisodeSeasonAndEpisodeNumber',
          })
          .where('isSpecialEpisode', false)
          .where('releaseDate', '>=', currentDateString)
          .groupBy('tvShowId')
          .as('upcomingEpisodeHelper'),
      'upcomingEpisodeHelper.tvShowId',
      'mediaItem.id'
    )
    .leftJoin<TvEpisode>(
      Database.knex.ref('episode').as('upcomingEpisode'),
      (qb) =>
        qb
          .on('upcomingEpisode.tvShowId', 'mediaItem.id')
          .andOn(
            'upcomingEpisode.seasonAndEpisodeNumber',
            'upcomingEpisodeSeasonAndEpisodeNumber'
          )
    )
    // Last aired episode
    .leftJoin<TvEpisode>(
      (qb) =>
        qb
          .from<TvEpisode>('episode')
          .select('tvShowId')
          .max('seasonAndEpisodeNumber', {
            as: 'lastAiredEpisodeSeasonAndEpisodeNumber',
          })
          .where('isSpecialEpisode', false)
          .where('releaseDate', '<', currentDateString)
          .groupBy('tvShowId')
          .as('lastAiredEpisodeHelper'),
      'lastAiredEpisodeHelper.tvShowId',
      'mediaItem.id'
    )
    .leftJoin<TvEpisode>(
      Database.knex.ref('episode').as('lastAiredEpisode'),
      (qb) =>
        qb
          .on('lastAiredEpisode.tvShowId', 'mediaItem.id')
          .andOn(
            'lastAiredEpisode.seasonAndEpisodeNumber',
            'lastAiredEpisodeSeasonAndEpisodeNumber'
          )
    )
    // Seen episodes count
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
              .whereNot('episode.isSpecialEpisode', true)
              .as('seen')
          )
          .groupBy('mediaItemId')
          .as('seenEpisodes'),
      'seenEpisodes.mediaItemId',
      'mediaItem.id'
    )
    // First unwatched episode and unseen episodes count
    .leftJoin<TvEpisode>(
      (qb) =>
        qb
          .from<TvEpisode>('episode')
          .select('tvShowId')
          .min('seasonAndEpisodeNumber', {
            as: 'seasonAndEpisodeNumber',
          })
          .count('*', { as: 'unseenEpisodesCount' })
          .leftJoin(
            (qb) => qb.from<Seen>('seen').where('userId', userId).as('seen'),
            'seen.episodeId',
            'episode.id'
          )
          .whereNot('episode.isSpecialEpisode', true)
          .whereNot('episode.releaseDate', '')
          .whereNot('episode.releaseDate', null)
          .where('episode.releaseDate', '<=', currentDateString)
          .whereNull('seen.userId')
          .groupBy('tvShowId')
          .as('firstUnwatchedEpisodeHelper'),
      'firstUnwatchedEpisodeHelper.tvShowId',
      'mediaItem.id'
    )
    .leftJoin<TvEpisode>(
      Database.knex.ref('episode').as('firstUnwatchedEpisode'),
      (qb) =>
        qb
          .on('firstUnwatchedEpisode.tvShowId', 'mediaItem.id')
          .andOn(
            'firstUnwatchedEpisode.seasonAndEpisodeNumber',
            'firstUnwatchedEpisodeHelper.seasonAndEpisodeNumber'
          )
    )
    // User rating
    .leftJoin<UserRating>(
      (qb) =>
        qb
          .from('userRating')
          .whereNotNull('userRating.rating')
          .orWhereNotNull('userRating.review')
          .as('userRating'),
      (qb) =>
        qb
          .on('userRating.mediaItemId', 'mediaItem.id')
          .andOnVal('userRating.userId', userId)
          .andOnNull('userRating.episodeId')
          .andOnNull('userRating.seasonId')
    )
    // Progress
    .leftJoin<Progress>(
      (qb) =>
        qb
          .from<Progress>('progress')
          .where('userId', userId)
          .whereNull('episodeId')
          .whereNot('progress', 1)
          .as('progress'),
      'progress.mediaItemId',
      'mediaItem.id'
    );

  // When platformRecommended sort with a specific group, join the group's cached ratings.
  // The LEFT JOIN is ONLY added when groupId is provided to avoid any performance impact
  // on the non-group path. gpr.rating replaces mediaItem.platformRating in the scoring formula.
  if (isPlatformRecommended && groupId != null) {
    query.leftJoin('groupPlatformRating as gpr', function () {
      this.on('gpr.mediaItemId', '=', 'mediaItem.id').andOnVal(
        'gpr.groupId',
        groupId
      );
    });
  }

  if (Array.isArray(mediaItemIds)) {
    query.whereIn('mediaItem.id', mediaItemIds);
  } else {
    if (isPlatformRecommended) {
      // For platform-recommended, surface items from ALL users' lists so
      // cross-content-type recommendations appear regardless of what the
      // current user personally added to their watchlist.
      query.whereNotNull('anyListItem.mediaItemId');
    } else {
      query.where((qb) =>
        qb
          .whereNotNull('listItem.mediaItemId')
          .orWhereNotNull('lastSeen.mediaItemId')
      );
    }

    if (onlySeenItems === false) {
      query
        .andWhereNot((qb) =>
          qb
            .where('mediaItem.mediaType', 'tv')
            .andWhere('firstUnwatchedEpisode.tvShowId', null)
        )
        .andWhere((qb) =>
          qb
            .where('mediaItem.mediaType', 'tv')
            .orWhere('mediaItem.releaseDate', '<=', currentDateString)
        );
    }

    if (isPlatformRecommended) {
      applyPlatformRecommendedExclusions(query, groupId);
    }

    applySeenYearFilter(query, year, yearFilter);

    if (genre) {
      query.andWhere('mediaItem.genres', 'LIKE', `%${genre}%`);
    }

    applySharedLibraryFilters(
      query,
      {
        mediaType,
        filter,
        genres,
        languages,
        creators,
        publishers,
        mediaTypes,
        yearMin,
        yearMax,
        ratingMin,
        ratingMax,
        status,
        onlyOnWatchlist,
        onlySeenItems,
        onlyWithUserRating,
        onlyWithoutUserRating,
      },
      {
        isPlatformRecommended,
        lastSeenColumn: 'lastSeen2.mediaItemId',
      }
    );
    applyNextAiringFilter(query, {
      currentDateString,
      mediaType,
      onlyWithNextAiring,
    });

    // nextEpisodesToWatchSubQuery
    if (onlyWithNextEpisodesToWatch === true) {
      query
        .where('seenEpisodesCount', '>', 0)
        .andWhere('unseenEpisodesCount', '>', 0);
    }

    if (onlyWithProgress) {
      query.where((qb) =>
        qb
          .where((qb) =>
            qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress')
          )
          .orWhere((qb) =>
            qb
              .where('mediaItem.mediaType', 'tv')
              .where('seenEpisodesCount', '>', 0)
              .andWhere('unseenEpisodesCount', '>', 0)
          )
      );
    }
    if (selectRandom) {
      query.orderByRaw('RANDOM()').limit(1);
    }
  }

  applyItemOrdering(query, {
    currentDateString,
    groupId,
    orderBy,
    sortOrder,
  });

  const sqlCountQuery = query
    .clone()
    .clearOrder()
    .clearSelect()
    .count('*', { as: 'count' });

  let sqlPaginationQuery;

  if (page) {
    const itemsPerPage = 40;
    const skip = itemsPerPage * (page - 1);
    const take = itemsPerPage;

    sqlPaginationQuery = query.clone().limit(take).offset(skip);
  }

  return {
    sqlQuery: query,
    sqlCountQuery: sqlCountQuery,
    sqlPaginationQuery: sqlPaginationQuery,
  };
};

export const generateColumnNames = <
  Prefix extends string,
  Properties extends ReadonlyArray<string>
>(
  prefix: Prefix,
  properties: Properties
) => {
  return properties.reduce(
    (previous, property) => ({
      ...previous,
      [`${prefix}.${property}`]: `${prefix}.${property}`,
    }),
    {}
  ) as {
    [Key in `${Prefix}.${Properties[number]}`]: Key;
  };
};

const mapRawResult = (row: RawMediaItemRow): MediaItemItemsResponse => {
  return {
    id: row['mediaItem.id'],
    tmdbId: row['mediaItem.tmdbId'],
    tvmazeId: row['mediaItem.tvmazeId'],
    igdbId: row['mediaItem.igdbId'],
    openlibraryId: row['mediaItem.openlibraryId'],
    tvdbId: row['mediaItem.tvdbId'],
    traktId: row['mediaItem.traktId'],
    imdbId: row['mediaItem.imdbId'],
    audibleId: row['mediaItem.audibleId'],
    mediaType: row['mediaItem.mediaType'],
    numberOfSeasons: row['mediaItem.numberOfSeasons'],
    status: row['mediaItem.status'],
    platform: row['mediaItem.platform']
      ? JSON.parse(row['mediaItem.platform'])
      : null,
    title: row['mediaItem.title'],
    originalTitle: row['mediaItem.originalTitle'],
    tmdbRating: row['mediaItem.tmdbRating'],
    runtime: row['mediaItem.runtime'],
    releaseDate: row['mediaItem.releaseDate'],
    overview: row['mediaItem.overview'],
    lastTimeUpdated: row['mediaItem.lastTimeUpdated'],
    source: row['mediaItem.source'],
    network: row['mediaItem.network'],
    language: row['mediaItem.language'],
    genres: row['mediaItem.genres']?.split(','),
    authors: splitCreatorField(row['mediaItem.authors'] ?? null),
    narrators: splitCreatorField(row['mediaItem.narrators'] ?? null),
    url: row['mediaItem.url'],
    developer: row['mediaItem.developer'],
    minimumAge: row['mediaItem.minimumAge'] ?? null,
    contentRatingSystem: row['mediaItem.contentRatingSystem'] ?? null,
    contentRatingRegion: row['mediaItem.contentRatingRegion'] ?? null,
    contentRatingLabel: row['mediaItem.contentRatingLabel'] ?? null,
    contentRatingDescriptors: deserializeDescriptors(
      row['mediaItem.contentRatingDescriptors']
    ),
    parentalGuidanceSummary: row['mediaItem.parentalGuidanceSummary'] ?? null,
    parentalGuidanceCategories: deserializeCategories(
      row['mediaItem.parentalGuidanceCategories']
    ),
    lastSeenAt: row['lastSeenAt'],
    progress: row['progress'],
    poster: mapImagePath(row['mediaItem.posterId']),
    posterSmall: mapImagePath(row['mediaItem.posterId'], '?size=small'),
    backdrop: mapImagePath(row['mediaItem.backdropId']),
    hasDetails: false,
    seen:
      row['mediaItem.mediaType'] === 'tv'
        ? row.numberOfEpisodes > 0 && !row.unseenEpisodesCount
        : Boolean(row['lastSeen2.mediaItemId']),

    onWatchlist: Boolean(row['listItem.id']),
    estimatedRating: row['listItem.estimatedRating'] ?? undefined,
    platformRating: row['mediaItem.platformRating'] ?? undefined,
    unseenEpisodesCount: row.unseenEpisodesCount || 0,
    seenEpisodesCount: row['seenEpisodesCount'],
    numberOfEpisodes: row.numberOfEpisodes,
    nextAiring:
      row['mediaItem.mediaType'] === 'tv'
        ? row['upcomingEpisode.releaseDate']
        : row['mediaItem.releaseDate'],
    lastAiring:
      row['mediaItem.mediaType'] === 'tv'
        ? row['lastAiredEpisode.releaseDate']
        : row['mediaItem.releaseDate'],
    userRating: mapUserRating(row),
    firstUnwatchedEpisode: mapEpisodeRow(
      row,
      'firstUnwatchedEpisode',
      'id'
    ),
    upcomingEpisode: mapEpisodeRow(
      row,
      'upcomingEpisode',
      'releaseDate',
      { seen: false, includeSeen: true }
    ),
    lastAiredEpisode: mapEpisodeRow(row, 'lastAiredEpisode', 'id', {
      seen: false,
      includeSeen: true,
    }),
  } as unknown as MediaItemItemsResponse;
};

export type FacetOption = {
  value: string;
  count: number;
};

export type FacetsResponse = {
  genres: FacetOption[];
  years: FacetOption[];
  languages: FacetOption[];
  creators: FacetOption[];
  publishers: FacetOption[];
  mediaTypes: FacetOption[];
};

/**
 * Builds a base query scoped to the current user's library (mirrors getItemsKnexSql's
 * listItem/seen joins) and applies the same filter params, then fetches only the columns
 * needed for facet aggregation. Aggregation is done in application layer because genres
 * is stored as CSV, not as a normalized table.
 */
export const getFacetsKnex = async (
  args: FacetQueryArgs
): Promise<FacetsResponse> => {
  const {
    userId,
    mediaType,
    filter,
    genres,
    languages,
    creators,
    publishers,
    mediaTypes,
    yearMin,
    yearMax,
    ratingMin,
    ratingMax,
    status,
    onlyOnWatchlist,
    onlySeenItems,
    onlyWithUserRating,
    onlyWithoutUserRating,
  } = args;

  const watchlistId = await getWatchlistId(userId);
  const isPlatformRecommended = args.orderBy === 'platformRecommended';

  // Build query selecting only the columns needed for faceting
  const query = Database.knex
    .select(
      'mediaItem.genres as genres',
      'mediaItem.language as language',
      'mediaItem.releaseDate as releaseDate',
      'mediaItem.mediaType as mediaType',
      'mediaItem.director as director',
      'mediaItem.creator as creator',
      'mediaItem.authors as authors',
      'mediaItem.developer as developer',
      'mediaItem.publisher as publisher',
      'mediaItem.tmdbRating as tmdbRating'
    )
    .from<MediaItemBase>('mediaItem')
    // lastSeen join (user scoping)
    .leftJoin<Seen>(
      (qb) =>
        qb
          .select('mediaItemId')
          .max('date', { as: 'date' })
          .from<Seen>('seen')
          .where('userId', userId)
          .groupBy('mediaItemId')
          .as('lastSeen'),
      'lastSeen.mediaItemId',
      'mediaItem.id'
    )
    // On watchlist join (current user's watchlist — used for status filters)
    .leftJoin<List>('listItem', (qb) => {
      qb.on('listItem.mediaItemId', 'mediaItem.id')
        .andOnNull('listItem.seasonId')
        .andOnNull('listItem.episodeId')
        .andOnVal('listItem.listId', watchlistId);
    })
    // Cross-user list membership — used for platform-recommended base filter
    .leftJoin(
      (qb) =>
        qb
          .select('mediaItemId')
          .from('listItem')
          .whereNull('listItem.seasonId')
          .whereNull('listItem.episodeId')
          .groupBy('mediaItemId')
          .as('anyListItem'),
      'anyListItem.mediaItemId',
      'mediaItem.id'
    )
    // User rating join (needed for status filters)
    .leftJoin<UserRating>(
      (qb) =>
        qb
          .from('userRating')
          .whereNotNull('userRating.rating')
          .orWhereNotNull('userRating.review')
          .as('userRating'),
      (qb) =>
        qb
          .on('userRating.mediaItemId', 'mediaItem.id')
          .andOnVal('userRating.userId', userId)
          .andOnNull('userRating.episodeId')
          .andOnNull('userRating.seasonId')
    );

  if (isPlatformRecommended) {
    // For platform-recommended, compute facets across ALL users' lists so the
    // Media Type facet reflects the full cross-content-type recommendation set.
    query.whereNotNull('anyListItem.mediaItemId');
  } else {
    // User-scoping: only items in user's library (on watchlist OR seen)
    query.where((qb) =>
      qb
        .whereNotNull('listItem.mediaItemId')
        .orWhereNotNull('lastSeen.mediaItemId')
    );
  }

  applySharedLibraryFilters(
    query,
    {
      mediaType,
      filter,
      genres,
      languages,
      creators,
      publishers,
      mediaTypes,
      yearMin,
      yearMax,
      ratingMin,
      ratingMax,
      status,
      onlyOnWatchlist,
      onlySeenItems,
      onlyWithUserRating,
      onlyWithoutUserRating,
    },
    {
      isPlatformRecommended,
      lastSeenColumn: 'lastSeen.mediaItemId',
    }
  );

  // Fetch all matching rows for application-layer aggregation
  const rows = await query;

  // Aggregate facets in application layer
  const genreCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const creatorCounts = new Map<string, number>();
  const publisherCounts = new Map<string, number>();
  const mediaTypeCounts = new Map<string, number>();

  for (const row of rows) {
    // Genres: split CSV and count each individual genre
    if (row.genres) {
      const genreList = (row.genres as string).split(',');
      for (const genre of genreList) {
        const trimmed = genre.trim();
        if (trimmed) {
          incrementFacetCount(genreCounts, trimmed);
        }
      }
    }

    // Years: extract year from releaseDate
    if (row.releaseDate) {
      const yearStr = String(row.releaseDate).substring(0, 4);
      if (yearStr && /^\d{4}$/.test(yearStr)) {
        incrementFacetCount(yearCounts, yearStr);
      }
    }

    // Languages
    if (row.language) {
      const lang = row.language as string;
      incrementFacetCount(languageCounts, lang);
    }

    // Creators: aggregate from director (movies), creator (TV), authors (books/audiobooks), developer (games)
    const creatorFields: (string | null)[] = [
      row.director as string | null,
      row.creator as string | null,
      row.authors as string | null,
      row.developer as string | null,
    ];
    for (const field of creatorFields) {
      if (field) {
        const names = splitCreatorField(field);
        for (const name of names) {
          incrementFacetCount(creatorCounts, name);
        }
      }
    }

    // Publishers
    if (row.publisher) {
      const pub = row.publisher as string;
      incrementFacetCount(publisherCounts, pub);
    }

    // Media types
    if (row.mediaType) {
      const mt = row.mediaType as string;
      incrementFacetCount(mediaTypeCounts, mt);
    }
  }

  const result: FacetsResponse = {
    genres: mapToSortedFacetOptions(genreCounts),
    years: mapToSortedFacetOptions(yearCounts),
    languages: mapToSortedFacetOptions(languageCounts),
    creators: mapToSortedFacetOptions(creatorCounts),
    publishers: mapToSortedFacetOptions(publisherCounts),
    mediaTypes: mapToSortedFacetOptions(mediaTypeCounts),
  };

  // When mediaType is specified, omit mediaTypes from response (already scoped)
  if (mediaType) {
    result.mediaTypes = [];
  }

  // Publishers only included when mediaType=video_game or when no mediaType
  if (mediaType && mediaType !== 'video_game') {
    result.publishers = [];
  }

  return result;
};

export class QueryBuilderHelper {
  static mapFirstUnwatchedEpisode(row: Record<string, unknown>) {
    return {
      description: row['mediaItem.firstUnwatchedEpisode.description'],
      episodeNumber: row['mediaItem.firstUnwatchedEpisode.episodeNumber'],
      id: row['mediaItem.firstUnwatchedEpisode.id'],
      imdbId: row['mediaItem.firstUnwatchedEpisode.imdbId'],
      isSpecialEpisode: Boolean(
        row['mediaItem.firstUnwatchedEpisode.isSpecialEpisode']
      ),
      releaseDate: row['mediaItem.firstUnwatchedEpisode.releaseDate'],
      runtime: row['mediaItem.firstUnwatchedEpisode.runtime'],
      seasonId: row['mediaItem.firstUnwatchedEpisode.seasonId'],
      seasonNumber: row['mediaItem.firstUnwatchedEpisode.seasonNumber'],
      title: row['mediaItem.firstUnwatchedEpisode.title'],
      tmdbId: row['mediaItem.firstUnwatchedEpisode.tmdbId'],
      traktId: row['mediaItem.firstUnwatchedEpisode.traktId'],
      tvdbId: row['mediaItem.firstUnwatchedEpisode.tvdbId'],
      tvShowId: row['mediaItem.firstUnwatchedEpisode.tvShowId'],
    };
  }
  static firstUnwatchedEpisode<
    TRecord extends object = Record<string, unknown>,
    TResult = Record<string, unknown>[]
  >(
    query: Knex.QueryBuilder<TRecord, TResult>,
    userId: number,
    mediaItemId: string
  ) {
    return query
      .select({
        'firstUnwatchedEpisode.episodeNumber':
          'firstUnwatchedEpisode.episodeNumber',
        'firstUnwatchedEpisode.seasonNumber':
          'firstUnwatchedEpisode.seasonNumber',
        'firstUnwatchedEpisode.title': 'firstUnwatchedEpisode.title',
        'firstUnwatchedEpisode.releaseDate':
          'firstUnwatchedEpisode.releaseDate',
        'firstUnwatchedEpisode.description':
          'firstUnwatchedEpisode.description',
        'firstUnwatchedEpisode.id': 'firstUnwatchedEpisode.id',
        'firstUnwatchedEpisode.imdbId': 'firstUnwatchedEpisode.imdbId',
        'firstUnwatchedEpisode.runtime': 'firstUnwatchedEpisode.runtime',
        'firstUnwatchedEpisode.seasonId': 'firstUnwatchedEpisode.seasonId',
        'firstUnwatchedEpisode.tmdbId': 'firstUnwatchedEpisode.tmdbId',
        'firstUnwatchedEpisode.tvShowId': 'firstUnwatchedEpisode.tvShowId',
        'firstUnwatchedEpisode.isSpecialEpisode':
          'firstUnwatchedEpisode.isSpecialEpisode',
        'firstUnwatchedEpisode.traktId': 'firstUnwatchedEpisode.traktId',
        'firstUnwatchedEpisode.tvdbId': 'firstUnwatchedEpisode.tvdbId',
      })
      .leftJoin<TvEpisode>(
        (qb) =>
          qb
            .from<TvEpisode>('episode')
            .select('tvShowId')
            .min('seasonAndEpisodeNumber', {
              as: 'seasonAndEpisodeNumber',
            })
            .leftJoin(
              (qb) =>
                qb
                  .from<Seen>('seen')
                  .where('userId', userId)
                  .where('type', 'seen')
                  .as('seen'),
              'seen.episodeId',
              'episode.id'
            )
            .whereNot('episode.isSpecialEpisode', true)
            .whereNot('episode.releaseDate', '')
            .whereNot('episode.releaseDate', null)
            .where('episode.releaseDate', '<=', new Date().toISOString())
            .whereNull('seen.userId')
            .groupBy('tvShowId')
            .as('firstUnwatchedEpisodeHelper'),
        'firstUnwatchedEpisodeHelper.tvShowId',
        mediaItemId
      )
      .leftJoin<TvEpisode>(
        Database.knex.ref('episode').as('firstUnwatchedEpisode'),
        (qb) =>
          qb
            .on('firstUnwatchedEpisode.tvShowId', mediaItemId)
            .andOn(
              'firstUnwatchedEpisode.seasonAndEpisodeNumber',
              'firstUnwatchedEpisodeHelper.seasonAndEpisodeNumber'
            )
      );
  }
}
