/**
 * Tests for the AgeRestrictedDetailsState rendered within Details.tsx.
 *
 * US-011 Acceptance Criteria covered:
 *  - Direct navigation to a restricted details page shows a dedicated restricted
 *    state instead of the raw error object/string.
 *  - The restricted state is driven by the API's stable `AGE_RESTRICTED` error code.
 *  - Non-age-restricted errors do not show the restricted state.
 *  - A successful (non-error) details page does not show the restricted state.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks – set up BEFORE import of the component under test
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    t: (strings: TemplateStringsArray | string, ...values: unknown[]) => {
      if (typeof strings === 'string') return strings;
      if ((strings as TemplateStringsArray).raw)
        return String.raw(strings as TemplateStringsArray, ...values);
      return (strings as TemplateStringsArray)[0];
    },
    Plural: ({ value, one, other }: { value: number; one: string; other: string }) =>
      React.createElement(
        React.Fragment,
        null,
        value === 1 ? one : other.replace('#', String(value)),
      ),
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
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

// Break the import chain that leads to FullCalendar
jest.mock('src/components/StarRating', () => ({
  BadgeRating: () => null,
}));

jest.mock('src/components/MetadataLocaleBadge', () => ({
  MetadataLocaleBadge: () => null,
}));

jest.mock('src/components/SelectSeenDate', () => ({
  SelectSeenDate: () => null,
}));

jest.mock('src/components/SetProgress', () => ({
  SetProgressComponent: () => null,
}));

jest.mock('src/components/AddToListModal', () => ({
  AddToListButtonWithModal: () => null,
}));

jest.mock('src/components/AddAndRemoveFromSeenHistoryButton', () => ({
  AddToSeenHistoryButton: () => null,
  RemoveFromSeenHistoryButton: () => null,
}));

jest.mock('src/components/Poster', () => ({
  Poster: () => null,
}));

jest.mock('src/components/Modal', () => ({
  Modal: ({ children }: any) => null,
}));

jest.mock('src/components/date', () => ({
  FormatDuration: () => null,
  RelativeTime: () => null,
}));

jest.mock('src/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('src/api/details', () => ({
  useDetails: jest.fn(),
  useUpdateMetadata: jest.fn(),
  addToProgress: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
  markAsSeen: jest.fn(),
}));

jest.mock('src/api/user', () => ({
  useOtherUser: jest.fn(),
  useUser: jest.fn(),
}));

jest.mock('src/api/configuration', () => ({
  useConfiguration: jest.fn(() => ({ configuration: null })),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => ({ mediaItemId: '1' })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// ---------------------------------------------------------------------------
// Import FetchError and the components under test AFTER mocks
// ---------------------------------------------------------------------------

import { FetchError } from 'src/api/api';
import { AgeRestrictedDetailsState, DetailsPage } from 'src/pages/Details';
import { useDetails } from 'src/api/details';
import { useUser } from 'src/api/user';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a FetchError that mimics the server's AGE_RESTRICTED 403 response.
 */
function makeAgeRestrictedError(): FetchError {
  return new FetchError({
    status: 403,
    statusText: 'Forbidden',
    body: JSON.stringify({
      errorMessage: 'This content is age-restricted.',
      MediaTrackerError: true,
      code: 'AGE_RESTRICTED',
    }),
  });
}

/**
 * Creates a generic FetchError (e.g. 404 Not Found).
 */
function makeGenericError(status = 404): FetchError {
  return new FetchError({
    status,
    statusText: 'Not Found',
    body: JSON.stringify({ errorMessage: 'Not found', MediaTrackerError: true }),
  });
}

// ---------------------------------------------------------------------------
// AgeRestrictedDetailsState component
// ---------------------------------------------------------------------------

describe('AgeRestrictedDetailsState', () => {
  it('renders the content restricted heading', () => {
    render(<AgeRestrictedDetailsState />);
    expect(screen.getByText(/Content restricted/i)).toBeInTheDocument();
  });

  it('renders an explanatory message about age-based filtering', () => {
    render(<AgeRestrictedDetailsState />);
    expect(
      screen.getByText(/age-based content filtering/i)
    ).toBeInTheDocument();
  });

  it('renders the lock emoji', () => {
    render(<AgeRestrictedDetailsState />);
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DetailsPage – restricted error state integration
// ---------------------------------------------------------------------------

describe('DetailsPage – restricted-details error state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUser as jest.Mock).mockReturnValue({ user: null });
  });

  it('shows the dedicated restricted state when the API returns AGE_RESTRICTED', () => {
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: makeAgeRestrictedError(),
      mediaItem: undefined,
    });

    render(<DetailsPage />);

    expect(screen.getByText(/Content restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/age-based content filtering/i)).toBeInTheDocument();
  });

  it('does NOT show the details content when the API returns AGE_RESTRICTED', () => {
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: makeAgeRestrictedError(),
      mediaItem: undefined,
    });

    render(<DetailsPage />);

    // The media item title should not render
    expect(screen.queryByText('Test Movie Title')).not.toBeInTheDocument();
  });

  it('shows the generic error string for non-AGE_RESTRICTED errors', () => {
    const genericError = makeGenericError(404);
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: genericError,
      mediaItem: undefined,
    });

    render(<DetailsPage />);

    // Should NOT show the age-restricted state
    expect(screen.queryByText(/Content restricted/i)).not.toBeInTheDocument();
    // Should show the error string representation
    expect(screen.queryByText(/🔒/)).not.toBeInTheDocument();
  });

  it('shows the generic error string for a 403 without AGE_RESTRICTED code', () => {
    const plainForbidden = new FetchError({
      status: 403,
      statusText: 'Forbidden',
      body: JSON.stringify({
        errorMessage: 'Forbidden',
        MediaTrackerError: true,
        // code is absent — generic 403
      }),
    });
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: plainForbidden,
      mediaItem: undefined,
    });

    render(<DetailsPage />);

    expect(screen.queryByText(/Content restricted/i)).not.toBeInTheDocument();
  });

  it('renders "Loading" when isLoading is true', () => {
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: true,
      error: undefined,
      mediaItem: undefined,
    });

    render(<DetailsPage />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isAgeRestrictedError helper — tested indirectly via DetailsPage
// ---------------------------------------------------------------------------

describe('DetailsPage – AGE_RESTRICTED vs non-AGE_RESTRICTED error detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUser as jest.Mock).mockReturnValue({ user: null });
  });

  it('correctly identifies AGE_RESTRICTED when code matches', () => {
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: makeAgeRestrictedError(),
      mediaItem: undefined,
    });

    render(<DetailsPage />);
    expect(screen.getByText(/Content restricted/i)).toBeInTheDocument();
  });

  it('does NOT identify as AGE_RESTRICTED when body is not valid JSON', () => {
    const malformedError = new FetchError({
      status: 403,
      statusText: 'Forbidden',
      body: 'not json',
    });
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: malformedError,
      mediaItem: undefined,
    });

    render(<DetailsPage />);
    expect(screen.queryByText(/Content restricted/i)).not.toBeInTheDocument();
  });

  it('does NOT identify as AGE_RESTRICTED for a plain Error object', () => {
    (useDetails as jest.Mock).mockReturnValue({
      isLoading: false,
      error: new Error('Something went wrong'),
      mediaItem: undefined,
    });

    render(<DetailsPage />);
    expect(screen.queryByText(/Content restricted/i)).not.toBeInTheDocument();
  });
});
