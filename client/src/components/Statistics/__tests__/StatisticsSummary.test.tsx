/**
 * Tests for StatisticsSummary defined in
 * src/components/Statistics/StatisticsSummary.tsx.
 *
 * Dependencies mocked:
 *  - src/api/api       – mediaTrackerApi.statistics.summary
 *  - react-query       – useQuery
 *  - @lingui/macro / @lingui/react – passthrough
 *  - react-router-dom  – MemoryRouter + mock navigate
 *  - src/components/date – FormatDuration passthrough
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

const mockSummary = jest.fn();
jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    statistics: {
      summary: (...args: any[]) => mockSummary(...args),
    },
  },
}));

jest.mock('react-query', () => {
  const actual = jest.requireActual('react-query');
  const React = require('react');
  return {
    ...actual,
    useQuery: (key: any, fn: any) => {
      const [queryData, setQueryData] = React.useState(undefined);
      React.useEffect(() => {
        if (fn) {
          Promise.resolve(fn()).then(setQueryData).catch((_e) => { /* ignore */ });
        }
      }, []);
      return { data: queryData, isLoading: queryData === undefined, error: null };
    },
  };
});

import { StatisticsSummary } from 'src/components/Statistics/StatisticsSummary';

const renderComponent = () =>
  render(
    React.createElement(MemoryRouter, null, React.createElement(StatisticsSummary))
  );

beforeEach(() => {
  mockSummary.mockClear();
});

describe('StatisticsSummary', () => {
  it('renders without crashing when data is undefined', () => {
    mockSummary.mockResolvedValue(undefined);
    const { container } = renderComponent();
    expect(container).toBeInTheDocument();
  });

  it('renders Tv section when summary returns tv plays > 0', async () => {
    mockSummary.mockResolvedValue({
      tv: { plays: 5, episodes: 10, items: 3, duration: 0 },
    });
    renderComponent();
    // Data loads asynchronously
    await screen.findByText('Tv');
    expect(screen.getByText('Tv')).toBeInTheDocument();
  });

  it('renders Movies section when summary returns movie plays > 0', async () => {
    mockSummary.mockResolvedValue({
      movie: { plays: 3, items: 3, duration: 0 },
    });
    renderComponent();
    await screen.findByText('Movies');
    expect(screen.getByText('Movies')).toBeInTheDocument();
  });

  it('calls mediaTrackerApi.statistics.summary', async () => {
    mockSummary.mockResolvedValue({});
    renderComponent();
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSummary).toHaveBeenCalledTimes(1);
  });

  it('renders nothing visible when summary returns empty data', async () => {
    mockSummary.mockResolvedValue({});
    renderComponent();
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });
});
