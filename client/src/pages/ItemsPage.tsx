import React, { FunctionComponent, useEffect, useState } from 'react';

import { MediaType } from 'mediatracker-api';
import { useLocation, useParams } from 'react-router';
import { PaginatedGridItems } from 'src/components/PaginatedGridItems';
import { useSearchParams } from 'react-router-dom';

export const ItemsPage: FunctionComponent<{
  mediaType?: MediaType;
}> = (props) => {
  const { mediaType } = props;
  const [searchParameter, _] = useSearchParams();
  const [locationState, setLocationState] = useState<{
    isStatisticPage: boolean;
  }>({ isStatisticPage: false });

  const { state } = useLocation() as { state: { isStatisticPage: boolean } };

  const year = searchParameter.get('year');
  const genre = searchParameter.get('genre');

  useEffect(() => {
    if (state === null || locationState.isStatisticPage) {
      return;
    }
    if (state.isStatisticPage) {
      setLocationState({ isStatisticPage: true });
    }
  }, [locationState.isStatisticPage, state]);

  return (
    <PaginatedGridItems
      args={{
        mediaType: mediaType,
        orderBy: 'lastSeen',
        sortOrder: 'desc',
        year: year ? year : undefined,
        genre: genre ? genre : undefined,
      }}
      isStatisticsPage={locationState.isStatisticPage}
      showSortOrderControls={true}
      showSearch={!locationState.isStatisticPage}
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
