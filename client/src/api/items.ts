import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';

import { Items, MediaItemItemsResponse } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';

type paginatedApiReturnType = {
  data: MediaItemItemsResponse[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  ageGatingActive?: boolean | null;
};

export const useItems = (args: Items.Paginated.RequestQuery) => {
  const selectRandom = args.selectRandom ?? false;

  const { error, data, isFetched } = useQuery({
    queryKey: ['items', args],
    queryFn: async () =>
      selectRandom
        ? mediaTrackerApi.items.random(args)
        : mediaTrackerApi.items.paginated(args),
    placeholderData: keepPreviousData,
  });

  const search = useMutation({
    mutationFn: (query: string) => {
      if (args.mediaType == null) {
        throw new Error('mediaType is required for search');
      }

      return mediaTrackerApi.search.search({ mediaType: args.mediaType, q: query });
    },
  });

  return !selectRandom
    ? {
        items: search.data
          ? search.data
          : (data as paginatedApiReturnType)?.data,
        error: error,
        isLoading: !isFetched || search.isPending,
        numberOfPages: data
          ? (data as paginatedApiReturnType).totalPages
          : undefined,
        numberOfItemsTotal: data
          ? (data as paginatedApiReturnType).total
          : undefined,
        ageGatingActive: data
          ? ((data as paginatedApiReturnType).ageGatingActive ?? false)
          : false,
        search: search.mutate,
      }
    : {
        items: search.data ? search.data : (data as MediaItemItemsResponse[]),
        error: error,
        isLoading: !isFetched || search.isPending,
        numberOfItemsTotal: data
          ? (data as MediaItemItemsResponse[]).length
          : undefined,
        ageGatingActive: false as const,
        search: search.mutate,
      };
};
