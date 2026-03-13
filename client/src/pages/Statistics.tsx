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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';

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

const StatisticsPage = (): React.JSX.Element => {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-2xl font-bold tracking-tight mb-4">
            <Trans>Statistics</Trans>
          </div>
          <div className="flex flex-col mt-2 sm:flex-row">
            <div className="flex flex-col px-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-sm sm:shrink-0 max-w-fit h-fit">
              {routeTitles.map(({ path, name }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    clsx(
                      'my-2 cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100',
                      isActive &&
                        'font-semibold text-zinc-900 dark:text-zinc-50 underline'
                    )
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
        </div>
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
    <div className="flex mb-2 items-center gap-2">
      <Select
        value={String(currentYear)}
        onValueChange={(value) => {
          let resolvedValue: string | null = value;
          if (resolvedValue == noyear().text) {
            resolvedValue = noyear().id;
          }
          if (resolvedValue == allYear().text) {
            resolvedValue = null;
          }
          props.onYearChange({ year: resolvedValue });
        }}
      >
        <SelectTrigger aria-label={t`Select year`} className="w-fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Trans>Select Year</Trans>
      </div>
    </div>
  );
};
