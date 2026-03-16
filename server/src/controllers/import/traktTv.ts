import Express from 'express';
import _ from 'lodash';

import { MediaItemBaseWithSeasons, MediaType } from 'src/entity/mediaItem';
import { Seen } from 'src/entity/seen';
import { UserRating } from 'src/entity/userRating';
import { TraktApi, TraktTvExport } from 'src/export/trakttv';
import { findMediaItemByExternalIdInExternalSources } from 'src/metadata/findByExternalId';
import { logger } from 'src/logger';
import { listRepository } from 'src/repository/list';
import { listItemRepository } from 'src/repository/listItemRepository';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { recalculateGroupPlatformRatingsForUser } from 'src/repository/groupPlatformRatingCache';
import { seenRepository } from 'src/repository/seen';
import { userRatingRepository } from 'src/repository/userRating';
import { updateMediaItem } from 'src/updateMetadata';
import { inArray } from 'src/utils';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';

type ImportState =
  | 'uninitialized'
  | 'waiting-for-authentication'
  | 'exporting'
  | 'updating-metadata'
  | 'importing'
  | 'imported'
  | 'error';

type TraktTvImportSummary = {
  watchlist: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  seen: {
    movies: number;
    episodes: number;
  };
  ratings: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  lists: {
    listName: string;
    listId: string;
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  }[];
};

type TraktTvNotImportedMovie = {
  title: string;
  year: number;
  traktTvLink: string;
};

type TraktTvNotImportedTvShow = {
  title: string;
  year: number;
  traktTvLink: string;
};

type TraktTvNotImportedSeason = {
  show: {
    title: string;
    year: number;
  };
  season: {
    seasonNumber: number;
  };
  traktTvLink: string;
};

type TraktTvNotImportedEpisode = {
  show: {
    title: string;
    year: number;
  };
  episode: {
    episodeNumber: number;
    seasonNumber: number;
  };
  traktTvLink: string;
};

type TraktTvImportNotImportedItems = {
  watchlist: {
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  };
  seen: {
    movies: TraktTvNotImportedMovie[];
    episodes: TraktTvNotImportedEpisode[];
  };
  ratings: {
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  };
  lists: {
    listName: string;
    listId: string;
    movies: TraktTvNotImportedMovie[];
    shows: TraktTvNotImportedTvShow[];
    seasons: TraktTvNotImportedSeason[];
    episodes: TraktTvNotImportedEpisode[];
  }[];
};

type DeviceCode = Awaited<ReturnType<typeof TraktTvExport.prototype.authenticate>>;

type StoredImportState = {
  state: ImportState;
  deviceCode?: DeviceCode;
  exportSummary?: TraktTvImportSummary;
  importSummary?: TraktTvImportSummary;
  notImportedItems?: TraktTvImportNotImportedItems;
  progress?: number;
  error?: string;
  clients: Array<Express.Response>;
};

type ImportStateSnapshot = Omit<StoredImportState, 'clients'>;

const isDefined = <T>(value: T | null | undefined): value is T => value != null;
const hasMediaItemId = (
  mediaItem: MediaItemBaseWithSeasons
): mediaItem is ImportedMediaItem => mediaItem.id != null;
const hasTmdbId = <T extends { tmdbId?: number }>(
  item: T
): item is T & { tmdbId: number } => item.tmdbId != null;

/**
 * @openapi_tags TraktTvImport
 */
export class TraktTvImportController {
  private readonly importState = new Map<number, StoredImportState>();

  private getState(userId: number): StoredImportState {
    const currentState = this.importState.get(userId);

    if (!currentState) {
      throw new Error(`No import state for userId ${userId}`);
    }

    return currentState;
  }

  private snapshotState(state: StoredImportState): ImportStateSnapshot {
    return {
      state: state.state,
      ...(state.deviceCode != null ? { deviceCode: state.deviceCode } : {}),
      ...(state.exportSummary != null
        ? { exportSummary: state.exportSummary }
        : {}),
      ...(state.importSummary != null
        ? { importSummary: state.importSummary }
        : {}),
      ...(state.notImportedItems != null
        ? { notImportedItems: state.notImportedItems }
        : {}),
      ...(state.progress != null ? { progress: state.progress } : {}),
      ...(state.error != null ? { error: state.error } : {}),
    };
  }

  private updateState(args: { userId: number } & ImportStateSnapshot) {
    const currentState = this.getState(args.userId);
    const nextState: StoredImportState = {
      ...currentState,
      state: args.state,
      ...(args.deviceCode != null ? { deviceCode: args.deviceCode } : {}),
      ...(args.exportSummary != null
        ? { exportSummary: args.exportSummary }
        : {}),
      ...(args.importSummary != null
        ? { importSummary: args.importSummary }
        : {}),
      ...(args.notImportedItems != null
        ? { notImportedItems: args.notImportedItems }
        : {}),
      ...(args.progress != null ? { progress: args.progress } : {}),
      ...(args.error != null ? { error: args.error } : {}),
      clients: currentState.clients,
    };

    this.importState.set(args.userId, nextState);

    const snapshot = this.snapshotState(nextState);
    currentState.clients.forEach((client) => {
      client.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    });
  }

  private addClient(args: { userId: number; client: Express.Response }) {
    const currentState = this.getState(args.userId);

    this.importState.set(args.userId, {
      ...currentState,
      clients: [...currentState.clients, args.client],
    });
  }

  private initState(args: { userId: number }) {
    this.importState.set(args.userId, {
      state: 'uninitialized',
      clients: [],
    });
  }

  /**
   * @openapi_operationId state
   */
  state = createExpressRoute<{
    method: 'get';
    path: '/api/import-trakttv/state';
    responseBody: {
      state: ImportState;
      progress?: number;
      exportSummary?: TraktTvImportSummary;
      importSummary?: TraktTvImportSummary;
      notImportedItems?: TraktTvImportNotImportedItems;
      error?: string;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    if (!this.importState.has(userId)) {
      this.initState({ userId });
    }

    const importState = this.getState(userId);

    res.send(this.snapshotState(importState));
  });

  /**
   * @openapi_operationId state-stream
   */
  stateStream = createExpressRoute<{
    method: 'get';
    path: '/api/import-trakttv/state-stream';
    responseBody: {
      state: ImportState;
      progress?: number;
      exportSummary?: TraktTvImportSummary;
      importSummary?: TraktTvImportSummary;
      notImportedItems?: TraktTvImportNotImportedItems;
      error?: string;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    if (!this.importState.has(userId)) {
      this.initState({ userId });
    }

    const importState = this.getState(userId);
    const state = this.snapshotState(importState);

    if (req.accepts('text/event-stream')) {
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      });

      res.write(`data: ${JSON.stringify(state)}\n\n`);

      this.addClient({ userId: userId, client: res });
    } else {
      res.send(state);
    }
  });

  /**
   * @openapi_operationId deviceToken
   */
  getUserCode = createExpressRoute<{
    method: 'get';
    path: '/api/import-trakttv/device-token';
    responseBody: {
      userCode: string;
      verificationUrl: string;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    if (!this.importState.has(userId)) {
      this.initState({ userId: userId });
    }

    const importState = this.getState(userId);

    if (
      importState.state === 'uninitialized' ||
      (importState.deviceCode != null &&
        importState.deviceCode.expiresAt <= new Date() &&
        !importState.exportSummary)
    ) {
      const traktTvImport = new TraktTvExport();

      const deviceCode = await traktTvImport.authenticate(async (userCode) => {
        try {
          if (userCode !== this.importState.get(userId)?.deviceCode?.userCode) {
            return;
          }

          this.updateState({ userId: userId, state: 'exporting' });

          const exportedData = await traktTvImport.export();

          this.updateState({
            userId: userId,
            state: 'updating-metadata',
            exportSummary: getExportedSummery(exportedData),
          });

          const { movieMetadata, tvShowMetadata } =
            await updateMetadataForTraktTvImport(exportedData, (progress) => {
              this.updateState({
                userId: userId,
                state: 'updating-metadata',
                progress: progress,
              });
            });

          this.updateState({
            userId: userId,
            state: 'importing',
            notImportedItems: getNotImportedItems(
              exportedData,
              movieMetadata,
              tvShowMetadata
            ),
            progress: 0,
          });

          const incrementImportingStep = () => {
            let step = 0;
            const numberOfSteps = 8;
            return () => {
              step++;

              this.updateState({
                userId: userId,
                state: 'importing',
                progress: step / numberOfSteps,
              });
            };
          };

          const watchlistMovies = exportedData.watchlist
            .filter(traktTvMovieFilter)
            .map(movieMetadata)
            .filter(isDefined)
            .map(({ mediaItem }) => ({
              mediaItemId: mediaItem.id,
            }));

          const watchlistTvShows = exportedData.watchlist
            .filter(traktTvShowFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(({ mediaItem }) => ({
              mediaItemId: mediaItem.id,
            }));

          const watchlistSeasons = exportedData.watchlist
            .filter(traktTvSeasonFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(withSeason)
            .filter(isDefined)
            .map(({ mediaItem, season }) => ({
              mediaItemId: mediaItem.id,
              seasonId: season.id,
            }));

          const watchlistEpisodes = exportedData.watchlist
            .filter(traktTvEpisodeFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(withEpisode)
            .filter(isDefined)
            .map(({ mediaItem, episode }) => ({
              mediaItemId: mediaItem.id,
              episodeId: episode.id,
            }));

          const seenMovies = exportedData.history
            .filter(traktTvMovieFilter)
            .map(movieMetadata)
            .filter(isDefined)
            .map(
              ({ mediaItem, item }): Seen => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                date: new Date(item.watched_at).getTime(),
              })
            );

          const seenEpisodes = exportedData.history
            .filter(traktTvEpisodeFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(withEpisode)
            .filter(isDefined)
            .map(
              ({ mediaItem, item, episode }): Seen => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                date: new Date(item.watched_at).getTime(),
                episodeId: episode.id,
              })
            );

          const ratedMovies = exportedData.rating
            .filter(traktTvMovieFilter)
            .map(movieMetadata)
            .filter(isDefined)
            .map(
              ({ mediaItem, item }): UserRating => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                rating: item.rating / 2,
                date: new Date(item.rated_at).getTime(),
              })
            );

          const ratedTvShows = exportedData.rating
            .filter(traktTvShowFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(
              ({ mediaItem, item }): UserRating => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                rating: item.rating / 2,
                date: new Date(item.rated_at).getTime(),
              })
            );

          const ratedSeasons = exportedData.rating
            .filter(traktTvSeasonFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(withSeason)
            .filter(isDefined)
            .map(
              ({ mediaItem, item, season }): UserRating => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                rating: item.rating / 2,
                date: new Date(item.rated_at).getTime(),
                seasonId: season.id,
              })
            );

          const ratedEpisodes = exportedData.rating
            .filter(traktTvEpisodeFilter)
            .map(tvShowMetadata)
            .filter(isDefined)
            .map(withEpisode)
            .filter(isDefined)
            .map(
              ({ mediaItem, item, episode }): UserRating => ({
                userId: userId,
                mediaItemId: mediaItem.id,
                rating: item.rating / 2,
                date: new Date(item.rated_at).getTime(),
                episodeId: episode.id,
              })
            );

          for (const item of [
            ...watchlistMovies,
            ...watchlistTvShows,
            ...watchlistSeasons,
            ...watchlistEpisodes,
          ] as {
            mediaItemId: number;
            seasonId?: number;
            episodeId?: number;
          }[]) {
            await listItemRepository.addItem({
              userId: userId,
              watchlist: true,
              mediaItemId: item.mediaItemId,
              ...(item.seasonId != null ? { seasonId: item.seasonId } : {}),
              ...(item.episodeId != null ? { episodeId: item.episodeId } : {}),
            });
          }

          const lists = exportedData.lists.map((traktList) => {
            const listItems =
              exportedData.listsItems.get(traktList.ids.slug) || [];

            return {
              name: traktList.name,
              traktId: traktList.ids.trakt,
              traktSlug: traktList.ids.slug,
              description: traktList.description,
              privacy: traktList.privacy,
              sortBy: traktList.sort_by,
              sortOrder: traktList.sort_how,
              movies: listItems
                .filter(traktTvMovieFilter)
                .map(movieMetadata)
                .filter(isDefined)
                .map(({ mediaItem }) => ({
                  mediaItemId: mediaItem.id,
                })),
              shows: listItems
                .filter(traktTvShowFilter)
                .map(tvShowMetadata)
                .filter(isDefined)
                .map(({ mediaItem }) => ({
                  mediaItemId: mediaItem.id,
                })),
              seasons: listItems
                .filter(traktTvSeasonFilter)
                .map(tvShowMetadata)
                .filter(isDefined)
                .map(withSeason)
                .filter(isDefined)
                .map(({ mediaItem, season }) => ({
                  mediaItemId: mediaItem.id,
                  seasonId: season.id,
                })),
              episodes: listItems
                .filter(traktTvEpisodeFilter)
                .map(tvShowMetadata)
                .filter(isDefined)
                .map(withEpisode)
                .filter(isDefined)
                .map(({ mediaItem, episode }) => ({
                  mediaItemId: mediaItem.id,
                  episodeId: episode.id,
                })),
            };
          });

          incrementImportingStep();

          for (const list of lists) {
            const mediaTrackerListName = `TraktTv-${list.name}`;

            const mediaTrackerList =
              (await listRepository.findOne({
                traktId: list.traktId,
              })) ||
              (await listRepository.findOne({
                name: mediaTrackerListName,
              })) ||
              (await listRepository.create({
                name: mediaTrackerListName,
                traktId: list.traktId,
                userId: userId,
                description: list.description,
                privacy: list.privacy,
                sortBy: list.sortBy,
                sortOrder: list.sortOrder,
              }));

            if (!mediaTrackerList) {
              continue;
            }

            await listItemRepository.addManyItems({
              listId: mediaTrackerList.id,
              userId: userId,
              listItems: [
                ...list.movies,
                ...list.shows,
                ...list.seasons,
                ...list.episodes,
              ],
            });
          }

          const uniqBy = (seen: Partial<Seen>): Partial<Seen> => {
            return {
              userId: seen.userId,
              mediaItemId: seen.mediaItemId,
              ...(seen.episodeId != null
                ? { episodeId: seen.episodeId }
                : {}),
              ...(seen.date != null ? { date: seen.date } : {}),
            };
          };

          incrementImportingStep();

          await seenRepository.createManyUnique(seenMovies, uniqBy, {
            userId: userId,
          });
          incrementImportingStep();

          await seenRepository.createManyUnique(seenEpisodes, uniqBy, {
            userId: userId,
          });

          incrementImportingStep();
          await userRatingRepository.createMany(ratedMovies);
          incrementImportingStep();
          await userRatingRepository.createMany(ratedTvShows);
          incrementImportingStep();
          await userRatingRepository.createMany(ratedSeasons);
          incrementImportingStep();
          await userRatingRepository.createMany(ratedEpisodes);

          // Fire-and-forget platformRating cache update for all media-level rated items.
          // ratedSeasons and ratedEpisodes are excluded — only media-level ratings
          // (no episodeId/seasonId) affect the platformRating cache.
          const mediaLevelRatings = [...ratedMovies, ...ratedTvShows];
          if (mediaLevelRatings.length > 0) {
            const affectedMediaItemIds = [
              ...new Set(mediaLevelRatings.map((r) => r.mediaItemId)),
            ];
            setImmediate(() => {
              Promise.all(
                affectedMediaItemIds.map((mediaItemId) =>
                  mediaItemRepository.recalculatePlatformRating(mediaItemId)
                )
              ).catch((err) => {
                logger.error(
                  'Unhandled error in platformRating recalculation after Trakt.tv import',
                  { err }
                );
              });
            });
            setImmediate(() => {
              Promise.all(
                affectedMediaItemIds.map((mediaItemId) =>
                  recalculateGroupPlatformRatingsForUser(userId, mediaItemId)
                )
              ).catch((err) => {
                logger.error(
                  'Unhandled error in groupPlatformRating recalculation after Trakt.tv import',
                  { err, userId }
                );
              });
            });
          }

          this.updateState({
            userId: userId,
            state: 'imported',
            importSummary: {
              watchlist: {
                movies: watchlistMovies.length,
                shows: watchlistTvShows.length,
                seasons: watchlistSeasons.length,
                episodes: watchlistEpisodes.length,
              },
              seen: {
                movies: seenMovies.length,
                episodes: seenEpisodes.length,
              },
              ratings: {
                movies: ratedMovies.length,
                shows: ratedTvShows.length,
                seasons: ratedSeasons.length,
                episodes: ratedEpisodes.length,
              },
              lists: lists.map((list) => ({
                listName: list.name,
                listId: list.traktSlug,
                movies: list.movies.length,
                shows: list.shows.length,
                seasons: list.seasons.length,
                episodes: list.episodes.length,
              })),
            },
          });
        } catch (error) {
          this.updateState({
            userId: userId,
            state: 'error',
            error: String(error),
          });
        }
      });

      this.updateState({
        userId: userId,
        state: 'waiting-for-authentication',
        deviceCode: deviceCode,
      });

      res.send({
        userCode: deviceCode.userCode,
        verificationUrl: deviceCode.verificationUrl,
      });
    } else {
      if (importState.deviceCode == null) {
        res.sendStatus(409);
        return;
      }

      res.send({
        userCode: importState.deviceCode.userCode,
        verificationUrl: importState.deviceCode.verificationUrl,
      });
    }
  });

  /**
   * @openapi_operationId startOver
   */
  startOver = createExpressRoute<{
    method: 'get';
    path: '/api/import-trakttv/start-over';
  }>(async (req, res) => {
    const userId = Number(req.user);

    const importState = this.importState.get(userId);

    if (importState) {
      if (
        inArray(importState.state, [
          'exporting',
          'importing',
          'updating-metadata',
          'uninitialized',
        ])
      ) {
        res.sendStatus(400);
        return;
      }

      this.importState.set(userId, {
        state: 'uninitialized',
        clients: importState.clients,
      });
    }

    res.send();
  });
}

const findEpisodeOrSeason = (args: {
  mediaItem: MediaItemBaseWithSeasons;
  seasonNumber: number;
  episodeNumber?: number;
}) => {
  const { mediaItem, seasonNumber, episodeNumber } = args;

  const season = mediaItem?.seasons?.find(
    (season) => season.seasonNumber === seasonNumber
  );

  const episode = episodeNumber
    ? season?.episodes?.find(
        (episode) => episode.episodeNumber === episodeNumber
      )
    : undefined;

  return {
    season: season,
    episode: episode,
  };
};

const getMediaItemsByTmdbIds = async (
  ids: {
    trakt: number;
    tvdb: number;
    imdb: string;
    tmdb: number;
    tvrage: number;
  }[],
  mediaType: MediaType
) => {
  const existingItems: MediaItemBaseWithSeasons[] =
    await mediaItemRepository.findByExternalIds({
      tmdbId: ids.map((item) => item.tmdb).filter(isDefined),
      imdbId: ids.map((item) => item.imdb).filter(isDefined),
      tvdbId: ids.map((item) => item.tvdb).filter(isDefined),
      traktId: ids.map((item) => item.trakt).filter(isDefined),
      mediaType: mediaType,
    });

  const existingItemsMapByTmdbId = existingItems.reduce<
    _.Dictionary<MediaItemBaseWithSeasons>
  >((result, mediaItem) => {
    if (mediaItem.tmdbId != null) {
      result[mediaItem.tmdbId] = mediaItem;
    }

    return result;
  }, {});

  const missingItems = _(ids)
    .filter((item) => !existingItemsMapByTmdbId[item.tmdb])
    .uniqBy((item) => item.trakt)
    .value();

  await Promise.all(
    existingItems
      .filter((item) => item.mediaType === 'tv')
      .map(async (item) => {
        item.seasons = await mediaItemRepository.seasonsWithEpisodes(item);
      })
      .map(errorHandler)
  );

  return {
    existingItems: existingItems,
    missingItems: missingItems,
  };
};

const errorHandler = async <T>(promise: Promise<T>): Promise<T | undefined> => {
  try {
    return await promise;
  } catch (error) {
    return undefined;
  }
};

const updateMetadataForTraktTvImport = async (
  exportedData: Awaited<ReturnType<typeof TraktTvExport.prototype.export>>,
  onProgress: (progress: number) => void
) => {
  const listItems = _.flatten(Array.from(exportedData.listsItems.values()));

  const movies = await getMediaItemsByTmdbIds(
    _.uniq(
      [
        ...exportedData.watchlist,
        ...exportedData.history,
        ...exportedData.rating,
        ...listItems,
      ]
        .flatMap((item) => (item.movie != null ? [item.movie.ids] : []))
    ),
    'movie'
  );

  const tvShows = await getMediaItemsByTmdbIds(
    _.uniq(
      [
        ...exportedData.watchlist,
        ...exportedData.history,
        ...exportedData.rating,
        ...listItems,
      ]
        .flatMap((item) => (item.show != null ? [item.show.ids] : []))
    ),
    'tv'
  );

  const tvShowsToUpdate = tvShows.existingItems.filter(
    (item) => item.needsDetails
  );

  const total =
    movies.missingItems.length +
    tvShows.missingItems.length +
    tvShowsToUpdate.length;

  let currentItem = 0;

  const updateProgress = () => {
    currentItem++;
    onProgress(currentItem / total);
  };

  const foundMovies = new Array<MediaItemBaseWithSeasons>();

  for (const item of movies.missingItems) {
    try {
      const foundMovie = await findMediaItemByExternalIdInExternalSources({
        id: {
          traktId: item.trakt,
          imdbId: item.imdb,
          tmdbId: item.tmdb,
          tvdbId: item.tvdb,
        },
        mediaType: 'movie',
      });
      if (foundMovie) {
        foundMovies.push(foundMovie);
      }
      updateProgress();
    } catch (error) {
      //
    }
  }

  const foundTvShows = new Array<MediaItemBaseWithSeasons>();

  for (const item of tvShows.missingItems) {
    try {
      const foundTvShow = await findMediaItemByExternalIdInExternalSources({
        id: {
          traktId: item.trakt,
          imdbId: item.imdb,
          tmdbId: item.tmdb,
          tvdbId: item.tvdb,
        },
        mediaType: 'tv',
      });
      if (foundTvShow) {
        foundTvShows.push(foundTvShow);
      }
      updateProgress();
    } catch (error) {
      //
    }
  }

  const updatedTvShows = new Array<MediaItemBaseWithSeasons>();

  for (const mediaItem of tvShowsToUpdate) {
    try {
      const updatedTvShow = await updateMediaItem(mediaItem);

      if (updatedTvShow) {
        updatedTvShows.push(updatedTvShow);
      }

      updateProgress();
    } catch (error) {
      //
    }
  }

  const mediaItemsMap = [
    ...movies.existingItems,
    ...foundMovies.filter(isDefined),
    ..._.uniqBy(
      [...updatedTvShows, ...tvShows.existingItems],
      (item) => item.id
    ),
    ...foundTvShows.filter(isDefined),
  ]
    .filter(hasMediaItemId)
    .filter(hasTmdbId)
    .reduce<_.Dictionary<ImportedMediaItem>>((result, mediaItem) => {
      result[mediaItem.tmdbId] = mediaItem;
      return result;
    }, {});

  return createMetadataFunctions(mediaItemsMap);
};

const withEpisode = <T extends TraktTvItem>({
  mediaItem,
  item,
}: {
  mediaItem: ImportedMediaItem;
  item: T;
}) => {
  if (!traktTvEpisodeFilter(item)) {
    return;
  }

  const res = findEpisodeOrSeason({
    mediaItem: mediaItem,
    seasonNumber: item.episode.season,
    episodeNumber: item.episode.number,
  });

  if (!res?.episode) {
    return;
  }

  return { mediaItem, item, episode: res.episode };
};

const withSeason = <T extends TraktTvItem>({
  mediaItem,
  item,
}: {
  mediaItem: ImportedMediaItem;
  item: T;
}) => {
  if (!traktTvSeasonFilter(item)) {
    return;
  }

  const res = findEpisodeOrSeason({
    mediaItem: mediaItem,
    seasonNumber: item.season.number,
  });

  if (!res?.season) {
    return;
  }

  return { mediaItem, item, season: res.season };
};

const traktTvMovieFilter = <T extends TraktTvItem>(
  item: T
): item is TraktTvMovieItem<T> => item.movie != null;

const traktTvHasShowFilter = <T extends TraktTvItem>(
  item: T
): item is TraktTvShowItem<T> => item.show != null;

const traktTvShowFilter = <T extends TraktTvItem>(
  item: T
): item is TraktTvShowItem<T> =>
  item.show != null && item.season == null && item.episode == null;

const traktTvSeasonFilter = <T extends TraktTvItem>(
  item: T
): item is TraktTvSeasonItem<T> =>
  item.show != null && item.season != null && item.episode == null;

const traktTvEpisodeFilter = <T extends TraktTvItem>(
  item: T
): item is TraktTvEpisodeItem<T> =>
  item.show != null && item.season == null && item.episode != null;

const getExportedSummery = (
  exportedData: Awaited<ReturnType<TraktTvExport['export']>>
) => {
  return {
    watchlist: {
      movies: exportedData.watchlist.filter(traktTvMovieFilter).length,
      shows: exportedData.watchlist.filter(traktTvShowFilter).length,
      seasons: exportedData.watchlist.filter(traktTvSeasonFilter).length,
      episodes: exportedData.watchlist.filter(traktTvEpisodeFilter).length,
    },
    seen: {
      movies: exportedData.history.filter(traktTvMovieFilter).length,
      episodes: exportedData.history.filter(traktTvEpisodeFilter).length,
    },
    ratings: {
      movies: exportedData.rating.filter(traktTvMovieFilter).length,
      shows: exportedData.rating.filter(
        (item) => item.show && !item.season && !item.episode
      ).length,
      seasons: exportedData.rating.filter(traktTvSeasonFilter).length,
      episodes: exportedData.rating.filter(traktTvEpisodeFilter).length,
    },
    lists: exportedData.lists.map((list) => {
      const listItems = exportedData.listsItems.get(list.ids.slug);

      return {
        listName: list.name,
        listId: list.ids.slug,
        movies: listItems?.filter(traktTvMovieFilter)?.length || 0,
        shows: listItems?.filter(traktTvShowFilter)?.length || 0,
        seasons: listItems?.filter(traktTvSeasonFilter)?.length || 0,
        episodes: listItems?.filter(traktTvEpisodeFilter)?.length || 0,
      };
    }),
  };
};

type TraktTvItem = {
  episode?: TraktApi.EpisodeResponse;
  show?: TraktApi.ShowResponse;
  movie?: TraktApi.MovieResponse;
  season?: TraktApi.SeasonResponse;
};

type TraktTvMovieItem<T extends TraktTvItem = TraktTvItem> = T & {
  movie: TraktApi.MovieResponse;
};

type TraktTvShowItem<T extends TraktTvItem = TraktTvItem> = T & {
  show: TraktApi.ShowResponse;
};

type TraktTvSeasonItem<T extends TraktTvItem = TraktTvItem> =
  TraktTvShowItem<T> & {
    season: TraktApi.SeasonResponse;
  };

type TraktTvEpisodeItem<T extends TraktTvItem = TraktTvItem> =
  TraktTvShowItem<T> & {
    episode: TraktApi.EpisodeResponse;
  };

type ImportedMediaItem = MediaItemBaseWithSeasons & {
  id: number;
};

type TraktMetadataResult<T extends TraktTvItem> = {
  mediaItem: ImportedMediaItem;
  item: T;
};

const createMetadataFunctions = (
  mediaItemsMap: _.Dictionary<ImportedMediaItem>
) => {
  const movieMetadata = <T extends TraktTvItem>(
    item: T
  ): TraktMetadataResult<TraktTvMovieItem<T>> | undefined => {
    if (!traktTvMovieFilter(item)) {
      return;
    }

    const res = mediaItemsMap[item.movie.ids.tmdb];

    if (res) {
      return {
        mediaItem: res,
        item,
      };
    }
  };

  const tvShowMetadata = <T extends TraktTvItem>(
    item: T
  ):
    | TraktMetadataResult<
        TraktTvShowItem<T> | TraktTvSeasonItem<T> | TraktTvEpisodeItem<T>
      >
    | undefined => {
    if (
      !traktTvShowFilter(item) &&
      !traktTvSeasonFilter(item) &&
      !traktTvEpisodeFilter(item)
    ) {
      return;
    }

    const res = mediaItemsMap[item.show.ids.tmdb];

    if (res) {
      return {
        mediaItem: res,
        item,
      };
    }
  };

  return {
    movieMetadata,
    tvShowMetadata,
  };
};

const getNotImportedItems = (
  exportedData: Awaited<ReturnType<TraktTvExport['export']>>,
  movieMetadata: <T extends TraktTvItem>(
    item: T
  ) => TraktMetadataResult<TraktTvMovieItem<T>> | undefined,
  tvShowMetadata: <T extends TraktTvItem>(
    item: T
  ) =>
    | TraktMetadataResult<
        TraktTvShowItem<T> | TraktTvSeasonItem<T> | TraktTvEpisodeItem<T>
      >
    | undefined
): TraktTvImportNotImportedItems => {
  const not = <T, U>(f: (args: T) => U) => {
    return (args: T) => !f(args);
  };

  const filterSeasonsWithoutMetadata = (item: TraktTvItem) => {
    if (!traktTvSeasonFilter(item)) {
      return false;
    }

    const show = tvShowMetadata(item);

    if (!show) {
      return true;
    }

    return !withSeason(show);
  };

  const filterEpisodesWithoutMetadata = (item: TraktTvItem) => {
    if (!traktTvEpisodeFilter(item)) {
      return false;
    }

    const show = tvShowMetadata(item);

    if (!show) {
      return true;
    }

    return !withEpisode(show);
  };

  const mapMovie = (item: TraktTvItem): TraktTvNotImportedMovie => {
    if (!traktTvMovieFilter(item)) {
      throw new Error('Expected Trakt movie item');
    }

    return {
      title: item.movie.title,
      year: item.movie.year,
      traktTvLink: `https://trakt.tv/movies/${item.movie.ids.slug}`,
    };
  };

  const mapTvShow = (item: TraktTvItem): TraktTvNotImportedTvShow => {
    if (!traktTvShowFilter(item)) {
      throw new Error('Expected Trakt show item');
    }

    return {
      title: item.show.title,
      year: item.show.year,
      traktTvLink: `https://trakt.tv/shows/${item.show.ids.slug}`,
    };
  };

  const mapSeason = (item: TraktTvItem): TraktTvNotImportedSeason => {
    if (!traktTvSeasonFilter(item)) {
      throw new Error('Expected Trakt season item');
    }

    return {
      show: {
        title: item.show.title,
        year: item.show.year,
      },
      season: {
        seasonNumber: item.season.number,
      },
      traktTvLink: `https://trakt.tv/shows/${item.show.ids.slug}/seasons/${item.season.number}`,
    };
  };

  const mapEpisode = (item: TraktTvItem): TraktTvNotImportedEpisode => {
    if (!traktTvEpisodeFilter(item)) {
      throw new Error('Expected Trakt episode item');
    }

    return {
      show: {
        title: item.show.title,
        year: item.show.year,
      },
      episode: {
        episodeNumber: item.episode.number,
        seasonNumber: item.episode.season,
      },
      traktTvLink: `https://trakt.tv/shows/${item.show.ids.slug}/seasons/${item.episode.season}/episodes/${item.episode.number}`,
    };
  };

  return {
    watchlist: {
      movies: exportedData.watchlist
        .filter(traktTvMovieFilter)
        .filter(not(movieMetadata))
        .map(mapMovie),
      shows: exportedData.watchlist
        .filter(traktTvShowFilter)
        .filter(not(tvShowMetadata))
        .map(mapTvShow),
      seasons: exportedData.watchlist
        .filter(filterSeasonsWithoutMetadata)
        .map(mapSeason),
      episodes: exportedData.watchlist
        .filter(filterEpisodesWithoutMetadata)
        .map(mapEpisode),
    },
    seen: {
      movies: exportedData.history
        .filter(traktTvMovieFilter)
        .filter(not(movieMetadata))
        .map(mapMovie),
      episodes: exportedData.history
        .filter(filterEpisodesWithoutMetadata)
        .map(mapEpisode),
    },
    ratings: {
      movies: exportedData.rating
        .filter(traktTvMovieFilter)
        .filter(not(movieMetadata))
        .map(mapMovie),
      shows: exportedData.rating
        .filter((item) => item.show && !item.season && !item.episode)
        .filter(not(tvShowMetadata))
        .map(mapTvShow),
      seasons: exportedData.rating
        .filter(filterSeasonsWithoutMetadata)
        .map(mapSeason),
      episodes: exportedData.rating
        .filter(filterEpisodesWithoutMetadata)
        .map(mapEpisode),
    },
    lists: exportedData.lists
      .map((list) => {
        const listItems = exportedData.listsItems.get(list.ids.slug) || [];

        return {
          listName: list.name,
          listId: list.ids.slug,
          movies: listItems
            .filter(traktTvMovieFilter)
            .filter(not(movieMetadata))
            .map(mapMovie),
          shows: listItems
            .filter(traktTvShowFilter)
            .filter(not(tvShowMetadata))
            .map(mapTvShow),
          seasons: listItems
            .filter(filterSeasonsWithoutMetadata)
            .map(mapSeason),
          episodes: listItems
            .filter(filterEpisodesWithoutMetadata)
            .map(mapEpisode),
        };
      })
      .filter(
        (list) =>
          list.movies.length > 0 ||
          list.shows.length > 0 ||
          list.seasons.length > 0 ||
          list.episodes.length > 0
      ),
  };
};
