/**
 * Tests for src/components/Facets/ActiveFacetChips.tsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

jest.mock('src/utils', () => ({
  isAudiobook: jest.fn().mockReturnValue(false),
  isBook: jest.fn().mockReturnValue(false),
  isVideoGame: jest.fn().mockReturnValue(false),
}));

import { ActiveFacetChips } from 'src/components/Facets/ActiveFacetChips';
import type { UseFacetsResult } from 'src/hooks/facets';

// ---------------------------------------------------------------------------
// Factory for mock facets
// ---------------------------------------------------------------------------

const makeFacets = (overrides: Partial<UseFacetsResult> = {}): UseFacetsResult => ({
  genres: [],
  setGenres: jest.fn(),
  languages: [],
  setLanguages: jest.fn(),
  creators: [],
  setCreators: jest.fn(),
  publishers: [],
  setPublishers: jest.fn(),
  mediaTypes: [],
  setMediaTypes: jest.fn(),
  status: [],
  setStatus: jest.fn(),
  yearMin: null,
  setYearMin: jest.fn(),
  yearMax: null,
  setYearMax: jest.fn(),
  ratingMin: null,
  setRatingMin: jest.fn(),
  ratingMax: null,
  setRatingMax: jest.fn(),
  activeFacetCount: 0,
  clearAllFacets: jest.fn(),
  facetParams: {},
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActiveFacetChips', () => {
  it('renders nothing when activeFacetCount is 0', () => {
    const { container } = render(
      React.createElement(ActiveFacetChips, { facets: makeFacets() })
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders genre chips for each selected genre', () => {
    const setGenres = jest.fn();
    const facets = makeFacets({
      genres: ['Action', 'Drama'],
      setGenres,
      activeFacetCount: 1,
    });

    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
  });

  it('renders the "Clear all" button when there are active facets', () => {
    const facets = makeFacets({
      genres: ['Action'],
      activeFacetCount: 1,
    });

    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
  });

  it('calls clearAllFacets when "Clear all" button is clicked', async () => {
    const clearAllFacets = jest.fn();
    const facets = makeFacets({
      genres: ['Action'],
      activeFacetCount: 1,
      clearAllFacets,
    });
    const user = userEvent.setup();

    render(React.createElement(ActiveFacetChips, { facets }));

    await user.click(screen.getByRole('button', { name: /clear all/i }));

    expect(clearAllFacets).toHaveBeenCalledTimes(1);
  });

  it('calls setGenres with value removed when a genre chip × is clicked', async () => {
    const setGenres = jest.fn();
    const facets = makeFacets({
      genres: ['Action', 'Drama'],
      setGenres,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();

    render(React.createElement(ActiveFacetChips, { facets }));

    // Find the remove button for "Action"
    const removeBtn = screen.getByRole('button', {
      name: /remove Genre: Action filter/i,
    });
    await user.click(removeBtn);

    expect(setGenres).toHaveBeenCalledWith(['Drama']);
  });

  it('renders year range chip when yearMin is set', () => {
    const facets = makeFacets({
      yearMin: 2010,
      activeFacetCount: 1,
    });

    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByText('2010–')).toBeInTheDocument();
  });

  it('renders year range chip with both bounds when yearMin and yearMax are set', () => {
    const facets = makeFacets({
      yearMin: 2010,
      yearMax: 2020,
      activeFacetCount: 1,
    });

    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByText('2010–2020')).toBeInTheDocument();
  });

  it('renders status chips', () => {
    const setStatus = jest.fn();
    const facets = makeFacets({
      status: ['rated'],
      setStatus,
      activeFacetCount: 1,
    });

    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByText('Rated')).toBeInTheDocument();
  });

  // ── Status chip label variants ──────────────────────────────────────────

  it('renders "Unrated" status chip', () => {
    const facets = makeFacets({
      status: ['unrated'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });

  it('renders "On watchlist" status chip', () => {
    const facets = makeFacets({
      status: ['watchlist'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('On watchlist')).toBeInTheDocument();
  });

  it('renders "Watched" for "seen" status by default', () => {
    const facets = makeFacets({
      status: ['seen'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('Watched')).toBeInTheDocument();
  });

  it('renders "Listened" for "seen" status with audiobook mediaType', () => {
    const { isAudiobook } = require('src/utils');
    (isAudiobook as jest.Mock).mockReturnValueOnce(true);

    const facets = makeFacets({
      status: ['seen'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'audiobook' }));
    expect(screen.getByText('Listened')).toBeInTheDocument();
  });

  it('renders "Read" for "seen" status with book mediaType', () => {
    const { isBook } = require('src/utils');
    (isBook as jest.Mock).mockReturnValueOnce(true);

    const facets = makeFacets({
      status: ['seen'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'book' }));
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('renders "Played" for "seen" status with video_game mediaType', () => {
    const { isVideoGame } = require('src/utils');
    (isVideoGame as jest.Mock).mockReturnValueOnce(true);

    const facets = makeFacets({
      status: ['seen'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'video_game' }));
    expect(screen.getByText('Played')).toBeInTheDocument();
  });

  it('renders the raw key for unknown status values', () => {
    const facets = makeFacets({
      status: ['custom_status'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('custom_status')).toBeInTheDocument();
  });

  it('removes a status chip when its remove button is clicked', async () => {
    const setStatus = jest.fn();
    const facets = makeFacets({
      status: ['rated', 'unrated'],
      setStatus,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Status: Rated filter/i,
    });
    await user.click(removeBtn);
    expect(setStatus).toHaveBeenCalledWith(['unrated']);
  });

  // ── Creator chips ───────────────────────────────────────────────────────

  it('renders creator chips with "Creator" label by default', () => {
    const facets = makeFacets({
      creators: ['John Doe'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Creator:')).toBeInTheDocument();
  });

  it('renders "Director" label for movie mediaType', () => {
    const facets = makeFacets({
      creators: ['Nolan'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'movie' }));
    expect(screen.getByText('Director:')).toBeInTheDocument();
  });

  it('renders "Creator" label for tv mediaType', () => {
    const facets = makeFacets({
      creators: ['Vince'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'tv' }));
    expect(screen.getByText('Creator:')).toBeInTheDocument();
  });

  it('renders "Author" label for book mediaType', () => {
    const facets = makeFacets({
      creators: ['Tolkien'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'book' }));
    expect(screen.getByText('Author:')).toBeInTheDocument();
  });

  it('renders "Author" label for audiobook mediaType', () => {
    const facets = makeFacets({
      creators: ['Tolkien'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'audiobook' }));
    expect(screen.getByText('Author:')).toBeInTheDocument();
  });

  it('renders "Developer" label for video_game mediaType', () => {
    const facets = makeFacets({
      creators: ['Nintendo'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets, mediaType: 'video_game' }));
    expect(screen.getByText('Developer:')).toBeInTheDocument();
  });

  it('removes a creator chip when its remove button is clicked', async () => {
    const setCreators = jest.fn();
    const facets = makeFacets({
      creators: ['Alice', 'Bob'],
      setCreators,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Creator: Alice filter/i,
    });
    await user.click(removeBtn);
    expect(setCreators).toHaveBeenCalledWith(['Bob']);
  });

  // ── Publisher chips ─────────────────────────────────────────────────────

  it('renders publisher chips', () => {
    const facets = makeFacets({
      publishers: ['Penguin', 'HarperCollins'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('Penguin')).toBeInTheDocument();
    expect(screen.getByText('HarperCollins')).toBeInTheDocument();
  });

  it('removes a publisher chip when its remove button is clicked', async () => {
    const setPublishers = jest.fn();
    const facets = makeFacets({
      publishers: ['Penguin', 'HarperCollins'],
      setPublishers,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Publisher: Penguin filter/i,
    });
    await user.click(removeBtn);
    expect(setPublishers).toHaveBeenCalledWith(['HarperCollins']);
  });

  // ── Language chips ──────────────────────────────────────────────────────

  it('renders language chips with display names', () => {
    const facets = makeFacets({
      languages: ['en'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    // Intl.DisplayNames should resolve 'en' to 'English'
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('falls back to raw code when Intl.DisplayNames throws', () => {
    // Temporarily make Intl.DisplayNames throw to trigger the catch branch
    const OrigDisplayNames = Intl.DisplayNames;
    (Intl as any).DisplayNames = class {
      constructor() {
        // constructor succeeds
      }
      of(): string {
        throw new Error('Unsupported code');
      }
    };

    const facets = makeFacets({
      languages: ['xx'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('xx')).toBeInTheDocument();

    // Restore
    (Intl as any).DisplayNames = OrigDisplayNames;
  });

  it('removes a language chip when its remove button is clicked', async () => {
    const setLanguages = jest.fn();
    const facets = makeFacets({
      languages: ['en', 'fr'],
      setLanguages,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Language: English filter/i,
    });
    await user.click(removeBtn);
    expect(setLanguages).toHaveBeenCalledWith(['fr']);
  });

  // ── Media Type chips ────────────────────────────────────────────────────

  it('renders media type chips with display labels', () => {
    const facets = makeFacets({
      mediaTypes: ['movie', 'tv', 'book', 'audiobook', 'video_game'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('Movie')).toBeInTheDocument();
    expect(screen.getByText('TV Show')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Audiobook')).toBeInTheDocument();
    expect(screen.getByText('Video game')).toBeInTheDocument();
  });

  it('renders raw value for unknown media type', () => {
    const facets = makeFacets({
      mediaTypes: ['podcast'],
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('podcast')).toBeInTheDocument();
  });

  it('removes a media type chip when its remove button is clicked', async () => {
    const setMediaTypes = jest.fn();
    const facets = makeFacets({
      mediaTypes: ['movie', 'tv'],
      setMediaTypes,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Media Type: Movie filter/i,
    });
    await user.click(removeBtn);
    expect(setMediaTypes).toHaveBeenCalledWith(['tv']);
  });

  // ── Year range chips ────────────────────────────────────────────────────

  it('renders year range chip with only yearMax (one-sided)', () => {
    const facets = makeFacets({
      yearMax: 2020,
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('\u20132020')).toBeInTheDocument();
  });

  it('clears both year bounds when year chip remove is clicked', async () => {
    const setYearMin = jest.fn();
    const setYearMax = jest.fn();
    const facets = makeFacets({
      yearMin: 2010,
      yearMax: 2020,
      setYearMin,
      setYearMax,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Year/i,
    });
    await user.click(removeBtn);
    expect(setYearMin).toHaveBeenCalledWith(null);
    expect(setYearMax).toHaveBeenCalledWith(null);
  });

  // ── Rating range chips ──────────────────────────────────────────────────

  it('renders rating range chip with both bounds', () => {
    const facets = makeFacets({
      ratingMin: 6.5,
      ratingMax: 10,
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('6.5\u201310.0')).toBeInTheDocument();
  });

  it('renders rating range chip with only ratingMin (one-sided)', () => {
    const facets = makeFacets({
      ratingMin: 7.5,
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('7.5\u2013')).toBeInTheDocument();
  });

  it('renders rating range chip with only ratingMax (one-sided)', () => {
    const facets = makeFacets({
      ratingMax: 8.0,
      activeFacetCount: 1,
    });
    render(React.createElement(ActiveFacetChips, { facets }));
    expect(screen.getByText('\u20138.0')).toBeInTheDocument();
  });

  it('clears both rating bounds when rating chip remove is clicked', async () => {
    const setRatingMin = jest.fn();
    const setRatingMax = jest.fn();
    const facets = makeFacets({
      ratingMin: 5,
      ratingMax: 9,
      setRatingMin,
      setRatingMax,
      activeFacetCount: 1,
    });
    const user = userEvent.setup();
    render(React.createElement(ActiveFacetChips, { facets }));

    const removeBtn = screen.getByRole('button', {
      name: /remove Rating/i,
    });
    await user.click(removeBtn);
    expect(setRatingMin).toHaveBeenCalledWith(null);
    expect(setRatingMax).toHaveBeenCalledWith(null);
  });

  // ── Multiple facet types at once ────────────────────────────────────────

  it('renders chips from multiple dimensions simultaneously', () => {
    const facets = makeFacets({
      genres: ['Horror'],
      languages: ['fr'],
      creators: ['Spielberg'],
      publishers: ['Universal'],
      mediaTypes: ['movie'],
      status: ['rated'],
      yearMin: 2000,
      yearMax: 2023,
      ratingMin: 3,
      ratingMax: 9,
      activeFacetCount: 8,
    });
    render(React.createElement(ActiveFacetChips, { facets }));

    expect(screen.getByText('Horror')).toBeInTheDocument();
    expect(screen.getByText('Spielberg')).toBeInTheDocument();
    expect(screen.getByText('Universal')).toBeInTheDocument();
    expect(screen.getByText('Movie')).toBeInTheDocument();
    expect(screen.getByText('Rated')).toBeInTheDocument();
    expect(screen.getByText('2000\u20132023')).toBeInTheDocument();
    expect(screen.getByText('3.0\u20139.0')).toBeInTheDocument();
  });
});
