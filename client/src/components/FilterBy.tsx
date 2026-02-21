import React from 'react';
import { t } from '@lingui/macro';

import { MediaType } from 'mediatracker-api';
import { isAudiobook, isBook, isVideoGame, reverseMap } from 'src/utils';
import { useMenuComponent } from 'src/hooks/menu';
import { useSearchParams } from 'react-router-dom';

const useFilterTextMap = (mediaType: MediaType, isStatisticsPage: boolean) => {
  if (isStatisticsPage) {
    return {
      all: t`All`,
      onlyWithUserRating: t`Rated`,
      onlyWithoutUserRating: t`Unrated`,
    };
  } else {
    return {
      all: t`All`,
      onlyWithUserRating: t`Rated`,
      onlyWithoutUserRating: t`Unrated`,
      onlyOnWatchlist: t`On watchlist`,
      onlySeenItems: isAudiobook(mediaType)
        ? t`Listened`
        : isBook(mediaType)
        ? t`Read`
        : isVideoGame(mediaType)
        ? t`Played`
        : t`Watched`,
    };
  }
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

  return {
    filter: isStatisticsPage
      ? { [filterTextReverseMap[selectedValue]]: true, onlySeenItems: true }
      : {
          [filterTextReverseMap[selectedValue]]: true,
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
