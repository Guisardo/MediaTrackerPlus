/**
 * Tests for src/api/token.ts – useTokens hook.
 *
 * Covers:
 *   - useTokens returns a list of tokens
 *   - addToken mutation calls the API
 *   - removeToken mutation calls the API
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
    tokens: {
      get: jest.fn(),
      add: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { useTokens } from 'src/api/token';
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

interface TokensHarnessProps {
  addPayload?: Record<string, unknown>;
  removePayload?: string | number;
}

const TokensHarness: React.FC<TokensHarnessProps> = ({
  addPayload,
  removePayload,
}) => {
  const result = useTokens();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement(
      'span',
      { 'data-testid': 'tokens' },
      JSON.stringify(result.tokens ?? null)
    ),
    addPayload &&
      React.createElement(
        'button',
        { onClick: () => result.addToken(addPayload as any) },
        'Add Token'
      ),
    removePayload !== undefined &&
      React.createElement(
        'button',
        { onClick: () => result.removeToken(removePayload as any) },
        'Remove Token'
      )
  );
};

const renderTokens = (props: TokensHarnessProps = {}) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(TokensHarness, props)
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTokens', () => {
  it('starts in a loading state', () => {
    (mediaTrackerApi.tokens.get as jest.Mock).mockResolvedValue([]);
    renderTokens();

    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls tokens.get to fetch token list', async () => {
    (mediaTrackerApi.tokens.get as jest.Mock).mockResolvedValue([]);
    renderTokens();

    await waitFor(() => {
      expect(mediaTrackerApi.tokens.get).toHaveBeenCalled();
    });
  });

  it('resolves tokens list from the API', async () => {
    const mockTokens = [{ id: 1, description: 'My Token' }];
    (mediaTrackerApi.tokens.get as jest.Mock).mockResolvedValue(mockTokens);

    renderTokens();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('tokens').textContent!)).toEqual(
      mockTokens
    );
  });

  it('calls tokens.add when addToken mutation is triggered', async () => {
    (mediaTrackerApi.tokens.get as jest.Mock).mockResolvedValue([]);
    (mediaTrackerApi.tokens.add as jest.Mock).mockResolvedValue({
      id: 99,
      description: 'New Token',
    });
    const user = userEvent.setup();

    renderTokens({ addPayload: { description: 'New Token' } });

    await user.click(screen.getByRole('button', { name: 'Add Token' }));

    await waitFor(() => {
      expect(mediaTrackerApi.tokens.add).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'New Token' })
      );
    });
  });

  it('calls tokens.delete when removeToken mutation is triggered', async () => {
    (mediaTrackerApi.tokens.get as jest.Mock).mockResolvedValue([]);
    (mediaTrackerApi.tokens.delete as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderTokens({ removePayload: 5 });

    await user.click(screen.getByRole('button', { name: 'Remove Token' }));

    await waitFor(() => {
      expect(mediaTrackerApi.tokens.delete).toHaveBeenCalledWith(5);
    });
  });
});
