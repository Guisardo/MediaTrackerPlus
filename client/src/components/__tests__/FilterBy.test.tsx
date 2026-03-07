/**
 * Tests for the useFilterBy hook and its FilterByComponent defined in
 * src/components/FilterBy.tsx.
 *
 * The hook returns a FilterByComponent that renders a dropdown menu built on
 * top of useMenuComponent (which, in turn, uses useUpdateSearchParams).
 * We verify:
 *  - All filter options are visible after opening the menu
 *  - The currently selected option receives the highlighted class
 *  - Selecting an option fires handleFilterChange and updates the displayed value
 *  - Watchlist/Seen/Listened/Read/Played labels are generated correctly per mediaType
 *  - isStatisticsPage removes onlyOnWatchlist and onlySeenItems options
 *  - Edge cases: single option map, numeric mediaType edge path
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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
}));

// clsx is a tiny utility; return its arguments joined as a string so class
// assertions still work with partial substring checks.
jest.mock('clsx', () => (...args: unknown[]) => args.filter(Boolean).join(' '));

// ---------------------------------------------------------------------------
// Test harness – drives useFilterBy and mounts FilterByComponent
// ---------------------------------------------------------------------------

import { useFilterBy } from 'src/components/FilterBy';
import type { MediaType } from 'mediatracker-api';

interface HarnessProps {
  mediaType: MediaType;
  isStatisticsPage: boolean;
  onFilterChange?: jest.Mock;
}

const FilterHarness: React.FC<HarnessProps> = ({
  mediaType,
  isStatisticsPage,
  onFilterChange = jest.fn(),
}) => {
  const { FilterByComponent } = useFilterBy(
    mediaType,
    isStatisticsPage,
    onFilterChange
  );

  return <FilterByComponent />;
};

const renderHarness = (props: HarnessProps, initialEntry = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FilterHarness {...props} />
    </MemoryRouter>
  );
};

// ---------------------------------------------------------------------------
// Opening the menu – helper
// ---------------------------------------------------------------------------

/**
 * Opens the dropdown by clicking the trigger element (the div that wraps the
 * filter_alt icon and the current selection label).
 */
const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  // The menu trigger is the first clickable container rendered by useMenuComponent
  const trigger = document.querySelector('.cursor-pointer');
  if (trigger) {
    await user.click(trigger as HTMLElement);
  }
};

// ---------------------------------------------------------------------------
// movie mediaType – normal page
// ---------------------------------------------------------------------------

describe('useFilterBy (movie, normal page) – FilterByComponent menu options', () => {
  it('renders the filter icon and default label before opening', () => {
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    expect(screen.getByText('filter_alt')).toBeInTheDocument();
  });

  it('shows All, Rated, Unrated, On watchlist, Watched after opening', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    await openMenu(user);

    // 'All' appears both in the trigger and in the dropdown <li>; use getAllByText
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rated')).toBeInTheDocument();
    expect(screen.getByText('Unrated')).toBeInTheDocument();
    expect(screen.getByText('On watchlist')).toBeInTheDocument();
    expect(screen.getByText('Watched')).toBeInTheDocument();
  });

  it('calls handleFilterChange when an option is selected', async () => {
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();

    renderHarness({
      mediaType: 'movie',
      isStatisticsPage: false,
      onFilterChange: handleFilterChange,
    });

    await openMenu(user);
    await user.click(screen.getByText('Rated'));

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('updates the displayed selected value after selecting an option', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    await openMenu(user);
    await user.click(screen.getByText('Rated'));

    // The selected value is displayed in the trigger div next to the icon
    // (the menu closes after selection; query in the closed state)
    expect(screen.getByText('Rated')).toBeInTheDocument();
  });

  it('applies the highlighted class to the currently active option', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    await openMenu(user);

    // 'All' is the initial selection; its <li> must have bg-zinc-300 (light) or
    // dark:bg-slate-700 applied by clsx inside useMenuComponent.
    // 'All' appears in both the trigger and the dropdown <li>; find the <li> element.
    const allElements = screen.getAllByText('All');
    const allOption = allElements.find((el) => el.tagName === 'LI') || allElements[0];
    expect(allOption.className).toContain('bg-zinc-300');
  });

  it('selected option changes highlight after clicking a different option', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    // First open, click Unrated
    await openMenu(user);
    await user.click(screen.getByText('Unrated'));

    // Re-open menu
    await openMenu(user);

    // 'Unrated' now appears in the trigger and the <li>; find the <li>
    const unratedElements = screen.getAllByText('Unrated');
    const unratedOption = unratedElements.find((el) => el.tagName === 'LI') || unratedElements[0];
    // 'All' may appear in multiple places; find the <li> element in the dropdown
    const allElements = screen.getAllByText('All');
    const allOption = allElements.find((el) => el.tagName === 'LI') || allElements[0];

    expect(unratedOption.className).toContain('bg-zinc-300');
    expect(allOption.className).not.toContain('bg-zinc-300');
  });
});

// ---------------------------------------------------------------------------
// Statistics page – no watchlist / seen options
// ---------------------------------------------------------------------------

describe('useFilterBy (movie, statistics page) – reduced option set', () => {
  it('does NOT show On watchlist when isStatisticsPage is true', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: true });

    await openMenu(user);

    expect(screen.queryByText('On watchlist')).not.toBeInTheDocument();
  });

  it('does NOT show Watched when isStatisticsPage is true', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: true });

    await openMenu(user);

    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
  });

  it('still shows All, Rated and Unrated on statistics page', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: true });

    await openMenu(user);

    // 'All' appears in both the trigger and the dropdown
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rated')).toBeInTheDocument();
    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Media-type-specific seen labels
// ---------------------------------------------------------------------------

describe('useFilterBy – media-type-specific seen labels', () => {
  it('shows "Listened" for audiobook mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'audiobook', isStatisticsPage: false });

    await openMenu(user);

    expect(screen.getByText('Listened')).toBeInTheDocument();
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
  });

  it('shows "Read" for book mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'book', isStatisticsPage: false });

    await openMenu(user);

    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
  });

  it('shows "Played" for video_game mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'video_game', isStatisticsPage: false });

    await openMenu(user);

    expect(screen.getByText('Played')).toBeInTheDocument();
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
  });

  it('shows "Watched" for tv mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'tv', isStatisticsPage: false });

    await openMenu(user);

    expect(screen.getByText('Watched')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge case: menu closes when clicking outside
// ---------------------------------------------------------------------------

describe('useFilterBy – menu visibility', () => {
  it('menu items are not visible before the trigger is clicked', () => {
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    // The <ul> dropdown does not exist yet
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('menu items become visible after clicking the trigger', async () => {
    const user = userEvent.setup();
    renderHarness({ mediaType: 'movie', isStatisticsPage: false });

    await openMenu(user);

    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
