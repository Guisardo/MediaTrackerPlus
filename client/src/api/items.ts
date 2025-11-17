import { useQuery, useMutation } from 'react-query';

import { Items, MediaItemItemsResponse } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';

type paginatedApiReturnType = {
  data: MediaItemItemsResponse[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
};

export const useItems = (args: Items.Paginated.RequestQuery) => {
  if (args.selectRandom === undefined) {
    args.selectRandom = false;
  }

  const { error, data, isFetched } = useQuery(
    ['items', args],
    async () =>
      args.selectRandom
        ? mediaTrackerApi.items.random(args)
        : mediaTrackerApi.items.paginated(args),
    {
      keepPreviousData: true,
    }
  );

  const search = useMutation((query: string) =>
    mediaTrackerApi.search.search({ mediaType: args.mediaType, q: query })
  );

  return !args.selectRandom
    ? {
        items: search.data
          ? search.data
          : (data as paginatedApiReturnType)?.data,
        error: error,
        isLoading: !isFetched || search.isLoading,
        numberOfPages: data
          ? (data as paginatedApiReturnType).totalPages
          : undefined,
        numberOfItemsTotal: data
          ? (data as paginatedApiReturnType).total
          : undefined,
        search: search.mutate,
      }
    : {
        items: search.data ? search.data : (data as MediaItemItemsResponse[]),
        error: error,
        isLoading: !isFetched || search.isLoading,
        numberOfItemsTotal: data
          ? (data as MediaItemItemsResponse[]).length
          : undefined,
        search: search.mutate,
      };
};
