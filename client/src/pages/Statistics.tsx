import { t, Trans } from '@lingui/macro';
import clsx from 'clsx';
import { Statistics } from 'mediatracker-api';
import React, { useEffect, useState } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { SettingsSegment } from 'src/components/SettingsSegment';
import StatisticsSeen from 'src/components/Statistics/Seen';
import StatsticsGenre from 'src/components/Statistics/Genre';

export const noyear = () => {
  return {
    text: t`I do not remember`,
    id: 'noyear',
  };
};

export const allYear = () => {
  return {
    text: t`All Years`,
    id: 'allyear',
  };
};

const StatisticsPage = (): JSX.Element => {
  const [years, setYears] = useState<(number | string)[]>([]);
  const [currentYear, setCurrentYear] =
    useState<Statistics.StatisticsSeeninyearList.RequestQuery>({
      year: new Date().getFullYear().toString(),
    });

  useEffect(() => {
    const date = new Date();
    const currentYear = date.getFullYear();
    const yearsBetween = currentYear - 1970;
    const allYears = [];
    for (let i = 0; i <= yearsBetween; i++) {
      allYears.push(1970 + i);
    }
    allYears.push(noyear().text);
    allYears.push(allYear().text);
    allYears.reverse();
    setYears(allYears);
  }, []);

  const handeYearChange = (
    data: Statistics.StatisticsSeeninyearList.RequestQuery
  ) => {
    setCurrentYear(data);
  };

  return (
    <>
      <Routes>
        <Route element={<StatisticsPageLayout />}>
          <Route
            path="seen"
            element={
              <StatisticsSeen
                years={years}
                currentYear={currentYear}
                onYearChange={handeYearChange}
              />
            }
          />

          <Route
            path="genre"
            element={
              <StatsticsGenre
                years={years}
                currentYear={currentYear}
                onYearChange={handeYearChange}
              />
            }
          />

          <Route path="*" element={<Navigate to={'seen'} replace={true} />} />
        </Route>
      </Routes>
    </>
  );
};

const StatisticsPageLayout = () => {
  const routeTitles = useRoutesTitle();
  const location = useLocation();

  const route = routeTitles.find(
    (route) => route.path === location.pathname.split('/').at(-1)
  );

  return (
    <>
      {route ? (
        <>
          <div className="text-4xl">
            <Trans>Statistics</Trans>
          </div>
          <div className="flex flex-col mt-2 sm:flex-row">
            <div className="flex flex-col px-3 border rounded sm:shrink-0 max-w-fit h-fit">
              {routeTitles.map(({ path, name }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    clsx('my-2 cursor-pointer text', isActive && 'underline ')
                  }
                >
                  {name}
                </NavLink>
              ))}
            </div>
            <div className="w-full mt-3 sm:ml-4 sm:mt-0">
              <SettingsSegment title={route.name}>
                <Outlet />
              </SettingsSegment>
            </div>
          </div>
        </>
      ) : (
        <Outlet />
      )}
    </>
  );
};

const useRoutesTitle = () => {
  return [
    {
      path: 'seen',
      name: t`Seen`,
    },

    {
      path: 'genre',
      name: t`Genres`,
    },
  ];
};

export default StatisticsPage;

export interface IStatistocsProps {
  years: (string | number)[];
  currentYear: Statistics.StatisticsSeeninyearList.RequestQuery;
  onYearChange: (
    data: Statistics.StatisticsSeeninyearList.RequestQuery
  ) => void;
}

export const YearSelector = (props: IStatistocsProps) => {
  let currentYear = props.currentYear.year;

  if (currentYear == noyear().id) {
    currentYear = noyear().text;
  }

  if (currentYear == null) {
    currentYear = allYear().text;
  }

  return (
    <div className="flex mb-2">
      <select
        className="mr-1"
        value={currentYear}
        onChange={(e) => {
          let value = e.target.value;
          if (value == noyear().text) {
            value = noyear().id;
          }
          if (value == allYear().text) {
            value = null;
          }
          props.onYearChange({ year: value });
        }}
      >
        {props.years.map((year) => {
          return <option key={year}>{year}</option>;
        })}
      </select>
      <div className="font-bold" style={{ lineHeight: 2 }}>
        <Trans>Select Year</Trans>
      </div>
    </div>
  );
};
