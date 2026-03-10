/**
 * Tests for StatisticSummaryYear defined in
 * src/components/Statistics/StatisticSummaryYear.tsx.
 *
 * Dependencies mocked:
 *  - src/hooks/statisticHooks – useSeen
 *  - src/api/api              – mediaTrackerApi
 *  - react-query              – useQuery
 *  - @lingui/macro / @lingui/react – passthrough
 *  - react-router-dom         – MemoryRouter + mock navigate
 *  - src/components/Statistics/StatisticsSegment – renders data as JSON for inspection
 *  - src/components/date      – FormatDuration passthrough
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: any) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
    createSearchParams: actual.createSearchParams,
  };
});

jest.mock('src/components/date', () => ({
  FormatDuration: ({ milliseconds }: { milliseconds: number }) => {
    const React = require('react');
    return React.createElement('span', null, String(milliseconds));
  },
}));

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    statistics: {
      statisticsSeeninyearList: jest.fn(),
    },
  },
}));

const mockUseSeen = jest.fn();
jest.mock('src/hooks/statisticHooks', () => ({
  useSeen: (...args: any[]) => mockUseSeen(...args),
  useGenreSeen: jest.fn().mockReturnValue({ data: undefined, isFetched: false, error: null }),
}));

import StatisticSummaryYear from 'src/components/Statistics/StatisticSummaryYear';

const renderComponent = (currentYear: any) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(StatisticSummaryYear, { currentYear })
    )
  );

beforeEach(() => {
  mockUseSeen.mockClear();
});

describe('StatisticSummaryYear', () => {
  it('renders without crashing when useSeen returns no data', () => {
    mockUseSeen.mockReturnValue({ data: undefined, isFetched: false, error: null });
    const { container } = renderComponent({ year: '2023' });
    expect(container).toBeInTheDocument();
  });

  it('passes currentYear to useSeen hook', () => {
    mockUseSeen.mockReturnValue({ data: undefined, isFetched: true, error: null });
    renderComponent({ year: '2023' });
    expect(mockUseSeen).toHaveBeenCalledWith({ year: '2023' });
  });

  it('passes null currentYear to useSeen hook when year is null', () => {
    mockUseSeen.mockReturnValue({ data: undefined, isFetched: true, error: null });
    renderComponent({ year: null });
    expect(mockUseSeen).toHaveBeenCalledWith({ year: null });
  });

  it('shows Tv section when useSeen returns tv data with plays > 0', () => {
    mockUseSeen.mockReturnValue({
      data: { tv: { plays: 5, episodes: 10, items: 3, duration: 0 } },
      isFetched: true,
      error: null,
    });
    renderComponent({ year: '2023' });
    expect(screen.getByText('Tv')).toBeInTheDocument();
  });

  it('shows Movies section when useSeen returns movie data with plays > 0', () => {
    mockUseSeen.mockReturnValue({
      data: { movie: { plays: 3, items: 3, duration: 0 } },
      isFetched: true,
      error: null,
    });
    renderComponent({ year: '2022' });
    expect(screen.getByText('Movies')).toBeInTheDocument();
  });

  it('renders empty when useSeen returns empty data object', () => {
    mockUseSeen.mockReturnValue({
      data: {},
      isFetched: true,
      error: null,
    });
    renderComponent({ year: '2023' });
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });
});
