import { useMutation, useQuery } from 'react-query';
import {
  GroupDetailResponse,
  GroupMemberResponse,
  GroupResponse,
  UserGroupRole,
} from 'mediatracker-api';

import { mediaTrackerApi } from 'src/api/api';
import { queryClient } from 'src/App';

const USER_GROUPS_QUERY_KEY = 'userGroups';

const groupDetailQueryKey = (groupId: number) => ['group', groupId];

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

/**
 * React Query hook for fetching a single group's details (members, name, role).
 *
 * Returns:
 *  - group: GroupDetailResponse (undefined while loading)
 *  - isLoading: true while fetching
 *  - isError: true if the request failed
 *  - invalidateGroupQuery: invalidates this group's cache to trigger a refetch
 */
export const useGroup = (groupId: number) => {
  const key = groupDetailQueryKey(groupId);

  const { data, isLoading, isError } = useQuery(key, () =>
    mediaTrackerApi.group.getGroup(groupId)
  );

  return {
    group: data as GroupDetailResponse | undefined,
    isLoading,
    isError,
    invalidateGroupQuery: () => {
      queryClient.invalidateQueries(key);
    },
  };
};

/**
 * React Query mutation hook for updating a group's name.
 *
 * Invalidates the group detail and userGroups caches on success.
 */
export const useUpdateGroup = (groupId: number) => {
  const mutation = useMutation(
    (name: string) => mediaTrackerApi.group.updateGroup(groupId, { name }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(groupDetailQueryKey(groupId));
        queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
      },
    }
  );

  return {
    updateGroup: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};

/**
 * React Query mutation hook for deleting (soft-deleting) a group.
 *
 * Invalidates the userGroups cache on success.
 */
export const useDeleteGroup = (groupId: number) => {
  const mutation = useMutation(
    () => mediaTrackerApi.group.deleteGroup(groupId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
      },
    }
  );

  return {
    deleteGroup: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};

/**
 * React Query mutation hook for adding a member to a group.
 *
 * Invalidates the group detail cache on success.
 */
export const useAddGroupMember = (groupId: number) => {
  const mutation = useMutation(
    ({ userId, role }: { userId: number; role: UserGroupRole }) =>
      mediaTrackerApi.group.addGroupMember(groupId, { userId, role }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(groupDetailQueryKey(groupId));
        queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
      },
    }
  );

  return {
    addGroupMember: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};

/**
 * React Query mutation hook for removing a member from a group.
 *
 * Invalidates the group detail and userGroups caches on success (in case
 * the sole-admin soft-delete changes the group's availability).
 */
export const useRemoveGroupMember = (groupId: number) => {
  const mutation = useMutation(
    (userId: number) => mediaTrackerApi.group.removeGroupMember(groupId, userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(groupDetailQueryKey(groupId));
        queryClient.invalidateQueries(USER_GROUPS_QUERY_KEY);
      },
    }
  );

  return {
    removeGroupMember: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};

/**
 * React Query mutation hook for updating a group member's role.
 *
 * Invalidates the group detail cache on success.
 */
export const useUpdateGroupMemberRole = (groupId: number) => {
  const mutation = useMutation(
    ({ userId, role }: { userId: number; role: UserGroupRole }) =>
      mediaTrackerApi.group.updateGroupMemberRole(groupId, userId, { role }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(groupDetailQueryKey(groupId));
      },
    }
  );

  return {
    updateGroupMemberRole: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
  };
};

/**
 * User search result shape returned by GET /api/users/search.
 * Only id and name are returned (non-sensitive fields).
 */
export interface UserSearchResult {
  id: number;
  name: string;
}

/**
 * Searches users by name query via GET /api/users/search.
 *
 * This is a standalone async function (not a hook) because user search is
 * triggered on-demand from the add-member UI input.  The caller is
 * responsible for debouncing before calling this.
 */
export const searchUsers = async (
  query: string
): Promise<UserSearchResult[]> => {
  const result = await mediaTrackerApi.users.search({ query });
  return result as unknown as UserSearchResult[];
};

export type { GroupDetailResponse, GroupMemberResponse, GroupResponse, UserGroupRole };
