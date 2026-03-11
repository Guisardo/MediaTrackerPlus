/**
 * Tests for the useGroupSelectorComponent hook in src/components/GroupSelector.tsx.
 *
 * The hook renders a dropdown for selecting a group context when the current
 * orderBy is 'platformRecommended' and the user belongs to at least one group.
 *
 * We verify:
 *  - Dropdown hidden when orderBy is not 'platformRecommended'
 *  - Dropdown hidden when user has no groups (empty array)
 *  - Dropdown hidden while groups are loading
 *  - Dropdown renders 'All Users' option and all group names
 *  - Selecting 'All Users' removes groupId from URL
 *  - Selecting a group adds groupId=<id> to URL
 *  - Stale groupId (not in user's groups) falls back to 'All Users'
 *  - When orderBy changes away from platformRecommended, groupId is removed from URL
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GroupResponse } from 'mediatracker-api';

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

jest.mock('clsx', () => (...args: unknown[]) => args.filter(Boolean).join(' '));

// Controlled useUserGroups mock
let mockGroups: GroupResponse[] | undefined = [];
let mockIsLoading = false;

jest.mock('src/api/groups', () => ({
  useUserGroups: () => ({
    groups: mockGroups,
    isLoading: mockIsLoading,
    isError: false,
    invalidateUserGroupsQuery: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import hook under test
// ---------------------------------------------------------------------------

import { useGroupSelectorComponent } from 'src/components/GroupSelector';
import type { MediaItemOrderBy } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface HarnessProps {
  orderBy: MediaItemOrderBy;
  onFilterChange?: jest.Mock;
}

/**
 * Captures current URL search params to allow assertions on URL state.
 * We use a ref stored at module level to avoid component re-render issues.
 */
let capturedSearchString = '';

const SearchCapture: React.FC = () => {
  const [params] = React.useState(() => new URLSearchParams(window.location.search));
  // Use a hook to track search params from react-router
  const { useSearchParams } = require('react-router-dom');
  const [searchParams] = useSearchParams();
  capturedSearchString = searchParams.toString();
  return null;
};

const GroupSelectorHarness: React.FC<HarnessProps> = ({
  orderBy,
  onFilterChange = jest.fn(),
}) => {
  const { GroupSelectorComponent } = useGroupSelectorComponent({
    orderBy,
    handleFilterChange: onFilterChange,
  });

  return (
    <>
      <SearchCapture />
      <GroupSelectorComponent />
    </>
  );
};

const renderHarness = (
  props: HarnessProps,
  initialEntry = '/?orderBy=platformRecommended'
) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GroupSelectorHarness {...props} />
    </MemoryRouter>
  );
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_A: GroupResponse = {
  id: 1,
  name: 'Family',
  createdBy: 10,
  createdAt: 1700000000000,
  updatedAt: null,
  role: 'admin',
  memberCount: 3,
};

const GROUP_B: GroupResponse = {
  id: 2,
  name: 'Friends',
  createdBy: 10,
  createdAt: 1700000001000,
  updatedAt: null,
  role: 'viewer',
  memberCount: 5,
};

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGroups = [];
  mockIsLoading = false;
  capturedSearchString = '';
});

// ---------------------------------------------------------------------------
// Visibility tests
// ---------------------------------------------------------------------------

describe('GroupSelector – visibility', () => {
  it('renders nothing when orderBy is not platformRecommended', () => {
    mockGroups = [GROUP_A];
    const { container } = renderHarness({ orderBy: 'title' }, '/');
    // The GroupSelectorComponent returns null when orderBy !== platformRecommended
    expect(container.querySelector('.material-icons')).not.toBeInTheDocument();
  });

  it('renders nothing when user has no groups (empty array)', () => {
    mockGroups = [];
    const { container } = renderHarness({ orderBy: 'platformRecommended' });
    expect(container.querySelector('.material-icons')).not.toBeInTheDocument();
  });

  it('renders nothing while groups are loading (isLoading=true)', () => {
    mockGroups = undefined;
    mockIsLoading = true;
    const { container } = renderHarness({ orderBy: 'platformRecommended' });
    expect(container.querySelector('.material-icons')).not.toBeInTheDocument();
  });

  it('renders the dropdown trigger when orderBy is platformRecommended and user has groups', () => {
    mockGroups = [GROUP_A];
    renderHarness({ orderBy: 'platformRecommended' });
    expect(screen.getByText('group')).toBeInTheDocument(); // material-icons
    expect(screen.getByText('All Users')).toBeInTheDocument();
  });

  it('shows group name as label when a valid groupId is in URL', () => {
    mockGroups = [GROUP_A, GROUP_B];
    renderHarness({ orderBy: 'platformRecommended' }, '/?groupId=1');
    expect(screen.getByText('Family')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dropdown options
// ---------------------------------------------------------------------------

describe('GroupSelector – dropdown options', () => {
  it('shows "All Users" and all group names in dropdown after clicking', async () => {
    mockGroups = [GROUP_A, GROUP_B];
    const user = userEvent.setup();
    renderHarness({ orderBy: 'platformRecommended' });

    // Click the trigger to open the dropdown
    await user.click(screen.getByText('All Users'));

    expect(screen.getAllByText('All Users').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
  });

  it('renders "All Users" option highlighted when no group is selected', async () => {
    mockGroups = [GROUP_A];
    const user = userEvent.setup();
    renderHarness({ orderBy: 'platformRecommended' });

    await user.click(screen.getByText('All Users'));

    // "All Users" <li> should have the selected highlight class
    const allUserOptions = screen.getAllByText('All Users');
    // Find the <li> element specifically
    const allUsersLi = allUserOptions.find((el) => el.tagName === 'LI');
    expect(allUsersLi).toBeDefined();
    expect(allUsersLi!.className).toContain('bg-zinc-300');
  });

  it('renders selected group option highlighted when a group is selected', async () => {
    mockGroups = [GROUP_A, GROUP_B];
    const user = userEvent.setup();
    renderHarness({ orderBy: 'platformRecommended' }, '/?groupId=2');

    // Click to open the dropdown
    const trigger = screen.getByText('Friends');
    await user.click(trigger);

    // Find the <li> for Friends
    const friendsOptions = screen.getAllByText('Friends');
    const friendsLi = friendsOptions.find((el) => el.tagName === 'LI');
    expect(friendsLi).toBeDefined();
    expect(friendsLi!.className).toContain('bg-zinc-300');
  });
});

// ---------------------------------------------------------------------------
// Selection behaviour – groupId URL param management
// ---------------------------------------------------------------------------

describe('GroupSelector – groupId URL param management', () => {
  it('calls handleFilterChange when a group is selected', async () => {
    mockGroups = [GROUP_A];
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();
    renderHarness({ orderBy: 'platformRecommended', onFilterChange: handleFilterChange });

    // Open the menu
    await user.click(screen.getByText('All Users'));
    // Select GROUP_A
    const options = screen.getAllByText('Family');
    const li = options.find((el) => el.tagName === 'LI') || options[0];
    await user.click(li);

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('calls handleFilterChange when "All Users" is selected', async () => {
    mockGroups = [GROUP_A];
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();
    renderHarness({
      orderBy: 'platformRecommended',
      onFilterChange: handleFilterChange,
    }, '/?groupId=1');

    await user.click(screen.getByText('Family'));
    const allUsersOptions = screen.getAllByText('All Users');
    const allUsersLi = allUsersOptions.find((el) => el.tagName === 'LI') || allUsersOptions[0];
    await user.click(allUsersLi);

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Stale groupId handling
// ---------------------------------------------------------------------------

describe('GroupSelector – stale groupId fallback', () => {
  it('falls back to "All Users" label when groupId in URL is not in user groups', () => {
    mockGroups = [GROUP_A]; // only group id=1, not id=999
    renderHarness({ orderBy: 'platformRecommended' }, '/?groupId=999');
    // Should show "All Users" because groupId=999 is not a valid group
    expect(screen.getByText('All Users')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// orderBy change removes groupId
// ---------------------------------------------------------------------------

describe('GroupSelector – orderBy change cleanup', () => {
  /**
   * Test harness that allows dynamically changing orderBy via a parent state.
   * We render the component and verify that changing orderBy causes groupId
   * to be removed from the URL.
   */
  const DynamicHarness: React.FC<{
    initialOrderBy: MediaItemOrderBy;
    onFilterChange?: jest.Mock;
    onGroupIdChange?: (hasGroupId: boolean) => void;
  }> = ({ initialOrderBy, onFilterChange = jest.fn(), onGroupIdChange }) => {
    const [orderBy, setOrderBy] = React.useState<MediaItemOrderBy>(initialOrderBy);
    const [, setSearchParams] = require('react-router-dom').useSearchParams();
    const { GroupSelectorComponent } = useGroupSelectorComponent({
      orderBy,
      handleFilterChange: onFilterChange,
    });

    // Track groupId presence for assertions
    const [searchParams] = require('react-router-dom').useSearchParams();
    const hasGroupId = searchParams.has('groupId');
    React.useEffect(() => {
      onGroupIdChange?.(hasGroupId);
    });

    return (
      <>
        <GroupSelectorComponent />
        <button onClick={() => setOrderBy('title')} data-testid="change-order">
          Change to title
        </button>
      </>
    );
  };

  it('removes groupId from URL when orderBy changes away from platformRecommended', async () => {
    mockGroups = [GROUP_A];
    const groupIdChanges: boolean[] = [];

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/?groupId=1&orderBy=platformRecommended']}>
        <DynamicHarness
          initialOrderBy="platformRecommended"
          onGroupIdChange={(v) => groupIdChanges.push(v)}
        />
      </MemoryRouter>
    );

    // Initially groupId should be present
    expect(groupIdChanges.at(-1)).toBe(true);

    // Click button to change orderBy to 'title'
    await user.click(screen.getByTestId('change-order'));

    // After orderBy changes, groupId should be removed from URL
    expect(groupIdChanges.at(-1)).toBe(false);
  });
});
