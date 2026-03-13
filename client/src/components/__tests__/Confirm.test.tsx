/**
 * Tests for src/components/Confirm.tsx
 *
 * Confirm is an async imperative function that:
 *   1. Appends a div to document.body
 *   2. Uses createRoot to show a shadcn/ui Dialog with Yes/No buttons
 *   3. Resolves to true (Yes) or false (No)
 *   4. Unmounts the root and removes the appended div after resolving
 *
 * Radix Dialog and i18n dependencies are mocked so tests run synchronously
 * without animation frames or real i18n context.
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
 * Mock radix-ui Dialog primitives — render synchronously in jsdom.
 * The Dialog must propagate `open` state to Content so it conditionally
 * renders children.
 */
jest.mock('radix-ui', () => {
  const React = require('react');

  const Root = ({ children, open, onOpenChange, ...rest }: any) => (
    <div data-testid="dialog-root" {...rest}>
      {React.Children.map(children, (child: React.ReactElement) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { __open: open, __onOpenChange: onOpenChange } as any);
      })}
    </div>
  );

  const Portal = ({ children }: any) => <>{children}</>;

  const Overlay = React.forwardRef(({ children, ...props }: any, ref: any) => {
    const { __open, __onOpenChange, ...rest } = props;
    return <div ref={ref} {...rest}>{children}</div>;
  });

  const Content = React.forwardRef(({ children, __open, __onOpenChange, ...props }: any, ref: any) => {
    if (!__open) return null;
    return <div ref={ref} {...props}>{children}</div>;
  });

  const Close = React.forwardRef((props: any, ref: any) => {
    const { children, ...rest } = props;
    return <button ref={ref} {...rest}>{children}</button>;
  });

  const Trigger = React.forwardRef((props: any, ref: any) => {
    const { children, ...rest } = props;
    return <button ref={ref} {...rest}>{children}</button>;
  });

  const Title = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h2 ref={ref} {...props}>{children}</h2>
  ));

  const Description = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <p ref={ref} {...props}>{children}</p>
  ));

  return {
    Dialog: {
      Root,
      Portal,
      Overlay,
      Content,
      Close,
      Trigger,
      Title,
      Description,
    },
  };
});

import { Confirm } from 'src/components/Confirm';

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

  it('cleans up the appended node from document.body after resolving', async () => {
    const user = userEvent.setup();
    const bodyChildCountBefore = document.body.childNodes.length;

    const confirmPromise = Confirm('Clean up?');

    await waitFor(() => expect(screen.getByText('Yes')).toBeInTheDocument());

    // A new div was appended to body
    expect(document.body.childNodes.length).toBeGreaterThan(bodyChildCountBefore);

    await user.click(screen.getByText('Yes'));
    await confirmPromise;

    // After resolving, the appended div should be cleaned up
    expect(document.body.childNodes.length).toBe(bodyChildCountBefore);
  });
});
