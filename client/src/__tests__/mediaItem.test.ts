/**
 * Tests for src/mediaItem.ts
 *
 * Covers:
 *   - firstUnwatchedSeason
 *   - lastSeason
 *   - findSeasonBySeasonNumber
 *   - findEpisodeBySeasonAndEpisodeNumber
 *   - hasBeenSeenAtLeastOnce  (TvSeason and TvEpisode paths)
 *   - useSelectedSeason hook  (via renderHook)
 */

import { renderHook, act } from '@testing-library/react';

import {
  firstUnwatchedSeason,
  lastSeason,
  findSeasonBySeasonNumber,
  findEpisodeBySeasonAndEpisodeNumber,
  hasBeenSeenAtLeastOnce,
  useSelectedSeason,
} from 'src/mediaItem';

import type {
  MediaItemDetailsResponse,
  TvEpisode,
  TvSeason,
  Seen,
} from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Lingui mock (used transitively through isSeason → utils)
// ---------------------------------------------------------------------------
jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.raw
      ? String.raw(strings, ...values)
      : strings.join(''),
}));

// ---------------------------------------------------------------------------
// Minimal factory helpers
// ---------------------------------------------------------------------------

const makeSeenEntry = (id = 1): Seen => ({
  id,
  mediaItemId: 1,
  userId: 1,
});

const makeTvEpisode = (overrides: Partial<TvEpisode> = {}): TvEpisode => ({
  title: 'Episode',
  episodeNumber: 1,
  seasonNumber: 1,
  isSpecialEpisode: false,
  ...overrides,
});

const makeTvSeason = (overrides: Partial<TvSeason> = {}): TvSeason => ({
  title: 'Season',
  seasonNumber: 1,
  isSpecialSeason: false,
  seen: false,
  ...overrides,
});

const makeDetailsItem = (
  overrides: Partial<MediaItemDetailsResponse> = {}
): MediaItemDetailsResponse =>
  ({
    title: 'Test Show',
    mediaType: 'tv',
    source: 'tmdb',
    lists: [],
    ...overrides,
  } as MediaItemDetailsResponse);

// ---------------------------------------------------------------------------
// firstUnwatchedSeason
// ---------------------------------------------------------------------------
describe('firstUnwatchedSeason', () => {
  it('returns the first season where seen is false (skipping special seasons)', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 0, isSpecialSeason: true, seen: false }),
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: false }),
      makeTvSeason({ seasonNumber: 3, isSpecialSeason: false, seen: false }),
    ];
    const item = makeDetailsItem({ seasons });

    const result = firstUnwatchedSeason(item);
    expect(result!.seasonNumber).toBe(2);
  });

  it('returns undefined when all non-special seasons are seen', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: true }),
    ];
    const item = makeDetailsItem({ seasons });

    expect(firstUnwatchedSeason(item)).toBeUndefined();
  });

  it('returns undefined when seasons is null', () => {
    const item = makeDetailsItem({ seasons: null });
    expect(firstUnwatchedSeason(item)).toBeUndefined();
  });

  it('returns undefined when seasons array is empty', () => {
    const item = makeDetailsItem({ seasons: [] });
    expect(firstUnwatchedSeason(item)).toBeUndefined();
  });

  it('skips special seasons even when they are unseen', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 0, isSpecialSeason: true, seen: false }),
    ];
    const item = makeDetailsItem({ seasons });
    expect(firstUnwatchedSeason(item)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// lastSeason
// ---------------------------------------------------------------------------
describe('lastSeason', () => {
  it('returns the last season in the array', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1 }),
      makeTvSeason({ seasonNumber: 2 }),
      makeTvSeason({ seasonNumber: 3 }),
    ];
    const item = makeDetailsItem({ seasons });

    expect(lastSeason(item)?.seasonNumber).toBe(3);
  });

  it('returns the only element when there is a single season', () => {
    const season = makeTvSeason({ seasonNumber: 5 });
    const item = makeDetailsItem({ seasons: [season] });

    expect(lastSeason(item)).toBe(season);
  });

  it('returns undefined when seasons is null', () => {
    const item = makeDetailsItem({ seasons: null });
    expect(lastSeason(item)).toBeUndefined();
  });

  it('returns undefined when seasons is an empty array', () => {
    const item = makeDetailsItem({ seasons: [] });
    expect(lastSeason(item)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findSeasonBySeasonNumber
// ---------------------------------------------------------------------------
describe('findSeasonBySeasonNumber', () => {
  it('finds the matching season by season number', () => {
    const s1 = makeTvSeason({ seasonNumber: 1 });
    const s2 = makeTvSeason({ seasonNumber: 2 });
    const item = makeDetailsItem({ seasons: [s1, s2] });

    expect(findSeasonBySeasonNumber(item, 2)).toBe(s2);
  });

  it('returns undefined when season number does not match', () => {
    const s1 = makeTvSeason({ seasonNumber: 1 });
    const item = makeDetailsItem({ seasons: [s1] });

    expect(findSeasonBySeasonNumber(item, 99)).toBeUndefined();
  });

  it('returns undefined when seasons is null', () => {
    const item = makeDetailsItem({ seasons: null });
    expect(findSeasonBySeasonNumber(item, 1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findEpisodeBySeasonAndEpisodeNumber
// ---------------------------------------------------------------------------
describe('findEpisodeBySeasonAndEpisodeNumber', () => {
  it('finds the correct episode across nested season/episode structure', () => {
    const ep1 = makeTvEpisode({ episodeNumber: 1, seasonNumber: 2 });
    const ep2 = makeTvEpisode({ episodeNumber: 2, seasonNumber: 2 });
    const season = makeTvSeason({ seasonNumber: 2, episodes: [ep1, ep2] });
    const item = makeDetailsItem({ seasons: [season] });

    expect(findEpisodeBySeasonAndEpisodeNumber(item, 2, 2)).toBe(ep2);
  });

  it('returns undefined when season is not found', () => {
    const item = makeDetailsItem({ seasons: [] });
    expect(findEpisodeBySeasonAndEpisodeNumber(item, 5, 1)).toBeUndefined();
  });

  it('returns undefined when season exists but episode number does not match', () => {
    const season = makeTvSeason({
      seasonNumber: 1,
      episodes: [makeTvEpisode({ episodeNumber: 1 })],
    });
    const item = makeDetailsItem({ seasons: [season] });

    expect(findEpisodeBySeasonAndEpisodeNumber(item, 1, 99)).toBeUndefined();
  });

  it('returns undefined when season has no episodes', () => {
    const season = makeTvSeason({ seasonNumber: 1, episodes: null });
    const item = makeDetailsItem({ seasons: [season] });

    expect(findEpisodeBySeasonAndEpisodeNumber(item, 1, 1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasBeenSeenAtLeastOnce
// ---------------------------------------------------------------------------
describe('hasBeenSeenAtLeastOnce', () => {
  describe('TvEpisode path (non-season)', () => {
    it('returns true when the episode has at least one seen history entry', () => {
      const episode = makeTvEpisode({
        seenHistory: [makeSeenEntry(1)],
      });
      expect(hasBeenSeenAtLeastOnce(episode)).toBe(true);
    });

    it('returns false when the episode has an empty seen history', () => {
      const episode = makeTvEpisode({ seenHistory: [] });
      expect(hasBeenSeenAtLeastOnce(episode)).toBe(false);
    });

    it('returns false when seenHistory is null', () => {
      const episode = makeTvEpisode({ seenHistory: null });
      expect(hasBeenSeenAtLeastOnce(episode)).toBe(false);
    });
  });

  describe('TvSeason path', () => {
    it('returns true when at least one episode has been seen', () => {
      const season = makeTvSeason({
        seasonNumber: 1,
        episodes: [
          makeTvEpisode({ episodeNumber: 1, seenHistory: [] }),
          makeTvEpisode({ episodeNumber: 2, seenHistory: [makeSeenEntry(2)] }),
        ],
      });
      expect(hasBeenSeenAtLeastOnce(season)).toBe(true);
    });

    it('returns false when no episodes have been seen', () => {
      const season = makeTvSeason({
        seasonNumber: 1,
        episodes: [
          makeTvEpisode({ episodeNumber: 1, seenHistory: [] }),
          makeTvEpisode({ episodeNumber: 2, seenHistory: [] }),
        ],
      });
      expect(hasBeenSeenAtLeastOnce(season)).toBe(false);
    });

    it('returns false when the season has no episodes', () => {
      const season = makeTvSeason({ seasonNumber: 1, episodes: [] });
      expect(hasBeenSeenAtLeastOnce(season)).toBe(false);
    });

    it('returns false when episodes is null', () => {
      const season = makeTvSeason({ seasonNumber: 1, episodes: null });
      expect(hasBeenSeenAtLeastOnce(season)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// useSelectedSeason
// ---------------------------------------------------------------------------
describe('useSelectedSeason', () => {
  it('initialises selectedSeasonNumber as undefined when no mediaItem', () => {
    const { result } = renderHook(() => useSelectedSeason(undefined));

    expect(result.current.selectedSeasonNumber).toBeUndefined();
    expect(result.current.selectedSeason).toBeUndefined();
  });

  it('auto-selects the first unwatched season when available', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: false }),
    ];
    const mediaItem = makeDetailsItem({ seasons });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    expect(result.current.selectedSeasonNumber).toBe(2);
    expect(result.current.selectedSeason?.seasonNumber).toBe(2);
  });

  it('auto-selects the last season when all seasons are seen', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 3, isSpecialSeason: false, seen: true }),
    ];
    const mediaItem = makeDetailsItem({ seasons });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    expect(result.current.selectedSeasonNumber).toBe(3);
    expect(result.current.selectedSeason?.seasonNumber).toBe(3);
  });

  it('auto-selects the last season when only special seasons are unseen', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 0, isSpecialSeason: true, seen: false }),
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
    ];
    const mediaItem = makeDetailsItem({ seasons });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    // firstUnwatchedSeason returns undefined (only special unseen), so it falls
    // back to lastSeason which is seasonNumber 1.
    expect(result.current.selectedSeasonNumber).toBe(1);
  });

  it('setSelectedSeasonNumber updates the selected season', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: true }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: true }),
    ];
    const mediaItem = makeDetailsItem({ seasons });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    // After initial auto-selection (last = 2), change to season 1
    act(() => {
      result.current.setSelectedSeasonNumber(1);
    });

    expect(result.current.selectedSeasonNumber).toBe(1);
    expect(result.current.selectedSeason?.seasonNumber).toBe(1);
  });

  it('does not re-select once a season has been manually chosen', () => {
    const seasons: TvSeason[] = [
      makeTvSeason({ seasonNumber: 1, isSpecialSeason: false, seen: false }),
      makeTvSeason({ seasonNumber: 2, isSpecialSeason: false, seen: false }),
    ];
    const mediaItem = makeDetailsItem({ seasons });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    // Starts on first unwatched (1)
    expect(result.current.selectedSeasonNumber).toBe(1);

    // Manually select season 2
    act(() => {
      result.current.setSelectedSeasonNumber(2);
    });

    expect(result.current.selectedSeasonNumber).toBe(2);
  });

  it('returns undefined selectedSeason when seasons list is empty', () => {
    const mediaItem = makeDetailsItem({ seasons: [] });

    const { result } = renderHook(() => useSelectedSeason(mediaItem));

    // No seasons to auto-select from
    expect(result.current.selectedSeasonNumber).toBeUndefined();
    expect(result.current.selectedSeason).toBeUndefined();
  });
});
