/**
 * Tests for src/api/lists.ts – useLists hook.
 *
 * Covers:
 *   - useLists fetches user lists with the correct userId
 *   - useLists passes mediaItemId when provided
 *   - invalidateListsQuery calls queryClient.invalidateQueries
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
    lists: {
      getUsersLists: jest.fn(),
    },
  },
}));

import { useLists } from 'src/api/lists';
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

interface ListsHarnessProps {
  userId: number;
  mediaItemId?: number;
}

const ListsHarness: React.FC<ListsHarnessProps> = ({ userId, mediaItemId }) => {
  const result = useLists({ userId, mediaItemId });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement('span', { 'data-testid': 'isError' }, String(result.isError)),
    React.createElement('span', { 'data-testid': 'lists' }, JSON.stringify(result.lists ?? null)),
    React.createElement(
      'button',
      { onClick: result.invalidateListsQuery },
      'Invalidate'
    )
  );
};

const renderLists = (props: ListsHarnessProps) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListsHarness, props)
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useLists', () => {
  it('starts in a loading state', () => {
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockResolvedValue([]);
    renderLists({ userId: 1 });

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls getUsersLists with the correct userId', async () => {
    const mockLists = [{ id: 1, name: 'Favorites', userId: 42 }];
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockResolvedValue(
      mockLists
    );

    renderLists({ userId: 42 });

    await waitFor(() => {
      expect(mediaTrackerApi.lists.getUsersLists).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42 })
      );
    });
  });

  it('resolves lists data from the API', async () => {
    const mockLists = [{ id: 1, name: 'Favorites', userId: 1 }];
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockResolvedValue(
      mockLists
    );

    renderLists({ userId: 1 });

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('lists').textContent!)).toEqual(
      mockLists
    );
  });

  it('passes mediaItemId to the API when provided', async () => {
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockResolvedValue([]);

    renderLists({ userId: 1, mediaItemId: 99 });

    await waitFor(() => {
      expect(mediaTrackerApi.lists.getUsersLists).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, mediaItemId: 99 })
      );
    });
  });

  it('shows isError when the API rejects', async () => {
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    renderLists({ userId: 1 });

    await waitFor(() => {
      expect(screen.getByTestId('isError').textContent).toBe('true');
    });
  });

  it('invalidateListsQuery calls queryClient.invalidateQueries', async () => {
    (mediaTrackerApi.lists.getUsersLists as jest.Mock).mockResolvedValue([]);
    const user = userEvent.setup();

    renderLists({ userId: 1 });

    await user.click(screen.getByRole('button', { name: 'Invalidate' }));

    expect(appQueryClient.invalidateQueries).toHaveBeenCalled();
  });
});
