/**
 * Tests for StatisticsSeen defined in
 * src/components/Statistics/Seen.tsx.
 *
 * Dependencies mocked:
 *  - src/pages/Statistics   – YearSelector, IStatistocsProps
 *  - StatisticSummaryYear   – renders data-testid for inspection
 *  - @lingui/macro / @lingui/react – passthrough
 *  - react-router-dom       – MemoryRouter
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

jest.mock('src/components/Statistics/StatisticSummaryYear', () => {
  const React = require('react');
  const Comp = ({ currentYear }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'statistic-summary-year' },
      JSON.stringify(currentYear)
    );
  return { __esModule: true, default: Comp };
});

import StatisticsSeen from 'src/components/Statistics/Seen';

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
      React.createElement(StatisticsSeen, props)
    )
  );

beforeEach(() => {
  mockOnYearChange.mockClear();
});

describe('StatisticsSeen', () => {
  it('renders without crashing', () => {
    renderComponent();
    expect(screen.getByTestId('year-selector')).toBeInTheDocument();
  });

  it('renders the YearSelector with correct years', () => {
    renderComponent();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
  });

  it('renders StatisticSummaryYear with currentYear', () => {
    renderComponent();
    const summaryYear = screen.getByTestId('statistic-summary-year');
    expect(summaryYear).toBeInTheDocument();
    expect(summaryYear.textContent).toContain('2023');
  });

  it('calls onYearChange when YearSelector triggers year change', () => {
    renderComponent();
    fireEvent.click(screen.getByText('2022'));
    expect(mockOnYearChange).toHaveBeenCalledWith({ year: '2022' });
  });

  it('passes updated currentYear to StatisticSummaryYear', () => {
    renderComponent({
      ...defaultProps,
      currentYear: { year: '2021' },
    });
    const summaryYear = screen.getByTestId('statistic-summary-year');
    expect(summaryYear.textContent).toContain('2021');
  });
});
