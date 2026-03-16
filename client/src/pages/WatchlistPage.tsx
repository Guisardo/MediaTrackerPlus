import React, { FunctionComponent } from 'react';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';
import { useUser } from 'src/api/user';

export const WatchlistPage: FunctionComponent = () => {
  const { user } = useUser();
  const addRecommendedToWatchlist = user?.addRecommendedToWatchlist;
  const orderBy =
    addRecommendedToWatchlist !== false ? 'recommended' : 'lastSeen';

  return (
    <PaginatedGridItems
      args={{
        orderBy,
        sortOrder: 'desc',
        onlyOnWatchlist: true,
      }}
      showSortOrderControls={true}
      showSearch={false}
      showFacets={true}
      gridItemAppearance={{
        showRating: true,
        topBar: {
          showFirstUnwatchedEpisodeBadge: true,
          showOnWatchlistIcon: true,
          showUnwatchedEpisodesCount: true,
        },
      }}
    />
  );
};
