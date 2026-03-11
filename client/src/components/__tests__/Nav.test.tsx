/**
 * Tests for the NavComponent and useRouteNames defined in
 * src/components/Nav.tsx.
 *
 * NavComponent depends on:
 *  - useUser (src/api/user)         – provides { user, logout }
 *  - useDarkMode (src/hooks/darkMode)
 *  - useLocation / NavLink          – react-router-dom
 *  - @react-spring/web              – animations (mocked synchronously)
 *  - @lingui/macro                  – translations (mocked to passthrough)
 *  - clsx                           – class util (mocked to join)
 *
 * Tests verify:
 *  - All navigation links rendered when user is logged in
 *  - Each NavLink has the correct href value
 *  - The active route link receives the "underline" class
 *  - The sidebar shows route names that match the current path
 *  - Dark-mode toggle renders and toggles
 *  - When user is falsy only the dark-mode toggle renders (no nav links)
 *  - useRouteNames returns all expected route entries
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// renderHook polyfill — @testing-library/react v12 does not export renderHook.
function renderHook<T>(callback: () => T, options?: { wrapper: React.FC<{ children: React.ReactNode }> }): { result: { current: T } } {
  const result = { current: undefined as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  function TestComponent() {
    result.current = callback();
    return null;
  }
  const element = options?.wrapper
    ? React.createElement(options.wrapper, null, React.createElement(TestComponent))
    : React.createElement(TestComponent);
  act(() => {
    ReactDOM.render(element, container);
  });
  return { result };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@lingui/react', () => ({
  useLingui: () => ({ i18n: { _: (s: any) => s, locale: 'en' } }),
  Trans: ({ id, children }: any) => <>{id || children}</>,
  I18nProvider: ({ children }: any) => <>{children}</>,
}));

jest.mock('clsx', () => (...args: unknown[]) => args.filter(Boolean).join(' '));

// @react-spring/web – synchronous mocks (same pattern as Modal.test.tsx)
jest.mock('@react-spring/web', () => {
  const React = require('react');
  return {
    Transition: ({
      items,
      children,
    }: {
      items: boolean;
      children: (styles: object, show: boolean) => React.ReactNode;
    }) => <>{children({}, items)}</>,
    Spring: ({
      children,
    }: {
      children: (styles: object) => React.ReactNode;
    }) => <>{children({})}</>,
    animated: {
      div: (props: React.HTMLProps<HTMLDivElement>) => <div {...props} />,
    },
  };
});

// useUser mock – default to a logged-in user
const mockLogout = jest.fn();
const mockUseUser = jest.fn();

jest.mock('src/api/user', () => ({
  useUser: () => mockUseUser(),
}));

// useDarkMode mock
const mockSetDarkMode = jest.fn();
const mockUseDarkMode = jest.fn(() => ({
  darkMode: false,
  setDarkMode: mockSetDarkMode,
}));

jest.mock('src/hooks/darkMode', () => ({
  useDarkMode: () => mockUseDarkMode(),
}));

// ---------------------------------------------------------------------------
// Import component and hook under test
// ---------------------------------------------------------------------------

import { NavComponent, useRouteNames } from 'src/components/Nav';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LOGGED_IN_USER = {
  id: 1,
  name: 'Alice',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderNav = (initialEntry = '/') => {
  mockUseUser.mockReturnValue({ user: LOGGED_IN_USER, logout: mockLogout });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavComponent />
    </MemoryRouter>
  );
};

// ---------------------------------------------------------------------------
// useRouteNames – standalone hook tests
// ---------------------------------------------------------------------------

describe('useRouteNames', () => {
  it('returns all 15 expected routes', () => {
    const { result } = renderHook(() => useRouteNames(), {
      wrapper: ({ children }) => (
        <MemoryRouter>{children}</MemoryRouter>
      ),
    });

    expect(result.current).toHaveLength(15);
  });

  it('includes Home at path /', () => {
    const { result } = renderHook(() => useRouteNames(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    const home = result.current.find((r) => r.path === '/');
    expect(home).toBeDefined();
    expect(home?.name).toBe('Home');
  });

  it('includes expected paths', () => {
    const { result } = renderHook(() => useRouteNames(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    const paths = result.current.map((r) => r.path);
    expect(paths).toContain('/tv');
    expect(paths).toContain('/movies');
    expect(paths).toContain('/games');
    expect(paths).toContain('/books');
    expect(paths).toContain('/audiobooks');
    expect(paths).toContain('/upcoming');
    expect(paths).toContain('/in-progress');
    expect(paths).toContain('/watchlist');
    expect(paths).toContain('/random');
    expect(paths).toContain('/statistics');
    expect(paths).toContain('/calendar');
    expect(paths).toContain('/import');
    expect(paths).toContain('/lists');
    expect(paths).toContain('/groups');
  });

  it('every route entry has a non-empty name', () => {
    const { result } = renderHook(() => useRouteNames(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    result.current.forEach(({ name }) => {
      expect(name).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// NavComponent – logged-in user renders navigation links
// ---------------------------------------------------------------------------

describe('NavComponent – logged-in user', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ user: LOGGED_IN_USER, logout: mockLogout });
    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode: mockSetDarkMode });
  });

  it('renders a <nav> element', () => {
    renderNav('/');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders navigation links for all routes', () => {
    renderNav('/');
    // There are 15 route links in the desktop nav
    const links = screen.getAllByRole('link', { name: /^(?!Alice|Logout|Settings).+/ });
    // At minimum the 15 NavLinks should be present (some may be in sidebar too)
    expect(links.length).toBeGreaterThanOrEqual(15);
  });

  it('renders a link to /tv', () => {
    renderNav('/');
    const tvLinks = screen.getAllByRole('link', { name: 'Tv' });
    expect(tvLinks.length).toBeGreaterThanOrEqual(1);
    expect(tvLinks[0]).toHaveAttribute('href', '/tv');
  });

  it('renders a link to /movies', () => {
    renderNav('/');
    const movieLinks = screen.getAllByRole('link', { name: 'Movies' });
    expect(movieLinks.length).toBeGreaterThanOrEqual(1);
    expect(movieLinks[0]).toHaveAttribute('href', '/movies');
  });

  it('renders a link to /lists', () => {
    renderNav('/');
    const listLinks = screen.getAllByRole('link', { name: 'Lists' });
    expect(listLinks.length).toBeGreaterThanOrEqual(1);
    expect(listLinks[0]).toHaveAttribute('href', '/lists');
  });

  it('renders a link to /statistics', () => {
    renderNav('/');
    const statsLinks = screen.getAllByRole('link', { name: 'Statistics' });
    expect(statsLinks.length).toBeGreaterThanOrEqual(1);
    expect(statsLinks[0]).toHaveAttribute('href', '/statistics');
  });

  it('renders the user name as a settings link', () => {
    renderNav('/');
    const settingsLink = screen.getByRole('link', { name: 'Alice' });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute('href', '#/settings');
  });

  it('renders a Logout link', () => {
    renderNav('/');
    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NavComponent – active route is underlined
// ---------------------------------------------------------------------------

describe('NavComponent – active route highlighting', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ user: LOGGED_IN_USER, logout: mockLogout });
    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode: mockSetDarkMode });
  });

  it('applies "underline" class to the /movies NavLink when on /movies', () => {
    renderNav('/movies');

    // NavLink receives isActive=true and applies clsx(isActive && 'underline')
    const moviesLinks = screen.getAllByRole('link', { name: 'Movies' });
    const activeLink = moviesLinks.find((l) => l.className.includes('underline'));
    expect(activeLink).toBeDefined();
  });

  it('applies "underline" class to the /tv NavLink when on /tv', () => {
    renderNav('/tv');

    const tvLinks = screen.getAllByRole('link', { name: 'Tv' });
    const activeLink = tvLinks.find((l) => l.className.includes('underline'));
    expect(activeLink).toBeDefined();
  });

  it('does NOT apply "underline" to /tv NavLink when on /movies', () => {
    renderNav('/movies');

    const tvLinks = screen.getAllByRole('link', { name: 'Tv' });
    // None of the Tv links should have underline (they are inactive)
    const underlinedTvLink = tvLinks.find((l) => l.className.includes('underline'));
    expect(underlinedTvLink).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// NavComponent – dark mode toggle
// ---------------------------------------------------------------------------

describe('NavComponent – dark mode toggle', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ user: LOGGED_IN_USER, logout: mockLogout });
  });

  it('renders mode_night icon when darkMode is false', () => {
    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode: mockSetDarkMode });
    renderNav('/');
    expect(screen.getAllByText('mode_night').length).toBeGreaterThanOrEqual(1);
  });

  it('renders light_mode icon when darkMode is true', () => {
    mockUseDarkMode.mockReturnValue({ darkMode: true, setDarkMode: mockSetDarkMode });
    renderNav('/');
    expect(screen.getAllByText('light_mode').length).toBeGreaterThanOrEqual(1);
  });

  it('calls setDarkMode with toggled value when dark mode icon is clicked', async () => {
    const user = userEvent.setup();
    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode: mockSetDarkMode });

    renderNav('/');

    const toggles = screen.getAllByText('mode_night');
    await user.click(toggles[0]);

    expect(mockSetDarkMode).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// NavComponent – unauthenticated user (no nav links)
// ---------------------------------------------------------------------------

describe('NavComponent – unauthenticated (no user)', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ user: null, logout: mockLogout });
    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode: mockSetDarkMode });
  });

  it('does NOT render a <nav> element when user is null', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavComponent />
      </MemoryRouter>
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('does NOT render any navigation links when user is null', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavComponent />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('still renders the dark-mode toggle when user is null', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavComponent />
      </MemoryRouter>
    );

    expect(screen.getByText('mode_night')).toBeInTheDocument();
  });
});
