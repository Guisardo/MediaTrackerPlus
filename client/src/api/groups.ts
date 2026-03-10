import { useMutation, useQuery } from 'react-query';
import { GroupResponse } from 'mediatracker-api';

import { mediaTrackerApi } from 'src/api/api';
import { queryClient } from 'src/App';

const USER_GROUPS_QUERY_KEY = 'userGroups';

/**
 * React Query hook for fetching the current user's groups.
 *
 * Returns:
 *  - groups: list of GroupResponse (undefined while loading)
 *  - isLoading: true while fetching
 *  - isError: true if the request failed
 *  - invalidateUserGroupsQuery: invalidates cache to trigger a refetch
 */
export const useUserGroups = () => {
  const { data, isLoading, isError } = useQuery(USER_GROUPS_QUERY_KEY, () =>
    mediaTrackerApi.group.listGroups()
  );

  return {
    groups: data as GroupResponse[] | undefined,
    isLoading,
    isError,
    invalidateUserGroupsQuery: () => {
      queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
    },
  };
};

/**
 * React Query mutation hook for creating a new group.
 *
 * Automatically invalidates the userGroups query on success.
 */
export const useCreateGroup = () => {
  const mutation = useMutation(
    (name: string) => mediaTrackerApi.group.createGroup({ name }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
      },
    }
  );

  return {
    createGroup: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};
