import React, { useState } from 'react';
import { t } from '@lingui/macro';

import { MediaItemOrderBy, MediaType, SortOrder } from 'mediatracker-api';
import { isTvShow, reverseMap } from 'src/utils';
import { useMenuComponent } from 'src/hooks/menu';
import { useUpdateSearchParams } from 'src/hooks/updateSearchParamsHook';

export const useMediaTypeOrderByNames = (): Record<
  MediaItemOrderBy,
  string
> => {
  return {
    lastSeen: t`Last seen`,
    releaseDate: t`Release date`,
    status: t`Status`,
    title: t`Title`,
    nextAiring: t`Next airing`,
    lastAiring: t`Last airing`,
    unseenEpisodes: t`Unseen episodes count`,
    mediaType: t`Media type`,
    progress: t`Progress`,
    recommended: t`Recommended`,
  };
};

export const useOrderByComponent = (args: {
  orderBy: MediaItemOrderBy;
  sortOrder: SortOrder;
  mediaType?: MediaType;
  handleFilterChange: () => void;
}) => {
  const { mediaType } = args;
  const { currentValue, updateSearchParams } = useUpdateSearchParams({
    filterParam: 'sortOrder',
    initialValue: args.sortOrder,
    resetPage: true,
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    currentValue as SortOrder
  );

  const mediaTypeOrderByString = {
    ...useMediaTypeOrderByNames(),
    ...(!isTvShow(mediaType)
      ? {
          nextAiring: undefined,
          lastAiring: undefined,
          unseenEpisodes: undefined,
        }
      : {}),
    ...(mediaType !== undefined ? { mediaType: undefined } : {}),
  };

  const mediaTypeOrderByStringMap = reverseMap(mediaTypeOrderByString);

  const values = Object.entries(mediaTypeOrderByString)
    .filter(([value, text]) => Boolean(text))
    .map(([value, text]: [MediaItemOrderBy, string]) => text);

  const { selectedValue, Menu } = useMenuComponent({
    values: values,
    initialSelection: mediaTypeOrderByString[args.orderBy],
    handleFilterChange: args.handleFilterChange,
    paramFilter: 'orderBy',
  });

  return {
    orderBy: selectedValue
      ? (mediaTypeOrderByStringMap[selectedValue] as MediaItemOrderBy)
      : args.orderBy,
    sortOrder,
    OrderByComponent: () => (
      <Menu>
        <div className="flex select-none">
          <div className="flex cursor-pointer select-none">
            <span className="material-icons">sort_by_alpha</span>&nbsp;
            {selectedValue}
          </div>
          <div
            className="ml-2 cursor-pointer"
            onClick={() => {
              args.handleFilterChange();
              updateSearchParams(sortOrder === 'asc' ? 'desc' : 'asc');
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </div>
        </div>
      </Menu>
    ),
  };
};
