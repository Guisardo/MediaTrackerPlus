import React, { FunctionComponent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mediaTrackerApi } from 'src/api/api';
import StatisticsSegmant from './StatisticsSegment';

export const StatisticsSummary: FunctionComponent = () => {
  const { data } = useQuery({
    queryKey: ['statistics', 'summary'],
    queryFn: mediaTrackerApi.statistics.summary,
  });

  return (
    <>
      {data ? <StatisticsSegmant data={data}></StatisticsSegmant> : null}
    </>
  );
};
