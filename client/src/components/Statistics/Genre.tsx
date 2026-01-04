import React from 'react';
import { IStatistocsProps, YearSelector } from 'src/pages/Statistics';
import StatisticsGenreSegment from './StatisticsGenreSegment';
import { useQuery } from 'react-query';
import { mediaTrackerApi } from 'src/api/api';

const StatsticsGenre = (props: IStatistocsProps) => {
  const {
    error: errorGenre,
    data: data,
    isFetched: isFetchedGenre,
  } = useQuery(['genre', props.currentYear], async () =>
    mediaTrackerApi.statistics.statisticsGenresinyearList(props.currentYear)
  );
  return (
    <>
      <YearSelector
        years={props.years}
        currentYear={props.currentYear}
        onYearChange={props.onYearChange}
      ></YearSelector>
      <StatisticsGenreSegment
        data={data}
        year={props.currentYear.year}
      ></StatisticsGenreSegment>
    </>
  );
};

export default StatsticsGenre;
