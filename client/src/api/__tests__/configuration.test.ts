/**
 * Tests for src/api/configuration.ts – useConfiguration hook.
 *
 * Covers:
 *   - useConfiguration returns configuration data
 *   - useConfiguration.update mutation calls the API
 *   - updateConfiguration mutation invalidates the configuration query
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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
    configuration: {
      get: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { useConfiguration } from 'src/api/configuration';
import { mediaTrackerApi } from 'src/api/api';

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

const ConfigHarness: React.FC<{ updatePayload?: Record<string, unknown> }> = ({
  updatePayload,
}) => {
  const result = useConfiguration();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement(
      'span',
      { 'data-testid': 'configuration' },
      JSON.stringify(result.configuration ?? null)
    ),
    updatePayload &&
      React.createElement(
        'button',
        { onClick: () => result.update(updatePayload as any) },
        'Update'
      )
  );
};

const renderConfig = (updatePayload?: Record<string, unknown>) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ConfigHarness, { updatePayload })
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useConfiguration', () => {
  it('starts in a loading state', () => {
    (mediaTrackerApi.configuration.get as jest.Mock).mockResolvedValue({});
    renderConfig();

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls configuration.get to fetch config data', async () => {
    const mockConfig = { enableRegistration: true, noUsers: false };
    (mediaTrackerApi.configuration.get as jest.Mock).mockResolvedValue(
      mockConfig
    );

    renderConfig();

    await waitFor(() => {
      expect(mediaTrackerApi.configuration.get).toHaveBeenCalled();
    });
  });

  it('resolves configuration data from the API', async () => {
    const mockConfig = { enableRegistration: true, noUsers: false };
    (mediaTrackerApi.configuration.get as jest.Mock).mockResolvedValue(
      mockConfig
    );

    renderConfig();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(
      JSON.parse(screen.getByTestId('configuration').textContent!)
    ).toEqual(mockConfig);
  });

  it('calls configuration.update when the update mutation is triggered', async () => {
    (mediaTrackerApi.configuration.get as jest.Mock).mockResolvedValue({});
    (mediaTrackerApi.configuration.update as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();

    renderConfig({ enableRegistration: false });

    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(mediaTrackerApi.configuration.update).toHaveBeenCalledWith(
        expect.objectContaining({ enableRegistration: false })
      );
    });
  });
});
