import { Statistics } from 'mediatracker-api';
import { useQuery } from '@tanstack/react-query';
import { mediaTrackerApi } from 'src/api/api';

export const useGenreSeen = (
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery
) => {
  const year = (currentYear.year === null
    ? null
    : currentYear) as Statistics.StatisticsSeeninyearList.RequestQuery | null;

  const {
    error: error,
    data: data,
    isFetched: isFetched,
  } = useQuery({
    queryKey: ['genre', year],
    queryFn: async () =>
      mediaTrackerApi.statistics.statisticsGenresinyearList(
        year as Statistics.StatisticsSeeninyearList.RequestQuery | undefined
      ),
  });

  return {
    error,
    data,
    isFetched,
  };
};

export const useSeen = (
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery
) => {
  const year = (currentYear.year === null
    ? null
    : currentYear) as Statistics.StatisticsSeeninyearList.RequestQuery | null;

  const {
    error: error,
    data: data,
    isFetched: isFetched,
  } = useQuery({
    queryKey: ['statistics', year],
    queryFn: async () =>
      mediaTrackerApi.statistics.statisticsSeeninyearList(
        year as Statistics.StatisticsSeeninyearList.RequestQuery | undefined
      ),
  });

  return {
    error,
    data,
    isFetched,
  };
};
