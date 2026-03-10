/**
 * Tests for StatsticsGenre defined in
 * src/components/Statistics/Genre.tsx.
 *
 * Dependencies mocked:
 *  - src/pages/Statistics          – YearSelector
 *  - src/hooks/statisticHooks      – useGenreSeen
 *  - src/api/api                   – mediaTrackerApi
 *  - StatisticsGenreSegment        – renders data as testid element
 *  - @lingui/macro / @lingui/react – passthrough
 *  - react-router-dom              – MemoryRouter
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

const mockOnYearChange = jest.fn();

jest.mock('src/pages/Statistics', () => {
  const React = require('react');
  return {
    YearSelector: ({ years, currentYear, onYearChange }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'year-selector' },
        years.map((y: any) =>
          React.createElement(
            'button',
            {
              key: String(y),
              onClick: () => onYearChange({ year: String(y) }),
            },
            String(y)
          )
        )
      ),
  };
});

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    statistics: {
      statisticsGenresinyearList: jest.fn(),
    },
  },
}));

const mockUseGenreSeen = jest.fn();
jest.mock('src/hooks/statisticHooks', () => ({
  useGenreSeen: (...args: any[]) => mockUseGenreSeen(...args),
  useSeen: jest.fn().mockReturnValue({ data: undefined, isFetched: false, error: null }),
}));

jest.mock('src/components/Statistics/StatisticsGenreSegment', () => {
  const React = require('react');
  const Comp = ({ data, year }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'genre-segment' },
      JSON.stringify({ data, year })
    );
  return { __esModule: true, default: Comp };
});

import StatsticsGenre from 'src/components/Statistics/Genre';

const defaultProps = {
  years: [2023, 2022, 2021],
  currentYear: { year: '2023' },
  onYearChange: mockOnYearChange,
};

const renderComponent = (props = defaultProps) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(StatsticsGenre, props)
    )
  );

beforeEach(() => {
  mockOnYearChange.mockClear();
  mockUseGenreSeen.mockReturnValue({ data: undefined, isFetched: false, error: null });
});

describe('StatsticsGenre', () => {
  it('renders without crashing', () => {
    renderComponent();
    expect(screen.getByTestId('year-selector')).toBeInTheDocument();
  });

  it('renders the YearSelector with the years prop', () => {
    renderComponent();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
  });

  it('calls onYearChange when year button clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('2022'));
    expect(mockOnYearChange).toHaveBeenCalledWith({ year: '2022' });
  });

  it('renders StatisticsGenreSegment', () => {
    renderComponent();
    expect(screen.getByTestId('genre-segment')).toBeInTheDocument();
  });

  it('passes currentYear.year to StatisticsGenreSegment', () => {
    renderComponent();
    const segment = screen.getByTestId('genre-segment');
    expect(segment.textContent).toContain('2023');
  });

  it('passes data from useGenreSeen to StatisticsGenreSegment', () => {
    const mockData = { tv: [{ genre: 'Action', count: 5 }] };
    mockUseGenreSeen.mockReturnValue({
      data: mockData,
      isFetched: true,
      error: null,
    });
    renderComponent();
    const segment = screen.getByTestId('genre-segment');
    expect(segment.textContent).toContain('Action');
  });

  it('calls useGenreSeen with currentYear', () => {
    renderComponent();
    expect(mockUseGenreSeen).toHaveBeenCalledWith({ year: '2023' });
  });
});
