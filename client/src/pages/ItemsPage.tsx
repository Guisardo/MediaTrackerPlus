import React, { FunctionComponent } from 'react';

import { MediaType } from 'mediatracker-api';
import { useParams } from 'react-router';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';
import { useSearchParams } from 'react-router-dom';

export const ItemsPage: FunctionComponent<{
  mediaType?: MediaType;
}> = (props) => {
  const { mediaType } = props;
  const [searchParameter, _] = useSearchParams();

  const year = searchParameter.get('year');
  const genre = searchParameter.get('genre');

  return (
    <PaginatedGridItems
      args={{
        mediaType: mediaType,
        orderBy: 'lastSeen',
        sortOrder: 'desc',
        year: year ? year : undefined,
        genre: genre ? genre : undefined,
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
