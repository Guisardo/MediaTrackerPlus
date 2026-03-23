/**
 * Tests for ParentalRatingSection rendered within Details.tsx.
 *
 * Covers:
 *  - No parental section when all parental metadata fields are null/absent
 *  - Section renders when contentRatingSystem is provided
 *  - Section renders rating system, region, and label when all three are present
 *  - Section renders descriptors when provided
 *  - Section renders guidance summary when provided
 *  - Section renders category breakdowns when provided
 *  - Category entries with severity and description render correctly
 *  - Category entries without severity/description still render
 *  - Multiple categories all render
 *  - Empty descriptors array does not render the descriptors row
 *  - Empty categories array does not render the categories section
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MediaItemDetailsResponse } from 'mediatracker-api';

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
// Details.tsx → StarRating → App → Router → Calendar → @fullcalendar
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
  Button: ({ children, onClick, asChild }: any) => (
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
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import { ParentalRatingSection } from 'src/pages/Details';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a MediaItemDetailsResponse with only the parental fields we care about. */
function makeMediaItem(
  parental: Partial<
    Pick<
      MediaItemDetailsResponse,
      | 'contentRatingSystem'
      | 'contentRatingRegion'
      | 'contentRatingLabel'
      | 'contentRatingDescriptors'
      | 'parentalGuidanceSummary'
      | 'parentalGuidanceCategories'
    >
  >,
): MediaItemDetailsResponse {
  return {
    id: 1,
    title: 'Test Title',
    mediaType: 'movie',
    source: 'tmdb',
    ...parental,
  } as MediaItemDetailsResponse;
}

const renderSection = (mediaItem: MediaItemDetailsResponse) =>
  render(<ParentalRatingSection mediaItem={mediaItem} />);

// ---------------------------------------------------------------------------
// Tests – absence (no parental metadata)
// ---------------------------------------------------------------------------

describe('ParentalRatingSection – no parental metadata', () => {
  it('renders nothing when all parental fields are null', () => {
    const { container } = renderSection(
      makeMediaItem({
        contentRatingSystem: null,
        contentRatingRegion: null,
        contentRatingLabel: null,
        contentRatingDescriptors: null,
        parentalGuidanceSummary: null,
        parentalGuidanceCategories: null,
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all parental fields are absent (undefined)', () => {
    const { container } = renderSection(makeMediaItem({}));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when descriptors and categories are empty arrays', () => {
    const { container } = renderSection(
      makeMediaItem({
        contentRatingDescriptors: [],
        parentalGuidanceCategories: [],
      }),
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests – presence (parental metadata provided)
// ---------------------------------------------------------------------------

describe('ParentalRatingSection – rating fields', () => {
  it('renders the section when contentRatingSystem is provided', () => {
    renderSection(makeMediaItem({ contentRatingSystem: 'MPAA' }));
    expect(screen.getByTestId('parental-rating-section')).toBeInTheDocument();
  });

  it('renders a "Parental guidance" heading', () => {
    renderSection(makeMediaItem({ contentRatingSystem: 'MPAA' }));
    expect(screen.getByText(/parental guidance/i)).toBeInTheDocument();
  });

  it('renders rating label when contentRatingLabel is provided', () => {
    renderSection(makeMediaItem({ contentRatingLabel: 'PG-13' }));
    expect(screen.getByText(/PG-13/)).toBeInTheDocument();
  });

  it('renders rating system when contentRatingSystem is provided', () => {
    renderSection(makeMediaItem({ contentRatingSystem: 'MPAA' }));
    expect(screen.getByText(/MPAA/)).toBeInTheDocument();
  });

  it('renders rating region when contentRatingRegion is provided', () => {
    renderSection(makeMediaItem({ contentRatingRegion: 'US' }));
    expect(screen.getByText(/US/)).toBeInTheDocument();
  });

  it('renders all three rating fields combined when all are provided', () => {
    renderSection(
      makeMediaItem({
        contentRatingSystem: 'MPAA',
        contentRatingRegion: 'US',
        contentRatingLabel: 'R',
      }),
    );
    const ratingText = screen.getByText(/R.*MPAA.*US|MPAA.*US.*R|R.*US.*MPAA/);
    expect(ratingText).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests – descriptors
// ---------------------------------------------------------------------------

describe('ParentalRatingSection – descriptors', () => {
  it('renders descriptors when contentRatingDescriptors is non-empty', () => {
    renderSection(
      makeMediaItem({
        contentRatingDescriptors: ['Violence', 'Strong Language'],
      }),
    );
    expect(screen.getByText(/Violence, Strong Language/)).toBeInTheDocument();
  });

  it('does not render descriptors row when descriptors is empty array', () => {
    renderSection(
      makeMediaItem({
        contentRatingSystem: 'MPAA',
        contentRatingDescriptors: [],
      }),
    );
    expect(screen.queryByText(/Descriptors/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests – guidance summary
// ---------------------------------------------------------------------------

describe('ParentalRatingSection – guidance summary', () => {
  it('renders guidance summary when parentalGuidanceSummary is provided', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceSummary: 'Contains scenes of moderate violence.',
      }),
    );
    expect(
      screen.getByText(/Contains scenes of moderate violence\./),
    ).toBeInTheDocument();
  });

  it('does not render guidance row when parentalGuidanceSummary is null', () => {
    renderSection(
      makeMediaItem({
        contentRatingSystem: 'MPAA',
        parentalGuidanceSummary: null,
      }),
    );
    expect(screen.queryByText(/^Guidance:/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests – category breakdowns
// ---------------------------------------------------------------------------

describe('ParentalRatingSection – category breakdowns', () => {
  it('renders a category name when categories are provided', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceCategories: [
          { category: 'Violence', severity: 'Moderate' },
        ],
      }),
    );
    expect(screen.getByText('Violence')).toBeInTheDocument();
  });

  it('renders category severity when provided', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceCategories: [
          { category: 'Language', severity: 'Mild' },
        ],
      }),
    );
    expect(screen.getByText(/Mild/)).toBeInTheDocument();
  });

  it('renders category description when provided', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceCategories: [
          {
            category: 'Language',
            severity: null,
            description: 'Occasional strong language',
          },
        ],
      }),
    );
    expect(
      screen.getByText(/Occasional strong language/),
    ).toBeInTheDocument();
  });

  it('renders a category without severity or description', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceCategories: [{ category: 'Nudity' }],
      }),
    );
    expect(screen.getByText('Nudity')).toBeInTheDocument();
  });

  it('renders all provided categories', () => {
    renderSection(
      makeMediaItem({
        parentalGuidanceCategories: [
          { category: 'Violence', severity: 'Severe' },
          { category: 'Language', severity: 'Mild' },
          { category: 'Sexual Content' },
        ],
      }),
    );
    expect(screen.getByText('Violence')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Sexual Content')).toBeInTheDocument();
  });

  it('does not render categories section when categories is empty array', () => {
    renderSection(
      makeMediaItem({
        contentRatingSystem: 'MPAA',
        parentalGuidanceCategories: [],
      }),
    );
    expect(screen.queryByText(/Content categories/i)).not.toBeInTheDocument();
  });
});
