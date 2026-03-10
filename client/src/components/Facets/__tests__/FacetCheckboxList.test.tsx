/**
 * Tests for src/components/Facets/FacetCheckboxList.tsx
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

import { FacetCheckboxList } from 'src/components/Facets/FacetCheckboxList';

const makeOptions = (values: string[]) =>
  values.map((value, i) => ({ value, count: i + 1 }));

describe('FacetCheckboxList', () => {
  it('renders a checkbox for each item', () => {
    render(
      React.createElement(FacetCheckboxList, {
        items: makeOptions(['Action', 'Drama', 'Comedy']),
        selectedValues: [],
        onSelectionChange: jest.fn(),
      })
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('renders item labels', () => {
    render(
      React.createElement(FacetCheckboxList, {
        items: makeOptions(['Action', 'Drama']),
        selectedValues: [],
        onSelectionChange: jest.fn(),
      })
    );

    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
  });

  it('renders count badges', () => {
    render(
      React.createElement(FacetCheckboxList, {
        items: [{ value: 'Action', count: 42 }],
        selectedValues: [],
        onSelectionChange: jest.fn(),
      })
    );

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('checks the checkbox for selected values', () => {
    render(
      React.createElement(FacetCheckboxList, {
        items: makeOptions(['Action', 'Drama']),
        selectedValues: ['Action'],
        onSelectionChange: jest.fn(),
      })
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('calls onSelectionChange with the new array when a checkbox is checked', async () => {
    const onSelectionChange = jest.fn();
    const user = userEvent.setup();

    render(
      React.createElement(FacetCheckboxList, {
        items: makeOptions(['Action', 'Drama']),
        selectedValues: ['Action'],
        onSelectionChange,
      })
    );

    // Click the unchecked "Drama" checkbox
    await user.click(screen.getAllByRole('checkbox')[1]);

    expect(onSelectionChange).toHaveBeenCalledWith(['Action', 'Drama']);
  });

  it('calls onSelectionChange with the value removed when a checked checkbox is unchecked', async () => {
    const onSelectionChange = jest.fn();
    const user = userEvent.setup();

    render(
      React.createElement(FacetCheckboxList, {
        items: makeOptions(['Action', 'Drama']),
        selectedValues: ['Action', 'Drama'],
        onSelectionChange,
      })
    );

    // Uncheck "Action"
    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(onSelectionChange).toHaveBeenCalledWith(['Drama']);
  });

  it('truncates list to maxVisible items (default 15)', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      value: `Genre ${i + 1}`,
      count: i + 1,
    }));

    render(
      React.createElement(FacetCheckboxList, {
        items,
        selectedValues: [],
        onSelectionChange: jest.fn(),
      })
    );

    // By default maxVisible=15, so Genre 16 should not be visible initially
    expect(screen.queryByText('Genre 16')).not.toBeInTheDocument();
    expect(screen.getByText('Genre 15')).toBeInTheDocument();
  });
});
