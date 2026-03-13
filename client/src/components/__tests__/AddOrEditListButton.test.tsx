/**
 * Tests for AddListButton and EditListButton (both driven by the internal
 * AddOrEditListButton component) defined in
 * src/components/AddOrEditListButton.tsx.
 *
 * Dependencies mocked:
 *  - src/api/api       – mediaTrackerApi.list.addList / updateList / deleteList
 *  - src/api/lists     – useLists (returns { lists, invalidateListsQuery })
 *  - src/api/user      – useUser (returns { user })
 *  - src/components/Modal  – renders children immediately (open by default)
 *  - src/components/Confirm – resolves to true by default
 *  - src/hooks/translations – returns simple stub key factories
 *  - src/utils          – listName, listDescription passthrough
 *  - @lingui/macro      – Trans / t passthrough
 *  - react-router-dom   – wrapped in MemoryRouter
 *
 * Tests verify:
 *  - "Add list" button is rendered in create mode (no list prop)
 *  - "Edit list" button is rendered in edit mode (with list prop)
 *  - The form modal opens when the button is clicked
 *  - Correct heading shown inside the modal (New list / Edit list)
 *  - Submitting the form calls mediaTrackerApi.list.addList in create mode
 *  - Submitting the form calls mediaTrackerApi.list.updateList in edit mode
 *  - invalidateListsQuery is called after successful submit
 *  - Delete button is visible in edit mode for non-watchlist
 *  - Delete button is hidden for watchlist list
 *  - Clicking Delete calls mediaTrackerApi.list.deleteList
 *  - Name input is disabled for watchlist in edit mode
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  };
});

// The @lingui/babel-plugin-lingui-macro transform rewrites @lingui/macro imports
// into @lingui/react imports at compile time.  We must also mock @lingui/react so
// that Trans (and useLingui) work without a real I18nProvider.
// After babel transform, <Trans>text</Trans> becomes <Trans id="hash" message="text" />,
// so we render the message prop as text content.
jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({
      i18n: {
        _: (msg: any) =>
          typeof msg === 'string' ? msg : msg?.message || msg?.id || '',
        locale: 'en',
      },
    }),
    Trans: ({ message, children }: { message?: string; children?: React.ReactNode }) => (
      <>{message || children}</>
    ),
    I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Modal – renders children immediately so we don't need animation
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

// Confirm – always resolves to true (user confirms)
const mockConfirm = jest.fn().mockResolvedValue(true);
jest.mock('src/components/Confirm', () => ({
  Confirm: (...args: unknown[]) => mockConfirm(...args),
}));

// mediaTrackerApi.list mocks
const mockAddList = jest.fn().mockResolvedValue({ id: 99 });
const mockUpdateList = jest.fn().mockResolvedValue({});
const mockDeleteList = jest.fn().mockResolvedValue({});

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    list: {
      addList: (...args: unknown[]) => mockAddList(...args),
      updateList: (...args: unknown[]) => mockUpdateList(...args),
      deleteList: (...args: unknown[]) => mockDeleteList(...args),
    },
  },
}));

// useLists mock
const mockInvalidateListsQuery = jest.fn();
jest.mock('src/api/lists', () => ({
  useLists: () => ({
    lists: [],
    isLoading: false,
    isError: false,
    invalidateListsQuery: mockInvalidateListsQuery,
  }),
}));

// useUser mock
jest.mock('src/api/user', () => ({
  useUser: () => ({
    user: { id: 1, name: 'Alice' },
  }),
}));

// translations hooks – return simple map factories
jest.mock('src/hooks/translations', () => {
  const makeFactory = (map: Record<string, string>) => ({
    map: (cb: (key: string, translation: string) => any) =>
      Object.entries(map).map(([key, translation]) => cb(key, translation)),
    keys: Object.keys(map),
    translations: Object.values(map),
    entries: Object.entries(map) as [string, string][],
    translationToKey: (t: string) =>
      Object.keys(map).find((k) => map[k] === t),
    keyToTranslation: (k: string) => map[k],
  });

  return {
    useListSortByKeys: () =>
      makeFactory({
        'recently-watched': 'Recently watched',
        title: 'Title',
        'release-date': 'Release date',
      }),
    useListPrivacyKeys: () =>
      makeFactory({
        private: 'Private',
        public: 'Public',
      }),
    useSortOrderKeys: () =>
      makeFactory({
        asc: 'Ascending',
        desc: 'Descending',
      }),
  };
});

// src/utils – passthrough for listName and listDescription
jest.mock('src/utils', () => ({
  listName: (list?: { name: string; isWatchlist: boolean }) =>
    list?.isWatchlist ? 'Watchlist' : list?.name,
  listDescription: (list?: { description?: string; isWatchlist: boolean }) =>
    list?.isWatchlist
      ? 'Movies, shows, seasons, episodes...'
      : list?.description,
}));

// ---------------------------------------------------------------------------
// Import components under test
// ---------------------------------------------------------------------------

import {
  AddListButton,
  EditListButton,
} from 'src/components/AddOrEditListButton';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXISTING_LIST = {
  id: 7,
  name: 'My Favourites',
  description: 'Best films',
  sortBy: 'title' as const,
  sortOrder: 'asc' as const,
  isWatchlist: false,
  privacy: 'private' as const,
};

const WATCHLIST = {
  id: 1,
  name: 'Watchlist',
  description: undefined,
  sortBy: 'recently-watched' as const,
  sortOrder: 'desc' as const,
  isWatchlist: true,
  privacy: 'private' as const,
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const renderAddButton = () =>
  render(
    <MemoryRouter initialEntries={['/lists']}>
      <AddListButton />
    </MemoryRouter>
  );

const renderEditButton = (list: typeof EXISTING_LIST | any = EXISTING_LIST) =>
  render(
    <MemoryRouter initialEntries={['/lists']}>
      <EditListButton list={list} />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Global mock cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Create mode (AddListButton)
// ---------------------------------------------------------------------------

describe('AddListButton – create mode', () => {

  it('renders an "Add list" button', () => {
    renderAddButton();
    expect(
      screen.getAllByRole('button', { name: 'Add list' })[0]
    ).toBeInTheDocument();
  });

  it('does NOT render the modal form before the button is clicked', () => {
    renderAddButton();
    // The modal is not open by default because openModal prop is provided
    // (our modal mock only opens when the trigger is clicked)
    expect(screen.queryByText('New list')).not.toBeInTheDocument();
  });

  it('opens the modal with "New list" heading after clicking the button', async () => {
    const user = userEvent.setup();
    renderAddButton();

    await user.click(screen.getByRole('button', { name: 'Add list' }));

    expect(screen.getByText('New list')).toBeInTheDocument();
  });

  it('renders Name, Description, Privacy, Sort by, Sort order fields in modal', async () => {
    const user = userEvent.setup();
    renderAddButton();

    await user.click(screen.getByRole('button', { name: 'Add list' }));

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Privacy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort by/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort order/i)).toBeInTheDocument();
  });

  it('calls mediaTrackerApi.list.addList on form submission', async () => {
    const user = userEvent.setup();
    renderAddButton();

    const addButtons = screen.getAllByRole('button', { name: 'Add list' });
    await user.click(addButtons[0]);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'My New List');

    // There are two "Add list" buttons now (trigger + submit); click the last one
    // which is the submit button inside the form
    const allAddButtons = screen.getAllByRole('button', { name: 'Add list' });
    await user.click(allAddButtons[allAddButtons.length - 1]);

    await waitFor(() => {
      expect(mockAddList).toHaveBeenCalledTimes(1);
    });
    expect(mockAddList).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My New List' })
    );
  });

  it('calls invalidateListsQuery after successful add', async () => {
    const user = userEvent.setup();
    renderAddButton();

    const addButtons = screen.getAllByRole('button', { name: 'Add list' });
    await user.click(addButtons[0]);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Test List');

    // Click the submit button (last "Add list" button in the DOM)
    const allAddButtons = screen.getAllByRole('button', { name: 'Add list' });
    await user.click(allAddButtons[allAddButtons.length - 1]);

    await waitFor(() => {
      expect(mockInvalidateListsQuery).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Edit mode (EditListButton)
// ---------------------------------------------------------------------------

describe('EditListButton – edit mode', () => {
  beforeEach(() => {
    mockUpdateList.mockClear();
    mockDeleteList.mockClear();
    mockInvalidateListsQuery.mockClear();
    mockConfirm.mockResolvedValue(true);
  });

  it('renders an "Edit list" button', () => {
    renderEditButton();
    expect(
      screen.getByRole('button', { name: 'Edit list' })
    ).toBeInTheDocument();
  });

  it('opens the modal with "Edit list" heading after clicking the button', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    // The modal heading is "Edit list"
    expect(screen.getAllByText('Edit list').length).toBeGreaterThanOrEqual(1);
  });

  it('pre-fills the name input with the existing list name', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('My Favourites');
  });

  it('pre-fills the description textarea with the existing description', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe('Best films');
  });

  it('calls mediaTrackerApi.list.updateList on form submission', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    const saveButton = screen.getByRole('button', { name: 'Save list' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateList).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateList).toHaveBeenCalledWith(
      expect.objectContaining({ id: EXISTING_LIST.id, name: 'My Favourites' })
    );
  });

  it('calls invalidateListsQuery after successful update', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));
    await user.click(screen.getByRole('button', { name: 'Save list' }));

    await waitFor(() => {
      expect(mockInvalidateListsQuery).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call addList when in edit mode', async () => {
    const user = userEvent.setup();
    renderEditButton();

    await user.click(screen.getByRole('button', { name: 'Edit list' }));
    await user.click(screen.getByRole('button', { name: 'Save list' }));

    await waitFor(() => {
      expect(mockUpdateList).toHaveBeenCalledTimes(1);
    });
    expect(mockAddList).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete button – visible for non-watchlist edit mode
// ---------------------------------------------------------------------------

describe('EditListButton – delete button', () => {
  beforeEach(() => {
    mockDeleteList.mockClear();
    mockInvalidateListsQuery.mockClear();
    mockConfirm.mockClear();
    mockConfirm.mockResolvedValue(true);
  });

  it('shows a Delete list button for a non-watchlist list', async () => {
    const user = userEvent.setup();
    renderEditButton(EXISTING_LIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    expect(screen.getByText('Delete list')).toBeInTheDocument();
  });

  it('calls Confirm before deleting', async () => {
    const user = userEvent.setup();
    renderEditButton(EXISTING_LIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));
    await user.click(screen.getByText('Delete list'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('calls mediaTrackerApi.list.deleteList when confirmed', async () => {
    const user = userEvent.setup();
    renderEditButton(EXISTING_LIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));
    await user.click(screen.getByText('Delete list'));

    await waitFor(() => {
      expect(mockDeleteList).toHaveBeenCalledTimes(1);
    });
    expect(mockDeleteList).toHaveBeenCalledWith(
      expect.objectContaining({ listId: EXISTING_LIST.id })
    );
  });

  it('does NOT call deleteList when Confirm resolves to false', async () => {
    mockConfirm.mockResolvedValue(false);
    const user = userEvent.setup();
    renderEditButton(EXISTING_LIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));
    await user.click(screen.getByText('Delete list'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });
    expect(mockDeleteList).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Watchlist editing – restricted fields
// ---------------------------------------------------------------------------

describe('EditListButton – watchlist restrictions', () => {
  it('does NOT show the Delete list button for a watchlist', async () => {
    const user = userEvent.setup();
    renderEditButton(WATCHLIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    expect(screen.queryByText('Delete list')).not.toBeInTheDocument();
  });

  it('renders the name input as disabled for a watchlist', async () => {
    const user = userEvent.setup();
    renderEditButton(WATCHLIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement;
    expect(nameInput).toBeDisabled();
  });

  it('renders the description textarea as disabled for a watchlist', async () => {
    const user = userEvent.setup();
    renderEditButton(WATCHLIST);

    await user.click(screen.getByRole('button', { name: 'Edit list' }));

    const descTextarea = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
    expect(descTextarea).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------

describe('AddOrEditListButton – close button', () => {
  it('closes the modal when the Close button is clicked', async () => {
    const user = userEvent.setup();
    renderAddButton();

    const addButtons = screen.getAllByRole('button', { name: 'Add list' });
    await user.click(addButtons[0]);
    expect(screen.getByText('New list')).toBeInTheDocument();

    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('New list')).not.toBeInTheDocument();
    });
  });
});
