import _ from 'lodash';
import { addHours, parseISO } from 'date-fns';

import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { TvEpisodeFilters } from 'src/entity/tvepisode';
import { tvEpisodeRepository } from 'src/repository/episode';
import { LastSeenAt, mediaItemRepository } from 'src/repository/mediaItem';
import { tvSeasonRepository } from 'src/repository/season';
import { seenRepository } from 'src/repository/seen';
import { Seen } from 'src/entity/seen';
import { logger } from 'src/logger';
import { listItemRepository } from 'src/repository/listItemRepository';
import { MediaType } from 'src/entity/mediaItem';
import { findMediaItemOrEpisodeByExternalId } from 'src/metadata/findByExternalId';
import { Database } from 'src/dbconfig';
import { definedOrNull, definedOrUndefined } from 'src/repository/repository';

/**
 * @openapi_tags Seen
 */
export class SeenController {
  /**
   * @openapi_operationId add
   */
  add = createExpressRoute<{
    method: 'put';
    path: '/api/seen';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
      lastSeenEpisodeId?: number;
      lastSeenAt?: LastSeenAt;
      date?: number;
      duration?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      mediaItemId,
      seasonId,
      episodeId,
      lastSeenAt,
      lastSeenEpisodeId,
      duration,
    } = req.query;

    let date = req.query.date ? new Date(req.query.date) : null;

    const mediaItem = await mediaItemRepository.findOne({
      id: mediaItemId,
    });

    if (!mediaItem) {
      res.sendStatus(400);
      return;
    }

    if (date && new Date(date) > addHours(new Date(), 1)) {
      res.sendStatus(400);
      logger.debug(
        `seen date (${new Date(
          date
        )}) is older then current date (${new Date()})`
      );
      return;
    }

    if (!date) {
      if (lastSeenAt === 'now') {
        date = new Date();
      } else if (lastSeenAt === 'unknown') {
        date = null;
      } else if (lastSeenAt === 'release_date') {
        if (episodeId) {
          const episode = await tvEpisodeRepository.findOne({
            id: episodeId,
          });

          if (!episode?.releaseDate) {
            res.sendStatus(400);
            return;
          }

          date = parseISO(episode.releaseDate);
        } else if (seasonId) {
          const season = await tvSeasonRepository.findOne({
            id: seasonId,
          });
          if (!season?.releaseDate) {
            res.sendStatus(400);
            return;
          }

          date = parseISO(season.releaseDate);
        } else {
          if (!mediaItem.releaseDate) {
            res.sendStatus(400);
            return;
          }
          date = parseISO(mediaItem.releaseDate);
        }
      }
    }

    if (lastSeenEpisodeId) {
      const episodes = await tvEpisodeRepository.find({
        tvShowId: mediaItemId,
        seasonId: definedOrUndefined(seasonId),
      });

      const lastEpisode = episodes.find(
        (episode) => episode.id === lastSeenEpisodeId
      );

      if (!lastEpisode) {
        throw new Error(`No episode with id ${lastSeenEpisodeId}`);
      }

      const seenEpisodes = episodes
        .filter(TvEpisodeFilters.unwatchedEpisodes)
        .filter(TvEpisodeFilters.releasedEpisodes)
        .filter(TvEpisodeFilters.nonSpecialEpisodes)
        .filter(
          (episode) =>
            episode.seasonNumber < lastEpisode.seasonNumber ||
            (episode.seasonNumber === lastEpisode.seasonNumber &&
              episode.episodeNumber <= lastEpisode.episodeNumber)
        );

      await seenRepository.createMany(
        seenEpisodes.map((episode) => ({
          userId: userId,
          mediaItemId: mediaItemId,
          seasonId: episode.seasonId,
          episodeId: episode.id,
          date:
            lastSeenAt === 'release_date'
              ? parseISO(episode.releaseDate!).getTime()
              : definedOrNull(date?.getTime()),
          duration:
            (episode.runtime ?? mediaItem.runtime) != null
              ? (episode.runtime ?? mediaItem.runtime)! * 60 * 1000
              : undefined,
        }))
      );
    } else {
      if (episodeId) {
        const episode = await tvEpisodeRepository.findOne({
          id: episodeId,
        });

        if (!episode) {
          res.sendStatus(400);
          return;
        }

        await seenRepository.create({
          userId: userId,
          mediaItemId: mediaItemId,
          episodeId: episodeId,
          date: definedOrNull(date?.getTime()),
        });
      } else if (seasonId) {
        const episodes = await tvEpisodeRepository.find({
          seasonId: seasonId,
        });

        await seenRepository.createMany(
          episodes
            .filter(TvEpisodeFilters.unwatchedEpisodes)
            .filter(TvEpisodeFilters.nonSpecialEpisodes)
            .filter(TvEpisodeFilters.releasedEpisodes)
            .map(
              (episode): Seen => ({
                userId: userId,
                mediaItemId: mediaItemId,
                episodeId: episode.id,
                date:
                  lastSeenAt === 'release_date'
                    ? parseISO(episode.releaseDate!).getTime()
                    : definedOrNull(date?.getTime()),
                duration:
                  (episode.runtime ?? mediaItem.runtime) != null
                    ? (episode.runtime ?? mediaItem.runtime)! * 60 * 1000
                    : undefined,
              })
            )
        );
      } else {
        if (mediaItem.mediaType === 'tv') {
          const episodes = await tvEpisodeRepository.find({
            tvShowId: mediaItemId,
          });

          await seenRepository.createMany(
            episodes
              .filter(TvEpisodeFilters.nonSpecialEpisodes)
              .filter(TvEpisodeFilters.releasedEpisodes)
              .map(
                (episode): Seen => ({
                  userId: userId,
                  mediaItemId: mediaItemId,
                  episodeId: episode.id,
                  date:
                    lastSeenAt === 'release_date'
                      ? parseISO(episode.releaseDate!).getTime()
                      : definedOrNull(date?.getTime()),
                  duration:
                    (episode.runtime ?? mediaItem.runtime) != null
                      ? (episode.runtime ?? mediaItem.runtime)! * 60 * 1000
                      : undefined,
                })
              )
          );
        } else {
          await seenRepository.create({
            userId: userId,
            mediaItemId: mediaItemId,
            episodeId: null,
            date: definedOrNull(date?.getTime()),
            duration: definedOrNull(duration),
          });
        }
      }

      if (mediaItem.mediaType !== 'tv') {
        await listItemRepository.removeItem({
          userId: userId,
          mediaItemId: mediaItemId,
          watchlist: true,
        });
      }
    }

    res.send();
  });

  /**
   * @openapi_operationId addByExternalId
   */
  addByExternalId = createExpressRoute<{
    method: 'put';
    path: '/api/seen/by-external-id';
    requestBody: {
      mediaType: MediaType;
      id: {
        imdbId?: string;
        tmdbId?: number;
      };
      seasonNumber?: number;
      episodeNumber?: number;
      duration?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { mediaType, id, seasonNumber, episodeNumber, duration } = req.body;

    const { mediaItem, episode, error } =
      await findMediaItemOrEpisodeByExternalId({
        mediaType: mediaType,
        id: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      });

    if (error) {
      res.status(400);
      res.send(error);
      return;
    }

    if (!mediaItem) {
      res.sendStatus(400);
      return;
    }

    await Database.knex.transaction(async (trx) => {
      const previousSeenItem = await trx<Seen>('seen')
        .where('userId', userId)
        .where('mediaItemId', mediaItem.id)
        .modify((qb) => {
          if (episode?.id == null) {
            qb.whereNull('episodeId');
          } else {
            qb.where('episodeId', episode.id);
          }
        })
        .where('date', '>', Date.now() - 1000 * 60 * 60 * 12);

      if (previousSeenItem.length > 0) {
        const previousSeenDate = previousSeenItem[0]?.date;
        logger.debug(
          `seen entry for userId ${userId}, mediaItemId: ${
            mediaItem.id
          }, episodeId: ${episode?.id} already exists, at ${new Date(
            previousSeenDate ?? Date.now()
          )}`
        );

        return;
      }

      logger.debug(
        `adding seen entry for userId ${userId}, mediaItemId: ${mediaItem.id}, episodeId: ${episode?.id}`
      );

      await trx<Seen>('seen').insert({
        userId: userId,
        mediaItemId: mediaItem.id,
        episodeId: episode?.id || null,
        date: Date.now(),
        duration: duration,
      });
    });

    res.status(200);
  });

  /**
   * @openapi_operationId deleteById
   */
  deleteById = createExpressRoute<{
    method: 'delete';
    path: '/api/seen/:seenId';
    pathParams: {
      seenId: number;
    };
  }>(async (req, res) => {
    const { seenId } = req.params;

    await seenRepository.delete({
      id: seenId,
    });

    res.send();
  });

  /**
   * @openapi_operationId delete
   */
  removeFromSeenHistory = createExpressRoute<{
    method: 'delete';
    path: '/api/seen/';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { mediaItemId, seasonId, episodeId } = req.query;

    if (episodeId) {
      await seenRepository.delete({
        userId: userId,
        episodeId: episodeId,
      });
    } else if (seasonId) {
      await seenRepository.deleteForTvSeason({
        userId: userId,
        seasonId: seasonId,
      });
    } else {
      await seenRepository.delete({
        userId: userId,
        mediaItemId: mediaItemId,
      });
    }

    res.send();
  });
}
