import { useQuery } from '@tanstack/react-query';
import { ListSortBy } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient } from 'src/App';

export const useListItems = (args: { listId: number; sortBy?: ListSortBy }) => {
  const { listId, sortBy } = args;

  const key = ['listItems', listId, sortBy];

  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () =>
      mediaTrackerApi.list.getListItems({
        listId,
        ...(sortBy !== undefined ? { sortBy } : {}),
      }),
  });

  return {
    listItems: data,
    isLoading,
    isError,
    invalidateListItemsQuery: () => queryClient.invalidateQueries({ queryKey: key }),
  };
};
