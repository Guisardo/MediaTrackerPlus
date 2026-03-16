/**
 * Tests for src/hooks/sortedList.ts
 *
 * Covers:
 *   - useSortedList returns undefined for undefined listItems
 *   - All sort strategies: release-date, recently-watched, recently-aired,
 *     next-airing, runtime, my-rating, recently-added, title, recommended
 *   - Null/undefined property → item pushed to end of sorted results
 *   - sortOrder 'asc' vs 'desc' reversal
 *   - Tie-breaking: TV show before season before episode; then alphabetical
 *   - recommended score formula (estimatedRating × 0.6 + tmdbRating × 0.4)
 */

import { renderHook } from '@testing-library/react';
import { useSortedList } from 'src/hooks/sortedList';

import type {
  MediaItemItemsResponse,
  TvSeason,
  TvEpisode,
  ListSortBy,
  ListSortOrder,
} from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Type alias — the single-element type inside ListItemsResponse
// ---------------------------------------------------------------------------

type ListItem = {
  id: number;
  listedAt: string;
  estimatedRating?: number | null;
  type: 'audiobook' | 'book' | 'episode' | 'movie' | 'season' | 'tv' | 'video_game';
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason | null;
  episode?: TvEpisode | null;
};

// ---------------------------------------------------------------------------
// Minimal factory helpers
// ---------------------------------------------------------------------------

const makeMediaItem = (
  title: string,
  overrides: Partial<MediaItemItemsResponse> = {}
): MediaItemItemsResponse =>
  ({
    title,
    mediaType: 'movie',
    source: 'tmdb',
    ...overrides,
  } as MediaItemItemsResponse);

const makeTvSeason = (
  seasonNumber: number,
  overrides: Partial<TvSeason> = {}
): TvSeason => ({
  title: `Season ${seasonNumber}`,
  seasonNumber,
  isSpecialSeason: false,
  ...overrides,
});

const makeTvEpisode = (
  episodeNumber: number,
  overrides: Partial<TvEpisode> = {}
): TvEpisode => ({
  title: `Episode ${episodeNumber}`,
  episodeNumber,
  seasonNumber: 1,
  isSpecialEpisode: false,
  seasonAndEpisodeNumber: episodeNumber,
  ...overrides,
});

const makeListItem = (
  id: number,
  title: string,
  overrides: Partial<ListItem> = {}
): ListItem => ({
  id,
  listedAt: '2023-01-01T00:00:00Z',
  type: 'movie',
  mediaItem: makeMediaItem(title),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Render helper — calls useSortedList and returns a sorted copy
// ---------------------------------------------------------------------------

const renderSorted = (
  sortBy: ListSortBy,
  sortOrder: ListSortOrder,
  listItems: ListItem[] | undefined
): ListItem[] | undefined => {
  // useSortedList mutates the array via .sort(), so we pass a shallow copy to
  // avoid cross-test contamination.
  const items = listItems ? [...listItems] : listItems;
  const { result } = renderHook(() =>
    useSortedList({ sortBy, sortOrder, listItems: items as unknown as import('mediatracker-api').ListItemsResponse })
  );
  return result.current as unknown as ListItem[] | undefined;
};

// ---------------------------------------------------------------------------
// Edge cases — undefined / empty input
// ---------------------------------------------------------------------------

describe('useSortedList — edge cases', () => {
  it('returns undefined when listItems is undefined', () => {
    expect(renderSorted('title', 'asc', undefined)).toBeUndefined();
  });

  it('returns an empty array when listItems is empty', () => {
    expect(renderSorted('title', 'asc', [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// title sort
// ---------------------------------------------------------------------------

describe('useSortedList — title', () => {
  const items = [
    makeListItem(1, 'Zorro'),
    makeListItem(2, 'Alpha'),
    makeListItem(3, 'Mango'),
  ];

  it('sorts alphabetically ascending', () => {
    const result = renderSorted('title', 'asc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Alpha',
      'Mango',
      'Zorro',
    ]);
  });

  it('sorts alphabetically descending', () => {
    const result = renderSorted('title', 'desc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Zorro',
      'Mango',
      'Alpha',
    ]);
  });
});

// ---------------------------------------------------------------------------
// release-date sort
// ---------------------------------------------------------------------------

describe('useSortedList — release-date', () => {
  it('sorts by mediaItem.releaseDate ascending', () => {
    const items = [
      makeListItem(1, 'C', {
        mediaItem: makeMediaItem('C', { releaseDate: '2020-03-01' }),
      }),
      makeListItem(2, 'A', {
        mediaItem: makeMediaItem('A', { releaseDate: '2018-06-15' }),
      }),
      makeListItem(3, 'B', {
        mediaItem: makeMediaItem('B', { releaseDate: '2019-12-31' }),
      }),
    ];

    const result = renderSorted('release-date', 'asc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual(['A', 'B', 'C']);
  });

  it('sorts by episode.releaseDate when an episode is present', () => {
    const items = [
      makeListItem(1, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(1, { releaseDate: '2022-05-01' }),
        mediaItem: makeMediaItem('Show', { releaseDate: '2022-01-01' }),
      }),
      makeListItem(2, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(2, { releaseDate: '2021-01-01' }),
        mediaItem: makeMediaItem('Show', { releaseDate: '2022-01-01' }),
      }),
    ];

    const result = renderSorted('release-date', 'asc', items);
    expect(result![0]!.episode!.releaseDate).toBe('2021-01-01');
    expect(result![1]!.episode!.releaseDate).toBe('2022-05-01');
  });

  it('pushes items with null releaseDate to the end', () => {
    const items = [
      makeListItem(1, 'Z No Date', {
        mediaItem: makeMediaItem('Z No Date', { releaseDate: null }),
      }),
      makeListItem(2, 'A Has Date', {
        mediaItem: makeMediaItem('A Has Date', { releaseDate: '2000-01-01' }),
      }),
    ];

    const result = renderSorted('release-date', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('A Has Date');
    expect(result![1]!.mediaItem.title).toBe('Z No Date');
  });
});

// ---------------------------------------------------------------------------
// recently-watched sort
// ---------------------------------------------------------------------------

describe('useSortedList — recently-watched', () => {
  it('sorts by lastSeenAt descending (desc = most recent first)', () => {
    const items = [
      makeListItem(1, 'Old', {
        mediaItem: makeMediaItem('Old', { lastSeenAt: 1000 }),
      }),
      makeListItem(2, 'New', {
        mediaItem: makeMediaItem('New', { lastSeenAt: 9000 }),
      }),
      makeListItem(3, 'Mid', {
        mediaItem: makeMediaItem('Mid', { lastSeenAt: 5000 }),
      }),
    ];

    const result = renderSorted('recently-watched', 'desc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual(['New', 'Mid', 'Old']);
  });

  it('sorts by lastSeenAt ascending', () => {
    const items = [
      makeListItem(1, 'Old', {
        mediaItem: makeMediaItem('Old', { lastSeenAt: 1000 }),
      }),
      makeListItem(2, 'New', {
        mediaItem: makeMediaItem('New', { lastSeenAt: 9000 }),
      }),
    ];

    const result = renderSorted('recently-watched', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Old');
    expect(result![1]!.mediaItem.title).toBe('New');
  });

  it('pushes items with null lastSeenAt to the end', () => {
    const items = [
      makeListItem(1, 'Never Seen', {
        mediaItem: makeMediaItem('Never Seen', { lastSeenAt: null }),
      }),
      makeListItem(2, 'Seen', {
        mediaItem: makeMediaItem('Seen', { lastSeenAt: 1234 }),
      }),
    ];

    const result = renderSorted('recently-watched', 'desc', items);
    expect(result![0]!.mediaItem.title).toBe('Seen');
    expect(result![1]!.mediaItem.title).toBe('Never Seen');
  });
});

// ---------------------------------------------------------------------------
// recently-aired sort
// ---------------------------------------------------------------------------

describe('useSortedList — recently-aired', () => {
  it('ignores future release dates (treats as undefined) and sorts by past dates', () => {
    const pastDate = '2020-01-01';
    const futureDate = new Date(Date.now() + 86400 * 365 * 1000)
      .toISOString()
      .split('T')[0];

    const items = [
      makeListItem(1, 'Future', {
        mediaItem: makeMediaItem('Future', { releaseDate: futureDate }),
      }),
      makeListItem(2, 'Past', {
        mediaItem: makeMediaItem('Past', { releaseDate: pastDate }),
      }),
    ];

    const result = renderSorted('recently-aired', 'desc', items);
    // 'Past' has a valid pastDate; 'Future' is pushed to end as undefined
    expect(result![0]!.mediaItem.title).toBe('Past');
    expect(result![1]!.mediaItem.title).toBe('Future');
  });

  it('uses lastAiredEpisode.releaseDate for TV shows without episode/season context', () => {
    const items = [
      makeListItem(1, 'Show A', {
        mediaItem: makeMediaItem('Show A', {
          mediaType: 'tv',
          lastAiredEpisode: makeTvEpisode(1, { releaseDate: '2021-05-10' }),
        }),
      }),
      makeListItem(2, 'Show B', {
        mediaItem: makeMediaItem('Show B', {
          mediaType: 'tv',
          lastAiredEpisode: makeTvEpisode(1, { releaseDate: '2020-01-01' }),
        }),
      }),
    ];

    const result = renderSorted('recently-aired', 'desc', items);
    expect(result![0]!.mediaItem.title).toBe('Show A');
    expect(result![1]!.mediaItem.title).toBe('Show B');
  });
});

// ---------------------------------------------------------------------------
// next-airing sort
// ---------------------------------------------------------------------------

describe('useSortedList — next-airing', () => {
  it('ignores past release dates and sorts by future dates ascending', () => {
    const pastDate = '2010-01-01';
    const futureDate1 = new Date(Date.now() + 86400 * 10 * 1000)
      .toISOString()
      .split('T')[0];
    const futureDate2 = new Date(Date.now() + 86400 * 20 * 1000)
      .toISOString()
      .split('T')[0];

    const items = [
      makeListItem(1, 'Far Future', {
        mediaItem: makeMediaItem('Far Future', {
          mediaType: 'tv',
          upcomingEpisode: makeTvEpisode(1, { releaseDate: futureDate2 }),
        }),
      }),
      makeListItem(2, 'Near Future', {
        mediaItem: makeMediaItem('Near Future', {
          mediaType: 'tv',
          upcomingEpisode: makeTvEpisode(1, { releaseDate: futureDate1 }),
        }),
      }),
      makeListItem(3, 'Past Show', {
        mediaItem: makeMediaItem('Past Show', {
          mediaType: 'tv',
          upcomingEpisode: makeTvEpisode(1, { releaseDate: pastDate }),
        }),
      }),
    ];

    const result = renderSorted('next-airing', 'asc', items);
    // past date is treated as undefined → pushed to end
    expect(result![0]!.mediaItem.title).toBe('Near Future');
    expect(result![1]!.mediaItem.title).toBe('Far Future');
    expect(result![2]!.mediaItem.title).toBe('Past Show');
  });
});

// ---------------------------------------------------------------------------
// runtime sort
// ---------------------------------------------------------------------------

describe('useSortedList — runtime', () => {
  it('sorts by totalRuntime ascending', () => {
    const items = [
      makeListItem(1, 'Long', {
        mediaItem: makeMediaItem('Long', { totalRuntime: 180 }),
      }),
      makeListItem(2, 'Short', {
        mediaItem: makeMediaItem('Short', { totalRuntime: 90 }),
      }),
      makeListItem(3, 'Medium', {
        mediaItem: makeMediaItem('Medium', { totalRuntime: 120 }),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Short',
      'Medium',
      'Long',
    ]);
  });

  it('sorts by totalRuntime descending', () => {
    const items = [
      makeListItem(1, 'Long', {
        mediaItem: makeMediaItem('Long', { totalRuntime: 180 }),
      }),
      makeListItem(2, 'Short', {
        mediaItem: makeMediaItem('Short', { totalRuntime: 90 }),
      }),
    ];

    const result = renderSorted('runtime', 'desc', items);
    expect(result![0]!.mediaItem.title).toBe('Long');
    expect(result![1]!.mediaItem.title).toBe('Short');
  });

  it('uses episode.runtime when episode is present', () => {
    const items = [
      makeListItem(1, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(1, { runtime: 45 }),
        mediaItem: makeMediaItem('Show', { totalRuntime: 1000 }),
      }),
      makeListItem(2, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(2, { runtime: 25 }),
        mediaItem: makeMediaItem('Show', { totalRuntime: 1000 }),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.episode!.runtime).toBe(25);
    expect(result![1]!.episode!.runtime).toBe(45);
  });

  it('pushes items with null runtime to the end', () => {
    const items = [
      makeListItem(1, 'No Runtime', {
        mediaItem: makeMediaItem('No Runtime', { totalRuntime: null }),
      }),
      makeListItem(2, 'Has Runtime', {
        mediaItem: makeMediaItem('Has Runtime', { totalRuntime: 60 }),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Has Runtime');
    expect(result![1]!.mediaItem.title).toBe('No Runtime');
  });
});

// ---------------------------------------------------------------------------
// my-rating sort
// ---------------------------------------------------------------------------

describe('useSortedList — my-rating', () => {
  it('sorts by userRating.rating descending', () => {
    const items = [
      makeListItem(1, 'Low Rated', {
        mediaItem: makeMediaItem('Low Rated', {
          userRating: { id: 1, mediaItemId: 1, date: 0, userId: 1, rating: 3 },
        }),
      }),
      makeListItem(2, 'High Rated', {
        mediaItem: makeMediaItem('High Rated', {
          userRating: { id: 2, mediaItemId: 2, date: 0, userId: 1, rating: 9 },
        }),
      }),
      makeListItem(3, 'Mid Rated', {
        mediaItem: makeMediaItem('Mid Rated', {
          userRating: { id: 3, mediaItemId: 3, date: 0, userId: 1, rating: 6 },
        }),
      }),
    ];

    const result = renderSorted('my-rating', 'desc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'High Rated',
      'Mid Rated',
      'Low Rated',
    ]);
  });

  it('pushes items with no rating to the end', () => {
    const items = [
      makeListItem(1, 'Unrated', {
        mediaItem: makeMediaItem('Unrated', { userRating: null }),
      }),
      makeListItem(2, 'Rated', {
        mediaItem: makeMediaItem('Rated', {
          userRating: { id: 1, mediaItemId: 1, date: 0, userId: 1, rating: 7 },
        }),
      }),
    ];

    const result = renderSorted('my-rating', 'desc', items);
    expect(result![0]!.mediaItem.title).toBe('Rated');
    expect(result![1]!.mediaItem.title).toBe('Unrated');
  });
});

// ---------------------------------------------------------------------------
// recently-added sort
// ---------------------------------------------------------------------------

describe('useSortedList — recently-added', () => {
  it('sorts by listedAt descending', () => {
    const items = [
      makeListItem(1, 'First Added', { listedAt: '2021-01-01T00:00:00Z' }),
      makeListItem(2, 'Last Added', { listedAt: '2023-06-01T00:00:00Z' }),
      makeListItem(3, 'Middle', { listedAt: '2022-03-15T00:00:00Z' }),
    ];

    const result = renderSorted('recently-added', 'desc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Last Added',
      'Middle',
      'First Added',
    ]);
  });

  it('sorts by listedAt ascending', () => {
    const items = [
      makeListItem(1, 'First Added', { listedAt: '2021-01-01T00:00:00Z' }),
      makeListItem(2, 'Last Added', { listedAt: '2023-06-01T00:00:00Z' }),
    ];

    const result = renderSorted('recently-added', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('First Added');
    expect(result![1]!.mediaItem.title).toBe('Last Added');
  });
});

// ---------------------------------------------------------------------------
// Tie-breaking: TV show vs season vs episode
// ---------------------------------------------------------------------------

describe('useSortedList — tie-breaking', () => {
  it('places TV show entry before season entry when values are equal', () => {
    const items = [
      // season entry first in input
      makeListItem(1, 'Show', {
        type: 'season',
        season: makeTvSeason(1),
        mediaItem: makeMediaItem('Show', { totalRuntime: 100 }),
      }),
      // show entry
      makeListItem(2, 'Show', {
        type: 'tv',
        mediaItem: makeMediaItem('Show', { totalRuntime: 100 }),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    // TV show (no season, no episode) should sort before season (has season)
    expect(result![0]!.type).toBe('tv');
    expect(result![1]!.type).toBe('season');
  });

  it('places season entry before episode entry when values are equal', () => {
    const items = [
      makeListItem(1, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(1, { runtime: 45 }),
        mediaItem: makeMediaItem('Show'),
      }),
      makeListItem(2, 'Show', {
        type: 'season',
        season: makeTvSeason(1, { totalRuntime: 45 }),
        mediaItem: makeMediaItem('Show'),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.type).toBe('season');
    expect(result![1]!.type).toBe('episode');
  });

  it('falls back to alphabetical title order when all tie-breaking criteria match', () => {
    const items = [
      makeListItem(1, 'Zorro Film', {
        mediaItem: makeMediaItem('Zorro Film', { totalRuntime: 120 }),
      }),
      makeListItem(2, 'Alpha Film', {
        mediaItem: makeMediaItem('Alpha Film', { totalRuntime: 120 }),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Alpha Film');
    expect(result![1]!.mediaItem.title).toBe('Zorro Film');
  });

  it('orders episodes by seasonAndEpisodeNumber when tied on the sort property', () => {
    const items = [
      makeListItem(1, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(3, { runtime: 45, seasonAndEpisodeNumber: 103 }),
        mediaItem: makeMediaItem('Show'),
      }),
      makeListItem(2, 'Show', {
        type: 'episode',
        episode: makeTvEpisode(1, { runtime: 45, seasonAndEpisodeNumber: 101 }),
        mediaItem: makeMediaItem('Show'),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.episode!.episodeNumber).toBe(1);
    expect(result![1]!.episode!.episodeNumber).toBe(3);
  });

  it('orders seasons by seasonNumber when tied on the sort property', () => {
    const items = [
      makeListItem(1, 'Show', {
        type: 'season',
        season: makeTvSeason(3, { totalRuntime: 200 }),
        mediaItem: makeMediaItem('Show'),
      }),
      makeListItem(2, 'Show', {
        type: 'season',
        season: makeTvSeason(1, { totalRuntime: 200 }),
        mediaItem: makeMediaItem('Show'),
      }),
    ];

    const result = renderSorted('runtime', 'asc', items);
    expect(result![0]!.season!.seasonNumber).toBe(1);
    expect(result![1]!.season!.seasonNumber).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// recommended sort
// ---------------------------------------------------------------------------

describe('useSortedList — recommended', () => {
  it('sorts by combined score (estimatedRating * 0.6 + tmdbRating * 0.4) descending', () => {
    // Item A: 8 * 0.6 + 7 * 0.4 = 4.8 + 2.8 = 7.6
    // Item B: 9 * 0.6 + 5 * 0.4 = 5.4 + 2.0 = 7.4
    // Item C: 7 * 0.6 + 9 * 0.4 = 4.2 + 3.6 = 7.8  ← highest
    const items = [
      makeListItem(1, 'A', {
        estimatedRating: 8,
        mediaItem: makeMediaItem('A', { tmdbRating: 7 }),
      }),
      makeListItem(2, 'B', {
        estimatedRating: 9,
        mediaItem: makeMediaItem('B', { tmdbRating: 5 }),
      }),
      makeListItem(3, 'C', {
        estimatedRating: 7,
        mediaItem: makeMediaItem('C', { tmdbRating: 9 }),
      }),
    ];

    const result = renderSorted('recommended', 'asc', items);
    expect(result!.map((i) => i.mediaItem.title)).toEqual(['C', 'A', 'B']);
  });

  it('uses estimatedRating alone when tmdbRating is null', () => {
    const items = [
      makeListItem(1, 'Low Est', {
        estimatedRating: 5,
        mediaItem: makeMediaItem('Low Est', { tmdbRating: null }),
      }),
      makeListItem(2, 'High Est', {
        estimatedRating: 9,
        mediaItem: makeMediaItem('High Est', { tmdbRating: null }),
      }),
    ];

    const result = renderSorted('recommended', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('High Est');
    expect(result![1]!.mediaItem.title).toBe('Low Est');
  });

  it('pushes items with null estimatedRating to the end', () => {
    const items = [
      makeListItem(1, 'No Score', {
        estimatedRating: null,
        mediaItem: makeMediaItem('No Score'),
      }),
      makeListItem(2, 'Has Score', {
        estimatedRating: 7,
        mediaItem: makeMediaItem('Has Score'),
      }),
    ];

    const result = renderSorted('recommended', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Has Score');
    expect(result![1]!.mediaItem.title).toBe('No Score');
  });

  it('falls back to alphabetical when both items have null estimatedRating', () => {
    const items = [
      makeListItem(1, 'Zorro', {
        estimatedRating: null,
        mediaItem: makeMediaItem('Zorro'),
      }),
      makeListItem(2, 'Alpha', {
        estimatedRating: null,
        mediaItem: makeMediaItem('Alpha'),
      }),
    ];

    const result = renderSorted('recommended', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Alpha');
    expect(result![1]!.mediaItem.title).toBe('Zorro');
  });

  it('falls back to alphabetical when both items have equal scores', () => {
    const items = [
      makeListItem(1, 'Zorro', {
        estimatedRating: 8,
        mediaItem: makeMediaItem('Zorro', { tmdbRating: 8 }),
      }),
      makeListItem(2, 'Alpha', {
        estimatedRating: 8,
        mediaItem: makeMediaItem('Alpha', { tmdbRating: 8 }),
      }),
    ];

    const result = renderSorted('recommended', 'asc', items);
    expect(result![0]!.mediaItem.title).toBe('Alpha');
    expect(result![1]!.mediaItem.title).toBe('Zorro');
  });

  it('always sorts recommended in descending score order regardless of sortOrder param', () => {
    // The recommended strategy ignores sortOrder and always picks highest first
    const itemsDesc = [
      makeListItem(1, 'Low', {
        estimatedRating: 4,
        mediaItem: makeMediaItem('Low', { tmdbRating: 4 }),
      }),
      makeListItem(2, 'High', {
        estimatedRating: 9,
        mediaItem: makeMediaItem('High', { tmdbRating: 9 }),
      }),
    ];

    const resultAsc = renderSorted('recommended', 'asc', [...itemsDesc]);
    const resultDesc = renderSorted('recommended', 'desc', [...itemsDesc]);

    // Both orderings should produce the same result (score desc)
    expect(resultAsc![0]!.mediaItem.title).toBe('High');
    expect(resultDesc![0]!.mediaItem.title).toBe('High');
  });
});

// ---------------------------------------------------------------------------
// platform-recommended sort — platformSeen filtering
// ---------------------------------------------------------------------------

describe('useSortedList — platform-recommended platformSeen filtering', () => {
  it('filters out items where mediaItem.platformSeen is true', () => {
    const items = [
      makeListItem(1, 'Unseen A', {
        mediaItem: makeMediaItem('Unseen A', {
          platformRating: 8,
          tmdbRating: 7,
          platformSeen: false,
        }),
      }),
      makeListItem(2, 'Seen B', {
        mediaItem: makeMediaItem('Seen B', {
          platformRating: 9,
          tmdbRating: 9,
          platformSeen: true,
        }),
      }),
      makeListItem(3, 'Unseen C', {
        mediaItem: makeMediaItem('Unseen C', {
          platformRating: 7,
          tmdbRating: 6,
          platformSeen: false,
        }),
      }),
    ];

    const result = renderSorted('platform-recommended', 'desc', items);
    // Only unseen items should remain; seen item 'Seen B' is filtered out
    expect(result).toHaveLength(2);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Unseen A',
      'Unseen C',
    ]);
  });

  it('includes items where platformSeen is null or undefined', () => {
    const items = [
      makeListItem(1, 'Null Seen', {
        mediaItem: makeMediaItem('Null Seen', {
          platformRating: 6,
          tmdbRating: 5,
          platformSeen: null,
        }),
      }),
      makeListItem(2, 'Undefined Seen', {
        mediaItem: makeMediaItem('Undefined Seen', {
          platformRating: 7,
          tmdbRating: 6,
        }),
      }),
      makeListItem(3, 'Explicitly Unseen', {
        mediaItem: makeMediaItem('Explicitly Unseen', {
          platformRating: 8,
          tmdbRating: 7,
          platformSeen: false,
        }),
      }),
    ];

    const result = renderSorted('platform-recommended', 'desc', items);
    // All three should be present since none have platformSeen === true
    expect(result).toHaveLength(3);
  });

  it('does not filter platformSeen items for other sort strategies', () => {
    const items = [
      makeListItem(1, 'Seen Movie', {
        mediaItem: makeMediaItem('Seen Movie', {
          platformSeen: true,
          releaseDate: '2023-01-01',
        }),
      }),
      makeListItem(2, 'Unseen Movie', {
        mediaItem: makeMediaItem('Unseen Movie', {
          platformSeen: false,
          releaseDate: '2022-01-01',
        }),
      }),
    ];

    // Using 'title' sort — platformSeen filtering should NOT apply
    const result = renderSorted('title', 'asc', items);
    expect(result).toHaveLength(2);
    expect(result!.map((i) => i.mediaItem.title)).toEqual([
      'Seen Movie',
      'Unseen Movie',
    ]);
  });

  it('returns empty array when all items have platformSeen true', () => {
    const items = [
      makeListItem(1, 'Seen A', {
        mediaItem: makeMediaItem('Seen A', {
          platformRating: 8,
          platformSeen: true,
        }),
      }),
      makeListItem(2, 'Seen B', {
        mediaItem: makeMediaItem('Seen B', {
          platformRating: 9,
          platformSeen: true,
        }),
      }),
    ];

    const result = renderSorted('platform-recommended', 'desc', items);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Both null values — alphabetical tie-break
// ---------------------------------------------------------------------------

describe('useSortedList — both null values alphabetical tie-break', () => {
  it('sorts alphabetically when both property values are null', () => {
    const items = [
      makeListItem(1, 'Zorro', {
        mediaItem: makeMediaItem('Zorro', { lastSeenAt: null }),
      }),
      makeListItem(2, 'Alpha', {
        mediaItem: makeMediaItem('Alpha', { lastSeenAt: null }),
      }),
    ];

    const result = renderSorted('recently-watched', 'desc', items);
    expect(result![0]!.mediaItem.title).toBe('Alpha');
    expect(result![1]!.mediaItem.title).toBe('Zorro');
  });
});
