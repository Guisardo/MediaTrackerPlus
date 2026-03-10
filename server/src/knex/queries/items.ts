import _, { random } from 'lodash';
import {
  MediaItemBase,
  MediaType,
  mediaItemColumns,
  MediaItemItemsResponse,
} from 'src/entity/mediaItem';
import { Database } from 'src/dbconfig';

import { Seen } from 'src/entity/seen';
import { UserRating, userRatingColumns } from 'src/entity/userRating';
import { FacetQueryArgs, GetItemsArgs } from 'src/repository/mediaItem';
import { TvEpisode, tvEpisodeColumns } from 'src/entity/tvepisode';
import knex, { Knex } from 'knex';
import { List, listItemColumns } from 'src/entity/list';
import { Progress } from 'src/entity/progress';
import { splitCreatorField } from 'src/utils/normalizeCreators';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getItemsKnex = async (args: any): Promise<any> => {
  const { page } = args;
  const { sqlQuery, sqlCountQuery, sqlPaginationQuery } = await getItemsKnexSql(
    args
  );

  if (page) {
    const [resCount, res] = await Database.knex.transaction(async (trx) => {
      const resCount = await sqlCountQuery.transacting(trx);
      const res = await sqlPaginationQuery.transacting(trx);

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

    const data = res.map(mapRawResult);

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
    return res.map(mapRawResult);
  }
};

const getItemsKnexSql = async (args: GetItemsArgs & { year: string }) => {
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

  const watchlist = await Database.knex('list')
    .select('id')
    .where('userId', userId)
    .where('isWatchlist', true)
    .first();

  if (watchlist === undefined) {
    throw new Error(`user ${userId} has no watchlist`);
  }

  const watchlistId = watchlist.id;

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
  if (orderBy === 'platformRecommended' && groupId != null) {
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
    if (orderBy === 'platformRecommended') {
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

      if (onlyOnWatchlist) {
        query.whereNotNull('listItem.mediaItemId');
      }
    }

    if (onlySeenItems === true) {
      query.whereNotNull('lastSeen2.mediaItemId');
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

    // Platform-recommended view: exclude items already watched by any platform member.
    // Non-TV: exclude if any user has a seen entry (episodeId IS NULL).
    // TV shows: exclude if any user has completed all non-special episodes.
    if (orderBy === 'platformRecommended') {
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
    }

    // Media type
    if (mediaType) {
      query.andWhere('mediaItem.mediaType', mediaType);
    }

    // Filter
    if (filter && filter.trim().length > 0) {
      query.andWhere('mediaItem.title', 'LIKE', `%${filter}%`);
    }

    if (year) {
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
    }

    if (genre) {
      query.andWhere('mediaItem.genres', 'LIKE', `%${genre}%`);
    }

    // Multi-value genres filter (OR logic within dimension, CSV LIKE matching)
    if (genres) {
      const genreArray = genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      if (genreArray.length > 0) {
        query.andWhere((qb) => {
          genreArray.forEach((g, index) => {
            if (index === 0) {
              qb.where('mediaItem.genres', 'LIKE', `%${g}%`);
            } else {
              qb.orWhere('mediaItem.genres', 'LIKE', `%${g}%`);
            }
          });
        });
      }
    }

    // Languages filter (OR logic, matches language column)
    if (languages) {
      const languageArray = languages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      if (languageArray.length > 0) {
        query.whereIn('mediaItem.language', languageArray);
      }
    }

    // Creators filter (OR logic, searches across director/creator/authors/developer columns)
    if (creators) {
      const creatorArray = creators
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (creatorArray.length > 0) {
        query.andWhere((qb) => {
          creatorArray.forEach((c) => {
            qb.orWhere('mediaItem.director', 'LIKE', `%${c}%`);
            qb.orWhere('mediaItem.creator', 'LIKE', `%${c}%`);
            qb.orWhere('mediaItem.authors', 'LIKE', `%${c}%`);
            qb.orWhere('mediaItem.developer', 'LIKE', `%${c}%`);
          });
        });
      }
    }

    // Publishers filter (OR logic, matches publisher column, plain string equality)
    if (publishers) {
      const publisherArray = publishers
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (publisherArray.length > 0) {
        query.whereIn('mediaItem.publisher', publisherArray);
      }
    }

    // MediaTypes filter (OR logic, matches mediaType column)
    if (mediaTypes) {
      const mediaTypeArray = mediaTypes
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      if (mediaTypeArray.length > 0) {
        query.whereIn('mediaItem.mediaType', mediaTypeArray);
      }
    }

    // Year range filter (inclusive bounds on releaseDate year)
    if (yearMin !== undefined || yearMax !== undefined) {
      if (yearMin !== undefined) {
        query.andWhere(
          'mediaItem.releaseDate',
          '>=',
          new Date(yearMin, 0, 1).toISOString()
        );
      }
      if (yearMax !== undefined) {
        query.andWhere(
          'mediaItem.releaseDate',
          '<=',
          new Date(yearMax, 11, 31, 23, 59, 59, 999).toISOString()
        );
      }
    }

    // Rating range filter (inclusive bounds, excludes items with no rating when ratingMin > 0)
    if (ratingMin !== undefined || ratingMax !== undefined) {
      if (ratingMin !== undefined && ratingMin > 0) {
        query
          .whereNotNull('mediaItem.tmdbRating')
          .andWhere('mediaItem.tmdbRating', '>=', ratingMin);
      }
      if (ratingMax !== undefined) {
        query.andWhere('mediaItem.tmdbRating', '<=', ratingMax);
      }
    }

    // Status filter: maps comma-separated status keys to boolean flags
    // Applies AND logic -- item must satisfy all selected status constraints
    if (status) {
      const statusArray = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusArray.includes('rated')) {
        query.whereNotNull('userRating.rating');
      }
      if (statusArray.includes('unrated')) {
        query.whereNull('userRating.rating');
      }
      if (statusArray.includes('watchlist')) {
        query.whereNotNull('listItem.mediaItemId');
      }
      if (statusArray.includes('seen')) {
        query.whereNotNull('lastSeen2.mediaItemId');
      }
    }

    // Next airing
    if (onlyWithNextAiring) {
      if (mediaType) {
        if (mediaType === 'tv') {
          query.andWhere('upcomingEpisode.releaseDate', '>', currentDateString);
        } else {
          query.andWhere('mediaItem.releaseDate', '>', currentDateString);
        }
      } else {
        query.andWhere((qb) =>
          qb
            .where((qb) =>
              qb
                .whereNot('mediaItem.mediaType', 'tv')
                .andWhere('mediaItem.releaseDate', '>', currentDateString)
            )
            .orWhere((qb) =>
              qb
                .where('mediaItem.mediaType', 'tv')
                .andWhere('upcomingEpisode.releaseDate', '>', currentDateString)
            )
        );
      }

      query.whereNotNull('listItem.mediaItemId');
    }

    // nextEpisodesToWatchSubQuery
    if (onlyWithNextEpisodesToWatch === true) {
      query
        .where('seenEpisodesCount', '>', 0)
        .andWhere('unseenEpisodesCount', '>', 0);
    }

    if (onlyWithUserRating === true) {
      query.whereNotNull('userRating.rating');
    }

    if (onlyWithoutUserRating === true) {
      query.whereNull('userRating.rating');
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

  if (orderBy && sortOrder) {
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
        query.orderByRaw(`CASE WHEN "listItem"."estimatedRating" IS NULL THEN 1 ELSE 0 END ASC`);
        query.orderByRaw(`CASE
                            WHEN "listItem"."estimatedRating" IS NOT NULL AND "mediaItem"."tmdbRating" IS NOT NULL
                              THEN ("listItem"."estimatedRating" * 0.6 + "mediaItem"."tmdbRating" * 0.4)
                            ELSE "listItem"."estimatedRating"
                          END DESC NULLS LAST`);
        query.orderBy('mediaItem.title', 'asc');
        break;

      // platform-recommended: community consensus (70%) weighted higher than external aggregators (30%).
      // Uses platformRating (cached average of all user ratings on this platform) instead of estimatedRating
      // (personal AI estimate for the current user). The 70/30 weighting reflects stronger trust in
      // aggregated community data vs. external sources, contrasting with 'recommended' which uses
      // 60/40 for personal estimates (single-user signal is weaker than community signal).
      //
      // When groupId is provided, uses gpr.rating (group-scoped cached rating from groupPlatformRating)
      // instead of mediaItem.platformRating. The same 70/30 formula is applied.
      //
      // Two-tier ordering:
      //   Tier 1 (rating IS NOT NULL): items with real community ratings — sorted by the
      //           70/30 blend (or rating alone when tmdbRating is absent).
      //   Tier 2 (rating IS NULL): items not yet rated — sorted by
      //           tmdbRating as a proxy, or last (NULLS LAST) when tmdbRating is also absent.
      case 'platformRecommended':
        if (groupId != null) {
          // Group-scoped: use gpr.rating (from the LEFT JOIN added above) instead of mediaItem.platformRating.
          // Step 1: tier separation — group-rated items always precede unrated items.
          query.orderByRaw(
            `CASE WHEN "gpr"."rating" IS NULL THEN 1 ELSE 0 END ASC`
          );
          // Step 2: within each tier, rank by score descending.
          query.orderByRaw(`CASE
                              WHEN "gpr"."rating" IS NOT NULL AND "mediaItem"."tmdbRating" IS NOT NULL
                                THEN ("gpr"."rating" * 0.7 + "mediaItem"."tmdbRating" * 0.3)
                              WHEN "gpr"."rating" IS NOT NULL
                                THEN "gpr"."rating"
                              ELSE "mediaItem"."tmdbRating"
                            END DESC NULLS LAST`);
        } else {
          // Global platform path (no groupId): uses mediaItem.platformRating.
          // Step 1: tier separation — platform-rated items always precede unrated items.
          query.orderByRaw(
            `CASE WHEN "mediaItem"."platformRating" IS NULL THEN 1 ELSE 0 END ASC`
          );
          // Step 2: within each tier, rank by score descending.
          //   Tier 1 — (1) both ratings: 70/30 blend, (2) platformRating only: platformRating.
          //   Tier 2 — tmdbRating fallback; items with neither rating sort last (NULLS LAST).
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
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapRawResult = (row: any): MediaItemItemsResponse => {
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
    lastSeenAt: row['lastSeenAt'],
    progress: row['progress'],
    poster: row['mediaItem.posterId']
      ? `/img/${row['mediaItem.posterId']}`
      : null,
    posterSmall: row['mediaItem.posterId']
      ? `/img/${row['mediaItem.posterId']}?size=small`
      : null,
    backdrop: row['mediaItem.backdropId']
      ? `/img/${row['mediaItem.backdropId']}`
      : null,
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
    userRating: row['userRating.id']
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
      : undefined,
    firstUnwatchedEpisode: row['firstUnwatchedEpisode.id']
      ? {
          id: row['firstUnwatchedEpisode.id'],
          title: row['firstUnwatchedEpisode.title'],
          description: row['firstUnwatchedEpisode.description'],
          episodeNumber: row['firstUnwatchedEpisode.episodeNumber'],
          seasonNumber: row['firstUnwatchedEpisode.seasonNumber'],
          releaseDate: row['firstUnwatchedEpisode.releaseDate'],
          tvShowId: row['firstUnwatchedEpisode.tvShowId'],
          tmdbId: row['firstUnwatchedEpisode.tmdbId'],
          imdbId: row['firstUnwatchedEpisode.imdbId'],
          tvdbId: row['firstUnwatchedEpisode.tvdbId'],
          traktId: row['firstUnwatchedEpisode.traktId'],
          runtime: row['firstUnwatchedEpisode.runtime'],
          seasonId: row['firstUnwatchedEpisode.seasonId'],
          isSpecialEpisode: Boolean(
            row['firstUnwatchedEpisode.isSpecialEpisode']
          ),
          userRating: undefined,
          seenHistory: undefined,
          lastSeenAt: undefined,
        }
      : undefined,
    upcomingEpisode: row['upcomingEpisode.releaseDate']
      ? {
          id: row['upcomingEpisode.id'],
          title: row['upcomingEpisode.title'],
          description: row['upcomingEpisode.description'],
          episodeNumber: row['upcomingEpisode.episodeNumber'],
          seasonNumber: row['upcomingEpisode.seasonNumber'],
          releaseDate: row['upcomingEpisode.releaseDate'],
          runtime: row['upcomingEpisode.runtime'],
          tvShowId: row['upcomingEpisode.tvShowId'],
          tmdbId: row['upcomingEpisode.tmdbId'],
          imdbId: row['upcomingEpisode.imdbId'],
          tvdbId: row['upcomingEpisode.tvdbId'],
          traktId: row['upcomingEpisode.traktId'],
          seasonId: row['upcomingEpisode.seasonId'],
          isSpecialEpisode: Boolean(row['upcomingEpisode.isSpecialEpisode']),
          userRating: undefined,
          seenHistory: undefined,
          lastSeenAt: undefined,
          seen: false,
        }
      : undefined,
    lastAiredEpisode: row['lastAiredEpisode.id']
      ? {
          id: row['lastAiredEpisode.id'],
          title: row['lastAiredEpisode.title'],
          description: row['lastAiredEpisode.description'],
          episodeNumber: row['lastAiredEpisode.episodeNumber'],
          seasonNumber: row['lastAiredEpisode.seasonNumber'],
          releaseDate: row['lastAiredEpisode.releaseDate'],
          runtime: row['lastAiredEpisode.runtime'],
          tvShowId: row['lastAiredEpisode.tvShowId'],
          tmdbId: row['lastAiredEpisode.tmdbId'],
          imdbId: row['lastAiredEpisode.imdbId'],
          tvdbId: row['lastAiredEpisode.tvdbId'],
          traktId: row['lastAiredEpisode.traktId'],
          seasonId: row['lastAiredEpisode.seasonId'],
          isSpecialEpisode: Boolean(row['lastAiredEpisode.isSpecialEpisode']),
          userRating: undefined,
          seenHistory: undefined,
          lastSeenAt: undefined,
          seen: false,
        }
      : undefined,
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
    onlyWithNextAiring,
    onlyWithNextEpisodesToWatch,
    onlyWithUserRating,
    onlyWithoutUserRating,
    onlyWithProgress,
    orderBy,
  } = args;

  const currentDateString = new Date().toISOString();

  const watchlist = await Database.knex('list')
    .select('id')
    .where('userId', userId)
    .where('isWatchlist', true)
    .first();

  if (watchlist === undefined) {
    throw new Error(`user ${userId} has no watchlist`);
  }

  const watchlistId = watchlist.id;
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

  // Apply filters (same logic as getItemsKnexSql)
  if (mediaType) {
    query.andWhere('mediaItem.mediaType', mediaType);
  }

  if (filter && filter.trim().length > 0) {
    query.andWhere('mediaItem.title', 'LIKE', `%${filter}%`);
  }

  if (genres) {
    const genreArray = genres
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    if (genreArray.length > 0) {
      query.andWhere((qb) => {
        genreArray.forEach((g, index) => {
          if (index === 0) {
            qb.where('mediaItem.genres', 'LIKE', `%${g}%`);
          } else {
            qb.orWhere('mediaItem.genres', 'LIKE', `%${g}%`);
          }
        });
      });
    }
  }

  if (languages) {
    const languageArray = languages
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    if (languageArray.length > 0) {
      query.whereIn('mediaItem.language', languageArray);
    }
  }

  if (creators) {
    const creatorArray = creators
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (creatorArray.length > 0) {
      query.andWhere((qb) => {
        creatorArray.forEach((c) => {
          qb.orWhere('mediaItem.director', 'LIKE', `%${c}%`);
          qb.orWhere('mediaItem.creator', 'LIKE', `%${c}%`);
          qb.orWhere('mediaItem.authors', 'LIKE', `%${c}%`);
          qb.orWhere('mediaItem.developer', 'LIKE', `%${c}%`);
        });
      });
    }
  }

  if (publishers) {
    const publisherArray = publishers
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (publisherArray.length > 0) {
      query.whereIn('mediaItem.publisher', publisherArray);
    }
  }

  if (mediaTypes) {
    const mediaTypeArray = mediaTypes
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (mediaTypeArray.length > 0) {
      query.whereIn('mediaItem.mediaType', mediaTypeArray);
    }
  }

  if (yearMin !== undefined || yearMax !== undefined) {
    if (yearMin !== undefined) {
      query.andWhere(
        'mediaItem.releaseDate',
        '>=',
        new Date(yearMin, 0, 1).toISOString()
      );
    }
    if (yearMax !== undefined) {
      query.andWhere(
        'mediaItem.releaseDate',
        '<=',
        new Date(yearMax, 11, 31, 23, 59, 59, 999).toISOString()
      );
    }
  }

  if (ratingMin !== undefined || ratingMax !== undefined) {
    if (ratingMin !== undefined && ratingMin > 0) {
      query
        .whereNotNull('mediaItem.tmdbRating')
        .andWhere('mediaItem.tmdbRating', '>=', ratingMin);
    }
    if (ratingMax !== undefined) {
      query.andWhere('mediaItem.tmdbRating', '<=', ratingMax);
    }
  }

  if (status) {
    const statusArray = status
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statusArray.includes('rated')) {
      query.whereNotNull('userRating.rating');
    }
    if (statusArray.includes('unrated')) {
      query.whereNull('userRating.rating');
    }
    if (statusArray.includes('watchlist')) {
      query.whereNotNull('listItem.mediaItemId');
    }
    if (statusArray.includes('seen')) {
      query.whereNotNull('lastSeen.mediaItemId');
    }
  }

  if (onlyOnWatchlist && !isPlatformRecommended) {
    query.whereNotNull('listItem.mediaItemId');
  }

  if (onlySeenItems === true) {
    query.whereNotNull('lastSeen.mediaItemId');
  }

  if (onlyWithUserRating === true) {
    query.whereNotNull('userRating.rating');
  }

  if (onlyWithoutUserRating === true) {
    query.whereNull('userRating.rating');
  }

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
          genreCounts.set(trimmed, (genreCounts.get(trimmed) || 0) + 1);
        }
      }
    }

    // Years: extract year from releaseDate
    if (row.releaseDate) {
      const yearStr = String(row.releaseDate).substring(0, 4);
      if (yearStr && /^\d{4}$/.test(yearStr)) {
        yearCounts.set(yearStr, (yearCounts.get(yearStr) || 0) + 1);
      }
    }

    // Languages
    if (row.language) {
      const lang = row.language as string;
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
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
          creatorCounts.set(name, (creatorCounts.get(name) || 0) + 1);
        }
      }
    }

    // Publishers
    if (row.publisher) {
      const pub = row.publisher as string;
      publisherCounts.set(pub, (publisherCounts.get(pub) || 0) + 1);
    }

    // Media types
    if (row.mediaType) {
      const mt = row.mediaType as string;
      mediaTypeCounts.set(mt, (mediaTypeCounts.get(mt) || 0) + 1);
    }
  }

  // Convert maps to sorted arrays (descending by count), excluding zero counts
  const mapToSortedArray = (map: Map<string, number>): FacetOption[] =>
    Array.from(map.entries())
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  const result: FacetsResponse = {
    genres: mapToSortedArray(genreCounts),
    years: mapToSortedArray(yearCounts),
    languages: mapToSortedArray(languageCounts),
    creators: mapToSortedArray(creatorCounts),
    publishers: mapToSortedArray(publisherCounts),
    mediaTypes: mapToSortedArray(mediaTypeCounts),
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
    TRecord = unknown,
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
