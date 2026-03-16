import { useQuery } from '@tanstack/react-query';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient } from 'src/App';

export const useLists = (args: {
  userId: number;
  mediaItemId?: number;
  seasonId?: number;
  episodeId?: number;
}) => {
  const { userId, mediaItemId, seasonId, episodeId } = args;

  const key = ['lists', userId, mediaItemId, seasonId, episodeId];

  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () =>
      mediaTrackerApi.lists.getUsersLists({
        userId,
        ...(mediaItemId !== undefined ? { mediaItemId } : {}),
        ...(seasonId !== undefined ? { seasonId } : {}),
        ...(episodeId !== undefined ? { episodeId } : {}),
      }),
  });

  return {
    lists: data,
    isLoading,
    isError,
    invalidateListsQuery: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['details', mediaItemId] });
    },
  };
};
