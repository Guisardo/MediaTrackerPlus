import React from 'react';
import { allYear, IStatistocsProps, YearSelector } from 'src/pages/Statistics';
import { StatisticsSummary } from './StatisticsSummary';
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
        currentYear={
          props.currentYear.year === 'allyear' ? null : props.currentYear
        }
      ></StatisticSummaryYear>
    </>
  );
};

export default StatisticsSeen;
