import React, { FunctionComponent } from 'react';
import { t, Trans } from '@lingui/macro';

import { MediaItemItemsResponse } from 'mediatracker-api';
import { useItems } from 'src/api/items';
import { GridItem, GridItemAppearanceArgs } from 'src/components/GridItem';
import { subDays } from 'date-fns';
import { StatisticsSummary } from 'src/components/Statistics/StatisticsSummary';

export const Segment: FunctionComponent<{
  title: string;
  items: MediaItemItemsResponse[];
  gridItemArgs?: GridItemAppearanceArgs;
}> = (props) => {
  const { title, items, gridItemArgs } = props;

  return (
    <>
      {items?.length > 0 && (
        <div className="mb-10">
          <div className="text-2xl font-bold">{title}</div>
          <div className="flex flex-row flex-wrap mt-4">
            {items?.slice(0, 5).map((item) => (
              <div key={item.id} className="w-40 mr-5">
                <GridItem mediaItem={item} appearance={gridItemArgs} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export const HomePage: FunctionComponent = () => {
  const { items: upcomingEpisodes, ageGatingActive: upcomingAgeGated } =
    useItems({
      orderBy: 'nextAiring',
      sortOrder: 'asc',
      page: 1,
      onlyOnWatchlist: true,
      onlyWithNextAiring: true,
    });

  const { items: continueWatching, ageGatingActive: continueAgeGated } =
    useItems({
      mediaType: 'tv',
      orderBy: 'lastSeen',
      sortOrder: 'desc',
      page: 1,
      onlyWithNextEpisodesToWatch: true,
      onlyOnWatchlist: true,
    });

  const {
    items: recentlyReleasedRaw,
    ageGatingActive: recentlyReleasedAgeGated,
  } = useItems({
    orderBy: 'lastAiring',
    sortOrder: 'desc',
    page: 1,
    onlyOnWatchlist: true,
    onlySeenItems: false,
  });

  const recentlyReleased = recentlyReleasedRaw?.filter(
    (mediaItem) =>
      mediaItem.lastAiring != null &&
      new Date(mediaItem.lastAiring) > subDays(new Date(), 30)
  );

  const { items: unratedItems, ageGatingActive: unratedAgeGated } = useItems({
    orderBy: 'lastSeen',
    sortOrder: 'desc',
    page: 1,
    onlySeenItems: true,
    onlyWithoutUserRating: true,
  });

  // Show fallback messaging when every home section is empty because age gating
  // removed all visible content. We only show this when at least one section
  // has ageGatingActive so we can distinguish a genuinely-empty library from a
  // fully-gated one.
  const anyAgeGating =
    upcomingAgeGated ||
    continueAgeGated ||
    recentlyReleasedAgeGated ||
    unratedAgeGated;
  const allSectionsEmpty =
    (upcomingEpisodes?.length ?? 0) === 0 &&
    (continueWatching?.length ?? 0) === 0 &&
    (recentlyReleased?.length ?? 0) === 0 &&
    (unratedItems?.length ?? 0) === 0;
  const showAgeGatedFallback = anyAgeGating && allSectionsEmpty;

  return (
    <>
      <div className="px-2">
        <StatisticsSummary />

        {showAgeGatedFallback && (
          <div className="mt-8 text-center text-zinc-600 dark:text-zinc-400">
            <Trans>
              Content is hidden based on your age-based content filtering
              preferences.
            </Trans>
          </div>
        )}

        <Segment
          title={t`Upcoming`}
          items={upcomingEpisodes}
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
          title={t`Next episode to watch`}
          items={continueWatching}
          gridItemArgs={{
            showRating: true,
            showFirstUnwatchedEpisode: true,
            showMarksAsSeenFirstUnwatchedEpisode: true,
            topBar: {
              showFirstUnwatchedEpisodeBadge: true,
              showOnWatchlistIcon: true,
              showUnwatchedEpisodesCount: true,
            },
          }}
        />

        <Segment
          title={t`Recently released`}
          items={recentlyReleased}
          gridItemArgs={{
            showRating: true,
            showLastAiring: true,
            showMarksAsSeenLastAiredEpisode: true,
            topBar: {
              showFirstUnwatchedEpisodeBadge: true,
              showOnWatchlistIcon: true,
              showUnwatchedEpisodesCount: true,
            },
          }}
        />

        <Segment
          title={t`Unrated`}
          items={unratedItems}
          gridItemArgs={{
            showRating: true,
            topBar: {
              showFirstUnwatchedEpisodeBadge: true,
              showOnWatchlistIcon: true,
              showUnwatchedEpisodesCount: true,
            },
          }}
        />
      </div>
    </>
  );
};
