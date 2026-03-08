/**
 * Tests for src/utils.ts
 *
 * Covers every exported function, including all branches within type guards,
 * format helpers, poster height, release date checks, map utilities, and list
 * label helpers.
 */

import {
  formatEpisodeNumber,
  formatSeasonNumber,
  findEpisodeBeId,
  getPosterHeight,
  hasBeenReleased,
  hasReleaseDate,
  isOnWatchlist,
  isSeason,
  isAudiobook,
  isBook,
  isMovie,
  isTvShow,
  isVideoGame,
  hasPoster,
  hideEpisodeTitle,
  hideSeasonOverview,
  hasProgress,
  reverseMap,
  canMetadataBeUpdated,
  listDescription,
  listName,
} from 'src/utils';

import type {
  MediaItemDetailsResponse,
  MediaItemItemsResponse,
  TvEpisode,
  TvSeason,
  UserResponse,
} from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Lingui mock — the `t` tagged-template literal is used by formatEpisodeNumber,
// formatSeasonNumber, listDescription and listName.  In tests we resolve it
// to the raw interpolated string so assertions remain deterministic.
// ---------------------------------------------------------------------------
jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.raw
      ? String.raw(strings, ...values)
      : strings.join(''),
}));

// ---------------------------------------------------------------------------
// Helpers — minimal object factories that satisfy the TypeScript types without
// requiring every optional field.
// ---------------------------------------------------------------------------

const makeTvEpisode = (
  overrides: Partial<TvEpisode> = {}
): TvEpisode => ({
  title: 'Test Episode',
  episodeNumber: 1,
  seasonNumber: 1,
  isSpecialEpisode: false,
  ...overrides,
});

const makeTvSeason = (
  overrides: Partial<TvSeason> = {}
): TvSeason => ({
  title: 'Test Season',
  seasonNumber: 1,
  isSpecialSeason: false,
  ...overrides,
});

const makeMediaItem = (
  overrides: Partial<MediaItemItemsResponse> = {}
): MediaItemItemsResponse => ({
  title: 'Test Media',
  mediaType: 'movie',
  source: 'tmdb',
  lists: [],
  ...overrides,
} as MediaItemItemsResponse);

const makeDetailsItem = (
  overrides: Partial<MediaItemDetailsResponse> = {}
): MediaItemDetailsResponse => ({
  title: 'Test Show',
  mediaType: 'tv',
  source: 'tmdb',
  lists: [],
  ...overrides,
} as MediaItemDetailsResponse);

const makeUser = (
  overrides: Partial<UserResponse> = {}
): UserResponse => ({
  id: 1,
  name: 'Test User',
  ...overrides,
});

// ---------------------------------------------------------------------------
// formatEpisodeNumber
// ---------------------------------------------------------------------------
describe('formatEpisodeNumber', () => {
  it('formats single-digit season and episode with leading zeros', () => {
    const episode = makeTvEpisode({ seasonNumber: 1, episodeNumber: 5 });
    expect(formatEpisodeNumber(episode)).toBe('S01E05');
  });

  it('formats double-digit season and episode numbers without padding', () => {
    const episode = makeTvEpisode({ seasonNumber: 10, episodeNumber: 12 });
    expect(formatEpisodeNumber(episode)).toBe('S10E12');
  });

  it('pads season but not episode when episode >= 10', () => {
    const episode = makeTvEpisode({ seasonNumber: 3, episodeNumber: 10 });
    expect(formatEpisodeNumber(episode)).toBe('S03E10');
  });

  it('pads episode but not season when season >= 10', () => {
    const episode = makeTvEpisode({ seasonNumber: 12, episodeNumber: 7 });
    expect(formatEpisodeNumber(episode)).toBe('S12E07');
  });

  it('formats season 0 and episode 0', () => {
    const episode = makeTvEpisode({ seasonNumber: 0, episodeNumber: 0 });
    expect(formatEpisodeNumber(episode)).toBe('S00E00');
  });
});

// ---------------------------------------------------------------------------
// formatSeasonNumber
// ---------------------------------------------------------------------------
describe('formatSeasonNumber', () => {
  it('formats single-digit season number with leading zero', () => {
    const season = makeTvSeason({ seasonNumber: 1 });
    expect(formatSeasonNumber(season)).toBe('S01');
  });

  it('formats double-digit season number without padding', () => {
    const season = makeTvSeason({ seasonNumber: 12 });
    expect(formatSeasonNumber(season)).toBe('S12');
  });

  it('formats season 0', () => {
    const season = makeTvSeason({ seasonNumber: 0 });
    expect(formatSeasonNumber(season)).toBe('S00');
  });
});

// ---------------------------------------------------------------------------
// findEpisodeBeId
// ---------------------------------------------------------------------------
describe('findEpisodeBeId', () => {
  it('returns null when the media item has no seasons', () => {
    const item = makeDetailsItem({ seasons: null });
    expect(findEpisodeBeId(item, 42)).toBeNull();
  });

  it('returns falsy when seasons array is empty', () => {
    const item = makeDetailsItem({ seasons: [] });
    expect(findEpisodeBeId(item, 42)).toBeFalsy();
  });

  it('finds an episode by id within a single season', () => {
    const ep = makeTvEpisode({ id: 7, episodeNumber: 3 });
    const season = makeTvSeason({ episodes: [ep] });
    const item = makeDetailsItem({ seasons: [season] });

    expect(findEpisodeBeId(item, 7)).toBe(ep);
  });

  it('finds an episode when it is in the second season', () => {
    const ep1 = makeTvEpisode({ id: 1, episodeNumber: 1 });
    const ep2 = makeTvEpisode({ id: 2, episodeNumber: 1, seasonNumber: 2 });
    const season1 = makeTvSeason({ seasonNumber: 1, episodes: [ep1] });
    const season2 = makeTvSeason({ seasonNumber: 2, episodes: [ep2] });
    const item = makeDetailsItem({ seasons: [season1, season2] });

    expect(findEpisodeBeId(item, 2)).toBe(ep2);
  });

  it('returns undefined when the episode id does not exist in any season', () => {
    const ep = makeTvEpisode({ id: 5, episodeNumber: 1 });
    const season = makeTvSeason({ episodes: [ep] });
    const item = makeDetailsItem({ seasons: [season] });

    expect(findEpisodeBeId(item, 999)).toBeUndefined();
  });

  it('skips seasons that have no episodes array', () => {
    const ep = makeTvEpisode({ id: 10, episodeNumber: 1 });
    const seasonNoEpisodes = makeTvSeason({ seasonNumber: 1, episodes: null });
    const seasonWithEpisodes = makeTvSeason({
      seasonNumber: 2,
      episodes: [ep],
    });
    const item = makeDetailsItem({
      seasons: [seasonNoEpisodes, seasonWithEpisodes],
    });

    expect(findEpisodeBeId(item, 10)).toBe(ep);
  });
});

// ---------------------------------------------------------------------------
// getPosterHeight
// ---------------------------------------------------------------------------
describe('getPosterHeight', () => {
  it('returns posterWidth / 0.75 for video_game', () => {
    expect(getPosterHeight({ mediaType: 'video_game', posterWidth: 150 }))
      .toBeCloseTo(200);
  });

  it('returns posterWidth (1:1) for audiobook', () => {
    expect(getPosterHeight({ mediaType: 'audiobook', posterWidth: 120 }))
      .toBe(120);
  });

  it('returns posterWidth * 1.5 for book', () => {
    expect(getPosterHeight({ mediaType: 'book', posterWidth: 100 })).toBe(150);
  });

  it('returns posterWidth * 1.5 for tv', () => {
    expect(getPosterHeight({ mediaType: 'tv', posterWidth: 100 })).toBe(150);
  });

  it('returns posterWidth * 1.5 for movie', () => {
    expect(getPosterHeight({ mediaType: 'movie', posterWidth: 100 })).toBe(150);
  });

  it('returns posterWidth * 1.5 when mediaType is undefined (default case)', () => {
    expect(getPosterHeight({ posterWidth: 100 })).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// hasBeenReleased
// ---------------------------------------------------------------------------
describe('hasBeenReleased', () => {
  it('returns truthy for a release date in the past', () => {
    const item = makeMediaItem({ releaseDate: '2000-01-01' });
    expect(hasBeenReleased(item)).toBeTruthy();
  });

  it('returns falsy for a release date in the future', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const item = makeMediaItem({
      releaseDate: futureDate.toISOString().split('T')[0],
    });
    expect(hasBeenReleased(item)).toBeFalsy();
  });

  it('returns falsy when releaseDate is null', () => {
    const item = makeMediaItem({ releaseDate: null });
    expect(hasBeenReleased(item)).toBeFalsy();
  });

  it('returns falsy when releaseDate is undefined', () => {
    const item = makeMediaItem({ releaseDate: undefined });
    expect(hasBeenReleased(item)).toBeFalsy();
  });

  it('works with TvSeason objects', () => {
    const season = makeTvSeason({ releaseDate: '2010-06-15' });
    expect(hasBeenReleased(season)).toBeTruthy();
  });

  it('works with TvEpisode objects', () => {
    const episode = makeTvEpisode({ releaseDate: '2010-06-15' });
    expect(hasBeenReleased(episode)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// hasReleaseDate
// ---------------------------------------------------------------------------
describe('hasReleaseDate', () => {
  it('returns true when a releaseDate string is present', () => {
    const item = makeMediaItem({ releaseDate: '2020-05-01' });
    expect(hasReleaseDate(item)).toBe(true);
  });

  it('returns false when releaseDate is null', () => {
    const item = makeMediaItem({ releaseDate: null });
    expect(hasReleaseDate(item)).toBe(false);
  });

  it('returns false when releaseDate is undefined', () => {
    const item = makeMediaItem({ releaseDate: undefined });
    expect(hasReleaseDate(item)).toBe(false);
  });

  it('works with TvSeason', () => {
    const season = makeTvSeason({ releaseDate: '2015-03-20' });
    expect(hasReleaseDate(season)).toBe(true);
  });

  it('works with TvEpisode', () => {
    const episode = makeTvEpisode({ releaseDate: null });
    expect(hasReleaseDate(episode)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOnWatchlist
// ---------------------------------------------------------------------------
describe('isOnWatchlist', () => {
  it('returns true when onWatchlist is true', () => {
    expect(isOnWatchlist(makeMediaItem({ onWatchlist: true }))).toBe(true);
  });

  it('returns false when onWatchlist is false', () => {
    expect(isOnWatchlist(makeMediaItem({ onWatchlist: false }))).toBe(false);
  });

  it('returns false when onWatchlist is null', () => {
    expect(isOnWatchlist(makeMediaItem({ onWatchlist: null }))).toBe(false);
  });

  it('returns false when onWatchlist is undefined', () => {
    expect(isOnWatchlist(makeMediaItem({}))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSeason
// ---------------------------------------------------------------------------
describe('isSeason', () => {
  it('returns true for a TvSeason object', () => {
    const season = makeTvSeason({ seasonNumber: 2 });
    expect(isSeason(season)).toBe(true);
  });

  it('returns false for a TvEpisode object', () => {
    const episode = makeTvEpisode({ episodeNumber: 1, seasonNumber: 1 });
    expect(isSeason(episode)).toBe(false);
  });

  it('returns false for a MediaItemItemsResponse (no seasonNumber)', () => {
    const item = makeMediaItem();
    expect(isSeason(item as unknown as TvSeason)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAudiobook
// ---------------------------------------------------------------------------
describe('isAudiobook', () => {
  it('returns true when passed the string "audiobook"', () => {
    expect(isAudiobook('audiobook')).toBe(true);
  });

  it('returns false when passed a different string', () => {
    expect(isAudiobook('movie')).toBe(false);
  });

  it('returns true when mediaItem.mediaType is "audiobook"', () => {
    expect(isAudiobook(makeMediaItem({ mediaType: 'audiobook' }))).toBe(true);
  });

  it('returns false when mediaItem.mediaType is not "audiobook"', () => {
    expect(isAudiobook(makeMediaItem({ mediaType: 'book' }))).toBe(false);
  });

  it('returns false when argument is undefined', () => {
    expect(isAudiobook(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBook
// ---------------------------------------------------------------------------
describe('isBook', () => {
  it('returns true for string "book"', () => {
    expect(isBook('book')).toBe(true);
  });

  it('returns false for string "audiobook"', () => {
    expect(isBook('audiobook')).toBe(false);
  });

  it('returns true for a media item with mediaType "book"', () => {
    expect(isBook(makeMediaItem({ mediaType: 'book' }))).toBe(true);
  });

  it('returns false for a media item with a different mediaType', () => {
    expect(isBook(makeMediaItem({ mediaType: 'movie' }))).toBe(false);
  });

  it('returns false when argument is undefined', () => {
    expect(isBook(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isMovie
// ---------------------------------------------------------------------------
describe('isMovie', () => {
  it('returns true for string "movie"', () => {
    expect(isMovie('movie')).toBe(true);
  });

  it('returns false for string "tv"', () => {
    expect(isMovie('tv')).toBe(false);
  });

  it('returns true for a media item with mediaType "movie"', () => {
    expect(isMovie(makeMediaItem({ mediaType: 'movie' }))).toBe(true);
  });

  it('returns false for a media item with a different mediaType', () => {
    expect(isMovie(makeMediaItem({ mediaType: 'tv' }))).toBe(false);
  });

  it('returns false when argument is undefined', () => {
    expect(isMovie(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTvShow
// ---------------------------------------------------------------------------
describe('isTvShow', () => {
  it('returns true for string "tv"', () => {
    expect(isTvShow('tv')).toBe(true);
  });

  it('returns false for string "movie"', () => {
    expect(isTvShow('movie')).toBe(false);
  });

  it('returns true for a media item with mediaType "tv"', () => {
    expect(isTvShow(makeMediaItem({ mediaType: 'tv' }))).toBe(true);
  });

  it('returns false for a media item with a different mediaType', () => {
    expect(isTvShow(makeMediaItem({ mediaType: 'book' }))).toBe(false);
  });

  it('returns false when argument is undefined', () => {
    expect(isTvShow(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isVideoGame
// ---------------------------------------------------------------------------
describe('isVideoGame', () => {
  it('returns true for string "video_game"', () => {
    expect(isVideoGame('video_game')).toBe(true);
  });

  it('returns false for string "movie"', () => {
    expect(isVideoGame('movie')).toBe(false);
  });

  it('returns true for a media item with mediaType "video_game"', () => {
    expect(isVideoGame(makeMediaItem({ mediaType: 'video_game' }))).toBe(true);
  });

  it('returns false for a media item with a different mediaType', () => {
    expect(isVideoGame(makeMediaItem({ mediaType: 'tv' }))).toBe(false);
  });

  it('returns false when argument is undefined', () => {
    expect(isVideoGame(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasPoster
// ---------------------------------------------------------------------------
describe('hasPoster', () => {
  it('returns true when posterSmall is set', () => {
    expect(hasPoster(makeMediaItem({ posterSmall: '/path/to/poster.jpg' }))).toBe(true);
  });

  it('returns false when posterSmall is undefined', () => {
    expect(hasPoster(makeMediaItem({ posterSmall: undefined }))).toBe(false);
  });

  it('returns false when posterSmall is null', () => {
    expect(hasPoster(makeMediaItem({ posterSmall: null }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hideEpisodeTitle
// ---------------------------------------------------------------------------
describe('hideEpisodeTitle', () => {
  it('returns true when hideEpisodeTitleForUnseenEpisodes is true', () => {
    expect(
      hideEpisodeTitle(makeUser({ hideEpisodeTitleForUnseenEpisodes: true }))
    ).toBe(true);
  });

  it('returns false when hideEpisodeTitleForUnseenEpisodes is false', () => {
    expect(
      hideEpisodeTitle(makeUser({ hideEpisodeTitleForUnseenEpisodes: false }))
    ).toBe(false);
  });

  it('returns undefined/nullish when property is not set', () => {
    expect(hideEpisodeTitle(makeUser({}))).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// hideSeasonOverview
// ---------------------------------------------------------------------------
describe('hideSeasonOverview', () => {
  it('returns true when hideOverviewForUnseenSeasons is true', () => {
    expect(
      hideSeasonOverview(makeUser({ hideOverviewForUnseenSeasons: true }))
    ).toBe(true);
  });

  it('returns false when hideOverviewForUnseenSeasons is false', () => {
    expect(
      hideSeasonOverview(makeUser({ hideOverviewForUnseenSeasons: false }))
    ).toBe(false);
  });

  it('returns undefined/nullish when property is not set', () => {
    expect(hideSeasonOverview(makeUser({}))).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// hasProgress
// ---------------------------------------------------------------------------
describe('hasProgress', () => {
  it('returns true when progress is a number', () => {
    expect(hasProgress(makeMediaItem({ progress: 0.5 }))).toBe(true);
  });

  it('returns true when progress is 0', () => {
    expect(hasProgress(makeMediaItem({ progress: 0 }))).toBe(true);
  });

  it('returns false when progress is null', () => {
    expect(hasProgress(makeMediaItem({ progress: null }))).toBe(false);
  });

  it('returns false when progress is undefined', () => {
    expect(hasProgress(makeMediaItem({ progress: undefined }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reverseMap
// ---------------------------------------------------------------------------
describe('reverseMap', () => {
  it('swaps keys and values in a simple map', () => {
    const original = { a: 'x', b: 'y', c: 'z' } as const;
    const reversed = reverseMap(original);

    expect(reversed).toEqual({ x: 'a', y: 'b', z: 'c' });
  });

  it('produces an empty object from an empty map', () => {
    const reversed = reverseMap({} as Record<string, string>);
    expect(reversed).toEqual({});
  });

  it('handles maps with multiple entries including single-character values', () => {
    const original = { foo: 'F', bar: 'B' } as const;
    const reversed = reverseMap(original);

    expect(reversed['F']).toBe('foo');
    expect(reversed['B']).toBe('bar');
  });
});

// ---------------------------------------------------------------------------
// canMetadataBeUpdated
// ---------------------------------------------------------------------------
describe('canMetadataBeUpdated', () => {
  it.each(['igdb', 'tmdb', 'openlibrary', 'audible'])(
    'returns true for source "%s"',
    (source) => {
      expect(canMetadataBeUpdated(makeMediaItem({ source }))).toBe(true);
    }
  );

  it('returns true for source in mixed case (lowercase comparison)', () => {
    expect(canMetadataBeUpdated(makeMediaItem({ source: 'TMDB' }))).toBe(true);
  });

  it('returns false for an unsupported source', () => {
    expect(canMetadataBeUpdated(makeMediaItem({ source: 'manual' }))).toBe(false);
  });

  it('returns false when source is an empty string', () => {
    expect(canMetadataBeUpdated(makeMediaItem({ source: '' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listDescription
// ---------------------------------------------------------------------------
describe('listDescription', () => {
  it('returns the watchlist description string when isWatchlist is true', () => {
    const result = listDescription({ isWatchlist: true });
    expect(typeof result).toBe('string');
    expect(result).toContain('watch');
  });

  it('returns the custom description when isWatchlist is false', () => {
    const result = listDescription({
      isWatchlist: false,
      description: 'My favourite sci-fi movies',
    });
    expect(result).toBe('My favourite sci-fi movies');
  });

  it('returns undefined description when isWatchlist is false and no description provided', () => {
    const result = listDescription({ isWatchlist: false });
    expect(result).toBeUndefined();
  });

  it('returns undefined when list argument itself is undefined', () => {
    expect(listDescription(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listName
// ---------------------------------------------------------------------------
describe('listName', () => {
  it('returns the "Watchlist" translation when isWatchlist is true', () => {
    const result = listName({ isWatchlist: true, name: 'ignored' });
    // The lingui t template tag is mocked to return the raw string
    expect(result).toBe('Watchlist');
  });

  it('returns the list name when isWatchlist is false', () => {
    const result = listName({ isWatchlist: false, name: 'My List' });
    expect(result).toBe('My List');
  });

  it('returns undefined when list argument is undefined', () => {
    expect(listName(undefined)).toBeUndefined();
  });
});
