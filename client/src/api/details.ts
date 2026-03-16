import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from 'src/App';
import {
  MediaItemItemsResponse,
  TvEpisode,
  LastSeenAt,
  Items,
  ListItemsResponse,
} from 'mediatracker-api';

import { TvSeason } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';

export const detailsKey = (mediaItemId: number) => ['details', mediaItemId];

const getDetails = async (mediaItemId: number) => {
  return mediaTrackerApi.details.get(mediaItemId);
};

const requireId = (
  value: number | null | undefined,
  label: string
): number => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

export const useDetails = (mediaItemId: number) => {
  const { isLoading, error, data } = useQuery({
    queryKey: detailsKey(mediaItemId),
    queryFn: () => getDetails(mediaItemId),
  });

  return {
    isLoading: isLoading,
    error: error,
    mediaItem: data,
  };
};

export const useUpdateMetadata = (mediaItemId: number) => {
  const mutation = useMutation({
    mutationFn: () => mediaTrackerApi.details.updateMetadata(mediaItemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailsKey(mediaItemId) }),
  });

  return {
    updateMetadata: mutation.mutate,
    isLoading: mutation.isPending,
    isError: mutation.isError,
  };
};

const updateMediaItem = async (mediaItem: MediaItemItemsResponse) => {
  const mediaItemId = requireId(mediaItem.id, 'mediaItem.id');
  const key = detailsKey(mediaItemId);
  await queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' });

  const updatedMediaItem =
    queryClient.getQueryData<MediaItemItemsResponse>(key) ||
    (await getDetails(mediaItemId));

  const updater = (item: MediaItemItemsResponse) => {
    return item.id === updatedMediaItem?.id ? updatedMediaItem : item;
  };

  queryClient.setQueriesData(
    { queryKey: ['items'] },
    (items: Items.Paginated.ResponseBody | undefined) => {
      if (!items) {
        return items;
      }

      return {
        ...items,
        data: items.data.map(updater),
      };
    }
  );

  queryClient.setQueriesData({ queryKey: ['listItems'] }, (items: ListItemsResponse | undefined) => {
    return items?.map((item) => ({
      ...item,
      mediaItem: updater(item.mediaItem),
    }));
  });

  queryClient.setQueriesData({ queryKey: ['search'] }, (data: MediaItemItemsResponse[]) => {
    return data?.map(updater);
  });
};

export const setRating = async (
  options: {
    rating?: number | null;
    review?: string;
  } & (
    | { mediaItem: MediaItemItemsResponse }
    | { mediaItem: MediaItemItemsResponse; season: TvSeason }
    | { mediaItem: MediaItemItemsResponse; episode: TvEpisode }
  )
) => {
  const mediaItem = options.mediaItem;
  const season = 'season' in options ? options.season : undefined;
  const episode = 'episode' in options ? options.episode : undefined;

  await mediaTrackerApi.rating.add({
    mediaItemId: requireId(mediaItem.id, 'mediaItem.id'),
    ...(season?.id != null ? { seasonId: season.id } : {}),
    ...(episode?.id != null ? { episodeId: episode.id } : {}),
    ...(options.rating !== undefined ? { rating: options.rating } : {}),
    ...(options.review !== undefined ? { review: options.review } : {}),
  });

  await updateMediaItem(mediaItem);
  queryClient.setQueriesData({ queryKey: ['listItems'] }, (items: ListItemsResponse) => {
    return items.map((item) => {
      if (item.mediaItem.id === mediaItem.id) {
        const userRating = {
          rating: options.rating,
          review: options.review,
        };

        if (episode) {
          return {
            ...item,
            episode: {
              ...item.episode,
              userRating: userRating,
            },
          };
        } else if (season) {
          return {
            ...item,
            season: {
              ...item.season,
              userRating: userRating,
            },
          };
        } else {
          return {
            ...item,
            mediaItem: {
              ...item.mediaItem,
              userRating: userRating,
            },
          };
        }
      }

      return item;
    });
  });
};

export const removeFromWatchlist = async (args: {
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}) => {
  const { mediaItem, season, episode } = args;

  await mediaTrackerApi.watchlist.delete({
    mediaItemId: requireId(mediaItem.id, 'mediaItem.id'),
    ...(season?.id != null ? { seasonId: season.id } : {}),
    ...(episode?.id != null ? { episodeId: episode.id } : {}),
  });

  if (!season && !episode) {
    await updateMediaItem(mediaItem);
  } else {
    queryClient.invalidateQueries({ queryKey: ['details'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  }

  queryClient.invalidateQueries({ queryKey: ['list'] });
  queryClient.invalidateQueries({ queryKey: ['lists'] });
  queryClient.invalidateQueries({ queryKey: ['listItems'] });
};

export const addToWatchlist = async (args: {
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}) => {
  const { mediaItem, season, episode } = args;

  await mediaTrackerApi.watchlist.add({
    mediaItemId: requireId(mediaItem.id, 'mediaItem.id'),
    ...(season?.id != null ? { seasonId: season.id } : {}),
    ...(episode?.id != null ? { episodeId: episode.id } : {}),
  });

  if (!season && !episode) {
    await updateMediaItem(mediaItem);
  } else {
    queryClient.invalidateQueries({ queryKey: ['details'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  }

  queryClient.invalidateQueries({ queryKey: ['list'] });
  queryClient.invalidateQueries({ queryKey: ['lists'] });
  queryClient.invalidateQueries({ queryKey: ['listItems'] });
};

export const addToProgress = async (args: {
  mediaItemId: number;
  progress: number;
  duration?: number;
}) => {
  const { mediaItemId, progress, duration } = args;

  await mediaTrackerApi.progress.add({
    mediaItemId,
    date: new Date().getTime(),
    progress,
    ...(duration !== undefined ? { duration } : {}),
  });

  queryClient.invalidateQueries({ queryKey: detailsKey(mediaItemId) });
  queryClient.invalidateQueries({ queryKey: ['items'] });
};

export const markAsSeen = async (args: {
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
  seenAt?: LastSeenAt;
  date?: Date;
}) => {
  await mediaTrackerApi.seen.add({
    mediaItemId: requireId(args.mediaItem.id, 'mediaItem.id'),
    ...(args.season?.id != null ? { seasonId: args.season.id } : {}),
    ...(args.episode?.id != null ? { episodeId: args.episode.id } : {}),
    ...(args.seenAt !== undefined ? { lastSeenAt: args.seenAt } : {}),
    ...(args.date !== undefined ? { date: args.date.getTime() } : {}),
  });

  await updateMediaItem(args.mediaItem);
  queryClient.invalidateQueries({ queryKey: ['items'] });
};

export const setLastSeenEpisode = async (args: {
  mediaItem: MediaItemItemsResponse;
  episode: TvEpisode;
  season?: TvSeason;
  lastSeenAt: LastSeenAt;
  date?: Date;
}) => {
  await mediaTrackerApi.seen.add({
    mediaItemId: requireId(args.mediaItem.id, 'mediaItem.id'),
    lastSeenEpisodeId: requireId(args.episode.id, 'episode.id'),
    lastSeenAt: args.lastSeenAt,
    ...(args.season?.id != null ? { seasonId: args.season.id } : {}),
    ...(args.date !== undefined ? { date: args.date.getTime() } : {}),
  });

  await updateMediaItem(args.mediaItem);
  queryClient.invalidateQueries({ queryKey: ['items'] });
};

export const markAsUnseen = async (args: {
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
  seenId?: number;
}) => {
  if (args.seenId) {
    await mediaTrackerApi.seen.deleteById(args.seenId);
  } else {
    await mediaTrackerApi.seen.delete({
      mediaItemId: requireId(args.mediaItem.id, 'mediaItem.id'),
      ...(args.season?.id != null ? { seasonId: args.season.id } : {}),
      ...(args.episode?.id != null ? { episodeId: args.episode.id } : {}),
    });
  }

  await updateMediaItem(args.mediaItem);
  queryClient.invalidateQueries({ queryKey: ['items'] });
};

export const removeFromSeenHistory = async (
  mediaItem: MediaItemItemsResponse
) => {
  await mediaTrackerApi.seen.delete({
    mediaItemId: requireId(mediaItem.id, 'mediaItem.id'),
  });
  await updateMediaItem(mediaItem);
  queryClient.invalidateQueries({ queryKey: ['items'] });
};
