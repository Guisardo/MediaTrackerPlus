import React, { FunctionComponent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trans } from '@lingui/macro';
import { MediaType } from 'mediatracker-api';

import { mediaTrackerApi } from 'src/api/api';
import { FormatDuration } from 'src/components/date';
import StatisticsSegmant from './StatisticsSegment';

export const StatisticsSummary: FunctionComponent = () => {
  const { data } = useQuery({
    queryKey: ['statistics', 'summary'],
    queryFn: mediaTrackerApi.statistics.summary,
  });

  return (
    <>
      <StatisticsSegmant data={data}></StatisticsSegmant>
    </>
  );
};
