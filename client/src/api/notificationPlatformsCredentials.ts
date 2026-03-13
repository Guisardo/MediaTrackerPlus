import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from 'src/App';

import { mediaTrackerApi } from 'src/api/api';

export const useNotificationPlatformsCredentials = () => {
  const { isLoading, error, data } = useQuery({
    queryKey: ['notificationPlatformsCredentials'],
    queryFn: () => mediaTrackerApi.user.getNotificationCredentials(),
  });

  const setNotificationCredentialsMutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.user.updateNotificationCredentials>[0]) =>
      mediaTrackerApi.user.updateNotificationCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPlatformsCredentials'] });
    },
  });

  return {
    isLoading: isLoading,
    error: error,
    notificationPlatformsCredentials: data,
    setNotificationPlatformsCredentials:
      setNotificationCredentialsMutation.mutate,
  };
};
