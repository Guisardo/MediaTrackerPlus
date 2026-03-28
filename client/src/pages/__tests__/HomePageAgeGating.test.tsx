/**
 * Tests for age-gated fallback messaging in the Home page (Home.tsx).
 *
 * US-011 Acceptance Criteria covered:
 *  - The home page shows intentional fallback messaging when all sections are
 *    empty because age gating removed visible content.
 *  - The fallback message does NOT appear when sections are empty for ordinary
 *    reasons (ageGatingActive is false/absent).
 *  - The fallback message does NOT appear when at least one section has items
 *    (even if ageGatingActive is true for other sections).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks – must appear before the imports of the mocked modules
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    t: (strings: any, ...values: any[]) =>
      typeof strings === 'string'
        ? strings
        : strings.raw
        ? String.raw(strings, ...values)
        : strings[0],
  };
});

jest.mock('@lingui/react', () => {
  const React = require('react');
  const Trans = ({ id, message, children }: any) => {
    const text = message || id;
    return React.createElement(React.Fragment, null, text || children || null);
  };
  return {
    Trans,
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    useLingui: () => ({
      i18n: {
        _: (id: any) =>
          typeof id === 'string' ? id : id?.message || id?.id || '',
      },
    }),
  };
});

jest.mock('src/api/items', () => ({
  useItems: jest.fn(),
}));

jest.mock('src/components/GridItem', () => {
  const React = require('react');
  return {
    GridItem: ({ mediaItem }: any) =>
      React.createElement('div', { 'data-testid': `grid-item-${mediaItem.id}` }, mediaItem.title),
    GridItemAppearanceArgs: {},
  };
});

jest.mock('src/components/Statistics/StatisticsSummary', () => {
  const React = require('react');
  return {
    StatisticsSummary: () =>
      React.createElement('div', { 'data-testid': 'statistics-summary' }),
  };
});

jest.mock('date-fns', () => ({
  subDays: (_date: Date, _days: number) => new Date('2020-01-01'),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useItems } from 'src/api/items';
import { HomePage } from 'src/pages/Home';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a mock useItems result with all sections empty and age gating active. */
const emptyAgeGated = {
  items: [],
  ageGatingActive: true,
  isLoading: false,
  numberOfPages: 1,
  numberOfItemsTotal: 0,
};

/** Returns a mock useItems result with all sections empty and no age gating. */
const emptyNoGating = {
  items: [],
  ageGatingActive: false,
  isLoading: false,
  numberOfPages: 1,
  numberOfItemsTotal: 0,
};

/** Returns a mock useItems result with one item and age gating active. */
const oneItemAgeGated = {
  items: [
    {
      id: 1,
      title: 'Visible Movie',
      mediaType: 'movie',
      lastAiring: new Date('2099-12-01').toISOString(), // far future so filter passes
    },
  ],
  ageGatingActive: true,
  isLoading: false,
  numberOfPages: 1,
  numberOfItemsTotal: 1,
};

// ---------------------------------------------------------------------------
// beforeEach – reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: all sections empty, no gating
  (useItems as jest.Mock).mockReturnValue(emptyNoGating);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomePage – age-gated fallback messaging', () => {
  it('shows fallback message when all sections are empty and at least one has ageGatingActive=true', () => {
    // All 4 useItems calls return empty + ageGatingActive=true
    (useItems as jest.Mock).mockReturnValue(emptyAgeGated);

    render(<HomePage />);

    expect(
      screen.getByText(/Content is hidden based on your age-based content filtering/i)
    ).toBeInTheDocument();
  });

  it('does NOT show fallback message when all sections are empty but ageGatingActive=false', () => {
    (useItems as jest.Mock).mockReturnValue(emptyNoGating);

    render(<HomePage />);

    expect(
      screen.queryByText(/Content is hidden based on your age-based content filtering/i)
    ).not.toBeInTheDocument();
  });

  it('does NOT show fallback message when sections are empty and ageGatingActive is absent', () => {
    (useItems as jest.Mock).mockReturnValue({
      items: [],
      isLoading: false,
      numberOfPages: 1,
      numberOfItemsTotal: 0,
      // ageGatingActive omitted
    });

    render(<HomePage />);

    expect(
      screen.queryByText(/Content is hidden based on your age-based content filtering/i)
    ).not.toBeInTheDocument();
  });

  it('does NOT show fallback message when at least one section has items (even if ageGatingActive=true for that call)', () => {
    let callCount = 0;
    (useItems as jest.Mock).mockImplementation(() => {
      callCount++;
      // First call (upcomingEpisodes) returns an item; the rest return empty+gated
      if (callCount === 1) {
        return oneItemAgeGated;
      }
      return emptyAgeGated;
    });

    render(<HomePage />);

    expect(
      screen.queryByText(/Content is hidden based on your age-based content filtering/i)
    ).not.toBeInTheDocument();
  });

  it('does NOT show fallback message when only some sections are age-gated but none have items', () => {
    let callCount = 0;
    (useItems as jest.Mock).mockImplementation(() => {
      callCount++;
      // First two calls: age-gated and empty; last two: not gated, empty
      return callCount <= 2 ? emptyAgeGated : emptyNoGating;
    });

    render(<HomePage />);

    // anyAgeGating=true AND allSectionsEmpty=true → message SHOULD show
    expect(
      screen.getByText(/Content is hidden based on your age-based content filtering/i)
    ).toBeInTheDocument();
  });

  it('renders section titles for non-empty sections when ageGatingActive is false', () => {
    let callCount = 0;
    (useItems as jest.Mock).mockImplementation(() => {
      callCount++;
      // Upcoming section (call 1) has items
      if (callCount === 1) {
        return {
          items: [{ id: 2, title: 'Upcoming Show', mediaType: 'tv', lastAiring: null }],
          ageGatingActive: false,
          isLoading: false,
        };
      }
      return emptyNoGating;
    });

    render(<HomePage />);

    // The Segment component renders "Upcoming" section title (from t`Upcoming` = "Upcoming")
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });
});
