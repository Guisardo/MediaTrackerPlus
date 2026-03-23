import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from 'src/App';
import { ApiResult, errorHandler, mediaTrackerApi } from 'src/api/api';
import React from 'react';
import { UserResponse } from 'mediatracker-api';

export const useOtherUser = (userId: number) => {
  const { isLoading, error, data } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => mediaTrackerApi.user.getById(userId),
  });

  return {
    isLoading: isLoading,
    error: error,
    user: data,
  };
};

export const useUser = () => {
  const { isLoading, error, data } = useQuery({
    queryKey: ['user'],
    queryFn: mediaTrackerApi.user.get,
  });

  const logoutMutation = useMutation({
    mutationFn: () => mediaTrackerApi.user.logout(),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
      queryClient.removeQueries();
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.user.login>[0]) =>
      mediaTrackerApi.user.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });

      queryClient.removeQueries({ queryKey: ['metadataProviderCredentials'] });
      queryClient.removeQueries({ queryKey: ['notificationPlatformsCredentials'] });
      queryClient.removeQueries({ queryKey: ['tokens'] });
      queryClient.removeQueries({ queryKey: ['calendar'] });
      queryClient.removeQueries({ queryKey: ['calendar'] });
      queryClient.removeQueries({ queryKey: ['details'] });
      queryClient.removeQueries({ queryKey: ['import'] });
      queryClient.removeQueries({ queryKey: ['items'] });
      queryClient.removeQueries({ queryKey: ['search'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.user.update>[0]) =>
      mediaTrackerApi.user.update(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });

      if ('dateOfBirth' in variables) {
        queryClient.invalidateQueries({ queryKey: ['items'] });
        queryClient.invalidateQueries({ queryKey: ['facets'] });
        queryClient.invalidateQueries({ queryKey: ['search'] });
        queryClient.invalidateQueries({ queryKey: ['details'] });
        queryClient.invalidateQueries({ queryKey: ['listItems'] });
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
        queryClient.invalidateQueries({ queryKey: ['statistics'] });
        queryClient.invalidateQueries({ queryKey: ['genre'] });
      }
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.user.updatePassword>[0]) =>
      mediaTrackerApi.user.updatePassword(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  return {
    isLoading: isLoading,
    error: error,
    user: data,
    updateUser: updateUserMutation.mutateAsync,
    updatePassword: updatePasswordMutation.mutateAsync,
    loginIsError: loginMutation.isError,
    loginIsLoading: loginMutation.isPending,
    login: loginMutation.mutate,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
  };
};

export const useRegisterUser = () => {
  const [error, setError] = React.useState<string>();

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.user.register>[0]) =>
      errorHandler(mediaTrackerApi.user.register)(data),
    onSuccess: (data: ApiResult<UserResponse>) => {
      if (data.data) {
        queryClient.invalidateQueries({ queryKey: ['configuration'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }
    },
    onSettled: (data: ApiResult<UserResponse> | undefined) => {
      if (data?.error) {
        setError(data.error);
      } else {
        setError(undefined);
      }
    },
  });

  return {
    registerUser: mutation.mutate,
    error: error,
  };
};
