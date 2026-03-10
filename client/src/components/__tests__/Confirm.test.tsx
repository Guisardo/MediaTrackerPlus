/**
 * Tests for src/components/Confirm.tsx
 *
 * Confirm is an async imperative function that:
 *   1. Appends a div to document#portal
 *   2. Uses ReactDOM.render to show a Modal with Yes/No buttons
 *   3. Resolves to true (Yes) or false (No)
 *   4. Removes the appended div from the portal after resolving
 *
 * All heavy dependencies (Modal, @react-spring/web, @lingui/macro,
 * @lingui/react) are mocked so tests run synchronously without animation
 * frames or real i18n context.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

jest.mock('@lingui/core', () => ({
  i18n: { _: (descriptor: unknown) => descriptor },
  setupI18n: jest.fn(),
}));

/**
 * Simplified Modal: immediately renders children with a no-op closeModal.
 * This bypasses @react-spring/web and Portal dependencies.
 * React is required inside the factory because jest.mock is hoisted before
 * imports and the outer React variable is not yet defined.
 */
jest.mock('src/components/Modal', () => {
  const React = require('react');
  return {
    Modal: ({ children }: { children: (closeModal: () => void) => React.ReactElement }) =>
      React.createElement('div', { 'data-testid': 'modal-wrapper' }, children(() => { /* noop */ })),
  };
});

import { Confirm } from 'src/components/Confirm';

// ---------------------------------------------------------------------------
// DOM setup – #portal element required by Confirm
// ---------------------------------------------------------------------------

let portalEl: HTMLDivElement;

beforeEach(() => {
  portalEl = document.createElement('div');
  portalEl.id = 'portal';
  document.body.appendChild(portalEl);
});

afterEach(() => {
  // Clean up any lingering portal children
  while (portalEl.firstChild) {
    portalEl.removeChild(portalEl.firstChild);
  }
  document.body.removeChild(portalEl);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Confirm', () => {
  it('renders the message text inside the dialog', async () => {
    const confirmPromise = Confirm('Are you sure?');

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    // Click No to clean up
    await userEvent.click(screen.getByText('No'));
    await confirmPromise;
  });

  it('resolves to true when the Yes button is clicked', async () => {
    const user = userEvent.setup();
    const confirmPromise = Confirm('Delete item?');

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Yes'));

    expect(await confirmPromise).toBe(true);
  });

  it('resolves to false when the No button is clicked', async () => {
    const user = userEvent.setup();
    const confirmPromise = Confirm('Delete item?');

    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    await user.click(screen.getByText('No'));

    expect(await confirmPromise).toBe(false);
  });

  it('removes the appended node from the portal after resolving', async () => {
    const user = userEvent.setup();
    const confirmPromise = Confirm('Clean up?');

    await waitFor(() => expect(screen.getByText('Yes')).toBeInTheDocument());

    const childCountBefore = portalEl.childNodes.length;
    expect(childCountBefore).toBeGreaterThan(0);

    await user.click(screen.getByText('Yes'));
    await confirmPromise;

    expect(portalEl.childNodes.length).toBe(childCountBefore - 1);
  });
});
