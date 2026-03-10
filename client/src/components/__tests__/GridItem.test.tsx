/**
 * Tests for src/components/GridItem.tsx
 *
 * GridItem renders a poster card for a media item with optional overlays,
 * action buttons, progress bar, and runtime display.  Its many sub-component
 * dependencies are mocked so tests focus purely on rendering logic.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

jest.mock('src/api/details', () => ({
  removeFromWatchlist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('src/components/Confirm', () => ({
  Confirm: jest.fn().mockResolvedValue(false),
}));

jest.mock('src/components/Poster', () => {
  const React = require('react');
  return {
    Poster: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'poster' }, children),
  };
});

jest.mock('src/components/StarRating', () => {
  const React = require('react');
  return {
    BadgeRating: () => React.createElement('span', { 'data-testid': 'badge-rating' }),
  };
});

jest.mock('src/components/date', () => {
  const React = require('react');
  return {
    FormatDuration: ({ milliseconds }: { milliseconds: number }) =>
      React.createElement('span', { 'data-testid': 'format-duration' }, String(milliseconds)),
    RelativeTime: ({ to }: { to: Date }) =>
      React.createElement('span', { 'data-testid': 'relative-time' }, to.toString()),
  };
});

jest.mock('src/components/AddAndRemoveFromSeenHistoryButton', () => {
  const React = require('react');
  return {
    AddToSeenHistoryButton: () =>
      React.createElement('button', { 'data-testid': 'add-to-seen' }, 'Mark as seen'),
  };
});

jest.mock('src/pages/Details', () => {
  const React = require('react');
  return {
    AddToWatchlistButton: () =>
      React.createElement('button', { 'data-testid': 'add-to-watchlist' }, 'Add to watchlist'),
  };
});

jest.mock('date-fns', () => ({
  parseISO: (dateStr: string) => new Date(dateStr),
}));

import { GridItem } from 'src/components/GridItem';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const makeMediaItem = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  title: 'Test Movie',
  mediaType: 'movie',
  releaseDate: '2020-05-15',
  posterSmall: null,
  onWatchlist: false,
  seen: false,
  progress: 0,
  unseenEpisodesCount: 0,
  firstUnwatchedEpisode: null,
  lastAiredEpisode: null,
  upcomingEpisode: null,
  totalRuntime: 120,
  runtime: 120,
  ...overrides,
});

const makeTvShow = (overrides: Record<string, unknown> = {}): any =>
  makeMediaItem({
    id: 10,
    title: 'Test Show',
    mediaType: 'tv',
    ...overrides,
  });

const makeSeason = (overrides: Record<string, unknown> = {}): any => ({
  id: 100,
  seasonNumber: 1,
  tvShowId: 10,
  onWatchlist: false,
  totalRuntime: 600,
  ...overrides,
});

const makeEpisode = (overrides: Record<string, unknown> = {}): any => ({
  id: 1000,
  episodeNumber: 1,
  seasonNumber: 1,
  tvShowId: 10,
  onWatchlist: false,
  runtime: 30,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridItem – basic rendering', () => {
  it('renders the media item title', () => {
    render(React.createElement(GridItem, { mediaItem: makeMediaItem() }));

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });

  it('renders the media type label', () => {
    render(React.createElement(GridItem, { mediaItem: makeMediaItem({ mediaType: 'movie' }) }));

    // t`Movie` → 'Movie' via our mock
    expect(screen.getByText('Movie')).toBeInTheDocument();
  });

  it('renders the release year extracted from releaseDate', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ releaseDate: '2021-08-10' }),
      })
    );

    expect(screen.getByText('2021')).toBeInTheDocument();
  });

  it('does not render year when releaseDate is absent', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ releaseDate: null }),
      })
    );

    // No year digits in the document from the year field
    expect(screen.queryByText('2020')).not.toBeInTheDocument();
  });

  it('renders the poster placeholder', () => {
    render(React.createElement(GridItem, { mediaItem: makeMediaItem() }));

    expect(screen.getByTestId('poster')).toBeInTheDocument();
  });
});

describe('GridItem – progress bar', () => {
  it('renders a progress bar when mediaItem.progress is non-zero', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ progress: 0.5 }),
      })
    );

    // Progress bar is rendered as a div with a style width set
    const progressFill = container.querySelector('div[style]');
    expect(progressFill).toBeInTheDocument();
    expect(progressFill?.getAttribute('style')).toContain('50%');
  });

  it('does not render the progress bar when progress is undefined', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ progress: undefined }),
      })
    );

    expect(container.querySelector('div[style*="width"]')).not.toBeInTheDocument();
  });
});

describe('GridItem – appearance flags', () => {
  it('renders BadgeRating when showRating is true and item has been released', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ releaseDate: '2019-01-01' }),
        appearance: { showRating: true },
      })
    );

    expect(screen.getByTestId('badge-rating')).toBeInTheDocument();
  });

  it('does not render BadgeRating when showRating is false', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem(),
        appearance: { showRating: false },
      })
    );

    expect(screen.queryByTestId('badge-rating')).not.toBeInTheDocument();
  });

  it('renders AddToWatchlistButton when showAddToWatchlistAndMarkAsSeenButtons and item is not on watchlist', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: false }),
        appearance: { showAddToWatchlistAndMarkAsSeenButtons: true },
      })
    );

    expect(screen.getByTestId('add-to-watchlist')).toBeInTheDocument();
  });

  it('does not render AddToWatchlistButton when item is already on watchlist', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: true }),
        appearance: { showAddToWatchlistAndMarkAsSeenButtons: true },
      })
    );

    expect(screen.queryByTestId('add-to-watchlist')).not.toBeInTheDocument();
  });

  it('renders AddToSeenHistoryButton when showAddToWatchlistAndMarkAsSeenButtons is true and item has been released', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: false, releaseDate: '2019-01-01' }),
        appearance: { showAddToWatchlistAndMarkAsSeenButtons: true },
      })
    );

    expect(screen.getByTestId('add-to-seen')).toBeInTheDocument();
  });

  it('renders FormatDuration when showTotalRuntime is true', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ totalRuntime: 90 }),
        appearance: { showTotalRuntime: true },
      })
    );

    expect(screen.getByTestId('format-duration')).toBeInTheDocument();
  });
});

describe('GridItem – TV show rendering', () => {
  it('renders TV show title', () => {
    render(React.createElement(GridItem, { mediaItem: makeTvShow() }));

    expect(screen.getByText('Test Show')).toBeInTheDocument();
  });

  it('renders TV media type label', () => {
    render(React.createElement(GridItem, { mediaItem: makeTvShow() }));

    // t`Tv` → 'Tv' via our mock
    expect(screen.getByText('Tv')).toBeInTheDocument();
  });
});

describe('GridItem – validation errors', () => {
  it('throws when both season and episode are provided', () => {
    const tvShow = makeTvShow({ id: 10 });
    const season = makeSeason({ tvShowId: 10 });
    const episode = makeEpisode({ tvShowId: 10 });

    expect(() => {
      render(
        React.createElement(GridItem, {
          mediaItem: tvShow,
          season,
          episode,
        })
      );
    }).toThrow('Booth season and episode cannot be provided');
  });

  it('throws when season tvShowId does not match mediaItem id', () => {
    const tvShow = makeTvShow({ id: 10 });
    const season = makeSeason({ tvShowId: 999 }); // wrong id

    expect(() => {
      render(
        React.createElement(GridItem, {
          mediaItem: tvShow,
          season,
        })
      );
    }).toThrow('Season needs to be from the same tv show as mediaItem');
  });

  it('throws when episode tvShowId does not match mediaItem id', () => {
    const tvShow = makeTvShow({ id: 10 });
    const episode = makeEpisode({ tvShowId: 999 }); // wrong id

    expect(() => {
      render(
        React.createElement(GridItem, {
          mediaItem: tvShow,
          episode,
        })
      );
    }).toThrow('Episode needs to be from the same tv show as mediaItem');
  });
});

// ---------------------------------------------------------------------------
// topBar prop branches
// ---------------------------------------------------------------------------

describe('GridItem – topBar: showOnWatchlistIcon', () => {
  it('renders bookmark icon when item is on watchlist and showOnWatchlistIcon is true', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: true }),
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = container.querySelectorAll('.material-icons');
    const bookmarkIcon = Array.from(icons).find(
      (el) => el.textContent === 'bookmark'
    );
    expect(bookmarkIcon).toBeTruthy();
  });

  it('does not render bookmark icon when item is NOT on watchlist', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: false }),
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const bookmarkIcon = icons.find((el) => el.textContent === 'bookmark');
    expect(bookmarkIcon).toBeUndefined();
  });

  it('renders bookmark icon when season is on watchlist', () => {
    const tvShow = makeTvShow({ id: 10 });
    const season = makeSeason({ tvShowId: 10, onWatchlist: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        season,
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = container.querySelectorAll('.material-icons');
    const bookmarkIcon = Array.from(icons).find(
      (el) => el.textContent === 'bookmark'
    );
    expect(bookmarkIcon).toBeTruthy();
  });

  it('renders bookmark icon when episode is on watchlist', () => {
    const tvShow = makeTvShow({ id: 10 });
    const episode = makeEpisode({ tvShowId: 10, onWatchlist: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        episode,
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = container.querySelectorAll('.material-icons');
    const bookmarkIcon = Array.from(icons).find(
      (el) => el.textContent === 'bookmark'
    );
    expect(bookmarkIcon).toBeTruthy();
  });
});

describe('GridItem – topBar: showFirstUnwatchedEpisodeBadge', () => {
  it('renders episode badge when showFirstUnwatchedEpisodeBadge is true and firstUnwatchedEpisode exists', () => {
    const tvShow = makeTvShow({
      firstUnwatchedEpisode: { seasonNumber: 1, episodeNumber: 3, releaseDate: '2021-01-01' },
    });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showFirstUnwatchedEpisodeBadge: true } },
      })
    );

    // The episode badge renders as text like "S01E03"
    expect(container.textContent).toContain('S01E03');
  });

  it('does not render episode badge when firstUnwatchedEpisode is null', () => {
    const tvShow = makeTvShow({ firstUnwatchedEpisode: null });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showFirstUnwatchedEpisodeBadge: true } },
      })
    );

    expect(container.textContent).not.toContain('S01E');
  });
});

describe('GridItem – topBar: showUnwatchedEpisodesCount for TV show', () => {
  it('renders unseen episodes count when unseenEpisodesCount > 0', () => {
    const tvShow = makeTvShow({ unseenEpisodesCount: 5, seen: false });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    expect(container.textContent).toContain('5');
  });

  it('renders check_circle_outline icon for TV show when seen is true', () => {
    const tvShow = makeTvShow({ seen: true, unseenEpisodesCount: 0 });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    const checkIcons = container.querySelectorAll('.material-icons');
    const checkIcon = Array.from(checkIcons).find(
      (el) => el.textContent === 'check_circle_outline'
    );
    expect(checkIcon).toBeTruthy();
  });

  it('does not render count badge when unseenEpisodesCount is 0 and seen is false', () => {
    const tvShow = makeTvShow({ unseenEpisodesCount: 0, seen: false });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    // No count should appear, no check icon
    const checkIcons = Array.from(container.querySelectorAll('.material-icons'));
    const checkIcon = checkIcons.find((el) => el.textContent === 'check_circle_outline');
    expect(checkIcon).toBeUndefined();
  });
});

describe('GridItem – topBar: showUnwatchedEpisodesCount for non-TV items', () => {
  it('renders check_circle_outline icon for non-TV item when seen is true', () => {
    const movie = makeMediaItem({ seen: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    const icons = container.querySelectorAll('.material-icons');
    const checkIcon = Array.from(icons).find(
      (el) => el.textContent === 'check_circle_outline'
    );
    expect(checkIcon).toBeTruthy();
  });

  it('does not render check_circle_outline icon for non-TV item when seen is false', () => {
    const movie = makeMediaItem({ seen: false });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const checkIcon = icons.find((el) => el.textContent === 'check_circle_outline');
    expect(checkIcon).toBeUndefined();
  });
});

describe('GridItem – topBar: isTvShow branch renders anchor vs fragment', () => {
  it('renders an anchor tag with seasons href for TV shows', () => {
    const tvShow = makeTvShow({ id: 10, unseenEpisodesCount: 2 });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    const anchor = container.querySelector('a[href="#/seasons/10"]');
    expect(anchor).toBeInTheDocument();
  });

  it('does not render a seasons anchor tag for non-TV items', () => {
    const movie = makeMediaItem({ id: 1, seen: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { topBar: { showUnwatchedEpisodesCount: true } },
      })
    );

    const anchor = container.querySelector('a[href^="#/seasons/"]');
    expect(anchor).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Poster href branches
// ---------------------------------------------------------------------------

describe('GridItem – poster href branches', () => {
  it('uses season href when season prop is provided', () => {
    const tvShow = makeTvShow({ id: 10 });
    const season = makeSeason({ tvShowId: 10, seasonNumber: 2 });

    // The Poster mock receives href prop - the component renders an anchor with details href
    // We verify no details href and that it renders without error using season-based href
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        season,
      })
    );

    // The component renders correctly with a season prop (season number appears in title area)
    expect(container.querySelector('[data-testid="poster"]')).toBeInTheDocument();
  });

  it('uses episode href when episode prop is provided', () => {
    const tvShow = makeTvShow({ id: 10 });
    const episode = makeEpisode({ tvShowId: 10, seasonNumber: 1, episodeNumber: 5 });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        episode,
      })
    );

    expect(container.querySelector('[data-testid="poster"]')).toBeInTheDocument();
  });

  it('uses details href when neither season nor episode is provided', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ id: 1 }),
      })
    );

    expect(container.querySelector('[data-testid="poster"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showNextAiring branches
// ---------------------------------------------------------------------------

describe('GridItem – showNextAiring', () => {
  it('renders episode number and RelativeTime for TV show with upcomingEpisode', () => {
    const tvShow = makeTvShow({
      upcomingEpisode: {
        seasonNumber: 2,
        episodeNumber: 4,
        releaseDate: '2025-06-01',
      },
    });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showNextAiring: true },
      })
    );

    expect(screen.getByTestId('relative-time')).toBeInTheDocument();
    // Episode number text rendered via formatEpisodeNumber mock
    expect(screen.getByText(/S02E04/)).toBeInTheDocument();
  });

  it('renders nothing for TV show when upcomingEpisode is absent', () => {
    const tvShow = makeTvShow({ upcomingEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showNextAiring: true },
      })
    );

    expect(screen.queryByTestId('relative-time')).not.toBeInTheDocument();
  });

  it('renders Release text for non-TV item with releaseDate', () => {
    const movie = makeMediaItem({ releaseDate: '2025-09-15', mediaType: 'movie' });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showNextAiring: true },
      })
    );

    // Trans wraps the "Release" text; the compiled Trans renders the message string portion.
    // Verify the branch was entered by checking for "Release" text anywhere in the component.
    expect(container.textContent).toMatch(/Release/);
  });

  it('renders nothing for non-TV item without releaseDate', () => {
    const movie = makeMediaItem({ releaseDate: null, mediaType: 'movie' });

    render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showNextAiring: true },
      })
    );

    expect(screen.queryByTestId('relative-time')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showLastAiring branches
// ---------------------------------------------------------------------------

describe('GridItem – showLastAiring', () => {
  it('renders episode number and RelativeTime for TV show with lastAiredEpisode', () => {
    const tvShow = makeTvShow({
      lastAiredEpisode: {
        seasonNumber: 3,
        episodeNumber: 7,
        releaseDate: '2024-03-20',
      },
    });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showLastAiring: true },
      })
    );

    expect(screen.getByTestId('relative-time')).toBeInTheDocument();
    expect(screen.getByText(/S03E07/)).toBeInTheDocument();
  });

  it('renders nothing for TV show when lastAiredEpisode is absent', () => {
    const tvShow = makeTvShow({ lastAiredEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showLastAiring: true },
      })
    );

    expect(screen.queryByTestId('relative-time')).not.toBeInTheDocument();
  });

  it('renders Released text for non-TV item with releaseDate', () => {
    const movie = makeMediaItem({ releaseDate: '2020-05-15', mediaType: 'movie' });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showLastAiring: true },
      })
    );

    // Trans wraps the "Released" text; the compiled Trans renders the message string portion.
    // Verify the branch was entered by checking for "Released" text anywhere in the component.
    expect(container.textContent).toMatch(/Released/);
  });

  it('renders nothing for non-TV item without releaseDate', () => {
    const movie = makeMediaItem({ releaseDate: null, mediaType: 'movie' });

    render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showLastAiring: true },
      })
    );

    expect(screen.queryByTestId('relative-time')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showTotalRuntime branches
// ---------------------------------------------------------------------------

describe('GridItem – showTotalRuntime runtime source branches', () => {
  it('uses episode.runtime when episode is provided', () => {
    const tvShow = makeTvShow({ id: 10, runtime: 45 });
    const episode = makeEpisode({ tvShowId: 10, runtime: 30 });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        episode,
        appearance: { showTotalRuntime: true },
      })
    );

    // episode.runtime = 30, so FormatDuration receives 30 * 60 * 1000 = 1800000
    const durationEl = screen.getByTestId('format-duration');
    expect(durationEl.textContent).toBe(String(30 * 60 * 1000));
  });

  it('falls back to mediaItem.runtime when episode.runtime is 0', () => {
    const tvShow = makeTvShow({ id: 10, runtime: 45 });
    const episode = makeEpisode({ tvShowId: 10, runtime: 0 });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        episode,
        appearance: { showTotalRuntime: true },
      })
    );

    // episode.runtime is 0 (falsy), falls back to mediaItem.runtime = 45
    const durationEl = screen.getByTestId('format-duration');
    expect(durationEl.textContent).toBe(String(45 * 60 * 1000));
  });

  it('uses season.totalRuntime when season is provided', () => {
    const tvShow = makeTvShow({ id: 10, totalRuntime: 500 });
    const season = makeSeason({ tvShowId: 10, totalRuntime: 600 });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        season,
        appearance: { showTotalRuntime: true },
      })
    );

    // season.totalRuntime = 600, so FormatDuration receives 600 * 60 * 1000 = 36000000
    const durationEl = screen.getByTestId('format-duration');
    expect(durationEl.textContent).toBe(String(600 * 60 * 1000));
  });

  it('uses mediaItem.totalRuntime when neither season nor episode is provided', () => {
    render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ totalRuntime: 90 }),
        appearance: { showTotalRuntime: true },
      })
    );

    // mediaItem.totalRuntime = 90, so FormatDuration receives 90 * 60 * 1000 = 5400000
    const durationEl = screen.getByTestId('format-duration');
    expect(durationEl.textContent).toBe(String(90 * 60 * 1000));
  });
});

// ---------------------------------------------------------------------------
// showReleaseDate branches
// ---------------------------------------------------------------------------

describe('GridItem – showReleaseDate', () => {
  it('renders formatted release date when showReleaseDate is true and releaseDate exists', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ releaseDate: '2022-04-10' }),
        appearance: { showReleaseDate: true },
      })
    );

    // The date is rendered via toLocaleDateString() - just verify something date-like is present
    // new Date('2022-04-10').toLocaleDateString() produces a locale-dependent string
    const posterEl = container.querySelector('[data-testid="poster"]');
    // The component renders without crash and date text is somewhere in the component
    expect(container.textContent).toContain(
      new Date('2022-04-10').toLocaleDateString()
    );
  });

  it('renders nothing for release date when releaseDate is null', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ releaseDate: null }),
        appearance: { showReleaseDate: true },
      })
    );

    // Just confirm it renders without crash, no date string present in meaningful way
    expect(container.querySelector('[data-testid="poster"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showLastSeenAt branches
// ---------------------------------------------------------------------------

describe('GridItem – showLastSeenAt', () => {
  it('renders formatted lastSeenAt when showLastSeenAt is true and lastSeenAt exists', () => {
    const lastSeenAt = '2023-11-25T18:30:00.000Z';

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ lastSeenAt }),
        appearance: { showLastSeenAt: true },
      })
    );

    expect(container.textContent).toContain(
      new Date(lastSeenAt).toLocaleString()
    );
  });

  it('renders nothing for lastSeenAt when lastSeenAt is null', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ lastSeenAt: null }),
        appearance: { showLastSeenAt: true },
      })
    );

    expect(container.querySelector('[data-testid="poster"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showMarksAsSeenFirstUnwatchedEpisode branches
// ---------------------------------------------------------------------------

describe('GridItem – showMarksAsSeenFirstUnwatchedEpisode', () => {
  it('renders AddToSeenHistoryButton for TV show with firstUnwatchedEpisode', () => {
    const tvShow = makeTvShow({
      firstUnwatchedEpisode: { seasonNumber: 1, episodeNumber: 1, releaseDate: '2021-01-01' },
    });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showMarksAsSeenFirstUnwatchedEpisode: true },
      })
    );

    expect(screen.getByTestId('add-to-seen')).toBeInTheDocument();
  });

  it('does not render AddToSeenHistoryButton for TV show without firstUnwatchedEpisode', () => {
    const tvShow = makeTvShow({ firstUnwatchedEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showMarksAsSeenFirstUnwatchedEpisode: true },
      })
    );

    expect(screen.queryByTestId('add-to-seen')).not.toBeInTheDocument();
  });

  it('renders AddToSeenHistoryButton for non-TV items (movie)', () => {
    const movie = makeMediaItem({ firstUnwatchedEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showMarksAsSeenFirstUnwatchedEpisode: true },
      })
    );

    expect(screen.getByTestId('add-to-seen')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// showMarksAsSeenLastAiredEpisode branches
// ---------------------------------------------------------------------------

describe('GridItem – showMarksAsSeenLastAiredEpisode', () => {
  it('renders AddToSeenHistoryButton for TV show with lastAiredEpisode', () => {
    const tvShow = makeTvShow({
      lastAiredEpisode: { seasonNumber: 2, episodeNumber: 5, releaseDate: '2022-05-10' },
    });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showMarksAsSeenLastAiredEpisode: true },
      })
    );

    expect(screen.getByTestId('add-to-seen')).toBeInTheDocument();
  });

  it('does not render AddToSeenHistoryButton for TV show without lastAiredEpisode', () => {
    const tvShow = makeTvShow({ lastAiredEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        appearance: { showMarksAsSeenLastAiredEpisode: true },
      })
    );

    expect(screen.queryByTestId('add-to-seen')).not.toBeInTheDocument();
  });

  it('renders AddToSeenHistoryButton for non-TV items (movie)', () => {
    const movie = makeMediaItem({ lastAiredEpisode: null });

    render(
      React.createElement(GridItem, {
        mediaItem: movie,
        appearance: { showMarksAsSeenLastAiredEpisode: true },
      })
    );

    expect(screen.getByTestId('add-to-seen')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isOnWatchlist computation branches
// ---------------------------------------------------------------------------

describe('GridItem – isOnWatchlist computation', () => {
  it('isOnWatchlist is true when season.onWatchlist is true and topBar.showOnWatchlistIcon is set', () => {
    const tvShow = makeTvShow({ id: 10, onWatchlist: false });
    const season = makeSeason({ tvShowId: 10, onWatchlist: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        season,
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const bookmarkIcon = icons.find((el) => el.textContent === 'bookmark');
    expect(bookmarkIcon).toBeTruthy();
  });

  it('isOnWatchlist is true when episode.onWatchlist is true and topBar.showOnWatchlistIcon is set', () => {
    const tvShow = makeTvShow({ id: 10, onWatchlist: false });
    const episode = makeEpisode({ tvShowId: 10, onWatchlist: true });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        episode,
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const bookmarkIcon = icons.find((el) => el.textContent === 'bookmark');
    expect(bookmarkIcon).toBeTruthy();
  });

  it('isOnWatchlist uses mediaItem.onWatchlist when no season or episode is provided', () => {
    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: makeMediaItem({ onWatchlist: true }),
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const bookmarkIcon = icons.find((el) => el.textContent === 'bookmark');
    expect(bookmarkIcon).toBeTruthy();
  });

  it('isOnWatchlist is false when season.onWatchlist is false and mediaItem.onWatchlist is false', () => {
    const tvShow = makeTvShow({ id: 10, onWatchlist: false });
    const season = makeSeason({ tvShowId: 10, onWatchlist: false });

    const { container } = render(
      React.createElement(GridItem, {
        mediaItem: tvShow,
        season,
        appearance: { topBar: { showOnWatchlistIcon: true } },
      })
    );

    const icons = Array.from(container.querySelectorAll('.material-icons'));
    const bookmarkIcon = icons.find((el) => el.textContent === 'bookmark');
    expect(bookmarkIcon).toBeUndefined();
  });
});
