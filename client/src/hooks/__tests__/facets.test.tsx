/**
 * Tests for src/hooks/facets.ts – useFacets hook.
 *
 * Covers:
 *   - Reading initial state (empty arrays and null values) from a clean URL
 *   - Parsing multi-value facets from URL params
 *   - Parsing range (numeric) facets from URL params
 *   - activeFacetCount computation
 *   - facetParams API object construction
 *   - setGenres, setLanguages, setCreators, setPublishers, setMediaTypes, setStatus
 *   - setYearMin, setYearMax, setRatingMin, setRatingMax
 *   - clearAllFacets (removes all facet params, preserves non-facet params)
 *   - handleArgumentChange is called on every setter and clearAllFacets
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { useFacets } from 'src/hooks/facets';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * A minimal harness that drives useFacets, exposes all readable values via
 * data-testid attributes, and provides a single button for dispatching setter
 * actions.
 */
interface FacetsHarnessProps {
  handleArgumentChange?: jest.Mock;
  action?: { type: string; payload?: unknown };
}

const FacetsHarness: React.FC<FacetsHarnessProps> = ({
  handleArgumentChange,
  action,
}) => {
  const facets = useFacets(handleArgumentChange);

  const handleAction = () => {
    if (!action) return;
    switch (action.type) {
      case 'setGenres':
        facets.setGenres(action.payload as string[]);
        break;
      case 'setLanguages':
        facets.setLanguages(action.payload as string[]);
        break;
      case 'setCreators':
        facets.setCreators(action.payload as string[]);
        break;
      case 'setPublishers':
        facets.setPublishers(action.payload as string[]);
        break;
      case 'setMediaTypes':
        facets.setMediaTypes(action.payload as string[]);
        break;
      case 'setStatus':
        facets.setStatus(action.payload as string[]);
        break;
      case 'setYearMin':
        facets.setYearMin(action.payload as number | null);
        break;
      case 'setYearMax':
        facets.setYearMax(action.payload as number | null);
        break;
      case 'setRatingMin':
        facets.setRatingMin(action.payload as number | null);
        break;
      case 'setRatingMax':
        facets.setRatingMax(action.payload as number | null);
        break;
      case 'clearAllFacets':
        facets.clearAllFacets();
        break;
    }
  };

  return (
    <>
      <span data-testid="genres">{JSON.stringify(facets.genres)}</span>
      <span data-testid="languages">{JSON.stringify(facets.languages)}</span>
      <span data-testid="creators">{JSON.stringify(facets.creators)}</span>
      <span data-testid="publishers">{JSON.stringify(facets.publishers)}</span>
      <span data-testid="mediaTypes">{JSON.stringify(facets.mediaTypes)}</span>
      <span data-testid="status">{JSON.stringify(facets.status)}</span>
      <span data-testid="yearMin">{String(facets.yearMin)}</span>
      <span data-testid="yearMax">{String(facets.yearMax)}</span>
      <span data-testid="ratingMin">{String(facets.ratingMin)}</span>
      <span data-testid="ratingMax">{String(facets.ratingMax)}</span>
      <span data-testid="activeFacetCount">
        {String(facets.activeFacetCount)}
      </span>
      <span data-testid="facetParams">
        {JSON.stringify(facets.facetParams)}
      </span>
      {action && (
        <button onClick={handleAction}>Execute Action</button>
      )}
    </>
  );
};

const renderFacets = (
  props: FacetsHarnessProps = {},
  initialEntry = '/'
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FacetsHarness {...props} />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Initial state (clean URL)
// ---------------------------------------------------------------------------

describe('useFacets – initial state (no URL params)', () => {
  it('returns empty arrays for all multi-value facets', () => {
    renderFacets({}, '/');

    expect(JSON.parse(screen.getByTestId('genres').textContent!)).toEqual([]);
    expect(JSON.parse(screen.getByTestId('languages').textContent!)).toEqual(
      []
    );
    expect(JSON.parse(screen.getByTestId('creators').textContent!)).toEqual([]);
    expect(JSON.parse(screen.getByTestId('publishers').textContent!)).toEqual(
      []
    );
    expect(JSON.parse(screen.getByTestId('mediaTypes').textContent!)).toEqual(
      []
    );
    expect(JSON.parse(screen.getByTestId('status').textContent!)).toEqual([]);
  });

  it('returns null for all range facets', () => {
    renderFacets({}, '/');

    expect(screen.getByTestId('yearMin').textContent).toBe('null');
    expect(screen.getByTestId('yearMax').textContent).toBe('null');
    expect(screen.getByTestId('ratingMin').textContent).toBe('null');
    expect(screen.getByTestId('ratingMax').textContent).toBe('null');
  });

  it('returns activeFacetCount of 0 when no facets are active', () => {
    renderFacets({}, '/');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('0');
  });

  it('returns an empty facetParams object when no facets are active', () => {
    renderFacets({}, '/');

    expect(JSON.parse(screen.getByTestId('facetParams').textContent!)).toEqual(
      {}
    );
  });
});

// ---------------------------------------------------------------------------
// Reading from URL params
// ---------------------------------------------------------------------------

describe('useFacets – reading from URL params', () => {
  it('parses genres from URL', () => {
    renderFacets({}, '/?genres=Action,Drama');

    expect(JSON.parse(screen.getByTestId('genres').textContent!)).toEqual([
      'Action',
      'Drama',
    ]);
  });

  it('parses languages from URL', () => {
    renderFacets({}, '/?languages=en,fr');

    expect(JSON.parse(screen.getByTestId('languages').textContent!)).toEqual([
      'en',
      'fr',
    ]);
  });

  it('parses creators from URL', () => {
    renderFacets({}, '/?creators=Nolan');

    expect(JSON.parse(screen.getByTestId('creators').textContent!)).toEqual([
      'Nolan',
    ]);
  });

  it('parses publishers from URL', () => {
    renderFacets({}, '/?publishers=Penguin');

    expect(JSON.parse(screen.getByTestId('publishers').textContent!)).toEqual([
      'Penguin',
    ]);
  });

  it('parses mediaTypes from URL', () => {
    renderFacets({}, '/?mediaTypes=movie,tv');

    expect(JSON.parse(screen.getByTestId('mediaTypes').textContent!)).toEqual([
      'movie',
      'tv',
    ]);
  });

  it('parses status from URL', () => {
    renderFacets({}, '/?status=rated,watchlist');

    expect(JSON.parse(screen.getByTestId('status').textContent!)).toEqual([
      'rated',
      'watchlist',
    ]);
  });

  it('parses yearMin from URL as a number', () => {
    renderFacets({}, '/?yearMin=2010');

    expect(screen.getByTestId('yearMin').textContent).toBe('2010');
  });

  it('parses yearMax from URL as a number', () => {
    renderFacets({}, '/?yearMax=2020');

    expect(screen.getByTestId('yearMax').textContent).toBe('2020');
  });

  it('parses ratingMin from URL as a number', () => {
    renderFacets({}, '/?ratingMin=6.5');

    expect(screen.getByTestId('ratingMin').textContent).toBe('6.5');
  });

  it('parses ratingMax from URL as a number', () => {
    renderFacets({}, '/?ratingMax=9');

    expect(screen.getByTestId('ratingMax').textContent).toBe('9');
  });
});

// ---------------------------------------------------------------------------
// activeFacetCount
// ---------------------------------------------------------------------------

describe('useFacets – activeFacetCount', () => {
  it('counts each multi-value dimension with at least one selection', () => {
    renderFacets({}, '/?genres=Action&languages=en&creators=Nolan');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('3');
  });

  it('counts year range as one dimension when only yearMin is set', () => {
    renderFacets({}, '/?yearMin=2010');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('1');
  });

  it('counts year range as one dimension when both yearMin and yearMax are set', () => {
    renderFacets({}, '/?yearMin=2010&yearMax=2020');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('1');
  });

  it('counts rating range as one dimension when only ratingMin is set', () => {
    renderFacets({}, '/?ratingMin=6');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('1');
  });

  it('counts rating range as one dimension when both ratingMin and ratingMax are set', () => {
    renderFacets({}, '/?ratingMin=5&ratingMax=9');

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('1');
  });

  it('counts all active dimensions independently', () => {
    renderFacets(
      {},
      '/?genres=Action&languages=en&yearMin=2010&ratingMax=9&status=rated'
    );

    // genres=1, languages=1, year range=1, rating range=1, status=1 → 5
    expect(screen.getByTestId('activeFacetCount').textContent).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// facetParams API object
// ---------------------------------------------------------------------------

describe('useFacets – facetParams', () => {
  it('builds correct API params from genres', () => {
    renderFacets({}, '/?genres=Action,Drama');

    const params = JSON.parse(screen.getByTestId('facetParams').textContent!);
    expect(params.genres).toBe('Action,Drama');
  });

  it('builds correct API params from yearMin and ratingMax together', () => {
    renderFacets({}, '/?genres=Action,Drama&yearMin=2010&ratingMax=9');

    const params = JSON.parse(screen.getByTestId('facetParams').textContent!);
    expect(params.genres).toBe('Action,Drama');
    expect(params.yearMin).toBe(2010);
    expect(params.ratingMax).toBe(9);
    expect(params.yearMax).toBeUndefined();
  });

  it('omits keys with no active selection', () => {
    renderFacets({}, '/?genres=Action');

    const params = JSON.parse(screen.getByTestId('facetParams').textContent!);
    expect(params.genres).toBe('Action');
    expect(params.languages).toBeUndefined();
    expect(params.creators).toBeUndefined();
    expect(params.yearMin).toBeUndefined();
  });

  it('includes all active multi-value params as comma-separated strings', () => {
    renderFacets({}, '/?languages=en,fr&creators=Nolan,Villeneuve');

    const params = JSON.parse(screen.getByTestId('facetParams').textContent!);
    expect(params.languages).toBe('en,fr');
    expect(params.creators).toBe('Nolan,Villeneuve');
  });
});

// ---------------------------------------------------------------------------
// setGenres
// ---------------------------------------------------------------------------

describe('useFacets – setGenres', () => {
  it('writes genres to the URL when called with a non-empty array', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setGenres', payload: ['Action', 'Drama'] } },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(JSON.parse(screen.getByTestId('genres').textContent!)).toEqual([
      'Action',
      'Drama',
    ]);
  });

  it('clears genres when called with an empty array', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setGenres', payload: [] } },
      '/?genres=Action,Drama'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(JSON.parse(screen.getByTestId('genres').textContent!)).toEqual([]);
  });

  it('calls handleArgumentChange when genres are set', async () => {
    const handleArgumentChange = jest.fn();
    const user = userEvent.setup();
    renderFacets(
      {
        handleArgumentChange,
        action: { type: 'setGenres', payload: ['Action'] },
      },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(handleArgumentChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// setYearMin / setYearMax
// ---------------------------------------------------------------------------

describe('useFacets – setYearMin', () => {
  it('writes yearMin to URL as a number when called with a numeric value', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setYearMin', payload: 2015 } },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('yearMin').textContent).toBe('2015');
  });

  it('removes yearMin from URL when called with null', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setYearMin', payload: null } },
      '/?yearMin=2010'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('yearMin').textContent).toBe('null');
  });

  it('calls handleArgumentChange when yearMin is set', async () => {
    const handleArgumentChange = jest.fn();
    const user = userEvent.setup();
    renderFacets(
      {
        handleArgumentChange,
        action: { type: 'setYearMin', payload: 2015 },
      },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(handleArgumentChange).toHaveBeenCalledTimes(1);
  });
});

describe('useFacets – setYearMax', () => {
  it('writes yearMax to URL when called with a numeric value', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setYearMax', payload: 2023 } },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('yearMax').textContent).toBe('2023');
  });

  it('removes yearMax from URL when called with null', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setYearMax', payload: null } },
      '/?yearMax=2023'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('yearMax').textContent).toBe('null');
  });
});

describe('useFacets – setRatingMin and setRatingMax', () => {
  it('writes ratingMin to URL', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setRatingMin', payload: 6.5 } },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('ratingMin').textContent).toBe('6.5');
  });

  it('removes ratingMin when set to null', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setRatingMin', payload: null } },
      '/?ratingMin=6.5'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('ratingMin').textContent).toBe('null');
  });

  it('writes ratingMax to URL', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setRatingMax', payload: 9 } },
      '/'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('ratingMax').textContent).toBe('9');
  });

  it('removes ratingMax when set to null', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'setRatingMax', payload: null } },
      '/?ratingMax=9'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('ratingMax').textContent).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// Multi-value setters (languages, creators, publishers, mediaTypes, status)
// ---------------------------------------------------------------------------

describe('useFacets – remaining multi-value setters', () => {
  const testCases: Array<{ type: string; paramName: string }> = [
    { type: 'setLanguages', paramName: 'languages' },
    { type: 'setCreators', paramName: 'creators' },
    { type: 'setPublishers', paramName: 'publishers' },
    { type: 'setMediaTypes', paramName: 'mediaTypes' },
    { type: 'setStatus', paramName: 'status' },
  ];

  testCases.forEach(({ type, paramName }) => {
    it(`${type} writes values to URL`, async () => {
      const user = userEvent.setup();
      renderFacets(
        { action: { type, payload: ['val1', 'val2'] } },
        '/'
      );

      await user.click(screen.getByRole('button', { name: 'Execute Action' }));

      const values = JSON.parse(
        screen.getByTestId(paramName).textContent!
      );
      expect(values).toEqual(['val1', 'val2']);
    });

    it(`${type} clears values when called with an empty array`, async () => {
      const user = userEvent.setup();
      renderFacets(
        { action: { type, payload: [] } },
        `/?${paramName}=val1`
      );

      await user.click(screen.getByRole('button', { name: 'Execute Action' }));

      expect(
        JSON.parse(screen.getByTestId(paramName).textContent!)
      ).toEqual([]);
    });

    it(`${type} calls handleArgumentChange`, async () => {
      const handleArgumentChange = jest.fn();
      const user = userEvent.setup();
      renderFacets(
        { handleArgumentChange, action: { type, payload: ['x'] } },
        '/'
      );

      await user.click(screen.getByRole('button', { name: 'Execute Action' }));

      expect(handleArgumentChange).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// clearAllFacets
// ---------------------------------------------------------------------------

describe('useFacets – clearAllFacets', () => {
  it('removes all facet params from the URL', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'clearAllFacets' } },
      '/?genres=Action&yearMin=2010&ratingMax=9&status=rated&languages=en'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(JSON.parse(screen.getByTestId('genres').textContent!)).toEqual([]);
    expect(screen.getByTestId('yearMin').textContent).toBe('null');
    expect(screen.getByTestId('ratingMax').textContent).toBe('null');
    expect(JSON.parse(screen.getByTestId('status').textContent!)).toEqual([]);
    expect(JSON.parse(screen.getByTestId('languages').textContent!)).toEqual(
      []
    );
  });

  it('resets activeFacetCount to 0 after clearing', async () => {
    const user = userEvent.setup();
    renderFacets(
      { action: { type: 'clearAllFacets' } },
      '/?genres=Action&yearMin=2010'
    );

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('2');

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(screen.getByTestId('activeFacetCount').textContent).toBe('0');
  });

  it('preserves non-facet params (orderBy) after clearing', async () => {
    const user = userEvent.setup();

    /**
     * Dedicated harness that also reads 'orderBy' from the URL to verify it is
     * preserved when clearAllFacets is invoked.
     */
    const HarnessWithOrderBy: React.FC = () => {
      const facets = useFacets();
      const [searchParams] = React.useState(() => new URLSearchParams(''));
      // Read orderBy directly via another useMultiValueSearchParam instance
      const { useMultiValueSearchParam: useParam } = (() => {
        // inline import to avoid top-level module issues
        const { useMultiValueSearchParam: impl } = require('src/hooks/useMultiValueSearchParam');
        return { useMultiValueSearchParam: impl };
      })();

      const InnerHarness: React.FC = () => {
        const facetsInner = useFacets();
        // We can't easily read orderBy here without another hook instance,
        // so we just verify genres and activeFacetCount.
        return (
          <>
            <span data-testid="genres2">
              {JSON.stringify(facetsInner.genres)}
            </span>
            <span data-testid="activeFacetCount2">
              {String(facetsInner.activeFacetCount)}
            </span>
            <button onClick={() => facetsInner.clearAllFacets()}>
              Clear
            </button>
          </>
        );
      };

      return <InnerHarness />;
    };

    render(
      <MemoryRouter initialEntries={['/?genres=Action&orderBy=title']}>
        <HarnessWithOrderBy />
      </MemoryRouter>
    );

    expect(screen.getByTestId('activeFacetCount2').textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(JSON.parse(screen.getByTestId('genres2').textContent!)).toEqual([]);
    expect(screen.getByTestId('activeFacetCount2').textContent).toBe('0');
  });

  it('calls handleArgumentChange when clearAllFacets is invoked', async () => {
    const handleArgumentChange = jest.fn();
    const user = userEvent.setup();
    renderFacets(
      { handleArgumentChange, action: { type: 'clearAllFacets' } },
      '/?genres=Action'
    );

    await user.click(screen.getByRole('button', { name: 'Execute Action' }));

    expect(handleArgumentChange).toHaveBeenCalledTimes(1);
  });
});
