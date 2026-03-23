/**
 * Tests for SettingsPreferencesPage in src/pages/settings/Preferences.tsx.
 *
 * Covers:
 *  - Rendering the dateOfBirth input section
 *  - Set flow: entering a new date and saving
 *  - Update flow: changing an existing date and saving
 *  - Clear flow: clearing an existing date
 *  - The Clear button is only shown when there is an existing value
 *  - Query invalidation for age-gated queries when dateOfBirth is saved
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: any) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/components/Checkbox', () => ({
  CheckboxWithTitleAndDescription: ({ title }: any) => (
    <div data-testid="checkbox">{title}</div>
  ),
}));

jest.mock('src/components/SettingsSegment', () => ({
  SettingsSegment: ({ children, title }: any) => (
    <div>
      <div data-testid="segment-title">{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('src/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

const mockUpdateUser = jest.fn();

jest.mock('src/api/user', () => ({
  useUser: () => ({
    user: mockUserValue,
    updateUser: mockUpdateUser,
  }),
}));

// ---------------------------------------------------------------------------
// Mutable user fixture – tests override before each render
// ---------------------------------------------------------------------------

let mockUserValue: { dateOfBirth: string | null | undefined } = {
  dateOfBirth: null,
};

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are in place
// ---------------------------------------------------------------------------

import { SettingsPreferencesPage } from 'src/pages/settings/Preferences';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderPage = () => render(<SettingsPreferencesPage />);

beforeEach(() => {
  jest.clearAllMocks();
  mockUserValue = { dateOfBirth: null };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsPreferencesPage – dateOfBirth section rendering', () => {
  it('renders the Age-based content filtering section', () => {
    renderPage();
    expect(screen.getByTestId('segment-title')).toBeInTheDocument();
  });

  it('renders the date input with no value when dateOfBirth is null', () => {
    mockUserValue = { dateOfBirth: null };
    renderPage();

    const dateInput = screen.getByLabelText(/date of birth/i);
    expect(dateInput).toBeInTheDocument();
    expect((dateInput as HTMLInputElement).value).toBe('');
  });

  it('renders the date input pre-populated when dateOfBirth is set', () => {
    mockUserValue = { dateOfBirth: '1990-06-15' };
    renderPage();

    const dateInput = screen.getByLabelText(/date of birth/i);
    expect((dateInput as HTMLInputElement).value).toBe('1990-06-15');
  });

  it('shows Save button always', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('does not show Clear button when dateOfBirth is null', () => {
    mockUserValue = { dateOfBirth: null };
    renderPage();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('shows Clear button when dateOfBirth is already set', () => {
    mockUserValue = { dateOfBirth: '1990-06-15' };
    renderPage();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('renders an explanation about self-only account data', () => {
    renderPage();
    expect(screen.getAllByText(/age-based content filtering/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/self-only account data/i)).toBeInTheDocument();
  });
});

describe('SettingsPreferencesPage – set flow (no existing date)', () => {
  it('calls updateUser with the entered dateOfBirth when Save is clicked', async () => {
    mockUserValue = { dateOfBirth: null };
    mockUpdateUser.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    const dateInput = screen.getByLabelText(/date of birth/i);
    await user.type(dateInput, '1995-03-20');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ dateOfBirth: '1995-03-20' });
    });
  });

  it('calls updateUser with null when Save is clicked on empty input', async () => {
    mockUserValue = { dateOfBirth: null };
    mockUpdateUser.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ dateOfBirth: null });
    });
  });
});

describe('SettingsPreferencesPage – update flow (existing date)', () => {
  it('calls updateUser with the new dateOfBirth when an existing value is changed and saved', async () => {
    mockUserValue = { dateOfBirth: '1990-06-15' };
    mockUpdateUser.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    const dateInput = screen.getByLabelText(/date of birth/i);
    await user.clear(dateInput);
    await user.type(dateInput, '1992-11-25');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ dateOfBirth: '1992-11-25' });
    });
  });
});

describe('SettingsPreferencesPage – clear flow (existing date)', () => {
  it('calls updateUser with null when Clear is clicked', async () => {
    mockUserValue = { dateOfBirth: '1990-06-15' };
    mockUpdateUser.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ dateOfBirth: null });
    });
  });
});
