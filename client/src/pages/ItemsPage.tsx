import React, { FunctionComponent, useEffect, useState } from 'react';

import { MediaType } from 'mediatracker-api';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';
import { useSearchParams } from 'react-router-dom';

export const ItemsPage: FunctionComponent<{
  mediaType?: MediaType;
}> = (props) => {
  const { mediaType } = props;

  return (
    <PaginatedGridItems
      args={{
        mediaType: mediaType,
        orderBy: 'lastSeen',
        sortOrder: 'desc',
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
