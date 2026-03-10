/**
 * Tests for src/api/user.ts – useUser and useRegisterUser hooks.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';

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

import { useUser, useRegisterUser } from 'src/api/user';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient as appQueryClient } from 'src/App';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false },
    },
  });

// Harness for useUser
const UserHarness: React.FC<{
  loginPayload?: { username: string; password: string };
  doLogout?: boolean;
}> = ({ loginPayload, doLogout }) => {
  const result = useUser();

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement('span', { 'data-testid': 'user' }, JSON.stringify(result.user ?? null)),
    loginPayload &&
      React.createElement(
        'button',
        { onClick: () => result.login(loginPayload) },
        'Login'
      ),
    doLogout &&
      React.createElement(
        'button',
        { onClick: () => result.logout() },
        'Logout'
      )
  );
};

const renderUser = (props: { loginPayload?: { username: string; password: string }; doLogout?: boolean } = {}) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(UserHarness, props)
    )
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUser', () => {
  it('calls user.get to fetch current user', async () => {
    (mediaTrackerApi.user.get as jest.Mock).mockResolvedValue({ id: 1, username: 'alice' });

    renderUser();

    await waitFor(() => {
      expect(mediaTrackerApi.user.get).toHaveBeenCalled();
    });
  });

  it('resolves user data from the API', async () => {
    const mockUser = { id: 1, username: 'alice' };
    (mediaTrackerApi.user.get as jest.Mock).mockResolvedValue(mockUser);

    renderUser();

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(mockUser);
  });

  it('calls user.login with correct credentials when login mutation is invoked', async () => {
    (mediaTrackerApi.user.get as jest.Mock).mockResolvedValue(null);
    (mediaTrackerApi.user.login as jest.Mock).mockResolvedValue({ id: 1, username: 'alice' });
    const user = userEvent.setup();

    renderUser({ loginPayload: { username: 'alice', password: 'secret' } });

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(mediaTrackerApi.user.login).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'alice', password: 'secret' })
      );
    });
  });

  it('calls user.logout when logout mutation is invoked', async () => {
    (mediaTrackerApi.user.get as jest.Mock).mockResolvedValue({ id: 1, username: 'alice' });
    (mediaTrackerApi.user.logout as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderUser({ doLogout: true });

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(mediaTrackerApi.user.logout).toHaveBeenCalled();
    });
  });
});

describe('useRegisterUser', () => {
  const RegisterHarness: React.FC = () => {
    const result = useRegisterUser();

    return React.createElement(
      React.Fragment,
      null,
      React.createElement('span', { 'data-testid': 'error' }, result.error ?? ''),
      React.createElement(
        'button',
        {
          onClick: () =>
            result.registerUser({ username: 'bob', password: 'pass' } as any),
        },
        'Register'
      )
    );
  };

  const renderRegister = () => {
    const client = createTestQueryClient();
    return render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(RegisterHarness)
      )
    );
  };

  it('calls user.register when registerUser is invoked', async () => {
    (mediaTrackerApi.user.register as jest.Mock).mockResolvedValue({
      data: { id: 1, username: 'bob' },
      error: undefined,
    });
    const user = userEvent.setup();

    renderRegister();

    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mediaTrackerApi.user.register).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'bob' })
      );
    });
  });
});
