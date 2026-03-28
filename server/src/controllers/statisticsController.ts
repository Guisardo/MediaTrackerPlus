import _ from 'lodash';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';

import { Database } from 'src/dbconfig';
import { MediaType } from 'src/entity/mediaItem';
import { userRepository } from 'src/repository/user';
import {
  computeViewerAge,
  applyAgeGatingFilter,
} from 'src/utils/ageEligibility';

/**
 * @openapi_tags Statistics
 */
export class StatisticsController {
  /**
   * @openapi_operationId summary
   */
  summary = createExpressRoute<{
    method: 'get';
    path: '/api/statistics/summary';
    responseBody: StatisticsSummaryResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const selfUser = await userRepository.findOneSelf({ id: userId });
    const viewerAge = computeViewerAge(selfUser?.dateOfBirth);
    const statistics = await userStatisticsSummary(userId, false, viewerAge);
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(statistics);
  });

  seeninyear = createExpressRoute<{
    method: 'get';
    path: '/api/statistics/seeninyear';
    requestQuery: { year?: string };
    responseBody: StatisticsSummaryResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const selfUser = await userRepository.findOneSelf({ id: userId });
    const viewerAge = computeViewerAge(selfUser?.dateOfBirth);
    const statistics = await userStatisticsSummary(userId, req.query.year, viewerAge);
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(statistics);
  });

  genres = createExpressRoute<{
    method: 'get';
    path: '/api/statistics/genresinyear';
    requestQuery: { year?: string };
    responseBody: GenreSummeryResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const selfUser = await userRepository.findOneSelf({ id: userId });
    const viewerAge = computeViewerAge(selfUser?.dateOfBirth);
    const statistics = await userGenreStatistics(userId, req.query.year, viewerAge);
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    res.send(statistics);
  });
}

type StatisticsSummaryResponse = {
  [Key in MediaType]: {
    numberOfPages?: number;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  };
};

type GenreSummeryResponse = {
  [Key in MediaType]: { genre: string; count: number }[];
};

export const userStatisticsSummary = async (
  userId: number,
  date: false | string = false,
  viewerAge: number | null = null
) => {
  const res = (await Database.knex('seen')
    .sum({
      runtime: Database.knex.raw(`CASE
                           WHEN "episode"."runtime" IS NOT NULL THEN "episode"."runtime"
                           ELSE "mediaItem"."runtime"
                         END * 1
                           `),
      numberOfPages: Database.knex.raw(`CASE
                                 WHEN "mediaItem"."numberOfPages" IS NOT NULL THEN "mediaItem"."numberOfPages"
                                 ELSE 0
                               END * 1`),
      duration: Database.knex.raw(`CASE
                            WHEN "seen"."duration" IS NOT NULL THEN "seen"."duration"
                            ELSE 0
                          END `),
    })
    .select('mediaItem.mediaType')
    .count({
      episodes: Database.knex.raw('DISTINCT "episode"."id"'),
      items: Database.knex.raw('DISTINCT "mediaItem"."id"'),
      plays: '*',
    })
    .where((qb) => {
      qb.where('userId', userId);
      if (date && date != 'noyear') {
        qb.andWhere(
          Database.knex.raw(
            "strftime('%Y', datetime(\"seen\".\"date\" / 1000, 'unixepoch')) is '" +
              date +
              "'"
          )
        );
      } else if (date && date == 'noyear') {
        qb.andWhere(
          Database.knex.raw(
            'strftime(\'%Y\', datetime("seen"."date" / 1000, \'unixepoch\')) is NULL'
          )
        );
      }
    })

    .leftJoin('mediaItem', 'mediaItem.id', 'seen.mediaItemId')
    .leftJoin('episode', 'episode.id', 'seen.episodeId')
    // Age gating: exclude restricted items from aggregates
    .modify((qb) => {
      applyAgeGatingFilter(qb, viewerAge);
    })
    .groupBy('mediaItem.mediaType')) as Array<{
    mediaType: MediaType;
    runtime: number;
    numberOfPages: number;
    duration: number;
    episodes: number;
    items: number;
    plays: number;
  }>;

  return _(res)
    .keyBy('mediaType')
    .mapValues((item) => ({
      ..._.omit(item, ['runtime', 'mediaType']),
      numberOfPages: Math.round(item.numberOfPages),
      duration: Math.round(
        item.mediaType === 'video_game' || item.mediaType === 'book'
          ? item.duration
          : item.runtime
      ),
    }))
    .value() as StatisticsSummaryResponse;
};

export const userGenreStatistics = async (
  userId: number,
  date: false | string = false,
  viewerAge: number | null = null
) => {
  const res = (await Database.knex('seen')
    .select('mediaItem.mediaType')
    .select('mediaItem.genres')
    .count({
      genre_count: Database.knex.raw('Distinct "mediaItem"."id"'),
    })
    .where((qb) => {
      qb.where('userId', userId);
      if (date && date != 'noyear' && date != 'allyear') {
        qb.andWhere(
          Database.knex.raw(
            "strftime('%Y', datetime(\"seen\".\"date\" / 1000, 'unixepoch')) is '" +
              date +
              "'"
          )
        );
      } else if (date && date == 'noyear') {
        qb.andWhere(
          Database.knex.raw(
            'strftime(\'%Y\', datetime("seen"."date" / 1000, \'unixepoch\')) is NULL'
          )
        );
      }
    })

    .leftJoin('mediaItem', 'mediaItem.id', 'seen.mediaItemId')
    .leftJoin('episode', 'episode.id', 'seen.episodeId')
    // Age gating: exclude restricted items from aggregates
    .modify((qb) => {
      applyAgeGatingFilter(qb, viewerAge);
    })
    .groupBy('mediaItem.genres')) as Array<{
    mediaType: MediaType;
    genres: string;
    genre_count: number;
  }>;

  const result = convertGenreResponse(res);
  return result;
};

const convertGenreResponse = (
  res: { mediaType: string; genres: string; genre_count: number }[]
) => {
  const splitted = split(res);

  const grouped = group(splitted);

  return grouped;
};

const split = (
  res: { mediaType: string; genres: string; genre_count: number }[]
) => {
  return _.values(
    _.reduce(
      res,
      function (
        result: {
          [id: string]: { media_type: string; genre: string; count: number };
        },
        obj
      ) {
        if (!obj.genres) return result;
        const allGenres = obj.genres.split(',');
        for (let i = 0; i < allGenres?.length; i++) {
          const typeGenre = `${obj.mediaType}_${allGenres[i]}`;
          result[typeGenre] = {
            media_type: obj.mediaType,
            genre: allGenres[i],
            count:
              obj.genre_count +
              (result[typeGenre] ? result[typeGenre].count : 0),
          };
        }

        return result;
      },
      {}
    )
  );
};

const group = (
  splitted: {
    media_type: string;
    genre: string;
    count: number;
  }[]
) => {
  return _(splitted)
    .groupBy('media_type')
    .mapValues((item) => {
      const result: { genre: string; count: number }[] = [];
      for (let i = 0; i < item.length; i++) {
        result.push({ ..._.omit(item[i], ['media_type']) });
      }
      result.sort(
        (a, b) => b.count - a.count || a.genre.localeCompare(b.genre)
      );
      return result;
    })
    .value() as GenreSummeryResponse;
};
