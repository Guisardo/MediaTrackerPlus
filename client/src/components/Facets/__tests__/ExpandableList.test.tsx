/**
 * Tests for src/components/Facets/ExpandableList.tsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
  t: (s: TemplateStringsArray) => (typeof s === 'string' ? s : s[0]),
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

import { ExpandableList } from 'src/components/Facets/ExpandableList';

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => `Item ${i + 1}`);

const renderList = (visible: unknown[]) =>
  React.createElement(
    'ul',
    null,
    (visible as string[]).map((item) =>
      React.createElement('li', { key: item }, item)
    )
  );

describe('ExpandableList', () => {
  it('renders all items when count is below maxVisible', () => {
    const items = makeItems(3);
    render(
      React.createElement(ExpandableList, { items, maxVisible: 5, children: renderList })
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('truncates list to maxVisible items and shows "Show more" button', () => {
    const items = makeItems(20);
    render(
      React.createElement(ExpandableList, { items, maxVisible: 5, children: renderList })
    );

    expect(screen.getByText('Item 5')).toBeInTheDocument();
    expect(screen.queryByText('Item 6')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('expands to show all items after clicking "Show more"', async () => {
    const user = userEvent.setup();
    const items = makeItems(10);
    render(
      React.createElement(ExpandableList, { items, maxVisible: 3, children: renderList })
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });

  it('collapses back after clicking "Show less"', async () => {
    const user = userEvent.setup();
    const items = makeItems(10);
    render(
      React.createElement(ExpandableList, { items, maxVisible: 3, children: renderList })
    );

    // Expand
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Item 10')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Item 10')).not.toBeInTheDocument();
  });

  it('uses default maxVisible of 15 when not specified', () => {
    const items = makeItems(20);
    render(
      React.createElement(ExpandableList, { items, children: renderList })
    );

    expect(screen.getByText('Item 15')).toBeInTheDocument();
    expect(screen.queryByText('Item 16')).not.toBeInTheDocument();
  });
});
