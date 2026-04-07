/**
 * Tests for the DetailsPage metadata info card (issue #59).
 *
 * Covers:
 *  - TMDB rating displayed as plain text ("X.X / 10")
 *  - TMDB rating absent when tmdbRating is null/undefined
 *  - Director rendered as a clickable facet pill linking to /movies?creators=...
 *  - Creator (TV) rendered as a clickable facet pill linking to /tv?creators=...
 *  - Developer (game) rendered as a clickable facet pill linking to /games?creators=...
 *  - Publisher (game) rendered as a clickable facet pill linking to /games?publishers=...
 *  - Authors rendered as clickable facet pills linking to /books?creators=...
 *  - Narrators remain plain text (not links)
 *  - Empty authors / narrators arrays do not render metadata rows
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { MediaItemDetailsResponse } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Mocks
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

jest.mock('src/components/StarRating', () => ({ BadgeRating: () => null }));
jest.mock('src/components/MetadataLocaleBadge', () => ({ MetadataLocaleBadge: () => null }));
jest.mock('src/components/SelectSeenDate', () => ({ SelectSeenDate: () => null }));
jest.mock('src/components/SetProgress', () => ({ SetProgressComponent: () => null }));
jest.mock('src/components/AddToListModal', () => ({ AddToListButtonWithModal: () => null }));
jest.mock('src/components/AddAndRemoveFromSeenHistoryButton', () => ({
  AddToSeenHistoryButton: () => null,
  RemoveFromSeenHistoryButton: () => null,
}));
jest.mock('src/components/Poster', () => ({ Poster: () => null }));
jest.mock('src/components/date', () => ({
  FormatDuration: () => null,
  RelativeTime: () => null,
}));
jest.mock('src/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
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
      {openModal?.(() => null)}
      {children?.(() => null)}
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
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMediaItem(
  overrides: Partial<MediaItemDetailsResponse> = {}
): MediaItemDetailsResponse {
  return {
    id: 1,
    title: 'Test Item',
    mediaType: 'movie',
    source: 'tmdb',
    seenHistory: [],
    onWatchlist: null,
    userRating: null,
    relatedContent: [],
    ...overrides,
  } as unknown as MediaItemDetailsResponse;
}

function setup(overrides: Partial<MediaItemDetailsResponse> = {}) {
  (useDetails as jest.Mock).mockReturnValue({
    isLoading: false,
    error: undefined,
    mediaItem: makeMediaItem(overrides),
  });
}

// ---------------------------------------------------------------------------
// TMDB Rating
// ---------------------------------------------------------------------------

describe('DetailsPage – TMDB rating metadata', () => {
  beforeEach(() => jest.clearAllMocks());

  it('displays tmdbRating formatted as "X.X / 10"', () => {
    setup({ tmdbRating: 7.4 });
    render(<DetailsPage />);
    expect(screen.getByText('7.4 / 10')).toBeInTheDocument();
  });

  it('displays a whole number rating with one decimal place', () => {
    setup({ tmdbRating: 8 });
    render(<DetailsPage />);
    expect(screen.getByText('8.0 / 10')).toBeInTheDocument();
  });

  it('omits the Rating row when tmdbRating is null', () => {
    setup({ tmdbRating: null });
    render(<DetailsPage />);
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
  });

  it('omits the Rating row when tmdbRating is undefined', () => {
    setup({ tmdbRating: undefined });
    render(<DetailsPage />);
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Director (movies)
// ---------------------------------------------------------------------------

describe('DetailsPage – Director metadata', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders director name as a clickable link', () => {
    setup({ mediaType: 'movie', director: 'Christopher Nolan' });
    render(<DetailsPage />);
    expect(screen.getByText('Christopher Nolan')).toBeInTheDocument();
    const link = screen.getByText('Christopher Nolan').closest('a');
    expect(link).toHaveAttribute('data-to', '/movies?creators=Christopher+Nolan');
  });

  it('omits Director row when director is null', () => {
    setup({ mediaType: 'movie', director: null });
    render(<DetailsPage />);
    expect(screen.queryByText('Director')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Creator (TV shows)
// ---------------------------------------------------------------------------

describe('DetailsPage – Creator metadata (TV)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders creator name as a clickable link for TV shows', () => {
    setup({ mediaType: 'tv', creator: 'Vince Gilligan' });
    render(<DetailsPage />);
    expect(screen.getByText('Vince Gilligan')).toBeInTheDocument();
    const link = screen.getByText('Vince Gilligan').closest('a');
    expect(link).toHaveAttribute('data-to', '/tv?creators=Vince+Gilligan');
  });

  it('omits Creator row when creator is null', () => {
    setup({ mediaType: 'tv', creator: null });
    render(<DetailsPage />);
    expect(screen.queryByText('Creator')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Developer (games)
// ---------------------------------------------------------------------------

describe('DetailsPage – Developer metadata (game)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders developer name as a clickable link for games', () => {
    setup({ mediaType: 'video_game', developer: 'Nintendo' });
    render(<DetailsPage />);
    expect(screen.getByText('Nintendo')).toBeInTheDocument();
    const link = screen.getByText('Nintendo').closest('a');
    expect(link).toHaveAttribute('data-to', '/games?creators=Nintendo');
  });

  it('omits Developer row when developer is null', () => {
    setup({ mediaType: 'video_game', developer: null });
    render(<DetailsPage />);
    expect(screen.queryByText('Developer')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Publisher (games)
// ---------------------------------------------------------------------------

describe('DetailsPage – Publisher metadata (game)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders publisher name as a clickable link for games', () => {
    setup({ mediaType: 'video_game', publisher: 'Sony Interactive' });
    render(<DetailsPage />);
    expect(screen.getByText('Sony Interactive')).toBeInTheDocument();
    const link = screen.getByText('Sony Interactive').closest('a');
    expect(link).toHaveAttribute('data-to', '/games?publishers=Sony+Interactive');
  });

  it('omits Publisher row when publisher is null', () => {
    setup({ mediaType: 'video_game', publisher: null });
    render(<DetailsPage />);
    expect(screen.queryByText('Publisher')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Authors (books / audiobooks)
// ---------------------------------------------------------------------------

describe('DetailsPage – Authors metadata (book)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders each author as a clickable link for books', () => {
    setup({ mediaType: 'book', authors: ['J.R.R. Tolkien', 'C.S. Lewis'] });
    render(<DetailsPage />);
    const tolkien = screen.getByText('J.R.R. Tolkien').closest('a');
    expect(tolkien).toHaveAttribute('data-to', '/books?creators=J.R.R.+Tolkien');
    const lewis = screen.getByText('C.S. Lewis').closest('a');
    expect(lewis).toHaveAttribute('data-to', '/books?creators=C.S.+Lewis');
  });

  it('renders authors sorted alphabetically', () => {
    setup({ mediaType: 'book', authors: ['Zzz Author', 'Aaa Author'] });
    render(<DetailsPage />);
    const pills = screen.getAllByText(/Author$/);
    expect(pills[0]).toHaveTextContent('Aaa Author');
    expect(pills[1]).toHaveTextContent('Zzz Author');
  });

  it('renders all authors as separate clickable pills', () => {
    setup({ mediaType: 'book', authors: ['Alice', 'Bob', 'Carol'] });
    render(<DetailsPage />);
    expect(screen.getByText('Alice').closest('a')).toHaveAttribute('data-to', '/books?creators=Alice');
    expect(screen.getByText('Bob').closest('a')).toHaveAttribute('data-to', '/books?creators=Bob');
    expect(screen.getByText('Carol').closest('a')).toHaveAttribute('data-to', '/books?creators=Carol');
  });

  it('omits Authors row when authors array is empty', () => {
    setup({ mediaType: 'book', authors: [] });
    render(<DetailsPage />);
    expect(screen.queryByText('Author')).not.toBeInTheDocument();
    expect(screen.queryByText('Authors')).not.toBeInTheDocument();
  });

  it('omits Authors row when authors is null', () => {
    setup({ mediaType: 'book', authors: null as any });
    render(<DetailsPage />);
    expect(screen.queryByText('Author')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Narrators (audiobooks) — remain plain text, not clickable
// ---------------------------------------------------------------------------

describe('DetailsPage – Narrators metadata (audiobook)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders narrator names as plain text (not links)', () => {
    setup({ mediaType: 'audiobook', narrators: ['James Earl Jones'] });
    render(<DetailsPage />);
    const el = screen.getByText('James Earl Jones');
    expect(el).toBeInTheDocument();
    expect(el.closest('a')).toBeNull();
  });

  it('renders multiple narrators comma-separated', () => {
    setup({ mediaType: 'audiobook', narrators: ['Alice', 'Bob'] });
    render(<DetailsPage />);
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
  });

  it('omits Narrators row when narrators array is empty', () => {
    setup({ mediaType: 'audiobook', narrators: [] });
    render(<DetailsPage />);
    expect(screen.queryByText('Narrator')).not.toBeInTheDocument();
    expect(screen.queryByText('Narrators')).not.toBeInTheDocument();
  });
});
