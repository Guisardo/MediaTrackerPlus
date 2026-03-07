/**
 * Tests for the useOrderByComponent hook and its OrderByComponent defined in
 * src/components/OrderBy.tsx.
 *
 * The hook is built on useMenuComponent (which renders a dropdown <ul>) and
 * useUpdateSearchParams for the sort-order toggle.
 *
 * We verify:
 *  - The component renders the sort icon and the initial order-by selection
 *  - All expected order-by options are visible after opening the menu
 *  - TV-show-only options (nextAiring, lastAiring, unseenEpisodes) are hidden
 *    for non-TV mediaTypes
 *  - Selecting an option calls handleFilterChange
 *  - The sort-order toggle shows ↑ for asc and ↓ for desc
 *  - Clicking the toggle arrow flips the direction and calls handleFilterChange
 *  - The mediaType option is hidden when a specific mediaType is provided
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

jest.mock('clsx', () => (...args: unknown[]) => args.filter(Boolean).join(' '));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

import { useOrderByComponent } from 'src/components/OrderBy';
import type { MediaItemOrderBy, MediaType, SortOrder } from 'mediatracker-api';

interface HarnessProps {
  orderBy: MediaItemOrderBy;
  sortOrder: SortOrder;
  mediaType?: MediaType;
  onFilterChange?: jest.Mock;
}

const OrderByHarness: React.FC<HarnessProps> = ({
  orderBy,
  sortOrder,
  mediaType,
  onFilterChange = jest.fn(),
}) => {
  const { OrderByComponent } = useOrderByComponent({
    orderBy,
    sortOrder,
    mediaType,
    handleFilterChange: onFilterChange,
  });

  return <OrderByComponent />;
};

const renderHarness = (props: HarnessProps, initialEntry = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <OrderByHarness {...props} />
    </MemoryRouter>
  );
};

// Opens the dropdown menu by clicking the trigger
const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const triggers = document.querySelectorAll('.cursor-pointer');
  // The first cursor-pointer div is the menu trigger (the sort icon + label)
  if (triggers.length > 0) {
    await user.click(triggers[0] as HTMLElement);
  }
};

// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------

describe('useOrderByComponent – initial render', () => {
  it('renders the sort_by_alpha icon', () => {
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    expect(screen.getByText('sort_by_alpha')).toBeInTheDocument();
  });

  it('shows the ↑ arrow when sortOrder is asc', () => {
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('shows the ↓ arrow when sortOrder is desc', () => {
    renderHarness({ orderBy: 'title', sortOrder: 'desc' });

    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('displays the initial orderBy label (Title) next to the icon', () => {
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('displays "Last seen" when orderBy is lastSeen', () => {
    renderHarness({ orderBy: 'lastSeen', sortOrder: 'desc' });

    expect(screen.getByText('Last seen')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Menu options – no mediaType (all options visible)
// ---------------------------------------------------------------------------

describe('useOrderByComponent – menu options without mediaType', () => {
  it('shows all base order-by options after opening the menu', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    await openMenu(user);

    expect(screen.getByText('Last seen')).toBeInTheDocument();
    expect(screen.getByText('Release date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    // 'Title' appears in both the trigger and the dropdown <li>
    expect(screen.getAllByText('Title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    // Media type option should be visible when no mediaType is provided
    expect(screen.getByText('Media type')).toBeInTheDocument();
  });

  it('hides TV-only options (Next airing, Last airing, Unseen episodes) when no mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    await openMenu(user);

    // When mediaType is undefined, isTvShow(undefined) returns false,
    // so the component removes TV-specific options.
    expect(screen.queryByText('Next airing')).not.toBeInTheDocument();
    expect(screen.queryByText('Last airing')).not.toBeInTheDocument();
    expect(screen.queryByText('Unseen episodes count')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Menu options – non-TV mediaType (TV-specific options removed)
// ---------------------------------------------------------------------------

describe('useOrderByComponent – menu options with movie mediaType', () => {
  it('hides Next airing, Last airing, Unseen episodes for movie mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc', mediaType: 'movie' });

    await openMenu(user);

    expect(screen.queryByText('Next airing')).not.toBeInTheDocument();
    expect(screen.queryByText('Last airing')).not.toBeInTheDocument();
    expect(screen.queryByText('Unseen episodes count')).not.toBeInTheDocument();
  });

  it('hides the Media type option when a specific mediaType is provided', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc', mediaType: 'movie' });

    await openMenu(user);

    expect(screen.queryByText('Media type')).not.toBeInTheDocument();
  });

  it('still shows base options for movie mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc', mediaType: 'movie' });

    await openMenu(user);

    // 'Title' appears in both the trigger and the dropdown <li>
    expect(screen.getAllByText('Title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Release date')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Menu options – tv mediaType (TV-specific options retained)
// ---------------------------------------------------------------------------

describe('useOrderByComponent – menu options with tv mediaType', () => {
  it('shows Next airing and Last airing for tv mediaType', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc', mediaType: 'tv' });

    await openMenu(user);

    expect(screen.getByText('Next airing')).toBeInTheDocument();
    expect(screen.getByText('Last airing')).toBeInTheDocument();
    expect(screen.getByText('Unseen episodes count')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Selecting an option
// ---------------------------------------------------------------------------

describe('useOrderByComponent – option selection', () => {
  it('calls handleFilterChange once when an option is selected', async () => {
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();

    renderHarness({
      orderBy: 'title',
      sortOrder: 'asc',
      onFilterChange: handleFilterChange,
    });

    await openMenu(user);
    await user.click(screen.getByText('Release date'));

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('updates the displayed label after selecting a different option', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    await openMenu(user);
    await user.click(screen.getByText('Release date'));

    expect(screen.getByText('Release date')).toBeInTheDocument();
  });

  it('highlights the selected option with bg-zinc-300 class', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    await openMenu(user);

    // 'Title' appears in the trigger and the dropdown <li>; find the <li>
    const titleElements = screen.getAllByText('Title');
    const titleOption = titleElements.find((el) => el.tagName === 'LI') || titleElements[0];
    expect(titleOption.className).toContain('bg-zinc-300');
  });
});

// ---------------------------------------------------------------------------
// Sort-order toggle
// ---------------------------------------------------------------------------

describe('useOrderByComponent – sort order toggle', () => {
  it('calls handleFilterChange when the arrow toggle is clicked', async () => {
    const handleFilterChange = jest.fn();
    const user = userEvent.setup();

    renderHarness({
      orderBy: 'title',
      sortOrder: 'asc',
      onFilterChange: handleFilterChange,
    });

    const arrow = screen.getByText('↑');
    await user.click(arrow);

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('switches ↑ to ↓ after clicking the toggle when starting at asc', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    await user.click(screen.getByText('↑'));

    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('switches ↓ to ↑ after clicking the toggle when starting at desc', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'desc' });

    await user.click(screen.getByText('↓'));

    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('toggles back and forth correctly on multiple clicks', async () => {
    const user = userEvent.setup();
    renderHarness({ orderBy: 'title', sortOrder: 'asc' });

    // asc → desc
    await user.click(screen.getByText('↑'));
    expect(screen.getByText('↓')).toBeInTheDocument();

    // desc → asc
    await user.click(screen.getByText('↓'));
    expect(screen.getByText('↑')).toBeInTheDocument();
  });
});
