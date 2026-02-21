import React, { FunctionComponent, useEffect, useState } from 'react';

import { MediaType } from 'mediatracker-api';
import { useLocation, useParams } from 'react-router';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';
import { useSearchParams } from 'react-router-dom';

export const ItemsPageStatistic: FunctionComponent<{
  mediaType?: MediaType;
}> = (props) => {
  const { mediaType } = props;
  const [searchParameter, _] = useSearchParams();

  const params = useParams() as { mediatype: MediaType };

  const year = searchParameter.get('year');
  const genre = searchParameter.get('genre');

  return (
    <PaginatedGridItems
      args={{
        mediaType: params.mediatype,
        orderBy: 'lastSeen',
        sortOrder: 'desc',
        year: year ? year : undefined,
        genre: genre ? genre : undefined,
      }}
      isStatisticsPage={true}
      showSortOrderControls={true}
      showSearch={false}
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
