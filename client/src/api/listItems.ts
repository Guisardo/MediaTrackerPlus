import { useQuery } from 'react-query';
import { ListSortBy } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient } from 'src/App';

export const useListItems = (args: { listId: number; sortBy?: ListSortBy }) => {
  const { listId, sortBy } = args;

  const key = ['listItems', listId, sortBy];

  const { data, isLoading, isError } = useQuery(key, () =>
    mediaTrackerApi.list.getListItems({ listId, sortBy })
  );

  return {
    listItems: data,
    isLoading,
    isError,
    invalidateListItemsQuery: () => queryClient.invalidateQueries(key),
  };
};
