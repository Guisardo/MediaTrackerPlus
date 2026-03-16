import React from 'react';
import { t } from '@lingui/macro';

import { MediaType } from 'mediatracker-api';
import { isAudiobook, isBook, isVideoGame, reverseMap } from 'src/utils';
import { useMenuComponent } from 'src/hooks/menu';

type FilterKey =
  | 'all'
  | 'onlyWithUserRating'
  | 'onlyWithoutUserRating'
  | 'onlyOnWatchlist'
  | 'onlySeenItems';

const useFilterTextMap = (mediaType: MediaType, isStatisticsPage: boolean) => {
  const filterTextMap: Partial<Record<FilterKey, string>> = {
    all: t`All`,
    onlyWithUserRating: t`Rated`,
    onlyWithoutUserRating: t`Unrated`,
  };

  if (!isStatisticsPage) {
    filterTextMap.onlyOnWatchlist = t`On watchlist`;
    filterTextMap.onlySeenItems = isAudiobook(mediaType)
      ? t`Listened`
      : isBook(mediaType)
      ? t`Read`
      : isVideoGame(mediaType)
      ? t`Played`
      : t`Watched`;
  }

  return filterTextMap as Record<FilterKey, string>;
};

export const useFilterBy = (
  mediaType: MediaType,
  isStatisticsPage: boolean,
  handleFilterChange: () => void
) => {
  const filterTextMap = useFilterTextMap(mediaType, isStatisticsPage);
  const filterTextReverseMap = reverseMap(filterTextMap);

  const { selectedValue, Menu } = useMenuComponent({
    values: Object.values(filterTextMap),
    initialSelection: filterTextMap['all'],
    paramFilter: 'filter',
    handleFilterChange: handleFilterChange,
  });

  const selectedFilter = selectedValue
    ? filterTextReverseMap[selectedValue]
    : 'all';

  return {
    filter:
      isStatisticsPage && selectedFilter === 'all'
        ? { all: true, onlySeenItems: true }
        : {
            [selectedFilter]: true,
          },
    FilterByComponent: () => {
      return (
        <Menu>
          <div className="flex ml-2 cursor-pointer select-none">
            <span className="material-icons">filter_alt</span>&nbsp;
            {selectedValue}
          </div>
        </Menu>
      );
    },
  };
};
