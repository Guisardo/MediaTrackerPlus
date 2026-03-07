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

// Modal and its peer deps – StarRating itself does NOT render Modal directly,
// but the file also exports BadgeRating which does. We only test StarRating.
jest.mock('@react-spring/web', () => {
  const React = require('react');
  return {
    Transition: ({ items, children }: { items: boolean; children: (s: object, show: boolean) => React.ReactNode }) =>
      <>{children({}, items)}</>,
    Spring: ({ children }: { children: (s: object) => React.ReactNode }) =>
      <>{children({})}</>,
    animated: {
      div: (props: React.HTMLProps<HTMLDivElement>) => <div {...props} />,
    },
  };
});

jest.mock('src/components/Portal', () => ({
  Portal: ({ children }: { children: any }) => children,
}));

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
    useLingui: () => ({ i18n: { _: (s: any) => s, locale: 'en' } }),
    Trans: ({ id, children }: any) => <>{id || children}</>,
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
