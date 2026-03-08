/**
 * Tests for src/hooks/darkMode.tsx
 *
 * Covers:
 *   - DarkModeProvider initial state derived from localStorage.theme
 *   - setDarkMode(true)  → localStorage + classList + state update
 *   - setDarkMode(false) → localStorage + classList + state update
 *   - StorageEvent listener → updates state on external tab change
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DarkModeProvider, useDarkMode } from 'src/hooks/darkMode';

// ---------------------------------------------------------------------------
// Consumer helper — renders a component that exposes the dark-mode context
// so we can assert on values and call setDarkMode from the test.
// ---------------------------------------------------------------------------

const DarkModeConsumer: React.FC = () => {
  const { darkMode, setDarkMode } = useDarkMode();

  return (
    <div>
      <span data-testid="mode">{darkMode ? 'dark' : 'light'}</span>
      <button onClick={() => setDarkMode(true)}>Enable dark</button>
      <button onClick={() => setDarkMode(false)}>Disable dark</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <DarkModeProvider>
      <DarkModeConsumer />
    </DarkModeProvider>
  );

// ---------------------------------------------------------------------------
// Setup / Teardown — reset DOM and localStorage between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

// ---------------------------------------------------------------------------
// Initial state from localStorage
// ---------------------------------------------------------------------------

describe('DarkModeProvider — initial state', () => {
  it('initialises darkMode as false when localStorage.theme is not "dark"', () => {
    localStorage.theme = 'light';
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('initialises darkMode as false when localStorage is empty', () => {
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('initialises darkMode as true when localStorage.theme is "dark"', () => {
    localStorage.theme = 'dark';
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// setDarkMode(true)
// ---------------------------------------------------------------------------

describe('DarkModeProvider — setDarkMode(true)', () => {
  it('updates the displayed mode to "dark"', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByText('Enable dark'));

    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  it('writes "dark" to localStorage.theme', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByText('Enable dark'));

    expect(localStorage.theme).toBe('dark');
  });

  it('adds the "dark" class to document.documentElement', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByText('Enable dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setDarkMode(false)
// ---------------------------------------------------------------------------

describe('DarkModeProvider — setDarkMode(false)', () => {
  it('updates the displayed mode to "light" after being in dark mode', async () => {
    const user = userEvent.setup();
    localStorage.theme = 'dark';
    renderWithProvider();

    // Confirm we start dark
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    await user.click(screen.getByText('Disable dark'));

    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('writes "light" to localStorage.theme', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    // First enable, then disable
    await user.click(screen.getByText('Enable dark'));
    await user.click(screen.getByText('Disable dark'));

    expect(localStorage.theme).toBe('light');
  });

  it('removes the "dark" class from document.documentElement', async () => {
    const user = userEvent.setup();
    document.documentElement.classList.add('dark');
    renderWithProvider();

    await user.click(screen.getByText('Disable dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// StorageEvent listener (cross-tab sync)
// ---------------------------------------------------------------------------

describe('DarkModeProvider — StorageEvent listener', () => {
  it('switches to dark mode when a storage event sets theme to "dark"', () => {
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('light');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme', newValue: 'dark' })
      );
    });

    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  it('switches to light mode when a storage event sets theme to "light"', () => {
    localStorage.theme = 'dark';
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme', newValue: 'light' })
      );
    });

    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('ignores storage events that are not for the "theme" key', () => {
    renderWithProvider();

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'unrelated-key', newValue: 'dark' })
      );
    });

    // State must not have changed
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('removes the storage event listener on unmount', () => {
    const { unmount } = renderWithProvider();
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });
});
