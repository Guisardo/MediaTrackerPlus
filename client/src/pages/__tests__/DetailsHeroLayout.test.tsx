/**
 * Tests for the redesigned DetailsPage hero strip and layout (issue #41).
 *
 * Covers:
 *  - Title renders as an <h1> element
 *  - Release year extracted from releaseDate and shown in hero strip
 *  - Genre pills rendered for items that have genres
 *  - Overview shown as a standalone paragraph
 *  - MediaTypeBadge renders the correct label for each media type
 *  - "Episodes page" CTA button appears only for TV shows
 *  - Watchlist button shown (add vs remove) based on watchlist state
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { MediaItemDetailsResponse } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports of the module under test
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    t: (strings: TemplateStringsArray | string, ...values: unknown[]) => {
      if (typeof strings === 'string') return strings;
      if ((strings as TemplateStringsArray).raw)
        return String.raw(strings as TemplateStringsArray, ...values);
      return (strings as TemplateStringsArray)[0];
    },
    Plural: ({ value, one, other }: { value: number; one: string; other: string }) =>
      React.createElement(
        React.Fragment,
        null,
        value === 1 ? one : other.replace('#', String(value))
      ),
  };
});

jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({
      i18n: {
        _: (msg: any) =>
          typeof msg === 'string' ? msg : msg?.message || msg?.id || '',
        locale: 'en',
      },
    }),
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('src/components/StarRating', () => ({
  BadgeRating: () => null,
}));

jest.mock('src/components/MetadataLocaleBadge', () => ({
  MetadataLocaleBadge: () => null,
}));

jest.mock('src/components/SelectSeenDate', () => ({
  SelectSeenDate: () => null,
}));

jest.mock('src/components/SetProgress', () => ({
  SetProgressComponent: () => null,
}));

jest.mock('src/components/AddToListModal', () => ({
  AddToListButtonWithModal: () => null,
}));

jest.mock('src/components/AddAndRemoveFromSeenHistoryButton', () => ({
  AddToSeenHistoryButton: () => null,
  RemoveFromSeenHistoryButton: () => null,
}));

jest.mock('src/components/Poster', () => ({
  Poster: () => null,
}));

jest.mock('src/components/date', () => ({
  FormatDuration: () => null,
  RelativeTime: () => null,
}));

jest.mock('src/components/ui/button', () => ({
  Button: ({ children, onClick, asChild, className, ...props }: any) => (
    <button className={className} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('src/components/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('src/components/DetailsRelatedContentSection', () => ({
  DetailsRelatedContentSection: () => null,
}));

jest.mock('src/components/Modal', () => ({
  Modal: ({ children, openModal }: any) => (
    <>
      {openModal?.(() => {})}
      {children?.(() => {})}
    </>
  ),
}));

jest.mock('src/api/details', () => ({
  useDetails: jest.fn(),
  useUpdateMetadata: jest.fn(() => ({ updateMetadata: jest.fn(), isLoading: false, isError: false })),
  addToProgress: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
  markAsSeen: jest.fn(),
}));

jest.mock('src/api/user', () => ({
  useOtherUser: jest.fn(() => ({ user: null, isLoading: false })),
  useUser: jest.fn(() => ({ user: null })),
}));

jest.mock('src/api/configuration', () => ({
  useConfiguration: jest.fn(() => ({ configuration: null })),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => ({ mediaItemId: '1' })),
  Link: ({ children, to }: any) => <a href="#" data-to={String(to)}>{children}</a>,
}));

// ---------------------------------------------------------------------------
// Import component under test after mocks
// ---------------------------------------------------------------------------

import { DetailsPage } from 'src/pages/Details';
import { useDetails } from 'src/api/details';

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeMediaItem(
  overrides: Partial<MediaItemDetailsResponse> = {}
): MediaItemDetailsResponse {
  return {
    id: 1,
    title: 'Test Movie',
    mediaType: 'movie',
    releaseDate: '2020-06-15',
    overview: 'A great film about testing.',
    genres: ['Action', 'Drama'],
    source: 'tmdb',
    seenHistory: [],
    onWatchlist: null,
    userRating: null,
    relatedContent: [],
    ...overrides,
  } as unknown as MediaItemDetailsResponse;
}

function setupDetails(overrides: Partial<MediaItemDetailsResponse> = {}) {
  (useDetails as jest.Mock).mockReturnValue({
    isLoading: false,
    error: undefined,
    mediaItem: makeMediaItem(overrides),
  });
}

// ---------------------------------------------------------------------------
// Title renders as <h1>
// ---------------------------------------------------------------------------

describe('DetailsPage – title', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the media item title as an h1 element', () => {
    setupDetails({ title: 'Inception' });
    render(<DetailsPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Inception');
  });
});

// ---------------------------------------------------------------------------
// Release year
// ---------------------------------------------------------------------------

describe('DetailsPage – release year', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the year extracted from releaseDate in the hero strip', () => {
    setupDetails({ releaseDate: '2023-11-24' });
    render(<DetailsPage />);
    expect(screen.getByText('2023')).toBeInTheDocument();
  });

  it('omits the year when releaseDate is absent', () => {
    setupDetails({ releaseDate: undefined });
    render(<DetailsPage />);
    // Years are 4-digit strings; none of 2020 etc. should appear
    expect(screen.queryByText(/^\d{4}$/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Genre chips
// ---------------------------------------------------------------------------

describe('DetailsPage – genre chips', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders each genre as a visible chip', () => {
    setupDetails({ genres: ['Sci-Fi', 'Thriller'] });
    render(<DetailsPage />);
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByText('Thriller')).toBeInTheDocument();
  });

  it('renders genres in sorted order', () => {
    setupDetails({ genres: ['Thriller', 'Action', 'Drama'] });
    render(<DetailsPage />);
    const chips = screen.getAllByText(/^(Action|Drama|Thriller)$/);
    const texts = chips.map((el) => el.textContent);
    expect(texts).toEqual(['Action', 'Drama', 'Thriller']);
  });

  it('renders nothing for genres when the array is empty', () => {
    setupDetails({ genres: [] });
    render(<DetailsPage />);
    // No genre chips; checking a known genre absence
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
  });

  it('renders nothing for genres when the field is absent', () => {
    setupDetails({ genres: undefined });
    render(<DetailsPage />);
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

describe('DetailsPage – overview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the overview text', () => {
    setupDetails({ overview: 'An epic space adventure.' });
    render(<DetailsPage />);
    expect(screen.getByText('An epic space adventure.')).toBeInTheDocument();
  });

  it('omits the overview block when overview is absent', () => {
    setupDetails({ overview: undefined });
    render(<DetailsPage />);
    expect(screen.queryByText(/epic space/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MediaTypeBadge — rendered via DetailsPage hero strip
// ---------------------------------------------------------------------------

describe('DetailsPage – MediaTypeBadge', () => {
  beforeEach(() => jest.clearAllMocks());

  const cases: Array<[MediaItemDetailsResponse['mediaType'], string]> = [
    ['movie', 'Movie'],
    ['tv', 'TV Show'],
    ['book', 'Book'],
    ['audiobook', 'Audiobook'],
    ['video_game', 'Game'],
  ];

  test.each(cases)(
    'renders "%s" badge label for mediaType=%s',
    (mediaType, expectedLabel) => {
      setupDetails({ mediaType });
      render(<DetailsPage />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    }
  );
});

// ---------------------------------------------------------------------------
// Episodes page CTA
// ---------------------------------------------------------------------------

describe('DetailsPage – Episodes page button', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the "Episodes page" button for TV shows', () => {
    setupDetails({
      mediaType: 'tv',
      numberOfSeasons: 3,
      numberOfEpisodes: 30,
    });
    render(<DetailsPage />);
    expect(
      screen.getByRole('link', { name: /episodes page/i })
    ).toBeInTheDocument();
  });

  it('does NOT show the "Episodes page" button for movies', () => {
    setupDetails({ mediaType: 'movie' });
    render(<DetailsPage />);
    expect(
      screen.queryByRole('link', { name: /episodes page/i })
    ).not.toBeInTheDocument();
  });

  it('links to the /seasons/:id route for TV shows', () => {
    setupDetails({ id: 42, mediaType: 'tv' } as any);
    render(<DetailsPage />);
    const link = screen.getByRole('link', { name: /episodes page/i });
    expect(link).toHaveAttribute('data-to', '/seasons/42');
  });
});

// ---------------------------------------------------------------------------
// Watchlist CTA
// ---------------------------------------------------------------------------

describe('DetailsPage – watchlist CTA', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "Add to watchlist" when item is NOT on watchlist', () => {
    setupDetails({ onWatchlist: null });
    render(<DetailsPage />);
    expect(
      screen.getByRole('button', { name: /add to watchlist/i })
    ).toBeInTheDocument();
  });

  it('shows "Remove from watchlist" when item IS on watchlist', () => {
    setupDetails({
      onWatchlist: true,
    } as any);
    render(<DetailsPage />);
    expect(
      screen.getByRole('button', { name: /remove from watchlist/i })
    ).toBeInTheDocument();
  });
});
