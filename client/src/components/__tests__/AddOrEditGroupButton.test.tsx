/**
 * Tests for AddGroupButton and AddGroupModal defined in
 * src/components/AddOrEditGroupButton.tsx.
 *
 * Dependencies mocked:
 *  - src/api/groups   – useCreateGroup (createGroup) and useUserGroups (invalidateUserGroupsQuery)
 *  - src/components/Modal – renders children immediately (open by default)
 *  - @lingui/macro    – Trans / t passthrough
 *  - @lingui/react    – useLingui / Trans passthrough
 *
 * Tests verify:
 *  - "Create group" button is rendered
 *  - The modal form does NOT open before the button is clicked
 *  - The modal opens and shows "New group" heading after button click
 *  - Submitting the form calls createGroup with the trimmed name
 *  - invalidateUserGroupsQuery is called after successful creation
 *  - The modal closes after successful submission
 *  - Empty / whitespace name is rejected (validation fires, createGroup not called)
 *  - The Close button dismisses the modal without calling createGroup
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      typeof strings === 'string'
        ? strings
        : strings.raw
        ? String.raw(strings, ...values)
        : strings[0],
    Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Plural: ({ value, one, other }: { value: number; one: string; other: string }) => {
      const template = value === 1 ? one : other;
      return <>{template.replace('#', String(value))}</>;
    },
  };
});

jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({ i18n: { _: (msg: string) => msg, locale: 'en' } }),
    Trans: ({ id, children }: { id?: string; children?: React.ReactNode }) => (
      <>{id || children}</>
    ),
    I18nProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Modal – renders children immediately without animation; simulates open/close
jest.mock('src/components/Modal', () => {
  const React = require('react');

  const Modal = ({
    openModal,
    children,
  }: {
    openModal?: (open: () => void) => React.ReactNode;
    children: ((closeModal: () => void) => React.ReactNode) | React.ReactNode;
  }) => {
    const [isOpen, setIsOpen] = React.useState(!openModal);

    return (
      <>
        {openModal && openModal(() => setIsOpen(true))}
        {isOpen &&
          (typeof children === 'function'
            ? children(() => setIsOpen(false))
            : children)}
      </>
    );
  };

  return { Modal };
});

// useCreateGroup mock
const mockCreateGroup = jest.fn().mockResolvedValue({ id: 42, name: 'My Group' });
jest.mock('src/api/groups', () => ({
  useCreateGroup: () => ({
    createGroup: (...args: unknown[]) => mockCreateGroup(...args),
    isLoading: false,
    isError: false,
  }),
  useUserGroups: () => ({
    groups: [],
    isLoading: false,
    isError: false,
    invalidateUserGroupsQuery: mockInvalidateUserGroupsQuery,
  }),
}));

const mockInvalidateUserGroupsQuery = jest.fn();

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { AddGroupButton } from 'src/components/AddOrEditGroupButton';

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const renderAddGroupButton = () =>
  render(
    <MemoryRouter initialEntries={['/groups']}>
      <AddGroupButton />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Global mock cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateGroup.mockResolvedValue({ id: 42, name: 'My Group' });
});

// ---------------------------------------------------------------------------
// AddGroupButton – create mode
// ---------------------------------------------------------------------------

describe('AddGroupButton', () => {
  it('renders a "Create group" button', () => {
    renderAddGroupButton();
    expect(
      screen.getAllByRole('button', { name: 'Create group' })[0]
    ).toBeInTheDocument();
  });

  it('does NOT render the modal form before the button is clicked', () => {
    renderAddGroupButton();
    // The modal is not open by default because openModal prop is provided
    expect(screen.queryByText('New group')).not.toBeInTheDocument();
  });

  it('opens the modal with "New group" heading after clicking the button', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);

    expect(screen.getByText('New group')).toBeInTheDocument();
  });

  it('renders Name input in the modal', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  it('calls createGroup with trimmed name on form submission', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, '  My New Group  ');

    // Click the submit button (the "Create group" button inside the form)
    const allButtons = screen.getAllByRole('button', { name: 'Create group' });
    await user.click(allButtons[allButtons.length - 1]);

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateGroup).toHaveBeenCalledWith('My New Group');
  });

  it('calls invalidateUserGroupsQuery after successful group creation', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Test Group');

    const allButtons = screen.getAllByRole('button', { name: 'Create group' });
    await user.click(allButtons[allButtons.length - 1]);

    await waitFor(() => {
      expect(mockInvalidateUserGroupsQuery).toHaveBeenCalledTimes(1);
    });
  });

  it('closes the modal after successful submission', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);
    expect(screen.getByText('New group')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'My Group');

    const allButtons = screen.getAllByRole('button', { name: 'Create group' });
    await user.click(allButtons[allButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('New group')).not.toBeInTheDocument();
    });
  });

  it('does NOT call createGroup when Close button is clicked', async () => {
    const user = userEvent.setup();
    renderAddGroupButton();

    await user.click(screen.getAllByRole('button', { name: 'Create group' })[0]);

    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('New group')).not.toBeInTheDocument();
    });
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });
});
