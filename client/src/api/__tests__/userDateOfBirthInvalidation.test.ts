/**
 * Tests that updating dateOfBirth via useUser.updateUser invalidates all
 * age-gated query caches (items, facets, search, details, listItems, calendar,
 * statistics, genre) in addition to the user query, while non-DOB updates
 * only invalidate the user query.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

jest.mock('src/App', () => ({
  queryClient: {
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    setQueriesData: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
    removeQueries: jest.fn(),
  },
}));

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    user: {
      get: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      register: jest.fn(),
      getById: jest.fn(),
    },
  },
  errorHandler: jest.fn((fn: any) => fn),
}));

import { useUser } from 'src/api/user';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient as appQueryClient } from 'src/App';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

/**
 * Harness that exposes an updateUser button accepting a JSON-encoded payload.
 */
const UpdateUserHarness: React.FC<{ payload: object }> = ({ payload }) => {
  const result = useUser();
  return React.createElement(
    'button',
    { onClick: () => result.updateUser(payload as any) },
    'UpdateUser'
  );
};

const renderHarness = (payload: object) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(UpdateUserHarness, { payload })
    )
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  (mediaTrackerApi.user.get as jest.Mock).mockResolvedValue({ id: 1 });
  (mediaTrackerApi.user.update as jest.Mock).mockResolvedValue({ id: 1 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUser.updateUser – query invalidation', () => {
  it('invalidates the user query on any successful update', async () => {
    const user = userEvent.setup();
    renderHarness({ publicReviews: true });

    await user.click(screen.getByRole('button', { name: 'UpdateUser' }));

    await waitFor(() => {
      expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['user'] })
      );
    });
  });

  it('does NOT invalidate age-gated queries when dateOfBirth is not in the payload', async () => {
    const user = userEvent.setup();
    renderHarness({ publicReviews: true });

    await user.click(screen.getByRole('button', { name: 'UpdateUser' }));

    await waitFor(() => {
      expect(mediaTrackerApi.user.update).toHaveBeenCalled();
    });

    const invalidateCalls = (appQueryClient.invalidateQueries as jest.Mock).mock.calls;
    const invalidatedKeys = invalidateCalls.map((call) => call[0]?.queryKey?.[0]);

    expect(invalidatedKeys).not.toContain('items');
    expect(invalidatedKeys).not.toContain('facets');
    expect(invalidatedKeys).not.toContain('search');
    expect(invalidatedKeys).not.toContain('details');
    expect(invalidatedKeys).not.toContain('listItems');
    expect(invalidatedKeys).not.toContain('calendar');
    expect(invalidatedKeys).not.toContain('statistics');
    expect(invalidatedKeys).not.toContain('genre');
  });

  it('invalidates all age-gated query caches when dateOfBirth is in the payload', async () => {
    const user = userEvent.setup();
    renderHarness({ dateOfBirth: '1995-05-10' });

    await user.click(screen.getByRole('button', { name: 'UpdateUser' }));

    await waitFor(() => {
      expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['user'] })
      );
    });

    const invalidateCalls = (appQueryClient.invalidateQueries as jest.Mock).mock.calls;
    const invalidatedKeys = invalidateCalls.map((call) => call[0]?.queryKey?.[0]);

    expect(invalidatedKeys).toContain('items');
    expect(invalidatedKeys).toContain('facets');
    expect(invalidatedKeys).toContain('search');
    expect(invalidatedKeys).toContain('details');
    expect(invalidatedKeys).toContain('listItems');
    expect(invalidatedKeys).toContain('calendar');
    expect(invalidatedKeys).toContain('statistics');
    expect(invalidatedKeys).toContain('genre');
  });

  it('invalidates all age-gated query caches when dateOfBirth is set to null (clear flow)', async () => {
    const user = userEvent.setup();
    renderHarness({ dateOfBirth: null });

    await user.click(screen.getByRole('button', { name: 'UpdateUser' }));

    await waitFor(() => {
      expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['user'] })
      );
    });

    const invalidateCalls = (appQueryClient.invalidateQueries as jest.Mock).mock.calls;
    const invalidatedKeys = invalidateCalls.map((call) => call[0]?.queryKey?.[0]);

    expect(invalidatedKeys).toContain('items');
    expect(invalidatedKeys).toContain('facets');
    expect(invalidatedKeys).toContain('search');
    expect(invalidatedKeys).toContain('details');
    expect(invalidatedKeys).toContain('listItems');
    expect(invalidatedKeys).toContain('calendar');
    expect(invalidatedKeys).toContain('statistics');
    expect(invalidatedKeys).toContain('genre');
  });

  it('calls mediaTrackerApi.user.update with the correct dateOfBirth payload', async () => {
    const user = userEvent.setup();
    renderHarness({ dateOfBirth: '1988-12-31' });

    await user.click(screen.getByRole('button', { name: 'UpdateUser' }));

    await waitFor(() => {
      expect(mediaTrackerApi.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ dateOfBirth: '1988-12-31' })
      );
    });
  });
});
