import React, { FunctionComponent } from 'react';

import { MediaType } from 'mediatracker-api';
import { useParams } from 'react-router';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';

export const ItemsPage: FunctionComponent<{
  mediaType?: MediaType;
}> = (props) => {
  const { mediaType } = props;
  const params = useParams();

  return (
    <PaginatedGridItems
      args={{
        mediaType: mediaType,
        orderBy: 'lastSeen',
        sortOrder: 'desc',
        year: params.year ? params.year : undefined,
      }}
      showSortOrderControls={true}
      showSearch={true}
      gridItemAppearance={{
        showRating: true,
        showAddToWatchlistAndMarkAsSeenButtons: true,
        topBar: {
          showFirstUnwatchedEpisodeBadge: true,
          showOnWatchlistIcon: true,
          showUnwatchedEpisodesCount: true,
        },
      }}
    />
  );
};
