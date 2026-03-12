import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from 'src/App';

import { mediaTrackerApi } from 'src/api/api';

export const useConfiguration = () => {
  const { isLoading, error, data } = useQuery({
    queryKey: ['configuration'],
    queryFn: () => mediaTrackerApi.configuration.get(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof mediaTrackerApi.configuration.update>[0]) =>
      mediaTrackerApi.configuration.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration'] });
    },
  });

  return {
    isLoading: isLoading,
    error: error,
    configuration: data,
    update: updateMutation.mutate,
  };
};
