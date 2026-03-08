/**
 * Tests for the usePagination hook defined in src/hooks/pagination.tsx.
 *
 * @testing-library/react v12 does not ship renderHook, so we drive the hook
 * by rendering a minimal harness component that exposes hook return values via
 * the DOM.  All tests mount inside a MemoryRouter with a controlled URL.
 *
 * NOTE: window.document.body.scrollIntoView is not implemented in jsdom so it
 * is stubbed globally for this suite.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { usePagination } from '../pagination';

// ---------------------------------------------------------------------------
// jsdom stub
// ---------------------------------------------------------------------------
beforeAll(() => {
  window.document.body.scrollIntoView = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Harness component
// ---------------------------------------------------------------------------

interface HarnessProps {
  itemsPerPage: number;
  totalItems: number;
  items?: number[];
}

/**
 * Renders usePagination and exposes every return value as data attributes /
 * text nodes so tests can assert on them without inspecting internal state.
 */
const PaginationHarness: React.FC<HarnessProps> = ({
  itemsPerPage,
  totalItems,
  items,
}) => {
  const { currentPage, numberOfPages, getPaginatedItems, setPage, showPaginationComponent } =
    usePagination({ itemsPerPage, totalItems });

  const paginatedItems = getPaginatedItems(items);

  return (
    <div>
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="number-of-pages">{numberOfPages}</span>
      <span data-testid="show-pagination">{String(showPaginationComponent)}</span>
      <span data-testid="paginated-items">
        {paginatedItems !== undefined ? JSON.stringify(paginatedItems) : 'undefined'}
      </span>
      <button data-testid="set-page-1" onClick={() => setPage(1)}>
        Go page 1
      </button>
      <button data-testid="set-page-4" onClick={() => setPage(4)}>
        Go page 4
      </button>
      <button data-testid="set-page-custom" onClick={() => setPage(2)}>
        Go page 2
      </button>
    </div>
  );
};

const renderHarness = (props: HarnessProps, initialEntry = '/') =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(PaginationHarness, props)
    )
  );

// ---------------------------------------------------------------------------
// Basic return values
// ---------------------------------------------------------------------------

describe('usePagination – basic values', () => {
  it('returns currentPage 1 when no page param is in the URL', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 50 }, '/items');

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('1')
    );
  });

  it('returns currentPage from the URL page param', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 50 }, '/items?page=3');

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('3')
    );
  });

  it('calculates numberOfPages as ceil(totalItems / itemsPerPage)', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 35 });

    // ceil(35 / 10) = 4
    await waitFor(() =>
      expect(screen.getByTestId('number-of-pages').textContent).toBe('4')
    );
  });

  it('returns numberOfPages 1 when totalItems equals itemsPerPage', async () => {
    renderHarness({ itemsPerPage: 20, totalItems: 20 });

    await waitFor(() =>
      expect(screen.getByTestId('number-of-pages').textContent).toBe('1')
    );
  });

  it('returns numberOfPages 0 when totalItems is 0', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 0 });

    await waitFor(() =>
      expect(screen.getByTestId('number-of-pages').textContent).toBe('0')
    );
  });
});

// ---------------------------------------------------------------------------
// showPaginationComponent
// ---------------------------------------------------------------------------

describe('usePagination – showPaginationComponent', () => {
  it('is true when numberOfPages > 1', async () => {
    renderHarness({ itemsPerPage: 5, totalItems: 20 });

    await waitFor(() =>
      expect(screen.getByTestId('show-pagination').textContent).toBe('true')
    );
  });

  it('is false when numberOfPages equals 1', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 10 });

    await waitFor(() =>
      expect(screen.getByTestId('show-pagination').textContent).toBe('false')
    );
  });

  it('is false when numberOfPages is 0 (no items)', async () => {
    renderHarness({ itemsPerPage: 10, totalItems: 0 });

    await waitFor(() =>
      expect(screen.getByTestId('show-pagination').textContent).toBe('false')
    );
  });
});

// ---------------------------------------------------------------------------
// getPaginatedItems
// ---------------------------------------------------------------------------

describe('usePagination – getPaginatedItems', () => {
  const allItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  it('returns the first page slice for page 1', async () => {
    renderHarness(
      { itemsPerPage: 5, totalItems: allItems.length, items: allItems },
      '/items'
    );

    await waitFor(() =>
      expect(screen.getByTestId('paginated-items').textContent).toBe(
        JSON.stringify([1, 2, 3, 4, 5])
      )
    );
  });

  it('returns the correct slice for page 2 from the URL', async () => {
    renderHarness(
      { itemsPerPage: 5, totalItems: allItems.length, items: allItems },
      '/items?page=2'
    );

    await waitFor(() =>
      expect(screen.getByTestId('paginated-items').textContent).toBe(
        JSON.stringify([6, 7, 8, 9, 10])
      )
    );
  });

  it('returns the last partial slice on the final page', async () => {
    renderHarness(
      { itemsPerPage: 5, totalItems: allItems.length, items: allItems },
      '/items?page=3'
    );

    await waitFor(() =>
      expect(screen.getByTestId('paginated-items').textContent).toBe(
        JSON.stringify([11, 12])
      )
    );
  });

  it('returns "undefined" when items array is undefined', async () => {
    renderHarness({ itemsPerPage: 5, totalItems: 0, items: undefined });

    await waitFor(() =>
      expect(screen.getByTestId('paginated-items').textContent).toBe('undefined')
    );
  });

  it('returns an empty array when items array is empty', async () => {
    renderHarness({ itemsPerPage: 5, totalItems: 0, items: [] });

    await waitFor(() =>
      expect(screen.getByTestId('paginated-items').textContent).toBe(
        JSON.stringify([])
      )
    );
  });
});

// ---------------------------------------------------------------------------
// setPage
// ---------------------------------------------------------------------------

describe('usePagination – setPage', () => {
  it('updates currentPage to 4 when setPage(4) is called', async () => {
    const user = userEvent.setup();
    renderHarness({ itemsPerPage: 10, totalItems: 100 }, '/items');

    await user.click(screen.getByTestId('set-page-4'));

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('4')
    );
  });

  it('resets currentPage to 1 when setPage(1) is called from an advanced page', async () => {
    const user = userEvent.setup();
    renderHarness({ itemsPerPage: 10, totalItems: 100 }, '/items?page=5');

    await user.click(screen.getByTestId('set-page-1'));

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('1')
    );
  });

  it('updates currentPage to 2 when setPage(2) is called', async () => {
    const user = userEvent.setup();
    renderHarness({ itemsPerPage: 10, totalItems: 50 }, '/items');

    await user.click(screen.getByTestId('set-page-custom'));

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('2')
    );
  });
});

// ---------------------------------------------------------------------------
// Auto-reset when page > numberOfPages
// ---------------------------------------------------------------------------

describe('usePagination – auto-reset when page exceeds numberOfPages', () => {
  it('resets currentPage to 1 when the URL page exceeds numberOfPages', async () => {
    // 20 items, 5 per page → 4 pages; URL has page=10 → should reset to 1
    renderHarness({ itemsPerPage: 5, totalItems: 20 }, '/items?page=10');

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('1')
    );
  });

  it('does NOT reset when currentPage is exactly numberOfPages', async () => {
    // 20 items, 5 per page → 4 pages; page=4 is valid
    renderHarness({ itemsPerPage: 5, totalItems: 20 }, '/items?page=4');

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('4')
    );
  });

  it('does NOT reset when currentPage is less than numberOfPages', async () => {
    renderHarness({ itemsPerPage: 5, totalItems: 30 }, '/items?page=2');

    await waitFor(() =>
      expect(screen.getByTestId('current-page').textContent).toBe('2')
    );
  });
});
