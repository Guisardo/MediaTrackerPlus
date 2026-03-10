/**
 * Tests for src/hooks/menu.tsx – useMenuComponent hook.
 *
 * The hook exposes:
 *   - Menu: a FunctionComponent that wraps arbitrary children with a
 *     click-to-toggle dropdown
 *   - selectedValue: the currently active item from the URL param
 *
 * MemoryRouter is required because the hook calls useUpdateSearchParams
 * internally (which reads/writes URL search params).
 */

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMenuComponent } from 'src/hooks/menu';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

type HarnessProps = {
  values: string[];
  initialSelection?: string;
  paramFilter?: string;
  handleFilterChange?: () => void;
  label?: string;
};

const Harness: React.FC<HarnessProps> = ({
  values,
  initialSelection,
  paramFilter = 'sort',
  handleFilterChange = jest.fn(),
  label = 'Trigger',
}) => {
  const { Menu, selectedValue } = useMenuComponent({
    values,
    initialSelection,
    paramFilter,
    handleFilterChange,
  });

  return (
    <>
      <Menu>
        <span>{label}</span>
      </Menu>
      <span data-testid="selectedValue">{selectedValue ?? ''}</span>
    </>
  );
};

function renderMenu(
  props: HarnessProps,
  initialEntries: string[] = ['/']
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Harness {...props} />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMenuComponent – Menu visibility', () => {
  it('does not show the dropdown list initially', () => {
    renderMenu({ values: ['Asc', 'Desc'] });

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows the dropdown list after clicking the trigger', async () => {
    const user = userEvent.setup();
    renderMenu({ values: ['Asc', 'Desc'] });

    await user.click(screen.getByText('Trigger'));

    expect(screen.getByText('Asc')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('hides the dropdown list after clicking the trigger a second time', async () => {
    const user = userEvent.setup();
    renderMenu({ values: ['Asc', 'Desc'] });

    await user.click(screen.getByText('Trigger'));
    expect(screen.getByText('Asc')).toBeInTheDocument();

    await user.click(screen.getByText('Trigger'));
    expect(screen.queryByText('Asc')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderMenu({ values: ['Asc', 'Desc'] });

    await user.click(screen.getByText('Trigger'));
    expect(screen.getByText('Asc')).toBeInTheDocument();

    // Click outside – userEvent.click on the body element triggers the
    // mousedown handler that hides the menu.
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Asc')).not.toBeInTheDocument();
    });
  });
});

describe('useMenuComponent – value selection', () => {
  it('calls handleFilterChange when a value is selected', async () => {
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();
    renderMenu({ values: ['Asc', 'Desc'], handleFilterChange });

    await user.click(screen.getByText('Trigger'));
    await user.click(screen.getByText('Asc'));

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('renders the initial selection from URL param', () => {
    renderMenu(
      { values: ['Asc', 'Desc'], paramFilter: 'sort' },
      ['/?sort=Desc']
    );

    expect(screen.getByTestId('selectedValue').textContent).toBe('Desc');
  });

  it('initializes selectedValue from initialSelection when URL param is absent', () => {
    renderMenu({ values: ['Asc', 'Desc'], initialSelection: 'Asc' });

    expect(screen.getByTestId('selectedValue').textContent).toBe('Asc');
  });
});
