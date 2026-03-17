import _ from 'lodash';
import { ExternalIds, MediaItemForProvider, MediaType } from 'src/entity/mediaItem';
import { logger } from 'src/logger';
import { Audible } from 'src/metadata/provider/audible';
import { OpenLibrary } from 'src/metadata/provider/openlibrary';
import { TMDbMovie, TMDbTv } from 'src/metadata/provider/tmdb';
import { tvEpisodeRepository } from 'src/repository/episode';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { definedOrUndefined } from 'src/repository/repository';
import { updateMediaItem } from 'src/updateMetadata';

export const findEpisodeByExternalId = async (args: {
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
}) => {
  const { imdbId, tmdbId, tvdbId } = args;

  const episode = await tvEpisodeRepository.findOne({
    tmdbId: definedOrUndefined(tmdbId),
    tvdbId: definedOrUndefined(tvdbId),
    imdbId: definedOrUndefined(imdbId),
  });

  if (episode) {
    const mediaItem = await mediaItemRepository.findOne({ id: episode.tvdbId });

    return {
      mediaItem: mediaItem,
      episode: episode,
    };
  }

  if (imdbId) {
    const res = await new TMDbTv().findByEpisodeImdbId(imdbId);

    if (res) {
      return await findMediaItemOrEpisodeByExternalId({
        mediaType: 'tv',
        id: {
          tmdbId: res.tvShowTmdbId,
        },
        episodeNumber: res.episode.episodeNumber,
        seasonNumber: res.episode.seasonNumber,
      });
    }
  } else if (tvdbId) {
    const res = await new TMDbTv().findByEpisodeTvdbId(tvdbId);

    if (res) {
      return await findMediaItemOrEpisodeByExternalId({
        mediaType: 'tv',
        id: {
          tmdbId: res.tvShowTmdbId,
        },
        episodeNumber: res.episode.episodeNumber,
        seasonNumber: res.episode.seasonNumber,
      });
    }
  }

  throw `Unable to find episode with imdbId: ${imdbId}, tmdbId: ${tmdbId}, tvdbId: ${tvdbId}`;
};

export const findMediaItemOrEpisodeByExternalId = async (args: {
  mediaType: MediaType;
  id: {
    imdbId?: string;
    tmdbId?: number;
    audibleId?: string;
    igdbId?: number;
  };
  seasonNumber?: number;
  episodeNumber?: number;
}) => {
  const { mediaType, id, seasonNumber, episodeNumber } = args;

  if (
    mediaType === 'tv' &&
    (typeof seasonNumber !== 'number' || typeof episodeNumber !== 'number')
  ) {
    return {
      error: 'Season end episode number are required for mediaType "tv"',
    };
  }

  if (!id.imdbId && !id.tmdbId && !id.audibleId && !id.igdbId) {
    return {
      error: 'At least one external id is required',
    };
  }

  const mediaItem = await findMediaItemByExternalId({
    id: id,
    mediaType: mediaType,
  });

  if (!mediaItem) {
    return {
      error: `Unable to find mediaItem with id: ${JSON.stringify(id)}`,
    };
  }

  if (mediaType === 'tv') {
    if (mediaItem.needsDetails) {
      await updateMediaItem(mediaItem);
    }

    const episode = await tvEpisodeRepository.findOne({
      tvShowId: mediaItem.id,
      episodeNumber: episodeNumber,
      seasonNumber: seasonNumber,
    });

    if (!episode) {
      return {
        error: `Unable to find episode S${seasonNumber}E${episodeNumber} for ${mediaItem.title}`,
      };
    }

    return {
      mediaItem: mediaItem,
      episode: episode,
    };
  }

  return {
    mediaItem: mediaItem,
  };
};

export const findMediaItemByExternalId = async (args: {
  id: ExternalIds;
  mediaType: MediaType;
}) => {
  const { id, mediaType } = args;
  const existingItem = await mediaItemRepository.findByExternalId(
    id,
    mediaType
  );

  if (!existingItem) {
    return await findMediaItemByExternalIdInExternalSources(args);
  }

  return existingItem;
};

export const findMediaItemByExternalIdInExternalSources = async (args: {
  id: ExternalIds;
  mediaType: MediaType;
}) => {
  const res = await searchMediaItem(args);

  if (res) {
    const existingItem = await mediaItemRepository.findByExternalId(
      res,
      args.mediaType
    );

    if (!existingItem) {
      return await mediaItemRepository.create(res);
    }

    return existingItem;
  }
};

const searchMediaItem = async (args: {
  id: ExternalIds;
  mediaType: MediaType;
}) => {
  const { id, mediaType } = args;

  type SearchPlanEntry = {
    debugMessage?: string;
    errorMessage: string;
    lookup: () => Promise<MediaItemForProvider | undefined>;
  };

  const runSearchPlan = async (
    searchPlan: SearchPlanEntry[]
  ): Promise<MediaItemForProvider | undefined> => {
    for (const entry of searchPlan) {
      if (entry.debugMessage) {
        logger.debug(entry.debugMessage);
      }

      try {
        const res = await entry.lookup();

        if (res) {
          return res;
        }
      } catch (error) {
        void error;
      }

      logger.error(entry.errorMessage);
    }
  };

  if (mediaType === 'tv') {
    return runSearchPlan(
      [
        id.tmdbId && {
          debugMessage: `searching tv show by tmdbId: ${id.tmdbId}`,
          errorMessage: `unable to find tv show with tmdbId: ${id.tmdbId}`,
          lookup: () => new TMDbTv().findByTmdbId(id.tmdbId as number),
        },
        id.imdbId && {
          debugMessage: `searching tv show by imdbId: ${id.imdbId}`,
          errorMessage: `unable to find tv show with imdbId: ${id.imdbId}`,
          lookup: () => new TMDbTv().findByImdbId(id.imdbId as string),
        },
        id.tvdbId && {
          debugMessage: `searching tv show by tvdbId: ${id.tvdbId}`,
          errorMessage: `unable to find tv show with tvdbId: ${id.tvdbId}`,
          lookup: () => new TMDbTv().findByTvdbId(id.tvdbId as number),
        },
      ].filter(Boolean) as SearchPlanEntry[]
    );
  } else if (mediaType === 'movie') {
    return runSearchPlan(
      [
        id.tmdbId && {
          debugMessage: `searching movie by tmdbId: ${id.tmdbId}`,
          errorMessage: `unable to find movie with tmdbId: ${id.tmdbId}`,
          lookup: () => new TMDbMovie().findByTmdbId(id.tmdbId as number),
        },
        id.imdbId && {
          debugMessage: `searching movie by imdbId: ${id.imdbId}`,
          errorMessage: `unable to find movie with imdbId: ${id.imdbId}`,
          lookup: () => new TMDbMovie().findByImdbId(id.imdbId as string),
        },
      ].filter(Boolean) as SearchPlanEntry[]
    );
  } else if (mediaType === 'audiobook') {
    if (id.audibleId) {
      return runSearchPlan([
        {
          errorMessage: `unable to find audiobook with audibleId: ${id.audibleId}`,
          lookup: () => new Audible().findByAudibleId(id.audibleId as string),
        },
      ]);
    }
  } else if (mediaType === 'book') {
    if (id.openlibraryId) {
      return runSearchPlan([
        {
          errorMessage: `unable to find book with openlibraryId: ${id.openlibraryId}`,
          lookup: () =>
            new OpenLibrary().details({
              openlibraryId: id.openlibraryId as string,
            }),
        },
      ]);
    }
  }

  logger.error(
    `no metadata provider for type ${mediaType} with external ids ${JSON.stringify(
      _.omitBy(id, (value) => !value)
    )}`
  );
};
