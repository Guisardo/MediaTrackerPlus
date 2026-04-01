import React, { useState } from 'react';
import { t } from '@lingui/macro';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

import { MediaItemOrderBy, MediaType, SortOrder } from 'mediatracker-api';
import { isTvShow, reverseMap } from 'src/utils';
import { useMenuComponent } from 'src/hooks/menu';
import { useUpdateSearchParams } from 'src/hooks/updateSearchParamsHook';
import { Button } from '@/components/ui/button';

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
    platformRecommended: t`Platform Recommended`,
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
    .map(([, text]) => text as string);

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
        <div className="flex items-center select-none gap-1">
          <div className="flex items-center cursor-pointer select-none gap-1">
            <ArrowUpDown
              className="size-4 text-zinc-700 dark:text-zinc-300"
              data-testid="sort-icon"
            />
            {selectedValue}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={(e) => {
              e.stopPropagation(); // prevent bubbling into Menu's toggle handler
              args.handleFilterChange();
              updateSearchParams(sortOrder === 'asc' ? 'desc' : 'asc');
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}
            aria-label={t`Toggle sort direction`}
          >
            {sortOrder === 'asc' ? (
              <ArrowUp className="size-4" data-testid="sort-direction-asc" />
            ) : (
              <ArrowDown className="size-4" data-testid="sort-direction-desc" />
            )}
          </Button>
        </div>
      </Menu>
    ),
  };
};
