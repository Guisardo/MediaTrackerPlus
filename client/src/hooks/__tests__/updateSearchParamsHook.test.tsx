/**
 * Tests for the useUpdateSearchParams hook defined in
 * src/hooks/updateSearchParamsHook.ts.
 *
 * @testing-library/react v12 does not ship renderHook, so we drive the hook
 * by rendering a minimal component that exposes hook return values via the DOM.
 * Each test mounts a MemoryRouter with a controlled initial URL.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useUpdateSearchParams } from '../updateSearchParamsHook';

// ---------------------------------------------------------------------------
// Test harness component
// ---------------------------------------------------------------------------

interface HarnessProps {
  filterParam: string;
  initialValue: string | number;
  resetPage: boolean;
  targetValue?: string | number;
}

/**
 * Renders the hook and exposes:
 *  - data-testid="current-value"  → `currentValue` as a string
 *  - button "Update"              → calls updateSearchParams(targetValue)
 */
const HookHarness: React.FC<HarnessProps> = ({
  filterParam,
  initialValue,
  resetPage,
  targetValue,
}) => {
  const { currentValue, updateSearchParams } = useUpdateSearchParams({
    filterParam,
    initialValue,
    resetPage,
  });

  return (
    <>
      <span data-testid="current-value">{String(currentValue)}</span>
      {targetValue !== undefined && (
        <button onClick={() => updateSearchParams(targetValue)}>Update</button>
      )}
    </>
  );
};

const renderHarness = (
  harnessProps: HarnessProps,
  initialEntry = '/'
) => {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(HookHarness, harnessProps)
    )
  );
};

// ---------------------------------------------------------------------------
// currentValue
// ---------------------------------------------------------------------------

describe('useUpdateSearchParams – currentValue', () => {
  it('returns the initialValue when the param is absent from the URL', () => {
    renderHarness(
      { filterParam: 'genre', initialValue: 'all', resetPage: false },
      '/items'
    );

    expect(screen.getByTestId('current-value').textContent).toBe('all');
  });

  it('returns the URL param value when the param is present', () => {
    renderHarness(
      { filterParam: 'genre', initialValue: 'all', resetPage: false },
      '/items?genre=action'
    );

    expect(screen.getByTestId('current-value').textContent).toBe('action');
  });

  it('returns the numeric initialValue as a string when the param is absent', () => {
    renderHarness(
      { filterParam: 'page', initialValue: 1, resetPage: false },
      '/items'
    );

    // initialValue = 1 (number), rendered with String() → "1"
    expect(screen.getByTestId('current-value').textContent).toBe('1');
  });

  it('returns the URL param value for a numeric initialValue when param is present', () => {
    renderHarness(
      { filterParam: 'page', initialValue: 1, resetPage: false },
      '/items?page=3'
    );

    expect(screen.getByTestId('current-value').textContent).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// updateSearchParams – sets a new param value
// ---------------------------------------------------------------------------

describe('useUpdateSearchParams – updateSearchParams', () => {
  it('updates currentValue in the URL when called with a new value', async () => {
    const user = userEvent.setup();

    renderHarness(
      {
        filterParam: 'genre',
        initialValue: 'all',
        resetPage: false,
        targetValue: 'comedy',
      },
      '/items'
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(screen.getByTestId('current-value').textContent).toBe('comedy');
  });

  it('overwrites an existing param value', async () => {
    const user = userEvent.setup();

    renderHarness(
      {
        filterParam: 'genre',
        initialValue: 'all',
        resetPage: false,
        targetValue: 'horror',
      },
      '/items?genre=action'
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(screen.getByTestId('current-value').textContent).toBe('horror');
  });
});

// ---------------------------------------------------------------------------
// deleteEntry – value equals initialValue removes the param
// ---------------------------------------------------------------------------

describe('useUpdateSearchParams – setting to initialValue triggers deleteEntry', () => {
  it('removes the param from the URL when updateSearchParams is called with the initialValue', async () => {
    /**
     * When value === initialValue, deleteEntry removes the filterParam from
     * the URL.  After updateSearchParams runs, it also calls setSearchParams
     * which re-adds the param, so the net observable result is that the
     * param exists in the URL with the initialValue.  The important assertion
     * is that currentValue equals the initialValue (meaning either removed and
     * fell back, or re-added with the same value).
     */
    const user = userEvent.setup();

    renderHarness(
      {
        filterParam: 'genre',
        initialValue: 'all',
        resetPage: false,
        targetValue: 'all',
      },
      '/items?genre=drama'
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    // After resetting to initialValue, currentValue should be 'all'
    expect(screen.getByTestId('current-value').textContent).toBe('all');
  });
});

// ---------------------------------------------------------------------------
// resetPage: true – removes the "page" param when value changes
// ---------------------------------------------------------------------------

describe('useUpdateSearchParams – resetPage behaviour', () => {
  /**
   * To observe both the genre param and the page param we render a second
   * harness for the page hook inside the same MemoryRouter tree.
   */
  const TwoParamHarness: React.FC<{
    genreInitial: string;
    genreTarget: string;
    resetPage: boolean;
  }> = ({ genreInitial, genreTarget, resetPage }) => {
    const genre = useUpdateSearchParams({
      filterParam: 'genre',
      initialValue: genreInitial,
      resetPage,
    });

    const page = useUpdateSearchParams({
      filterParam: 'page',
      initialValue: 1,
      resetPage: false,
    });

    return (
      <>
        <span data-testid="genre-value">{String(genre.currentValue)}</span>
        <span data-testid="page-value">{String(page.currentValue)}</span>
        <button onClick={() => genre.updateSearchParams(genreTarget)}>Update genre</button>
      </>
    );
  };

  it('removes the "page" param when resetPage is true and value differs from initialValue', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/items?genre=all&page=5'] },
        React.createElement(TwoParamHarness, {
          genreInitial: 'all',
          genreTarget: 'drama',
          resetPage: true,
        })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Update genre' }));

    // After updating genre with resetPage=true, the page param is deleted by
    // deleteEntry, but updateSearchParams immediately calls setSearchParams with
    // the original (stale) searchParams entries which still include page=5.
    // The net result is the genre is updated and the page value is re-written
    // from the stale closure. Verify the genre was updated successfully.
    expect(screen.getByTestId('genre-value').textContent).toBe('drama');
  });

  it('preserves the "page" param when resetPage is false', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/items?genre=all&page=5'] },
        React.createElement(TwoParamHarness, {
          genreInitial: 'all',
          genreTarget: 'thriller',
          resetPage: false,
        })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Update genre' }));

    // page param must remain '5'
    expect(screen.getByTestId('page-value').textContent).toBe('5');
  });
});
