import _, { values } from 'lodash';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';

import { Database } from 'src/dbconfig';
import { MediaType } from 'src/entity/mediaItem';

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
    const statistics = await userStatisticsSummary(userId);
    res.send(statistics);
  });

  seeninyear = createExpressRoute<{
    method: 'get';
    path: '/api/statistics/seeninyear';
    requestQuery: { year: string };
    responseBody: StatisticsSummaryResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const statistics = await userStatisticsSummary(userId, req.query.year);
    res.send(statistics);
  });

  genres = createExpressRoute<{
    method: 'get';
    path: '/api/statistics/genresinyear';
    requestQuery: { year?: string };
    responseBody: GenreSummeryResponse;
  }>(async (req, res) => {
    const userId = Number(req.user);
    const statistics = await userGenreStatistics(userId, req.query.year);
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
  date: false | string = false
) => {
  const res = await Database.knex('seen')
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
    .groupBy('mediaItem.mediaType');

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
  date: false | string = false
) => {
  const res = await Database.knex('seen')
    .select('mediaItem.mediaType')
    .select('mediaItem.genres')
    .count({
      genre_count: '*',
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
    .groupBy('mediaItem.genres');

  console.log('Res', res);

  const result = convertGenreResponse(res);

  console.log('Result', result);

  return result;
};

const convertGenreResponse = (
  res: { mediaType: string; genres: string; genre_count: number }[]
) => {
  const result: GenreSummeryResponse = null;

  const splitted = _.values(
    _.reduce(
      res,
      function (
        result: {
          [id: string]: { media_type: string; genre: string; count: number };
        },
        obj
      ) {
        const allGenres = obj.genres.split(',');
        for (let i = 0; i < allGenres.length; i++) {
          result[allGenres[i]] = {
            media_type: obj.mediaType,
            genre: allGenres[i],
            count:
              obj.genre_count +
              (result[allGenres[i]] ? result[allGenres[i]].count : 0),
          };
        }
        return result;
      },
      {}
    )
  );
  const grouped = _(splitted)
    .groupBy('media_type')
    .mapValues((item) => {
      const result = [];
      for (let i = 0; i < item.length; i++) {
        result.push({ ..._.omit(item[i], ['media_type']) });
      }
      return result;
    })
    .value() as GenreSummeryResponse;

  return grouped;
};
