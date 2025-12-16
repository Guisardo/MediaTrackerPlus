import React, { FunctionComponent } from 'react';
import { useQuery } from 'react-query';
import { Trans } from '@lingui/macro';
import { MediaType } from 'mediatracker-api';

import { mediaTrackerApi } from 'src/api/api';
import { FormatDuration } from 'src/components/date';
import StatisticsSegmant from './StatisticsSegment';

const Foo: FunctionComponent<{
  mediaType: MediaType;
  content: JSX.Element;
}> = (props) => {
  const { mediaType, content } = props;

  return (
    <>
      <div>
        {mediaType}
        {content}
      </div>
    </>
  );
};

export const StatisticsSummary: FunctionComponent = () => {
  const { data } = useQuery(
    ['statistics', 'summary'],
    mediaTrackerApi.statistics.summary
  );

  return (
    <>
      <StatisticsSegmant data={data}></StatisticsSegmant>
    </>
  );
};
