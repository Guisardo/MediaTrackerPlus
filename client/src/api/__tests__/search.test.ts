/**
 * Tests for src/api/search.ts – useSearch hook.
 *
 * Covers:
 *   - useSearch returns a search function
 *   - Calling search triggers the API with the correct params
 *   - Items are returned after search resolves
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    search: {
      search: jest.fn(),
    },
  },
}));

import { useSearch } from 'src/api/search';
import { mediaTrackerApi } from 'src/api/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

interface SearchHarnessProps {
  searchArgs?: { mediaType: string; query: string };
}

const SearchHarness: React.FC<SearchHarnessProps> = ({ searchArgs }) => {
  const result = useSearch();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement(
      'span',
      { 'data-testid': 'items' },
      JSON.stringify(result.items ?? null)
    ),
    searchArgs &&
      React.createElement(
        'button',
        {
          onClick: () =>
            result.search({
              mediaType: searchArgs.mediaType as any,
              query: searchArgs.query,
            }),
        },
        'Search'
      )
  );
};

const renderSearch = (props: SearchHarnessProps = {}) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(SearchHarness, props)
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSearch', () => {
  it('starts with no items (items is undefined)', () => {
    renderSearch();

    expect(JSON.parse(screen.getByTestId('items').textContent!)).toBeNull();
  });

  it('starts with isLoading=false before a search is triggered', () => {
    renderSearch();

    expect(screen.getByTestId('isLoading').textContent).toBe('false');
  });

  it('calls search.search with the correct params when search is invoked', async () => {
    const mockResults = [{ id: 1, title: 'Inception', mediaType: 'movie' }];
    (mediaTrackerApi.search.search as jest.Mock).mockResolvedValue(mockResults);
    const user = userEvent.setup();

    renderSearch({ searchArgs: { mediaType: 'movie', query: 'Inception' } });

    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mediaTrackerApi.search.search).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: 'movie', q: 'Inception' })
      );
    });
  });

  it('returns items from the API after search resolves', async () => {
    const mockResults = [{ id: 1, title: 'Inception', mediaType: 'movie' }];
    (mediaTrackerApi.search.search as jest.Mock).mockResolvedValue(mockResults);
    const user = userEvent.setup();

    renderSearch({ searchArgs: { mediaType: 'movie', query: 'Inception' } });

    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items).toEqual(mockResults);
    });
  });
});
