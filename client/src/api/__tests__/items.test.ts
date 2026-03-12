/**
 * Tests for src/api/items.ts – useItems hook.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    items: {
      paginated: jest.fn(),
      random: jest.fn(),
    },
    search: {
      search: jest.fn(),
    },
  },
}));

import { useItems } from 'src/api/items';
import { mediaTrackerApi } from 'src/api/api';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

interface ItemsHarnessProps {
  args: Record<string, unknown>;
  searchQuery?: string;
}

const ItemsHarness: React.FC<ItemsHarnessProps> = ({ args, searchQuery }) => {
  const result = useItems(args as any);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement(
      'span',
      { 'data-testid': 'items' },
      JSON.stringify(result.items ?? null)
    ),
    React.createElement(
      'span',
      { 'data-testid': 'numberOfPages' },
      String((result as any).numberOfPages ?? null)
    ),
    searchQuery !== undefined &&
      React.createElement(
        'button',
        { onClick: () => result.search(searchQuery) },
        'Search'
      )
  );
};

const renderItems = (props: ItemsHarnessProps) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ItemsHarness, props)
    )
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useItems – paginated mode', () => {
  it('calls items.paginated with the provided args', async () => {
    const mockResponse = { data: [{ id: 1, title: 'Movie' }], totalPages: 3, total: 30, page: 1, from: 1, to: 10 };
    (mediaTrackerApi.items.paginated as jest.Mock).mockResolvedValue(mockResponse);

    renderItems({ args: { mediaType: 'movie', page: 1 } });

    await waitFor(() => {
      expect(mediaTrackerApi.items.paginated).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: 'movie', page: 1 })
      );
    });
  });

  it('returns items and pagination info from paginated response', async () => {
    const mockData = [{ id: 1, title: 'Movie' }];
    const mockResponse = { data: mockData, totalPages: 5, total: 50, page: 1, from: 1, to: 10 };
    (mediaTrackerApi.items.paginated as jest.Mock).mockResolvedValue(mockResponse);

    renderItems({ args: { mediaType: 'movie', page: 1 } });

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('items').textContent!)).toEqual(mockData);
    expect(screen.getByTestId('numberOfPages').textContent).toBe('5');
  });
});

describe('useItems – random mode', () => {
  it('calls items.random when selectRandom is true', async () => {
    const mockData = [{ id: 1, title: 'Random Movie' }];
    (mediaTrackerApi.items.random as jest.Mock).mockResolvedValue(mockData);

    renderItems({ args: { mediaType: 'movie', selectRandom: true } });

    await waitFor(() => {
      expect(mediaTrackerApi.items.random).toHaveBeenCalled();
    });
  });

  it('does NOT call items.paginated in random mode', async () => {
    (mediaTrackerApi.items.random as jest.Mock).mockResolvedValue([]);

    renderItems({ args: { mediaType: 'movie', selectRandom: true } });

    await waitFor(() => {
      expect(mediaTrackerApi.items.paginated).not.toHaveBeenCalled();
    });
  });
});
