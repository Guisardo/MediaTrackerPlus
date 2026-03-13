/**
 * Tests for the StarRating component defined in src/components/StarRating.tsx.
 *
 * StarRating renders 5 star icons driven by a mediaItem (and optional season /
 * episode) rating value.  Clicking a star calls `setRating` (from
 * src/api/details) and hovering a star updates the hover highlight state.
 *
 * External dependencies are mocked:
 *  - src/api/details → setRating is a jest.fn()
 *  - src/App         → queryClient stub (avoid QueryClient setup)
 *  - clsx            → identity passthrough (avoids needing tailwind in tests)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the component
// ---------------------------------------------------------------------------

jest.mock('src/api/details', () => ({
  setRating: jest.fn().mockResolvedValue(undefined),
}));

// Retrieve the auto-mocked function after the mock is hoisted.
let mockSetRating: jest.Mock;
beforeAll(() => {
  mockSetRating = require('src/api/details').setRating as jest.Mock;
});

jest.mock('src/App', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

// Mock radix-ui Dialog primitives — Modal.tsx now uses shadcn/ui Dialog
// (backed by Radix) instead of @react-spring/web + Portal.
jest.mock('radix-ui', () => {
  const React = require('react');

  const Root = ({ children, open, onOpenChange, ...rest }: any) => (
    <div data-testid="dialog-root" {...rest}>
      {React.Children.map(children, (child: React.ReactElement) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { __open: open, __onOpenChange: onOpenChange } as any);
      })}
    </div>
  );

  const Portal = ({ children }: any) => <>{children}</>;
  const Overlay = React.forwardRef(({ children, __open, __onOpenChange, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>{children}</div>
  ));
  const Content = React.forwardRef(({ children, __open, __onOpenChange, ...props }: any, ref: any) => {
    if (!__open) return null;
    return <div ref={ref} {...props}>{children}</div>;
  });
  const Close = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <button ref={ref} {...props}>{children}</button>
  ));
  const Trigger = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <button ref={ref} {...props}>{children}</button>
  ));
  const Title = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h2 ref={ref} {...props}>{children}</h2>
  ));
  const Description = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <p ref={ref} {...props}>{children}</p>
  ));

  return {
    Dialog: { Root, Portal, Overlay, Content, Close, Trigger, Title, Description },
  };
});

jest.mock('src/components/SelectSeenDate', () => {
  const React = require('react');
  return {
    SelectSeenDate: () => React.createElement('div', null, 'SelectSeenDate mock'),
  };
});

jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  formatEpisodeNumber: jest.fn(() => 'S01E01'),
  formatSeasonNumber: jest.fn(() => 'Season 1'),
}));

// @lingui/macro – Trans is just a passthrough for children
jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// @lingui/react – mock useLingui and Trans to avoid I18nProvider requirement
jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({
      i18n: {
        _: (s: any) =>
          typeof s === 'string' ? s : s?.message || s?.id || '',
        locale: 'en',
      },
    }),
    Trans: ({ message, children }: any) => <>{message || children}</>,
    I18nProvider: ({ children }: any) => <>{children}</>,
  };
});

import { StarRating } from '../StarRating';
import type { MediaItemItemsResponse } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeMediaItem = (rating?: number): MediaItemItemsResponse =>
  ({
    id: 1,
    title: 'Test Movie',
    mediaType: 'movie',
    userRating: rating !== undefined ? { rating } : undefined,
    seen: false,
  } as unknown as MediaItemItemsResponse);

// ---------------------------------------------------------------------------
// Rendering: star icons
// ---------------------------------------------------------------------------

describe('StarRating – rendering', () => {
  it('renders exactly 5 star icon elements', () => {
    render(<StarRating mediaItem={makeMediaItem()} />);

    // Each star is a <span> containing either "star" or "star_border" text
    const stars = screen.getAllByText(/^star(_border)?$/);
    expect(stars).toHaveLength(5);
  });

  it('shows filled stars up to the rating value', () => {
    render(<StarRating mediaItem={makeMediaItem(3)} />);

    const filledStars = screen.getAllByText('star');
    const borderStars = screen.getAllByText('star_border');

    expect(filledStars).toHaveLength(3);
    expect(borderStars).toHaveLength(2);
  });

  it('shows all border stars when rating is undefined', () => {
    render(<StarRating mediaItem={makeMediaItem(undefined)} />);

    const borderStars = screen.getAllByText('star_border');
    expect(borderStars).toHaveLength(5);
  });

  it('shows all filled stars when rating is 5', () => {
    render(<StarRating mediaItem={makeMediaItem(5)} />);

    const filledStars = screen.getAllByText('star');
    expect(filledStars).toHaveLength(5);
  });

  it('shows all border stars when rating is 0', () => {
    render(<StarRating mediaItem={makeMediaItem(0)} />);

    const borderStars = screen.getAllByText('star_border');
    expect(borderStars).toHaveLength(5);
  });

  it('uses the episode userRating when an episode prop is provided', () => {
    const mediaItem = makeMediaItem();
    const episode = {
      id: 10,
      userRating: { rating: 2 },
    } as any;

    render(<StarRating mediaItem={mediaItem} episode={episode} />);

    const filledStars = screen.getAllByText('star');
    expect(filledStars).toHaveLength(2);
  });

  it('uses the season userRating when a season prop is provided', () => {
    const mediaItem = makeMediaItem();
    const season = {
      id: 5,
      userRating: { rating: 4 },
    } as any;

    render(<StarRating mediaItem={mediaItem} season={season} />);

    const filledStars = screen.getAllByText('star');
    expect(filledStars).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Click interactions
// ---------------------------------------------------------------------------

describe('StarRating – click interactions', () => {
  beforeEach(() => {
    mockSetRating.mockClear();
  });

  it('calls setRating with rating=1 when the first star is clicked', async () => {
    const user = userEvent.setup();
    render(<StarRating mediaItem={makeMediaItem()} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[0]);

    expect(mockSetRating).toHaveBeenCalledTimes(1);
    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 1 })
    );
  });

  it('calls setRating with rating=3 when the third star is clicked', async () => {
    const user = userEvent.setup();
    render(<StarRating mediaItem={makeMediaItem()} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[2]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 3 })
    );
  });

  it('calls setRating with rating=5 when the fifth star is clicked', async () => {
    const user = userEvent.setup();
    render(<StarRating mediaItem={makeMediaItem()} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[4]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 5 })
    );
  });

  it('passes the mediaItem to setRating', async () => {
    const user = userEvent.setup();
    const mediaItem = makeMediaItem(2);
    render(<StarRating mediaItem={mediaItem} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[0]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItem })
    );
  });

  it('passes season to setRating when season prop is provided', async () => {
    const user = userEvent.setup();
    const mediaItem = makeMediaItem();
    const season = { id: 5, userRating: { rating: 1 } } as any;

    render(<StarRating mediaItem={mediaItem} season={season} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[1]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ season })
    );
  });

  it('passes episode to setRating when episode prop is provided', async () => {
    const user = userEvent.setup();
    const mediaItem = makeMediaItem();
    const episode = { id: 10, userRating: { rating: 2 } } as any;

    render(<StarRating mediaItem={mediaItem} episode={episode} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    await user.click(stars[3]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ episode })
    );
  });
});

// ---------------------------------------------------------------------------
// Hover state changes
// ---------------------------------------------------------------------------

describe('StarRating – hover state', () => {
  it('highlights stars up to hovered index on pointer enter', () => {
    render(<StarRating mediaItem={makeMediaItem(0)} />);

    const stars = screen.getAllByText(/^star(_border)?$/);

    // Hover the third star (index 2 → hoverIndex=3, highlights stars at 0, 1, 2)
    fireEvent.pointerEnter(stars[2]);

    // Hover changes the text-yellow-400 class on stars below hoverIndex; it does
    // NOT change the text content ('star' vs 'star_border'), which only reflects
    // the saved rating. Check highlighting via the class instead.
    const allStars = screen.getAllByText(/^star(_border)?$/);
    const highlightedAfterHover = allStars.filter((el) =>
      el.classList.contains('text-yellow-400')
    );
    expect(highlightedAfterHover).toHaveLength(3);
  });

  it('removes hover highlights on pointer leave', () => {
    render(<StarRating mediaItem={makeMediaItem(0)} />);

    const stars = screen.getAllByText(/^star(_border)?$/);

    // Enter then leave
    fireEvent.pointerEnter(stars[2]);
    fireEvent.pointerLeave(stars[2]);

    // Should revert to 0 filled stars (rating is 0)
    const allBorderStars = screen.getAllByText('star_border');
    expect(allBorderStars).toHaveLength(5);
  });

  it('respects existing rating alongside hover state', () => {
    /**
     * With rating=2 and hovering star index 3 (0-based), hoverIndex=4.
     * Stars at indices 0-3 receive the text-yellow-400 class (index < hoverIndex).
     * The text-content 'star' still reflects only the saved rating (2 stars),
     * but the yellow highlight extends to 4 stars via the CSS class.
     */
    render(<StarRating mediaItem={makeMediaItem(2)} />);

    const stars = screen.getAllByText(/^star(_border)?$/);
    fireEvent.pointerEnter(stars[3]); // hover over 4th star (hoverIndex=4)

    const allStars = screen.getAllByText(/^star(_border)?$/);
    const highlightedStars = allStars.filter((el) =>
      el.classList.contains('text-yellow-400')
    );
    // Indices 0,1,2,3 → 4 stars highlighted via yellow class
    expect(highlightedStars).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// BadgeRating component
// ---------------------------------------------------------------------------

import { BadgeRating } from '../StarRating';

describe('BadgeRating – rendering', () => {
  beforeEach(() => {
    mockSetRating.mockClear();
  });

  it('renders a star icon and the rating number when rated', () => {
    render(<BadgeRating mediaItem={makeMediaItem(4)} />);

    // The badge always shows a "star" icon
    expect(screen.getByText('star')).toBeInTheDocument();
    // It should show the numeric rating value
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders a star icon without numeric rating when unrated', () => {
    const { container } = render(<BadgeRating mediaItem={makeMediaItem()} />);

    expect(screen.getByText('star')).toBeInTheDocument();
    // No numeric rating should be displayed for unrated items
    const spans = container.querySelectorAll('span');
    const numericSpans = Array.from(spans).filter((s) => /^\d+$/.test(s.textContent || ''));
    expect(numericSpans).toHaveLength(0);
  });

  it('reads season userRating when season prop is provided', () => {
    const mediaItem = makeMediaItem();
    const season = { id: 5, userRating: { rating: 3 }, seen: false } as any;

    render(<BadgeRating mediaItem={mediaItem} season={season} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('reads episode userRating when episode prop is provided', () => {
    const mediaItem = makeMediaItem();
    const episode = { id: 10, userRating: { rating: 5 }, seen: true } as any;

    render(<BadgeRating mediaItem={mediaItem} episode={episode} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('opens the modal on click, revealing the StarRatingModal', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(3)} />);

    // Click the badge to open modal
    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // StarRatingModal shows the title and a textarea for review
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StarRatingModal (via BadgeRating) – interactions
// ---------------------------------------------------------------------------

describe('StarRatingModal – interactions via BadgeRating', () => {
  beforeEach(() => {
    mockSetRating.mockClear();
  });

  it('displays season number in the modal title when season prop is provided', async () => {
    const user = userEvent.setup();
    const mediaItem = makeMediaItem(2);
    const season = { id: 5, seasonNumber: 1, userRating: { rating: 2 }, seen: false } as any;

    render(<BadgeRating mediaItem={mediaItem} season={season} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // Title div contains "Test Movie" + formatted season; use a substring matcher
    const titleDiv = screen.getByText((content, element) =>
      element?.tagName === 'DIV' &&
      (element?.className ?? '').includes('text-4xl') &&
      (content.includes('Test Movie') || element?.textContent?.includes('Season 1')) || false
    );
    expect(titleDiv.textContent).toContain('Season 1');
  });

  it('displays episode number in the modal title when episode prop is provided', async () => {
    const user = userEvent.setup();
    const mediaItem = makeMediaItem(2);
    const episode = {
      id: 10,
      seasonNumber: 1,
      episodeNumber: 1,
      userRating: { rating: 2 },
      seen: true,
    } as any;

    render(<BadgeRating mediaItem={mediaItem} episode={episode} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // Title div contains "Test Movie" + formatted episode; use a substring matcher
    const titleDiv = screen.getByText((content, element) =>
      element?.tagName === 'DIV' &&
      (element?.className ?? '').includes('text-4xl') &&
      (content.includes('Test Movie') || element?.textContent?.includes('S01E01')) || false
    );
    expect(titleDiv.textContent).toContain('S01E01');
  });

  it('calls setRating when a star is clicked inside the modal', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(0)} />);

    // Open the modal
    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // The modal shows its own set of 5 stars; click the 3rd one
    const modalStars = screen.getAllByText(/^star(_border)?$/);
    // First star is the badge star, remaining 5 are the modal stars
    const modalStarSet = modalStars.slice(1);
    await user.click(modalStarSet[2]);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 3 })
    );
  });

  it('clears rating when clicking on the currently rated star in the modal', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(3)} />);

    // Open the modal
    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // Click the 3rd star (index 2) which matches current rating=3
    const modalStars = screen.getAllByText(/^star(_border)?$/);
    const modalStarSet = modalStars.slice(1);
    await user.click(modalStarSet[2]);

    // When clicking the star matching the current rating, it should pass null
    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ rating: null })
    );
  });

  it('updates the review text via the textarea', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(3)} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Great movie!');

    expect(textarea).toHaveValue('Great movie!');
  });

  it('submits the review form and calls setRating with review text', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(3)} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Excellent');

    // Submit the form by clicking the save button
    const saveBtn = screen.getByText('Save review');
    await user.click(saveBtn);

    expect(mockSetRating).toHaveBeenCalledWith(
      expect.objectContaining({ review: 'Excellent' })
    );
  });

  it('closes the modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<BadgeRating mediaItem={makeMediaItem(3)} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    // The modal should be open showing the title
    expect(screen.getByText('Test Movie')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    await user.click(cancelBtn);

    // After canceling, the modal content (textarea) should be gone
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('initializes textarea with existing review text', async () => {
    const user = userEvent.setup();
    const mediaItem = {
      id: 1,
      title: 'Test Movie',
      mediaType: 'movie',
      userRating: { rating: 4, review: 'Already reviewed' },
      seen: true,
    } as unknown as MediaItemItemsResponse;

    render(<BadgeRating mediaItem={mediaItem} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    await user.click(badge!);

    expect(screen.getByRole('textbox')).toHaveValue('Already reviewed');
  });

  it('highlights stars on hover inside the modal', async () => {
    render(<BadgeRating mediaItem={makeMediaItem(0)} />);

    const badge = screen.getByText('star').closest('span[class*="cursor-pointer"]');
    fireEvent.click(badge!);

    const modalStars = screen.getAllByText(/^star(_border)?$/);
    const modalStarSet = modalStars.slice(1);

    fireEvent.pointerEnter(modalStarSet[3]);

    const highlighted = modalStarSet.filter((el) =>
      el.classList.contains('text-yellow-400')
    );
    expect(highlighted).toHaveLength(4);

    fireEvent.pointerLeave(modalStarSet[3]);

    const highlightedAfter = modalStarSet.filter((el) =>
      el.classList.contains('text-yellow-400')
    );
    expect(highlightedAfter).toHaveLength(0);
  });
});
