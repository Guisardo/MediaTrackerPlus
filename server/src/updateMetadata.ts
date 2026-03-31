import _ from 'lodash';
import chalk from 'chalk';
import { plural, t } from '@lingui/macro';
import { parseISO } from 'date-fns';

import {
  MediaItemBase,
  MediaItemBaseWithSeasons,
  MediaItemForProvider,
} from 'src/entity/mediaItem';
import { TvEpisode } from 'src/entity/tvepisode';
import { TvSeason, TvSeasonFilters } from 'src/entity/tvseason';
import { MetadataProvider } from 'src/metadata/metadataProvider';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { durationToMilliseconds, updateAsset } from 'src/utils';
import { Notifications } from 'src/notifications/notifications';
import { userRepository } from 'src/repository/user';
import { User } from 'src/entity/user';
import { CancellationToken } from 'src/cancellationToken';
import { createLock } from 'src/lock';
import { logger } from 'src/logger';
import { Database } from 'src/dbconfig';
import { Config } from 'src/config';
import {
  FormattedNotification,
  formatNotification,
} from 'src/notifications/notificationFormatter';
import { getMetadataLanguages, IGDB_REGION_MAP } from 'src/metadataLanguages';
import {
  EpisodeTranslationUpsertRow,
  MediaItemTranslationUpsertRow,
  SeasonTranslationUpsertRow,
  upsertEpisodeTranslations,
  upsertMediaItemTranslations,
  upsertSeasonTranslations,
} from 'src/repository/translationRepository';

class MissingUpstreamMetadataError extends Error {
  readonly mediaItem: MediaItemBaseWithSeasons;

  constructor(mediaItem: MediaItemBaseWithSeasons) {
    super(`Upstream metadata not found for "${mediaItem.title}"`);
    this.name = 'MissingUpstreamMetadataError';
    this.mediaItem = mediaItem;
  }
}

const isUpstreamMetadataNotFound = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'isAxiosError' in error &&
      (error as { isAxiosError?: boolean }).isAxiosError === true &&
      (error as { response?: { status?: number } }).response?.status === 404
  );

const touchMediaItemLastUpdated = async (
  mediaItem: MediaItemBaseWithSeasons
): Promise<void> => {
  await mediaItemRepository.update({
    ...mediaItem,
    lastTimeUpdated: new Date().getTime(),
  });
};

type LocalizedDetailsResult = {
  language: string;
  localizedData: MediaItemForProvider;
};

type PreparedMediaItemFetch = {
  mediaItem: MediaItemBaseWithSeasons;
  metadataProvider?: MetadataProvider;
  newMediaItem?: MediaItemForProvider;
  localizedDetails?: LocalizedDetailsResult[];
  gameLocalizations?: Array<{ regionId: number; name: string }>;
  error?: unknown;
};

type UpdateMediaItemPreloadedData = {
  metadataProvider: MetadataProvider;
  newMediaItem: MediaItemForProvider;
  localizedDetails?: LocalizedDetailsResult[];
  gameLocalizations?: Array<{ regionId: number; name: string }>;
};

const METADATA_SYNC_FETCH_CONCURRENCY =
  Config.METADATA_SYNC_FETCH_CONCURRENCY;

const METADATA_SYNC_BATCH_SIZE = Config.METADATA_SYNC_BATCH_SIZE;

const chunkItems = <T>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const mapWithConcurrency = async <T, Result>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<Result>
): Promise<Result[]> => {
  const results = new Array<Result>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const currentIndex = nextIndex++;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
      }
    })
  );

  return results;
};

const getItemsToDelete = (
  oldMediaItem: MediaItemBaseWithSeasons,
  updatedMediaItem: MediaItemBaseWithSeasons
): [Array<TvEpisode>, Array<TvSeason>] => {
  const oldSeasonsMap = _.keyBy(
    oldMediaItem.seasons,
    (season) => season.seasonNumber
  );

  const newSeasonsMap = _.keyBy(
    updatedMediaItem.seasons,
    (season) => season.seasonNumber
  );

  const oldSeasons =
    oldMediaItem.seasons?.map((season) => season.seasonNumber) ?? [];
  const newSeasons =
    updatedMediaItem.seasons?.map((season) => season.seasonNumber) ?? [];

  const seasonNumbersToDelete = _.difference(oldSeasons, newSeasons);
  const seasonToDelete = seasonNumbersToDelete
    .map((seasonNumber) => oldSeasonsMap[seasonNumber])
    .filter((season): season is TvSeason => season != null);

  const episodesToDelete = (oldMediaItem.seasons ?? []).flatMap((season) => {
    const episodesMap = _.keyBy(
      oldSeasonsMap[season.seasonNumber]?.episodes,
      (episode) => episode.episodeNumber
    );

    const oldEpisodes =
      season.episodes?.map((episode) => episode.episodeNumber) ?? [];
    const newEpisodes =
      newSeasonsMap[season.seasonNumber]?.episodes?.map(
        (episode) => episode.episodeNumber
      ) ?? [];

    const episodesNumbersToDelete = _.difference(oldEpisodes, newEpisodes);

    return episodesNumbersToDelete
      .map((episodeNumber) => episodesMap[episodeNumber])
      .filter((episode): episode is TvEpisode => episode != null);
  });

  return [episodesToDelete, seasonToDelete];
};

const merge = (
  oldMediaItem: MediaItemBaseWithSeasons,
  newMediaItem: MediaItemForProvider
): MediaItemBaseWithSeasons => {
  const seasonsMap = _.keyBy(
    oldMediaItem.seasons,
    (season) => season.seasonNumber
  );

  const mediaItemId = oldMediaItem.id;

  return {
    ...newMediaItem,
    lastTimeUpdated: new Date().getTime(),
    id: mediaItemId,
    seasons: newMediaItem.seasons?.map((season) => {
      const seasonId = seasonsMap[season.seasonNumber]?.id;

      const episodesMap = _.keyBy(
        seasonsMap[season.seasonNumber]?.episodes,
        (episode) => episode.episodeNumber
      );

      return {
        ...season,
        id: seasonId,
        tvShowId: mediaItemId,
        episodes: season.episodes?.map((episode) => ({
          ...episode,
          id: episodesMap[episode.episodeNumber]?.id,
          tvShowId: mediaItemId,
          seasonId: seasonId,
        })),
      };
    }),
  };
};

const downloadNewAssets = async (
  oldMediaItem: MediaItemBaseWithSeasons,
  newMediaItem: MediaItemBaseWithSeasons
) => {
  if (
    newMediaItem.externalPosterUrl &&
    newMediaItem.externalPosterUrl !== oldMediaItem.externalPosterUrl
  ) {
    await updateAsset({
      type: 'poster',
      mediaItem: oldMediaItem,
    });
  }

  if (
    newMediaItem.externalBackdropUrl &&
    newMediaItem.externalBackdropUrl !== oldMediaItem.externalBackdropUrl
  ) {
    await updateAsset({
      type: 'backdrop',
      mediaItem: oldMediaItem,
    });
  }

  const newSeasonsMap = _.keyBy(
    newMediaItem.seasons,
    (season) => season.seasonNumber
  );

  await Promise.all(
    newMediaItem.seasons
      ?.filter((season) => season.externalPosterUrl)
      ?.filter(
        (season) =>
          season.id &&
          season.externalPosterUrl !==
            newSeasonsMap[season.seasonNumber]?.externalPosterUrl
      )
      .map((season) =>
        updateAsset({
          type: 'poster',
          season: season,
        })
      ) || []
  );
};

type NotificationSender = (args: {
  message: FormattedNotification;
  filter: (user: User) => boolean;
}) => Promise<void>;

const createNotificationSender = (users: User[]): NotificationSender => {
  return async (args) => {
    await Promise.all(
      users.filter(args.filter).map((user) =>
        Notifications.send({
          userId: user.id,
          message: args.message,
        })
      )
    );
  };
};

const notifyStatusChange = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  newMediaItem: MediaItemBaseWithSeasons;
  send: NotificationSender;
}): Promise<void> => {
  const { oldMediaItem, newMediaItem, send } = args;

  if (
    newMediaItem.status === oldMediaItem.status ||
    (!newMediaItem.status && !oldMediaItem.status)
  ) {
    return;
  }

  const status = newMediaItem.status;

  await send({
    message: formatNotification(
      (f) =>
        t`Status changed for ${f.mediaItemUrl(newMediaItem)}: "${status}"`
    ),
    filter: (user) => user.sendNotificationWhenStatusChanges === true,
  });
};

const notifyReleaseDateChange = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  newMediaItem: MediaItemBaseWithSeasons;
  send: NotificationSender;
}): Promise<void> => {
  const { oldMediaItem, newMediaItem, send } = args;

  if (
    newMediaItem.releaseDate === oldMediaItem.releaseDate ||
    !newMediaItem.releaseDate ||
    parseISO(newMediaItem.releaseDate) <= new Date()
  ) {
    return;
  }

  const releaseDate = newMediaItem.releaseDate;

  await send({
    message: formatNotification(
      (f) =>
        t`Release date changed for ${f.mediaItemUrl(
          newMediaItem
        )}: "${releaseDate}"`
    ),
    filter: (user) => user.sendNotificationWhenReleaseDateChanges === true,
  });
};

const getComparableNonSpecialSeasons = (
  seasons: MediaItemBaseWithSeasons['seasons']
): TvSeason[] =>
  (seasons || [])
    .filter(TvSeasonFilters.nonSpecialSeason)
    .sort(TvSeasonFilters.seasonNumber);

const getSeasonChangeContext = (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  newMediaItem: MediaItemBaseWithSeasons;
}):
  | { kind: 'none' }
  | { kind: 'removed'; season: TvSeason }
  | { kind: 'added'; season: TvSeason }
  | { kind: 'updated'; oldSeason: TvSeason; newSeason: TvSeason } => {
  const { oldMediaItem, newMediaItem } = args;

  if (
    newMediaItem.mediaType !== 'tv' ||
    !oldMediaItem.seasons ||
    !newMediaItem.seasons
  ) {
    return { kind: 'none' };
  }

  const oldSeasons = getComparableNonSpecialSeasons(oldMediaItem.seasons);
  const newSeasons = getComparableNonSpecialSeasons(newMediaItem.seasons);

  if (newSeasons.length < oldSeasons.length) {
    const removedSeason = oldSeasons[newSeasons.length - 1];
    return removedSeason
      ? { kind: 'removed', season: removedSeason }
      : { kind: 'none' };
  }

  if (newSeasons.length > oldSeasons.length) {
    const newSeason = newSeasons[newSeasons.length - 1];
    return newSeason ? { kind: 'added', season: newSeason } : { kind: 'none' };
  }

  const oldSeason = oldSeasons[oldSeasons.length - 1];
  const newSeason = newSeasons[newSeasons.length - 1];

  return oldSeason && newSeason
    ? { kind: 'updated', oldSeason, newSeason }
    : { kind: 'none' };
};

const notifyRemovedSeason = async (args: {
  newMediaItem: MediaItemBaseWithSeasons;
  season: TvSeason;
  send: NotificationSender;
}): Promise<void> => {
  const { newMediaItem, season, send } = args;

  await send({
    message: formatNotification(
      (f) =>
        t`Season ${season.seasonNumber} of ${f.mediaItemUrl(
          newMediaItem
        )} has been canceled`
    ),
    filter: (user) => user.sendNotificationWhenNumberOfSeasonsChanges === true,
  });
};

const notifyNewSeason = async (args: {
  newMediaItem: MediaItemBaseWithSeasons;
  season: TvSeason;
  send: NotificationSender;
}): Promise<void> => {
  const { newMediaItem, season, send } = args;

  if (season.releaseDate && parseISO(season.releaseDate) > new Date()) {
    const releaseDate = parseISO(season.releaseDate).toLocaleDateString();

    await send({
      message: formatNotification(
        (f) =>
          t`New season of ${f.mediaItemUrl(
            newMediaItem
          )} will be released at ${releaseDate}`
      ),
      filter: (user) => user.sendNotificationWhenNumberOfSeasonsChanges === true,
    });
    return;
  }

  await send({
    message: formatNotification(
      (f) => t`${f.mediaItemUrl(newMediaItem)} got a new season`
    ),
    filter: (user) => user.sendNotificationWhenNumberOfSeasonsChanges === true,
  });
};

const notifyUpdatedSeasonReleaseDate = async (args: {
  newMediaItem: MediaItemBaseWithSeasons;
  oldSeason: TvSeason;
  newSeason: TvSeason;
  send: NotificationSender;
}): Promise<void> => {
  const { newMediaItem, oldSeason, newSeason, send } = args;

  if (
    oldSeason.releaseDate === newSeason.releaseDate ||
    !newSeason.releaseDate ||
    parseISO(newSeason.releaseDate) <= new Date()
  ) {
    return;
  }

  const releaseDate = parseISO(newSeason.releaseDate).toLocaleDateString();

  await send({
    message: formatNotification(
      (f) =>
        t`Season ${newSeason.seasonNumber} of ${f.mediaItemUrl(
          newMediaItem
        )} will be released at ${releaseDate}`
    ),
    filter: (user) => user.sendNotificationWhenNumberOfSeasonsChanges === true,
  });
};

const notifyTvSeasonChanges = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  newMediaItem: MediaItemBaseWithSeasons;
  send: NotificationSender;
}): Promise<void> => {
  const seasonChange = getSeasonChangeContext(args);

  if (seasonChange.kind === 'removed') {
    await notifyRemovedSeason({
      newMediaItem: args.newMediaItem,
      season: seasonChange.season,
      send: args.send,
    });
    return;
  }

  if (seasonChange.kind === 'added') {
    await notifyNewSeason({
      newMediaItem: args.newMediaItem,
      season: seasonChange.season,
      send: args.send,
    });
    return;
  }

  if (seasonChange.kind === 'updated') {
    await notifyUpdatedSeasonReleaseDate({
      newMediaItem: args.newMediaItem,
      oldSeason: seasonChange.oldSeason,
      newSeason: seasonChange.newSeason,
      send: args.send,
    });
  }
};

const sendNotifications = async (
  oldMediaItem: MediaItemBaseWithSeasons,
  newMediaItem: MediaItemBaseWithSeasons
) => {
  if (oldMediaItem.id == null) {
    return;
  }

  // Use the updated media item's minimumAge so recipients are evaluated
  // against current parental metadata after the refresh. Recipients without
  // a dateOfBirth or whose age meets the threshold are included.
  const users = await userRepository.findNotificationRecipientsForMediaItem({
    mediaItemId: oldMediaItem.id,
    minimumAge: newMediaItem.minimumAge,
  });
  const send = createNotificationSender(users);

  await notifyStatusChange({ oldMediaItem, newMediaItem, send });
  await notifyReleaseDateChange({ oldMediaItem, newMediaItem, send });
  await notifyTvSeasonChanges({ oldMediaItem, newMediaItem, send });
};

type SeasonEpisodeIdMaps = {
  seasonIdByNumber: Map<number, number>;
  episodeIdBySeasonAndEpisode: Map<string, number>;
};

const buildSeasonEpisodeIdMaps = (seasons: TvSeason[]): SeasonEpisodeIdMaps => {
  const seasonIdByNumber = new Map<number, number>();
  const episodeIdBySeasonAndEpisode = new Map<string, number>();

  for (const season of seasons) {
    if (season.id != null) {
      seasonIdByNumber.set(season.seasonNumber, season.id);
    }
    if (season.episodes) {
      for (const episode of season.episodes) {
        if (episode.id != null) {
          episodeIdBySeasonAndEpisode.set(
            `${episode.seasonNumber}:${episode.episodeNumber}`,
            episode.id
          );
        }
      }
    }
  }

  return { seasonIdByNumber, episodeIdBySeasonAndEpisode };
};

const collectSeasonEpisodeTranslationRows = (args: {
  seasons: MediaItemBaseWithSeasons['seasons'],
  language: string,
  seasonIdByNumber: Map<number, number>,
  episodeIdBySeasonAndEpisode: Map<string, number>
}): {
  seasonRows: SeasonTranslationUpsertRow[];
  episodeRows: EpisodeTranslationUpsertRow[];
} => {
  const {
    seasons,
    language,
    seasonIdByNumber,
    episodeIdBySeasonAndEpisode,
  } = args;
  const seasonRows: SeasonTranslationUpsertRow[] = [];
  const episodeRows: EpisodeTranslationUpsertRow[] = [];

  if (!seasons) {
    return { seasonRows, episodeRows };
  }

  for (const season of seasons) {
    const seasonId = seasonIdByNumber.get(season.seasonNumber);
    if (seasonId != null) {
      seasonRows.push({
        seasonId,
        language,
        title: season.title ?? null,
        description: season.description ?? null,
      });
    }

    if (season.episodes) {
      for (const episode of season.episodes) {
        const episodeId = episodeIdBySeasonAndEpisode.get(
          `${episode.seasonNumber}:${episode.episodeNumber}`
        );
        if (episodeId != null) {
          episodeRows.push({
            episodeId,
            language,
            title: episode.title ?? null,
            description: episode.description ?? null,
          });
        }
      }
    }
  }

  return { seasonRows, episodeRows };
};

const fetchLocalizedDetails = async (
  provider: MetadataProvider,
  oldMediaItem: MediaItemBaseWithSeasons,
  languages: string[]
): Promise<LocalizedDetailsResult[]> => {
  if (provider.localizedDetails == null || languages.length === 0) {
    return [];
  }

  const localizedDetails: LocalizedDetailsResult[] = [];

  for (const language of languages) {
    try {
      const localizedData = await provider.localizedDetails(oldMediaItem, language);

      if (localizedData) {
        localizedDetails.push({
          language,
          localizedData,
        });
      }
    } catch (error) {
      logger.error(
        `Failed to fetch localized details for mediaItem ${oldMediaItem.id} in language ${language}: ${error}`,
        { err: error }
      );
    }
  }

  return localizedDetails;
};

const fetchGameLocalizations = async (
  provider: MetadataProvider,
  oldMediaItem: MediaItemBaseWithSeasons
): Promise<Array<{ regionId: number; name: string }>> => {
  if (provider.fetchGameLocalizations == null) {
    return [];
  }

  try {
    return await provider.fetchGameLocalizations(oldMediaItem);
  } catch (error) {
    logger.error(
      `Failed to fetch game localizations for mediaItem ${oldMediaItem.id}: ${error}`,
      { err: error }
    );

    return [];
  }
};

const upsertPreparedTranslations = async (args: {
  mediaItemId: number;
  baseData: MediaItemForProvider;
  localizedDetails: LocalizedDetailsResult[];
  updatedMediaItem: MediaItemBaseWithSeasons;
}): Promise<void> => {
  const { mediaItemId, baseData, localizedDetails, updatedMediaItem } = args;
  const languages = getMetadataLanguages();

  if (languages.length === 0) {
    return;
  }

  const localizedByLanguage = new Map(
    localizedDetails.map((item) => [item.language, item.localizedData])
  );
  const firstLanguage = languages[0];

  if (firstLanguage && !localizedByLanguage.has(firstLanguage)) {
    localizedByLanguage.set(firstLanguage, baseData);
  }

  if (localizedByLanguage.size === 0) {
    return;
  }

  const mediaItemRows: MediaItemTranslationUpsertRow[] = [];
  const seasonRows: SeasonTranslationUpsertRow[] = [];
  const episodeRows: EpisodeTranslationUpsertRow[] = [];

  const idMaps: SeasonEpisodeIdMaps =
    updatedMediaItem.mediaType === 'tv' && updatedMediaItem.seasons
      ? buildSeasonEpisodeIdMaps(updatedMediaItem.seasons as TvSeason[])
      : { seasonIdByNumber: new Map(), episodeIdBySeasonAndEpisode: new Map() };

  for (const [language, localizedData] of localizedByLanguage) {
    mediaItemRows.push({
      mediaItemId,
      language,
      title: localizedData.title ?? null,
      overview: localizedData.overview ?? null,
      genres: localizedData.genres ?? null,
    });

    const translationRows = collectSeasonEpisodeTranslationRows({
      seasons: localizedData.seasons,
      language,
      seasonIdByNumber: idMaps.seasonIdByNumber,
      episodeIdBySeasonAndEpisode: idMaps.episodeIdBySeasonAndEpisode,
    });

    seasonRows.push(...translationRows.seasonRows);
    episodeRows.push(...translationRows.episodeRows);
  }

  await upsertMediaItemTranslations(mediaItemRows);
  await upsertSeasonTranslations(seasonRows);
  await upsertEpisodeTranslations(episodeRows);
};

const upsertPreparedGameLocalizations = async (args: {
  mediaItemId: number;
  languages: string[];
  localizations: Array<{ regionId: number; name: string }>;
}): Promise<void> => {
  const { mediaItemId, languages, localizations } = args;

  if (localizations.length === 0 || languages.length === 0) {
    return;
  }

  const rows: MediaItemTranslationUpsertRow[] = [];

  for (const localization of localizations) {
    const regionLanguages = IGDB_REGION_MAP[localization.regionId];

    if (regionLanguages === undefined) {
      continue;
    }

    const targetLanguages: string[] =
      regionLanguages === 'all'
        ? languages
        : regionLanguages.filter((lang) => languages.includes(lang));

    for (const language of targetLanguages) {
      rows.push({
        mediaItemId,
        language,
        title: localization.name || null,
        overview: null,
        genres: null,
      });
    }
  }

  await upsertMediaItemTranslations(rows);
};

const logMediaItemUpdateStart = (
  mediaItem: MediaItemBaseWithSeasons
): void => {
  if (mediaItem.lastTimeUpdated) {
    const date = chalk.blue(new Date(mediaItem.lastTimeUpdated).toLocaleString());
    logger.info(t`Updating: ${mediaItem.title} (last updated at: ${date})`);
    return;
  }

  logger.info(t`Updating: ${mediaItem.title}`);
};

const resolveUpdateMediaItemData = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  preloaded?: UpdateMediaItemPreloadedData;
}): Promise<{
  metadataProvider: MetadataProvider;
  newMediaItem: MediaItemForProvider;
}> => {
  const { oldMediaItem, preloaded } = args;
  const metadataProvider =
    preloaded?.metadataProvider ??
    metadataProviders.get(oldMediaItem.mediaType, oldMediaItem.source);

  if (!metadataProvider) {
    throw new Error(
      `No metadata provider "${oldMediaItem.source}" for media type ${oldMediaItem.mediaType}`
    );
  }

  const newMediaItem =
    preloaded?.newMediaItem ?? (await metadataProvider.details(oldMediaItem));

  if (!newMediaItem) {
    throw new Error('No metadata');
  }

  return {
    metadataProvider,
    newMediaItem,
  };
};

const buildUpdatedMediaItem = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  newMediaItem: MediaItemForProvider;
}): Promise<MediaItemBaseWithSeasons | undefined> => {
  const { oldMediaItem, newMediaItem } = args;

  if (newMediaItem.mediaType === 'tv') {
    return await margeTvShow(oldMediaItem, newMediaItem);
  }

  return {
    ...newMediaItem,
    lastTimeUpdated: new Date().getTime(),
    id: oldMediaItem.id,
  };
};

const persistUpdatedMediaItem = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  updatedMediaItem?: MediaItemBaseWithSeasons;
}): Promise<MediaItemBaseWithSeasons | undefined> => {
  const { oldMediaItem, updatedMediaItem } = args;

  if (!updatedMediaItem) {
    return updatedMediaItem;
  }

  const persistedMediaItem = await mediaItemRepository.update(updatedMediaItem);
  await downloadNewAssets(oldMediaItem, persistedMediaItem);

  if (!oldMediaItem.needsDetails) {
    await sendNotifications(oldMediaItem, persistedMediaItem);
  }

  return persistedMediaItem;
};

const applyUpdatedMediaItemLocalizations = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  metadataProvider: MetadataProvider;
  newMediaItem: MediaItemForProvider;
  persistedMediaItem?: MediaItemBaseWithSeasons;
  preloaded?: UpdateMediaItemPreloadedData;
}): Promise<void> => {
  const {
    oldMediaItem,
    metadataProvider,
    newMediaItem,
    persistedMediaItem,
    preloaded,
  } = args;

  if (!persistedMediaItem) {
    return;
  }

  const mediaItemId = oldMediaItem.id;
  if (mediaItemId == null) {
    return;
  }

  if (metadataProvider.localizedDetails != null) {
    const localizedDetails =
      preloaded?.localizedDetails ??
      (await fetchLocalizedDetails(
        metadataProvider,
        oldMediaItem,
        getMetadataLanguages()
      ));

    await upsertPreparedTranslations({
      mediaItemId,
      baseData: newMediaItem,
      localizedDetails,
      updatedMediaItem: persistedMediaItem,
    });
  }

  if (metadataProvider.fetchGameLocalizations != null) {
    const gameLocalizations =
      preloaded?.gameLocalizations ??
      (await fetchGameLocalizations(metadataProvider, oldMediaItem));

    await upsertPreparedGameLocalizations({
      mediaItemId,
      languages: getMetadataLanguages(),
      localizations: gameLocalizations,
    });
  }
};

const handleUpdateMediaItemError = async (args: {
  oldMediaItem: MediaItemBaseWithSeasons;
  error: unknown;
}): Promise<never> => {
  const { oldMediaItem, error } = args;

  if (isUpstreamMetadataNotFound(error)) {
    await touchMediaItemLastUpdated(oldMediaItem);
    throw new MissingUpstreamMetadataError(oldMediaItem);
  }

  throw error;
};

export const updateMediaItem = async (
  oldMediaItem?: MediaItemBaseWithSeasons,
  preloaded?: UpdateMediaItemPreloadedData
) => {
  if (!oldMediaItem || oldMediaItem.id == null) {
    return;
  }

  logMediaItemUpdateStart(oldMediaItem);

  await mediaItemRepository.lock(oldMediaItem.id);

  try {
    const { metadataProvider, newMediaItem } = await resolveUpdateMediaItemData({
      oldMediaItem,
      preloaded,
    });
    const updatedMediaItem = await buildUpdatedMediaItem({
      oldMediaItem,
      newMediaItem,
    });
    const persistedMediaItem = await persistUpdatedMediaItem({
      oldMediaItem,
      updatedMediaItem,
    });

    await applyUpdatedMediaItemLocalizations({
      oldMediaItem,
      metadataProvider,
      newMediaItem,
      persistedMediaItem,
      preloaded,
    });

    await mediaItemRepository.unlock(oldMediaItem.id);
    return persistedMediaItem;
  } catch (error) {
    await mediaItemRepository.unlock(oldMediaItem.id);
    await handleUpdateMediaItemError({ oldMediaItem, error });
  }
};

const shouldUpdate = (mediaItem: MediaItemBase) => {
  const lastTimeUpdated = mediaItem.lastTimeUpdated ?? 0;
  const timePassed = new Date().getTime() - lastTimeUpdated;

  if (
    mediaItem.mediaType !== 'tv' &&
    mediaItem.releaseDate &&
    parseISO(mediaItem.releaseDate) < new Date() &&
    parseISO(mediaItem.releaseDate) < new Date(lastTimeUpdated)
  ) {
    return (
      timePassed >=
      durationToMilliseconds({
        days: 30,
      })
    );
  }

  return timePassed >= durationToMilliseconds({ hours: 24 });
};

const margeTvShow = async (
  oldMediaItem: MediaItemBase,
  newMediaItem: MediaItemForProvider
) => {
  const oldMediaItemWithSeason = {
    ...oldMediaItem,
    seasons: await mediaItemRepository.seasonsWithEpisodes(oldMediaItem),
  };
  const updatedMediaItem = merge(oldMediaItemWithSeason, newMediaItem);

  const [episodesToDelete, seasonsToDelete] = getItemsToDelete(
    oldMediaItemWithSeason,
    updatedMediaItem
  );

  if (episodesToDelete.length > 0) {
    logger.info(
      `Local database has episodes not present in the external source. Attempting to remove local episodes: ${episodesToDelete
        .map(
          (episode) =>
            `${episode.seasonNumber}x${episode.episodeNumber} "${episode.title}"`
        )
        .join(', ')}`
    );
  }

  if (seasonsToDelete.length > 0) {
    logger.info(
      `Local database has seasons not present in the external source. Attempting to remove local seasons: ${seasonsToDelete
        .map((season) => `${season.seasonNumber} "${season.title}"`)
        .join(', ')}`
    );
  }

  if (episodesToDelete.length > 0 || seasonsToDelete.length > 0) {
    const episodesIdToDelete: number[] = [
      ...episodesToDelete.map((episode) => episode.id),
      ...seasonsToDelete.flatMap((season) =>
        season.episodes?.map((episode) => episode.id)
      ),
    ].filter((id): id is number => id != null);

    const seasonsIdsToDelete = seasonsToDelete
      .map((season) => season.id)
      .filter((id): id is number => id != null);

    if (episodesIdToDelete.length > 0 || seasonsIdsToDelete.length > 0) {
      try {
        await Database.knex.transaction(async (trx) => {
          if (episodesIdToDelete.length > 0) {
            const seen = await trx('seen').whereIn(
              'episodeId',
              episodesIdToDelete
            );

            if (seen.length > 0) {
              throw `failed to delete local episodes, there are seen entries with those episodes`;
            }

            const progress = await trx('progress').whereIn(
              'episodeId',
              episodesIdToDelete
            );

            if (progress.length > 0) {
              throw `failed to delete local episodes, there are progress entries with those episodes`;
            }

            const listItems = await trx('listItem').whereIn(
              'episodeId',
              episodesIdToDelete
            );

            if (listItems.length > 0) {
              throw `failed to delete local episodes, there are listItems with those episodes`;
            }

            const userRating = await trx('userRating').whereIn(
              'episodeId',
              episodesIdToDelete
            );

            if (userRating.length > 0) {
              throw `failed to delete local episodes, there are userRating with those episodes`;
            }

            await trx('seen').whereIn('episodeId', episodesIdToDelete).delete();
            await trx('progress')
              .whereIn('episodeId', episodesIdToDelete)
              .delete();

            await trx('listItem')
              .whereIn('episodeId', episodesIdToDelete)
              .delete();

            await trx('userRating')
              .whereIn('episodeId', episodesIdToDelete)
              .delete();

            await trx('notificationsHistory')
              .whereIn('episodeId', episodesIdToDelete)
              .delete();

            await trx('episode').whereIn('id', episodesIdToDelete).delete();
          }
          if (seasonsIdsToDelete.length > 0) {
            const listItems = await trx('listItem').whereIn(
              'seasonId',
              seasonsIdsToDelete
            );

            if (listItems.length > 0) {
              throw `failed to delete local seasons, there are listItems with those seasons`;
            }

            const userRating = await trx('userRating').whereIn(
              'seasonId',
              seasonsIdsToDelete
            );

            if (userRating.length > 0) {
              throw `failed to delete local seasons, there are userRating with those seasons`;
            }

            await trx('listItem')
              .whereIn('seasonId', seasonsIdsToDelete)
              .delete();

            await trx('userRating')
              .whereIn('seasonId', seasonsIdsToDelete)
              .delete();

            await trx('season').whereIn('id', seasonsIdsToDelete).delete();
          }

          return true;
        });
        logger.info(`deleted local episodes and seasons`);
      } catch (error) {
        logger.error(error);

        return {
          ...newMediaItem,
          id: oldMediaItemWithSeason.id,
          lastTimeUpdated: new Date().getTime(),
          seasons: oldMediaItemWithSeason.seasons,
        };
      }
    }
  }

  return updatedMediaItem;
};

const handleUpstream404WithoutPreparedApply = async (
  mediaItem: MediaItemBaseWithSeasons
): Promise<void> => {
  if (mediaItem.id == null) {
    return;
  }

  await mediaItemRepository.lock(mediaItem.id);

  try {
    await touchMediaItemLastUpdated(mediaItem);
  } finally {
    await mediaItemRepository.unlock(mediaItem.id);
  }
};

const prepareMediaItemFetch = async (
  mediaItem: MediaItemBaseWithSeasons
): Promise<PreparedMediaItemFetch> => {
  const metadataProvider = metadataProviders.get(mediaItem.mediaType, mediaItem.source);

  if (!metadataProvider) {
    return {
      mediaItem,
      error: new Error(
        `No metadata provider "${mediaItem.source}" for media type ${mediaItem.mediaType}`
      ),
    };
  }

  try {
    const newMediaItem = await metadataProvider.details(mediaItem);

    if (!newMediaItem) {
      return {
        mediaItem,
        metadataProvider,
        error: new Error('No metadata'),
      };
    }

    const [localizedDetails, gameLocalizations] = await Promise.all([
      fetchLocalizedDetails(metadataProvider, mediaItem, getMetadataLanguages()),
      fetchGameLocalizations(metadataProvider, mediaItem),
    ]);

    return {
      mediaItem,
      metadataProvider,
      newMediaItem,
      localizedDetails,
      gameLocalizations,
    };
  } catch (error) {
    return {
      mediaItem,
      metadataProvider,
      error,
    };
  }
};

type MetadataUpdateCounters = {
  numberOfUpdatedItems: number;
  numberOfSkippedItems: number;
  numberOfFailures: number;
};

const createMetadataUpdateCounters = (): MetadataUpdateCounters => ({
  numberOfUpdatedItems: 0,
  numberOfSkippedItems: 0,
  numberOfFailures: 0,
});

const shouldCancelMetadataUpdate = (
  cancellationToken?: CancellationToken
): boolean => {
  if (!cancellationToken?.shouldCancel) {
    return false;
  }

  logger.info(chalk.bold('Updating metadata canceled'));
  return true;
};

const logMetadataUpdateError = (error: unknown): void => {
  logger.error(chalk.red(error instanceof Error ? error.toString() : String(error)));
};

const logUpstream404Skip = (title: string): void => {
  logger.warn(
    chalk.yellow(
      `Skipping ${title}: upstream metadata returned 404. Keeping local metadata and refreshing lastTimeUpdated.`
    )
  );
};

const handlePreparedFetchFailure = async (args: {
  prepared: PreparedMediaItemFetch;
  counters: MetadataUpdateCounters;
}): Promise<boolean> => {
  const { prepared, counters } = args;

  if (!prepared.error) {
    return false;
  }

  if (isUpstreamMetadataNotFound(prepared.error)) {
    try {
      await handleUpstream404WithoutPreparedApply(prepared.mediaItem);
      logUpstream404Skip(prepared.mediaItem.title);
      counters.numberOfSkippedItems++;
    } catch (error) {
      logMetadataUpdateError(error);
      counters.numberOfFailures++;
    }
    return true;
  }

  logMetadataUpdateError(prepared.error);
  counters.numberOfFailures++;
  return true;
};

const hasPreparedMediaItemPayload = (
  prepared: PreparedMediaItemFetch
): prepared is PreparedMediaItemFetch &
  Required<Pick<PreparedMediaItemFetch, 'metadataProvider' | 'newMediaItem'>> =>
  prepared.metadataProvider != null && prepared.newMediaItem != null;

const applyPreparedMediaItemUpdate = async (args: {
  prepared: PreparedMediaItemFetch;
  counters: MetadataUpdateCounters;
}): Promise<void> => {
  const { prepared, counters } = args;

  if (!hasPreparedMediaItemPayload(prepared)) {
    logger.error(
      chalk.red(
        `Missing prepared metadata payload for media item ${prepared.mediaItem.id}`
      )
    );
    counters.numberOfFailures++;
    return;
  }

  try {
    await updateMediaItem(prepared.mediaItem, {
      metadataProvider: prepared.metadataProvider,
      newMediaItem: prepared.newMediaItem,
      localizedDetails: prepared.localizedDetails,
      gameLocalizations: prepared.gameLocalizations,
    });
    counters.numberOfUpdatedItems++;
  } catch (error) {
    if (error instanceof MissingUpstreamMetadataError) {
      logUpstream404Skip(error.mediaItem.title);
      counters.numberOfSkippedItems++;
      return;
    }

    logMetadataUpdateError(error);
    counters.numberOfFailures++;
  }
};

const logMetadataUpdateSummary = (
  counters: MetadataUpdateCounters
): void => {
  const {
    numberOfUpdatedItems,
    numberOfSkippedItems,
    numberOfFailures,
  } = counters;

  if (
    numberOfUpdatedItems === 0 &&
    numberOfSkippedItems === 0 &&
    numberOfFailures === 0
  ) {
    logger.info(chalk.bold.green(t`Everything up to date`));
    return;
  }

  if (numberOfUpdatedItems > 0) {
    logger.info(
      chalk.bold.green(
        plural(numberOfUpdatedItems, {
          one: 'Updated 1 item',
          other: 'Updated # items',
        })
      )
    );
  }

  if (numberOfSkippedItems > 0) {
    logger.warn(
      chalk.bold.yellow(
        plural(numberOfSkippedItems, {
          one: 'Skipped 1 item because upstream metadata returned 404',
          other: 'Skipped # items because upstream metadata returned 404',
        })
      )
    );
  }

  if (numberOfFailures > 0) {
    logger.error(
      chalk.bold.red(
        plural(numberOfFailures, {
          one: 'Failed to update 1 item',
          other: 'Failed to update # items',
        })
      )
    );
  }
};

export const updateMediaItems = async (args: {
  mediaItems: MediaItemBaseWithSeasons[];
  cancellationToken?: CancellationToken;
  forceUpdate?: boolean;
}) => {
  const { mediaItems, cancellationToken, forceUpdate } = args;

  logger.info(
    chalk.bold.green(
      plural(mediaItems.length, {
        one: 'Updating metadata for # item',
        other: 'Updating metadata for # items',
      })
    )
  );

  const counters = createMetadataUpdateCounters();
  const selectedMediaItems = mediaItems.filter((mediaItem) =>
    forceUpdate ? true : shouldUpdate(mediaItem)
  );

  for (const mediaItemBatch of chunkItems(
    selectedMediaItems,
    METADATA_SYNC_BATCH_SIZE
  )) {
    if (shouldCancelMetadataUpdate(cancellationToken)) {
      break;
    }

    const preparedBatch = await mapWithConcurrency(
      mediaItemBatch,
      METADATA_SYNC_FETCH_CONCURRENCY,
      async (mediaItem) => await prepareMediaItemFetch(mediaItem)
    );

    // SQLite writes remain serialized item-by-item during apply.
    for (const prepared of preparedBatch) {
      if (shouldCancelMetadataUpdate(cancellationToken)) {
        break;
      }

      if (await handlePreparedFetchFailure({ prepared, counters })) {
        continue;
      }

      await applyPreparedMediaItemUpdate({ prepared, counters });
    }
  }

  logMetadataUpdateSummary(counters);

  cancellationToken?.complected();
};

export const runLockedMetadataUpdate = createLock(
  async (args: {
    selectMediaItems: () => Promise<MediaItemBaseWithSeasons[]>;
    forceUpdate?: boolean;
  }): Promise<void> => {
    await mediaItemRepository.unlockLockedMediaItems();
    const mediaItems = await args.selectMediaItems();
    await updateMediaItems({
      mediaItems,
      forceUpdate: args.forceUpdate,
    });
  }
);

export const updateMetadata = async (): Promise<void> => {
  await runLockedMetadataUpdate({
    selectMediaItems: async () => await mediaItemRepository.itemsToPossiblyUpdate(),
  });
};
