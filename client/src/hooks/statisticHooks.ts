import { Statistics } from 'mediatracker-api';
import { useQuery } from 'react-query';
import { mediaTrackerApi } from 'src/api/api';

export const useGenreSeen = (
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery
) => {
  let year = currentYear;
  if (currentYear.year === null) {
    year = null;
  }

  const {
    error: error,
    data: data,
    isFetched: isFetched,
  } = useQuery(['genre', year], async () =>
    mediaTrackerApi.statistics.statisticsGenresinyearList(year)
  );

  return {
    error,
    data,
    isFetched,
  };
};

export const useSeen = (
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery
) => {
  let year = currentYear;
  if (currentYear.year === null) {
    year = null;
  }

  const {
    error: error,
    data: data,
    isFetched: isFetched,
  } = useQuery(['statistics', year], async () =>
    mediaTrackerApi.statistics.statisticsSeeninyearList(year)
  );

  return {
    error,
    data,
    isFetched,
  };
};
