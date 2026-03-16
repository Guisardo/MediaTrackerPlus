import React from 'react';
import StatisticsSegmant from './StatisticsSegment';
import { Statistics } from 'mediatracker-api';
import { useSeen } from 'src/hooks/statisticHooks';

const StatisticSummaryYear = (props: {
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery;
}) => {
  const {
    error: errorSeenCount,
    data: data,
    isFetched: isFetchedSeenCount,
  } = useSeen(props.currentYear);

  return data ? (
    <StatisticsSegmant
      data={data}
      year={props.currentYear.year ?? undefined}
    ></StatisticsSegmant>
  ) : null;
};

export default StatisticSummaryYear;
