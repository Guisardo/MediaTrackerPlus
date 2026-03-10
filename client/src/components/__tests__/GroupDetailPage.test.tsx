/**
 * Tests for GroupDetailPage defined in src/pages/GroupDetailPage.tsx.
 *
 * Dependencies mocked:
 *  - src/api/groups         – useGroup, useUpdateGroup, useDeleteGroup,
 *                             useAddGroupMember, useRemoveGroupMember,
 *                             useUpdateGroupMemberRole, searchUsers
 *  - src/components/Confirm – resolves immediately with controlled value
 *  - react-router-dom       – wrapped in MemoryRouter; useNavigate mocked
 *  - @lingui/macro          – Trans / t passthrough
 *  - @lingui/react          – passthrough
 *
 * Tests verify:
 *  - Loading state renders "Loading" when group is undefined
 *  - Error state renders error message when isError is true
 *  - Admin sees inline name input (editable)
 *  - Viewer sees a plain h1 (read-only)
 *  - Members list is rendered for all users
 *  - Admin sees role dropdown and Remove button for each member
 *  - Viewer sees text role (no role dropdown, no Remove button)
 *  - Add member panel is shown for admin, hidden for viewer
 *  - Delete group button is shown for admin, hidden for viewer
 *  - Delete group calls deleteGroup and navigates to /groups on confirm
 *  - Delete group does NOT call deleteGroup when confirm is cancelled
 *  - Remove member calls removeGroupMember after confirm
 *  - Role change calls updateGroupMemberRole
 *  - Member search: debounced input triggers searchUsers; results are
 *    shown in dropdown; clicking a result calls addGroupMember
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GroupDetailResponse, GroupMemberResponse } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Mocks – set up BEFORE imports of the component under test
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    t: (strings: TemplateStringsArray | string, ...values: unknown[]) => {
      if (typeof strings === 'string') return strings;
      if (strings.raw) return String.raw(strings as TemplateStringsArray, ...values);
      return (strings as TemplateStringsArray)[0];
    },
    Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Plural: ({
      value,
      one,
      other,
    }: {
      value: number;
      one: string;
      other: string;
    }) => {
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

// Controlled navigate mock
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: '1' }),
  };
});

// Controlled Confirm mock — default to true (user clicks Yes)
let mockConfirmResult = true;
jest.mock('src/components/Confirm', () => ({
  Confirm: async (_message: string) => mockConfirmResult,
}));

// Controlled API hook mocks
const mockUpdateGroup = jest.fn().mockResolvedValue(undefined);
const mockDeleteGroup = jest.fn().mockResolvedValue(undefined);
const mockAddGroupMember = jest.fn().mockResolvedValue(undefined);
const mockRemoveGroupMember = jest.fn().mockResolvedValue(undefined);
const mockUpdateGroupMemberRole = jest.fn().mockResolvedValue(undefined);
const mockInvalidateGroupQuery = jest.fn();
const mockSearchUsers = jest.fn().mockResolvedValue([]);

let mockGroupData: GroupDetailResponse | undefined = undefined;
let mockGroupIsLoading = false;
let mockGroupIsError = false;

jest.mock('src/api/groups', () => ({
  useGroup: () => ({
    group: mockGroupData,
    isLoading: mockGroupIsLoading,
    isError: mockGroupIsError,
    invalidateGroupQuery: mockInvalidateGroupQuery,
  }),
  useUpdateGroup: () => ({
    updateGroup: (...args: unknown[]) => mockUpdateGroup(...args),
    isLoading: false,
    isError: false,
  }),
  useDeleteGroup: () => ({
    deleteGroup: () => mockDeleteGroup(),
    isLoading: false,
    isError: false,
  }),
  useAddGroupMember: () => ({
    addGroupMember: (...args: unknown[]) => mockAddGroupMember(...args),
    isLoading: false,
    isError: false,
  }),
  useRemoveGroupMember: () => ({
    removeGroupMember: (...args: unknown[]) => mockRemoveGroupMember(...args),
    isLoading: false,
    isError: false,
  }),
  useUpdateGroupMemberRole: () => ({
    updateGroupMemberRole: (...args: unknown[]) =>
      mockUpdateGroupMemberRole(...args),
    isLoading: false,
    isError: false,
  }),
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
}));

// ---------------------------------------------------------------------------
// Import component under test (AFTER mocks are set up)
// ---------------------------------------------------------------------------

import { GroupDetailPage } from 'src/pages/GroupDetailPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_MEMBER: GroupMemberResponse = {
  id: 1,
  userId: 10,
  name: 'Alice',
  role: 'admin',
  addedAt: 1700000000000,
};

const VIEWER_MEMBER: GroupMemberResponse = {
  id: 2,
  userId: 20,
  name: 'Bob',
  role: 'viewer',
  addedAt: 1700000001000,
};

const ADMIN_GROUP: GroupDetailResponse = {
  id: 1,
  name: 'Family',
  createdBy: 10,
  createdAt: 1700000000000,
  updatedAt: null,
  role: 'admin',
  members: [ADMIN_MEMBER, VIEWER_MEMBER],
};

const VIEWER_GROUP: GroupDetailResponse = {
  id: 1,
  name: 'Work Colleagues',
  createdBy: 20,
  createdAt: 1700000000000,
  updatedAt: null,
  role: 'viewer',
  members: [ADMIN_MEMBER, VIEWER_MEMBER],
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const renderGroupDetailPage = () =>
  render(
    <MemoryRouter initialEntries={['/groups/1']}>
      <GroupDetailPage />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Global mock cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGroupData = undefined;
  mockGroupIsLoading = false;
  mockGroupIsError = false;
  mockConfirmResult = true;
  mockSearchUsers.mockResolvedValue([]);
  mockNavigate.mockReset();
  mockDeleteGroup.mockResolvedValue(undefined);
  mockRemoveGroupMember.mockResolvedValue(undefined);
  mockUpdateGroupMemberRole.mockResolvedValue(undefined);
  mockAddGroupMember.mockResolvedValue(undefined);
  mockUpdateGroup.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Loading and error states
// ---------------------------------------------------------------------------

describe('GroupDetailPage – loading state', () => {
  it('renders "Loading" when group data is not yet available', () => {
    mockGroupIsLoading = true;
    renderGroupDetailPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});

describe('GroupDetailPage – error state', () => {
  it('renders an error message when isError is true', () => {
    mockGroupIsError = true;
    renderGroupDetailPage();
    expect(screen.getByText(/Failed to load group/i)).toBeInTheDocument();
  });

  it('renders error message when group data is null/undefined and not loading', () => {
    mockGroupData = undefined;
    mockGroupIsLoading = false;
    mockGroupIsError = false;
    renderGroupDetailPage();
    // When isLoading=false and isError=false and group=undefined → fallthrough to error branch
    expect(screen.getByText(/Failed to load group/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Admin view — management controls visible
// ---------------------------------------------------------------------------

describe('GroupDetailPage – admin view', () => {
  beforeEach(() => {
    mockGroupData = ADMIN_GROUP;
  });

  it('renders the group name in an editable input for admin', () => {
    renderGroupDetailPage();
    const nameInput = screen.getByRole('textbox', { name: /Group name/i });
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('Family');
  });

  it('renders the members list', () => {
    renderGroupDetailPage();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders role dropdowns for each member', () => {
    renderGroupDetailPage();
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Remove buttons for each member', () => {
    renderGroupDetailPage();
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the Add member search input', () => {
    renderGroupDetailPage();
    expect(
      screen.getByRole('textbox', { name: /Search users to add/i })
    ).toBeInTheDocument();
  });

  it('renders the Delete group button', () => {
    renderGroupDetailPage();
    expect(
      screen.getByRole('button', { name: /Delete group/i })
    ).toBeInTheDocument();
  });

  it('shows the admin role label', () => {
    renderGroupDetailPage();
    expect(screen.getAllByText('Admin')[0]).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Viewer view — read-only, no management controls
// ---------------------------------------------------------------------------

describe('GroupDetailPage – viewer view', () => {
  beforeEach(() => {
    mockGroupData = VIEWER_GROUP;
  });

  it('renders the group name as a plain heading (not editable)', () => {
    renderGroupDetailPage();
    expect(screen.getByRole('heading', { name: 'Work Colleagues' })).toBeInTheDocument();
    // No editable input for the name
    expect(screen.queryByRole('textbox', { name: /Group name/i })).not.toBeInTheDocument();
  });

  it('renders the members list in read-only mode', () => {
    renderGroupDetailPage();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does NOT render Remove buttons for viewer', () => {
    renderGroupDetailPage();
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
  });

  it('does NOT render role dropdowns for viewer', () => {
    renderGroupDetailPage();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('does NOT render the Add member panel for viewer', () => {
    renderGroupDetailPage();
    expect(
      screen.queryByRole('textbox', { name: /Search users to add/i })
    ).not.toBeInTheDocument();
  });

  it('does NOT render the Delete group button for viewer', () => {
    renderGroupDetailPage();
    expect(
      screen.queryByRole('button', { name: /Delete group/i })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Delete group
// ---------------------------------------------------------------------------

describe('GroupDetailPage – delete group', () => {
  beforeEach(() => {
    mockGroupData = ADMIN_GROUP;
  });

  it('calls deleteGroup and navigates to /groups when confirmed', async () => {
    const user = userEvent.setup();
    mockConfirmResult = true;
    renderGroupDetailPage();

    await user.click(screen.getByRole('button', { name: /Delete group/i }));

    await waitFor(() => {
      expect(mockDeleteGroup).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/groups', { replace: true });
  });

  it('does NOT call deleteGroup when confirm is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirmResult = false;
    renderGroupDetailPage();

    await user.click(screen.getByRole('button', { name: /Delete group/i }));

    await waitFor(() => {
      expect(mockDeleteGroup).not.toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Remove member
// ---------------------------------------------------------------------------

describe('GroupDetailPage – remove member', () => {
  beforeEach(() => {
    mockGroupData = ADMIN_GROUP;
  });

  it('calls removeGroupMember with correct userId after confirm', async () => {
    const user = userEvent.setup();
    mockConfirmResult = true;
    renderGroupDetailPage();

    // Find the Remove button for Bob (userId=20)
    const removeButtons = screen.getAllByRole('button', { name: /Remove Bob/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockRemoveGroupMember).toHaveBeenCalledWith(20);
    });
  });

  it('does NOT call removeGroupMember when confirm is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirmResult = false;
    renderGroupDetailPage();

    const removeButtons = screen.getAllByRole('button', { name: /Remove Bob/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockRemoveGroupMember).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Role change
// ---------------------------------------------------------------------------

describe('GroupDetailPage – role change', () => {
  beforeEach(() => {
    mockGroupData = ADMIN_GROUP;
  });

  it('calls updateGroupMemberRole with correct userId and new role', async () => {
    const user = userEvent.setup();
    renderGroupDetailPage();

    // Find role select for Bob (viewer → admin)
    const bobRoleSelect = screen.getByRole('combobox', {
      name: /Role for Bob/i,
    });
    await user.selectOptions(bobRoleSelect, 'admin');

    await waitFor(() => {
      expect(mockUpdateGroupMemberRole).toHaveBeenCalledWith({
        userId: 20,
        role: 'admin',
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Member search and add
// ---------------------------------------------------------------------------

describe('GroupDetailPage – add member', () => {
  beforeEach(() => {
    mockGroupData = ADMIN_GROUP;
  });

  it('shows search results after typing in the search input', async () => {
    const user = userEvent.setup();

    mockSearchUsers.mockResolvedValue([
      { id: 30, name: 'Charlie' },
      { id: 40, name: 'Diana' },
    ]);

    renderGroupDetailPage();

    const searchInput = screen.getByRole('textbox', {
      name: /Search users to add/i,
    });

    await user.type(searchInput, 'Ch');

    // Wait for debounce (300ms) and then the async call to resolve
    await waitFor(
      () => {
        expect(mockSearchUsers).toHaveBeenCalledWith('Ch');
      },
      { timeout: 2000 }
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });

  it('calls addGroupMember when a search result is clicked', async () => {
    const user = userEvent.setup();

    mockSearchUsers.mockResolvedValue([{ id: 30, name: 'Charlie' }]);

    renderGroupDetailPage();

    const searchInput = screen.getByRole('textbox', {
      name: /Search users to add/i,
    });

    await user.type(searchInput, 'Ch');

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Charlie'));

    await waitFor(() => {
      expect(mockAddGroupMember).toHaveBeenCalledWith({
        userId: 30,
        role: 'viewer',
      });
    });
  });

  it('filters out existing members from search results', async () => {
    const user = userEvent.setup();

    // Alice (userId=10) and Bob (userId=20) are already members
    mockSearchUsers.mockResolvedValue([
      { id: 10, name: 'Alice' },  // existing — should be filtered out
      { id: 30, name: 'Charlie' }, // not a member — should appear
    ]);

    renderGroupDetailPage();

    const searchInput = screen.getByRole('textbox', {
      name: /Search users to add/i,
    });

    await user.type(searchInput, 'x');

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    // Alice should NOT appear because she is already a member
    expect(screen.queryAllByText('Alice')).toHaveLength(1); // only the member row, not in dropdown
  });

  it('shows no results message when query returns empty', async () => {
    const user = userEvent.setup();

    mockSearchUsers.mockResolvedValue([]);

    renderGroupDetailPage();

    const searchInput = screen.getByRole('textbox', {
      name: /Search users to add/i,
    });

    await user.type(searchInput, 'zzz');

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });
});
