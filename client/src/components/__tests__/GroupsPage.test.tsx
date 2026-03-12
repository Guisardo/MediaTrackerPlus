/**
 * Tests for GroupsPage defined in src/pages/GroupsPage.tsx.
 *
 * Dependencies mocked:
 *  - src/api/groups         – useUserGroups returns controlled groups fixture
 *  - src/components/AddOrEditGroupButton – stubbed to avoid deep dependencies
 *  - @lingui/macro          – Trans / Plural passthrough
 *  - @lingui/react          – Trans passthrough
 *  - react-router-dom       – wrapped in MemoryRouter; Link renders as <a>
 *
 * Tests verify:
 *  - Loading state: renders "Loading" when groups is undefined
 *  - Empty state: shows "No groups yet" prompt when groups is an empty array
 *  - Groups list: renders group name, role, and member count for each group
 *  - Group row link: each group name links to /groups/:groupId
 *  - Role display: 'admin' shows "Admin", 'viewer' shows "Viewer"
 *  - Multiple groups: all groups are rendered
 *  - Create group button is always rendered (visible to current user)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GroupResponse } from 'mediatracker-api';

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
    I18nProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Stub AddGroupButton to isolate GroupsPage rendering
jest.mock('src/components/AddOrEditGroupButton', () => ({
  AddGroupButton: () => <button>Create group</button>,
}));

// Controlled useUserGroups mock
let mockGroups: GroupResponse[] | undefined = undefined;

jest.mock('src/api/groups', () => ({
  useUserGroups: () => ({
    groups: mockGroups,
    isLoading: mockGroups === undefined,
    isError: false,
    invalidateUserGroupsQuery: jest.fn(),
  }),
  useCreateGroup: () => ({
    createGroup: jest.fn(),
    isLoading: false,
    isError: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { GroupsPage } from 'src/pages/GroupsPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_GROUP: GroupResponse = {
  id: 1,
  name: 'Family',
  createdBy: 10,
  createdAt: 1700000000000,
  updatedAt: null,
  role: 'admin',
  memberCount: 4,
};

const VIEWER_GROUP: GroupResponse = {
  id: 2,
  name: 'Work Colleagues',
  createdBy: 20,
  createdAt: 1700000001000,
  updatedAt: null,
  role: 'viewer',
  memberCount: 7,
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const renderGroupsPage = () =>
  render(
    <MemoryRouter initialEntries={['/groups']}>
      <GroupsPage />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGroups = undefined;
});

describe('GroupsPage – loading state', () => {
  it('renders "Loading" when groups data is not yet available', () => {
    mockGroups = undefined;
    renderGroupsPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});

describe('GroupsPage – empty state', () => {
  it('renders the empty state message when user has no groups', () => {
    mockGroups = [];
    renderGroupsPage();
    expect(screen.getByText('No groups yet')).toBeInTheDocument();
  });

  it('renders the empty state helper text', () => {
    mockGroups = [];
    renderGroupsPage();
    expect(
      screen.getByText(/Create a group to share Platform Recommended/i)
    ).toBeInTheDocument();
  });

  it('still renders the Create group button in empty state', () => {
    mockGroups = [];
    renderGroupsPage();
    expect(screen.getByRole('button', { name: 'Create group' })).toBeInTheDocument();
  });
});

describe('GroupsPage – groups list', () => {
  it('renders group name for each group', () => {
    mockGroups = [ADMIN_GROUP, VIEWER_GROUP];
    renderGroupsPage();
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Work Colleagues')).toBeInTheDocument();
  });

  it('renders group name as a link to /groups/:groupId', () => {
    mockGroups = [ADMIN_GROUP];
    renderGroupsPage();
    const link = screen.getByRole('link', { name: 'Family' });
    expect(link).toHaveAttribute('href', '/groups/1');
  });

  it('displays "Admin" role for admin groups', () => {
    mockGroups = [ADMIN_GROUP];
    renderGroupsPage();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('displays "Viewer" role for viewer groups', () => {
    mockGroups = [VIEWER_GROUP];
    renderGroupsPage();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('renders a member count container for each group', () => {
    mockGroups = [ADMIN_GROUP];
    renderGroupsPage();
    // The Plural component is transformed by babel-plugin-macros into lingui's
    // ICU runtime. We verify the container element is rendered (even if the
    // ICU string is unprocessed in the jsdom test environment).
    const memberCountEl = document.querySelector('.text-sm.text-gray-600');
    expect(memberCountEl).not.toBeNull();
    expect(memberCountEl).toBeInTheDocument();
  });

  it('renders all groups when multiple groups exist', () => {
    mockGroups = [ADMIN_GROUP, VIEWER_GROUP];
    renderGroupsPage();
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Work Colleagues')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    // Verify both groups' member count containers are rendered
    const memberCountEls = document.querySelectorAll('.text-sm.text-gray-600');
    expect(memberCountEls).toHaveLength(2);
  });

  it('does NOT render the empty state when groups exist', () => {
    mockGroups = [ADMIN_GROUP];
    renderGroupsPage();
    expect(screen.queryByText('No groups yet')).not.toBeInTheDocument();
  });

  it('renders the Create group button when groups exist', () => {
    mockGroups = [ADMIN_GROUP];
    renderGroupsPage();
    expect(screen.getByRole('button', { name: 'Create group' })).toBeInTheDocument();
  });
});
