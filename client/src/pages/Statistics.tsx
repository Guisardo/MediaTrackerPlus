import { t, Trans } from '@lingui/macro';
import { Statistics } from 'mediatracker-api';
import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { mediaTrackerApi } from 'src/api/api';
import StatisticsSegmant from 'src/components/StatisticsSegment';
import { StatisticsSummary } from 'src/components/StatisticsSummary';

const StatisticsPage = (): JSX.Element => {
  const [years, setYears] = useState<(number | string)[]>([]);
  const [currentYear, setCurrentYear] =
    useState<Statistics.StatisticsSeeninyearList.RequestQuery>({
      year: new Date().getFullYear().toString(),
    });
  const { error, data, isFetched } = useQuery(
    ['statistics', currentYear],
    async () => mediaTrackerApi.statistics.statisticsSeeninyearList(currentYear)
  );

  useEffect(() => {
    const date = new Date();
    const currentYear = date.getFullYear();
    const yearsBetween = currentYear - 1970;
    const allYears = [];
    for (let i = 0; i <= yearsBetween; i++) {
      allYears.push(1970 + i);
    }
    allYears.push(t`I do not remember`);
    allYears.reverse();
    setYears(allYears);
  }, []);

  return (
    <>
      <div className="text-2xl font-bold">{t`Overall`}</div>
      <StatisticsSummary></StatisticsSummary>
      <div className="flex mb-2">
        <div
          className="text-2xl font-bold"
          style={{ marginRight: '16px' }}
        >{t`By Year`}</div>
        <select
          className="mr-1"
          value={currentYear.year}
          onChange={(e) => {
            let value = e.target.value;
            if (value.length > 4) {
              value = 'noyear';
            }
            setCurrentYear({ year: value });
          }}
        >
          {years.map((year) => {
            return <option key={year}>{year}</option>;
          })}
        </select>
        <div>
          <Trans>Select Year</Trans>
        </div>
      </div>
      <StatisticsSegmant data={data}></StatisticsSegmant>
    </>
  );
};

export default StatisticsPage;
