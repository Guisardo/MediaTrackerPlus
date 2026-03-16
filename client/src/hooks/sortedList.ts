import { useMemo } from 'react';
import { ListItemsResponse, ListSortBy, ListSortOrder } from 'mediatracker-api';

const pastDateOrUndefined = (date?: string | null) => {
  if (date && date > new Date().toISOString()) {
    return undefined;
  }

  return date;
};

const futureDateOrUndefined = (date?: string | null) => {
  if (date && date < new Date().toISOString()) {
    return undefined;
  }

  return date;
};

export const useSortedList = (args: {
  sortOrder: ListSortOrder;
  sortBy: ListSortBy;
  listItems?: ListItemsResponse;
}): ListItemsResponse | undefined => {
  const { sortBy, sortOrder, listItems } = args;

  return useMemo(() => {
    if (!listItems) {
      return undefined;
    }

    const sortFunctionFactory = <T>(
      property: (listItem: ListItem) => T | null | undefined,
      comparator: (a: NonNullable<T>, b: NonNullable<T>) => number
    ) => {
      return (a: ListItem, b: ListItem): number => {
        const propertyA = property(a);
        const propertyB = property(b);

        if (
          (propertyA === null || propertyA === undefined) &&
          (propertyB === null || propertyB === undefined)
        ) {
          return a.mediaItem.title.localeCompare(b.mediaItem.title);
        }

        if (propertyA === null || propertyA === undefined) {
          return 1;
        }

        if (propertyB === null || propertyB === undefined) {
          return -1;
        }

        if (propertyA === propertyB) {
          // Tv Show and season before episode
          if (!a.episode && b.episode) {
            return -1;
          }

          if (!b.episode && a.episode) {
            return 1;
          }

          // Season after Tv Show
          if (!a.season && b.season) {
            return -1;
          }

          if (!b.season && a.season) {
            return 1;
          }

          // Order episodes
          if (a.episode && b.episode) {
            return (
              (a.episode.seasonAndEpisodeNumber ?? 0) -
              (b.episode.seasonAndEpisodeNumber ?? 0)
            );
          }

          // Order seasons
          if (a.season && b.season) {
            return a.season.seasonNumber - b.season.seasonNumber;
          }

          return a.mediaItem.title.localeCompare(b.mediaItem.title);
        }

        if (sortOrder === 'asc') {
          const left = propertyA as NonNullable<T>;
          const right = propertyB as NonNullable<T>;
          return comparator(left, right);
        }

        if (sortOrder === 'desc') {
          const left = propertyB as NonNullable<T>;
          const right = propertyA as NonNullable<T>;
          return comparator(left, right);
        }

        return 0;
      };
    };

    const sortFunctions: Record<
      ListSortBy,
      (a: ListItem, b: ListItem) => number
    > = {
      'release-date': sortFunctionFactory(
        (listItem) =>
          listItem.episode
            ? listItem.episode.releaseDate
            : listItem.season
            ? listItem.season.releaseDate
            : listItem.mediaItem.releaseDate,
        stringComparator
      ),
      'recently-watched': sortFunctionFactory(
        (listItem) =>
          listItem.episode
            ? listItem.episode.lastSeenAt
            : listItem.season
            ? listItem.season.lastSeenAt
            : listItem.mediaItem.lastSeenAt,
        numericComparator
      ),
      'recently-aired': sortFunctionFactory(
        (listItem) =>
          pastDateOrUndefined(
            listItem.episode
              ? listItem.episode.releaseDate
              : listItem.season
              ? listItem.season.releaseDate
              : listItem.mediaItem.mediaType === 'tv'
              ? listItem.mediaItem.lastAiredEpisode?.releaseDate
              : listItem.mediaItem.releaseDate
          ),
        stringComparator
      ),
      'next-airing': sortFunctionFactory(
        (listItem) =>
          futureDateOrUndefined(
            listItem.episode
              ? listItem.episode.releaseDate
              : listItem.season
              ? listItem.season.releaseDate
              : listItem.mediaItem.mediaType === 'tv'
              ? listItem.mediaItem.upcomingEpisode?.releaseDate
              : listItem.mediaItem.releaseDate
          ),
        stringComparator
      ),
      runtime: sortFunctionFactory(
        (listItem) =>
          listItem.episode
            ? listItem.episode.runtime
            : listItem.season
            ? listItem.season.totalRuntime
            : listItem.mediaItem.totalRuntime,
        numericComparator
      ),
      'my-rating': sortFunctionFactory(
        (listItem) =>
          listItem.episode
            ? listItem.episode.userRating?.rating
            : listItem.season
            ? listItem.season.userRating?.rating
            : listItem.mediaItem.userRating?.rating,
        numericComparator
      ),
      'recently-added': sortFunctionFactory(
        (listItem) => listItem.listedAt,
        stringComparator
      ),
      title: sortFunctionFactory(
        (listItem) => listItem.mediaItem.title,
        stringComparator
      ),
      'platform-recommended': (a: ListItem, b: ListItem): number => {
        // Two-tier ordering that mirrors the SQL sort in server/src/knex/queries/items.ts:
        //   Tier 1 — items with a real platformRating (community average from estimatedRating data):
        //            sorted by the 70/30 blend descending (or platformRating alone when
        //            tmdbRating is absent).
        //   Tier 2 — items with no platformRating (not yet rated on this platform):
        //            sorted by tmdbRating descending as a proxy; absent tmdbRating sorts last.
        //
        // Cross-tier: all tier-1 items rank above all tier-2 items regardless of raw score.
        // This prevents seeded/external-only ratings from displacing genuine community consensus.
        const tierOf = (item: ListItem): 0 | 1 =>
          item.mediaItem.platformRating != null ? 0 : 1;

        const tierA = tierOf(a);
        const tierB = tierOf(b);

        if (tierA !== tierB) {
          return tierA - tierB;
        }

        // Within the same tier, rank by score descending.
        const scoreOf = (listItem: ListItem): number | undefined => {
          const platformRating = listItem.mediaItem.platformRating;
          const tmdbRating = listItem.mediaItem.tmdbRating;
          if (platformRating != null && tmdbRating != null) {
            return platformRating * 0.7 + tmdbRating * 0.3;
          }
          if (platformRating != null) {
            return platformRating;
          }
          // Tier 2: rank by tmdbRating; items with neither sort last.
          return tmdbRating ?? undefined;
        };

        const scoreA = scoreOf(a);
        const scoreB = scoreOf(b);

        if (scoreA == null && scoreB == null) {
          return a.mediaItem.title.localeCompare(b.mediaItem.title);
        }
        if (scoreA == null) {
          return 1;
        }
        if (scoreB == null) {
          return -1;
        }
        // Higher score = more recommended → descending regardless of sortOrder
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.mediaItem.title.localeCompare(b.mediaItem.title);
      },
      recommended: (a: ListItem, b: ListItem): number => {
        const scoreOf = (listItem: ListItem): number | undefined => {
          const estimatedRating = listItem.estimatedRating;
          if (estimatedRating == null) {
            return undefined;
          }
          const tmdbRating = listItem.mediaItem.tmdbRating;
          if (tmdbRating != null) {
            return estimatedRating * 0.6 + tmdbRating * 0.4;
          }
          return estimatedRating;
        };

        const scoreA = scoreOf(a);
        const scoreB = scoreOf(b);

        if (scoreA == null && scoreB == null) {
          return a.mediaItem.title.localeCompare(b.mediaItem.title);
        }
        if (scoreA == null) {
          return 1;
        }
        if (scoreB == null) {
          return -1;
        }
        // Higher score = more recommended → descending regardless of sortOrder
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.mediaItem.title.localeCompare(b.mediaItem.title);
      },
    };

    // For platform-recommended sort, filter out items that have already been
    // watched by any platform member so the view only surfaces unseen content.
    const itemsToSort =
      sortBy === 'platform-recommended'
        ? listItems.filter((item) => !item.mediaItem.platformSeen)
        : listItems;

    return itemsToSort.sort(sortFunctions[sortBy]);
  }, [sortOrder, listItems, sortBy]);
};

type ListItem = ListItemsResponse extends Array<infer T> ? T : never;

const stringComparator = (a: string, b: string) => a.localeCompare(b);
const numericComparator = (a: number, b: number) => a - b;
