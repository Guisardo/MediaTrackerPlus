import React from 'react';
import { IStatistocsProps, YearSelector } from 'src/pages/Statistics';
import StatisticsGenreSegment from './StatisticsGenreSegment';
import { mediaTrackerApi } from 'src/api/api';
import { useGenreSeen } from 'src/hooks/statisticHooks';

const StatsticsGenre = (props: IStatistocsProps) => {
  const {
    error: errorGenre,
    data: data,
    isFetched: isFetchedGenre,
  } = useGenreSeen(props.currentYear);
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
