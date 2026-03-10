/**
 * Tests for src/api/list.ts – useList hook.
 *
 * Covers:
 *   - useList fetches a single list by listId
 *   - invalidateListQuery calls queryClient.invalidateQueries
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/App', () => ({
  queryClient: {
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    setQueriesData: jest.fn(),
    getQueryData: jest.fn(),
    removeQueries: jest.fn(),
  },
}));

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    list: {
      getList: jest.fn(),
      getListItems: jest.fn(),
    },
  },
}));

import { useList } from 'src/api/list';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient as appQueryClient } from 'src/App';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false },
    },
  });

const ListHarness: React.FC<{ listId: number }> = ({ listId }) => {
  const result = useList({ listId });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement('span', { 'data-testid': 'isError' }, String(result.isError)),
    React.createElement('span', { 'data-testid': 'list' }, JSON.stringify(result.list ?? null)),
    React.createElement(
      'button',
      { onClick: result.invalidateListQuery },
      'Invalidate'
    )
  );
};

const renderList = (listId: number) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListHarness, { listId })
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useList', () => {
  it('starts in a loading state', () => {
    (mediaTrackerApi.list.getList as jest.Mock).mockResolvedValue({});
    renderList(1);

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls getList with the correct listId', async () => {
    const mockList = { id: 5, name: 'Watchlist', userId: 1 };
    (mediaTrackerApi.list.getList as jest.Mock).mockResolvedValue(mockList);

    renderList(5);

    await waitFor(() => {
      expect(mediaTrackerApi.list.getList).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 5 })
      );
    });
  });

  it('resolves list data from the API', async () => {
    const mockList = { id: 5, name: 'Watchlist', userId: 1 };
    (mediaTrackerApi.list.getList as jest.Mock).mockResolvedValue(mockList);

    renderList(5);

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('list').textContent!)).toEqual(
      mockList
    );
  });

  it('shows isError when the API rejects', async () => {
    (mediaTrackerApi.list.getList as jest.Mock).mockRejectedValue(
      new Error('Not found')
    );

    renderList(999);

    await waitFor(() => {
      expect(screen.getByTestId('isError').textContent).toBe('true');
    });
  });

  it('invalidateListQuery calls queryClient.invalidateQueries', async () => {
    (mediaTrackerApi.list.getList as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();

    renderList(1);

    await user.click(screen.getByRole('button', { name: 'Invalidate' }));

    expect(appQueryClient.invalidateQueries).toHaveBeenCalled();
  });
});
