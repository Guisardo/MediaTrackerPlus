import { useMemo } from 'react';
import { ListItemsResponse, ListSortBy, ListSortOrder } from 'mediatracker-api';

const pastDateOrUndefined = (date?: string) => {
  if (date && date > new Date().toISOString()) {
    return undefined;
  }

  return date;
};

const futureDateOrUndefined = (date?: string) => {
  if (date && date < new Date().toISOString()) {
    return undefined;
  }

  return date;
};

export const useSortedList = (args: {
  sortOrder: ListSortOrder;
  sortBy: ListSortBy;
  listItems?: ListItemsResponse;
}) => {
  const { sortBy, sortOrder, listItems } = args;

  return useMemo(() => {
    if (!listItems) {
      return;
    }

    const sortFunctionFactory = <T>(
      property: (listItem: ListItem) => T,
      comparator: (a: T, b: T) => number
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
              a.episode.seasonAndEpisodeNumber -
              b.episode.seasonAndEpisodeNumber
            );
          }

          // Order seasons
          if (a.season && b.season) {
            return a.season.seasonNumber - b.season.seasonNumber;
          }

          return a.mediaItem.title.localeCompare(b.mediaItem.title);
        }

        if (sortOrder === 'asc') {
          return comparator(propertyA, propertyB);
        } else if (sortOrder === 'desc') {
          return comparator(propertyB, propertyA);
        }
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
        // Score = platformRating * 0.7 + externalRating * 0.3 when both are present.
        // Falls back to platformRating alone, then tmdbRating alone for unrated items.
        // Community consensus (platform average) weighted higher than external aggregators.
        // Contrast with 'recommended' which uses 60/40 for personal rating estimates vs external.
        const scoreOf = (listItem: ListItem): number | undefined => {
          const platformRating = listItem.mediaItem.platformRating;
          const tmdbRating = listItem.mediaItem.tmdbRating;
          if (platformRating != null && tmdbRating != null) {
            return platformRating * 0.7 + tmdbRating * 0.3;
          }
          if (platformRating != null) {
            return platformRating;
          }
          // Fall back to external rating for items without any platform rating yet.
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
