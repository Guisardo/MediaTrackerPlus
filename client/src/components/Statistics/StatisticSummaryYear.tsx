import React from 'react';
import { useQuery } from 'react-query';
import { mediaTrackerApi } from 'src/api/api';
import StatisticsSegmant from './StatisticsSegment';
import { Statistics } from 'mediatracker-api';

const StatisticSummaryYear = (props: {
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery;
}) => {
  const {
    error: errorSeenCount,
    data: data,
    isFetched: isFetchedSeenCount,
  } = useQuery(['statistics', props.currentYear], async () =>
    mediaTrackerApi.statistics.statisticsSeeninyearList(props.currentYear)
  );

  return (
    <StatisticsSegmant
      data={data}
      year={props.currentYear.year}
    ></StatisticsSegmant>
  );
};

export default StatisticSummaryYear;
