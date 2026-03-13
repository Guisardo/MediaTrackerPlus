/**
 * Tests for src/api/listItems.ts – useListItems hook.
 *
 * Covers:
 *   - useListItems fetches list items by listId
 *   - invalidateListItemsQuery calls queryClient.invalidateQueries
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

import { useListItems } from 'src/api/listItems';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient as appQueryClient } from 'src/App';

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

const ListItemsHarness: React.FC<{ listId: number }> = ({ listId }) => {
  const result = useListItems({ listId });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement('span', { 'data-testid': 'isError' }, String(result.isError)),
    React.createElement(
      'span',
      { 'data-testid': 'listItems' },
      JSON.stringify(result.listItems ?? null)
    ),
    React.createElement(
      'button',
      { onClick: result.invalidateListItemsQuery },
      'Invalidate'
    )
  );
};

const renderListItems = (listId: number) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListItemsHarness, { listId })
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useListItems', () => {
  it('starts in a loading state', () => {
    (mediaTrackerApi.list.getListItems as jest.Mock).mockResolvedValue([]);
    renderListItems(1);

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls getListItems with the correct listId', async () => {
    const mockItems = [{ id: 1, listId: 7, mediaItem: { id: 10, title: 'Test' } }];
    (mediaTrackerApi.list.getListItems as jest.Mock).mockResolvedValue(
      mockItems
    );

    renderListItems(7);

    await waitFor(() => {
      expect(mediaTrackerApi.list.getListItems).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 7 })
      );
    });
  });

  it('resolves listItems data from the API', async () => {
    const mockItems = [{ id: 1, listId: 3, mediaItem: { id: 10, title: 'Movie' } }];
    (mediaTrackerApi.list.getListItems as jest.Mock).mockResolvedValue(
      mockItems
    );

    renderListItems(3);

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('listItems').textContent!)).toEqual(
      mockItems
    );
  });

  it('shows isError when the API rejects', async () => {
    (mediaTrackerApi.list.getListItems as jest.Mock).mockRejectedValue(
      new Error('Not found')
    );

    renderListItems(999);

    await waitFor(() => {
      expect(screen.getByTestId('isError').textContent).toBe('true');
    });
  });

  it('invalidateListItemsQuery calls queryClient.invalidateQueries', async () => {
    (mediaTrackerApi.list.getListItems as jest.Mock).mockResolvedValue([]);
    const user = userEvent.setup();

    renderListItems(1);

    await user.click(screen.getByRole('button', { name: 'Invalidate' }));

    expect(appQueryClient.invalidateQueries).toHaveBeenCalled();
  });
});
