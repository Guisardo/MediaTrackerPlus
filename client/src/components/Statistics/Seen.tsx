import React from 'react';
import { IStatistocsProps, YearSelector } from 'src/pages/Statistics';
import StatisticSummaryYear from './StatisticSummaryYear';

const StatisticsSeen = (props: IStatistocsProps) => {
  return (
    <>
      <YearSelector
        years={props.years}
        currentYear={props.currentYear}
        onYearChange={props.onYearChange}
      ></YearSelector>
      <StatisticSummaryYear
        currentYear={props.currentYear}
      ></StatisticSummaryYear>
    </>
  );
};

export default StatisticsSeen;
