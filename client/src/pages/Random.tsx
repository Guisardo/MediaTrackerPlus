import { MediaType } from 'mediatracker-api';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useItems } from 'src/api/items';
import { Segment } from './Home';
import { t } from '@lingui/macro';

const mediaTypes: { [mediaType in MediaType]: string } = {
  movie: 'Random Movie',
  tv: 'Random Tv Show',
  video_game: 'Random Video Game',
  audiobook: 'Random Audiobook',
  book: 'Random Book',
};

export const Random: FunctionComponent = () => {
  const { items: randomMovie } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    onlyOnWatchlist: true,
    selectRandom: true,
    mediaType: 'movie',
  });
  const { items: randomTv } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    onlyOnWatchlist: true,
    selectRandom: true,
    mediaType: 'tv',
  });
  const { items: randomVideoGame } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    onlyOnWatchlist: true,
    selectRandom: true,
    mediaType: 'video_game',
  });
  const { items: randomBook } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    onlyOnWatchlist: true,
    selectRandom: true,
    mediaType: 'book',
  });
  const { items: randomAudioBook } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    onlyOnWatchlist: true,
    selectRandom: true,
    mediaType: 'audiobook',
  });

  return (
    <>
      <Segment
        title={t`Random Movie`}
        items={randomMovie}
        gridItemArgs={{
          showRating: true,
          showNextAiring: true,
          topBar: {
            showFirstUnwatchedEpisodeBadge: true,
            showOnWatchlistIcon: true,
            showUnwatchedEpisodesCount: true,
          },
        }}
      />
      <Segment
        title={t`Random Tv Show`}
        items={randomTv}
        gridItemArgs={{
          showRating: true,
          showNextAiring: true,
          topBar: {
            showFirstUnwatchedEpisodeBadge: true,
            showOnWatchlistIcon: true,
            showUnwatchedEpisodesCount: true,
          },
        }}
      />
      <Segment
        title={t`Random Video Game`}
        items={randomVideoGame}
        gridItemArgs={{
          showRating: true,
          showNextAiring: true,
          topBar: {
            showFirstUnwatchedEpisodeBadge: true,
            showOnWatchlistIcon: true,
            showUnwatchedEpisodesCount: true,
          },
        }}
      />
      <Segment
        title={t`Random Book`}
        items={randomBook}
        gridItemArgs={{
          showRating: true,
          showNextAiring: true,
          topBar: {
            showFirstUnwatchedEpisodeBadge: true,
            showOnWatchlistIcon: true,
            showUnwatchedEpisodesCount: true,
          },
        }}
      />
      <Segment
        title={t`Random Audiobook`}
        items={randomAudioBook}
        gridItemArgs={{
          showRating: true,
          showNextAiring: true,
          topBar: {
            showFirstUnwatchedEpisodeBadge: true,
            showOnWatchlistIcon: true,
            showUnwatchedEpisodesCount: true,
          },
        }}
      />
    </>
  );
};
