/**
 * Tests for src/components/PaginatedGridItems.tsx.
 *
 * Covers the Pagination component and the PaginatedGridItems component,
 * targeting as many branches as possible:
 *  - Loading state rendering
 *  - Items display vs search results
 *  - Search input visibility based on props and mediaType
 *  - "Search for items or import" empty-state message
 *  - Sort-order controls (OrderByComponent, FilterByComponent) visibility
 *  - Facet UI elements (FacetPanel, FacetDrawer, FacetMobileButton, ActiveFacetChips)
 *  - Pagination component rendering and interaction
 *  - noItems logic under showFacets=true/false with filters/facet counts
 *  - facetsData fallback vs real data
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks – must appear before the imports of the mocked modules
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => {
  // This module is a babel macro and its symbols are transformed at compile
  // time to @lingui/react's Trans. The jest mock here is a no-op safety net
  // for any direct runtime import; the real mock work happens in @lingui/react.
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    Plural: ({ value, one, other }: any) =>
      React.createElement(React.Fragment, null, value === 1 ? one : other),
    t: (strings: any, ...values: any[]) =>
      typeof strings === 'string'
        ? strings
        : strings.raw
        ? String.raw(strings, ...values)
        : strings[0],
  };
});

/**
 * @lingui/macro Trans/Plural calls are compiled at babel time to:
 *   <Trans id="ICU string" values={{...}} />
 *
 * So we mock @lingui/react's Trans to interpret the id prop, substituting
 * the values object so assertions against the rendered text work.
 */
jest.mock('@lingui/react', () => {
  const React = require('react');

  /**
   * Resolves a compiled Lingui ICU message id string against a values map.
   *
   * Handles patterns like:
   *   "{key, plural, one {form with {0}} other {# form with {1}}}"
   *
   * The resolution follows two passes:
   *   1. Inner value substitution: replace {0}, {1}, {key} leaf references.
   *   2. Plural resolution: handle {key, plural, one {...} other {...}}.
   *
   * This covers the babel-compiled output of @lingui/macro's <Plural> and
   * simple <Trans> components.
   */
  const resolveICU = (id: string, values: Record<string, unknown>): string => {
    if (!id) return '';

    /**
     * Replace leaf {N} or {keyName} placeholders (not followed by a comma,
     * which would indicate they are plural/select keys rather than values).
     */
    const substituteLeafValues = (str: string): string =>
      str.replace(/\{(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key) => {
        const val = (values as any)?.[key] ?? (values as any)?.[Number(key)];
        if (val === undefined || val === null) return '';
        return String(val);
      });

    /**
     * Resolve a single {key, plural, one {form} other {form}} expression.
     * Nested {N} refs inside the forms are substituted after selecting the form.
     * Returns the resolved string or null if the pattern does not match.
     */
    const resolvePluralBlock = (
      str: string,
      valuesMap: Record<string, unknown>
    ): string => {
      // Match a top-level plural block. We extract inner content manually
      // to handle nested braces.
      const pluralStart = /^\{([a-zA-Z0-9_]+),\s*plural,\s*/;
      const startMatch = pluralStart.exec(str);
      if (!startMatch) return str;

      const key = startMatch[1];
      const numVal = Number((valuesMap as any)?.[key]);
      const rest = str.slice(startMatch[0].length);

      // Parse "one {form} other {form}}" by tracking brace depth
      const parseForms = (
        input: string
      ): Record<string, string> => {
        const forms: Record<string, string> = {};
        let i = 0;
        while (i < input.length) {
          // Skip whitespace
          while (i < input.length && /\s/.test(input[i])) i++;
          if (input[i] === '}') break; // end of plural block

          // Read the keyword (e.g. "one", "other")
          const kwStart = i;
          while (i < input.length && input[i] !== '{' && input[i] !== '}') i++;
          const keyword = input.slice(kwStart, i).trim();
          if (!keyword || input[i] !== '{') break;

          // Read the form body — track brace depth
          i++; // consume opening '{'
          let depth = 1;
          const bodyStart = i;
          while (i < input.length && depth > 0) {
            if (input[i] === '{') depth++;
            else if (input[i] === '}') depth--;
            i++;
          }
          // body is input.slice(bodyStart, i - 1) (exclude final closing '}')
          const body = input.slice(bodyStart, i - 1);
          forms[keyword] = body;
        }
        return forms;
      };

      const forms = parseForms(rest);
      const form = numVal === 1 ? (forms.one ?? forms.other ?? '') : (forms.other ?? forms.one ?? '');
      // Replace '#' with the numeric value, then substitute leaf refs
      const substituted = form.replace('#', String(numVal));
      return substituteLeafValues(substituted);
    };

    // First: substitute all leaf {N}/{key} references that are NOT plural keys
    let result = id;

    // Handle plural blocks at the top level and recursively
    // Simple approach: find all plural block starts and resolve them
    result = result.replace(/\{([a-zA-Z0-9_]+),\s*plural,.*\}$/gs, (match) =>
      resolvePluralBlock(match, values)
    );

    // If no plural was found, still substitute leaf values
    result = substituteLeafValues(result);

    return result.trim();
  };

  /**
   * Substitutes <N>text</N> placeholders in an ICU message with the actual
   * React elements from the `components` prop. Returns an array of nodes.
   */
  const substituteComponents = (
    id: string,
    components: Record<string, unknown>
  ): React.ReactNode[] => {
    // Split by component placeholders like <0>text</0>
    const parts = id.split(/(<\d+>[^<]*<\/\d+>)/);
    return parts.map((part, idx) => {
      const match = part.match(/^<(\d+)>(.*)<\/\d+>$/);
      if (match) {
        const [, key, innerText] = match;
        const Component = (components as any)[key];
        if (Component && React.isValidElement(Component)) {
          // Clone the component element with the inner text as children
          return React.cloneElement(Component as React.ReactElement, { key: idx }, innerText);
        }
        return innerText;
      }
      return part || null;
    });
  };

  const Trans = ({ id, message, children, values, components }: any) => {
    // In Lingui v5, the babel plugin sets id=hash and message=readable ICU text.
    // Use message (readable text with ICU patterns) for resolution, fall back to id.
    const text = message || id;
    if (text) {
      if (components) {
        let resolved = text;
        if (values) {
          resolved = resolveICU(resolved, values);
        }
        const nodes = substituteComponents(resolved, components);
        return React.createElement(React.Fragment, null, ...nodes);
      }
      const resolved = resolveICU(text, values ?? {});
      return React.createElement(React.Fragment, null, resolved);
    }
    return React.createElement(React.Fragment, null, children ?? null);
  };

  return {
    Trans,
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    useLingui: () => ({
      i18n: {
        _: (id: any) =>
          typeof id === 'string' ? id : id?.message || id?.id || '',
      },
    }),
  };
});

/**
 * A clsx mock that handles both string/boolean args and object args.
 * Objects contribute their key if the value is truthy.
 */
jest.mock('clsx', () => (...args: unknown[]): string => {
  const result: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      result.push(arg);
    } else if (typeof arg === 'object' && !Array.isArray(arg)) {
      for (const [key, val] of Object.entries(arg as Record<string, unknown>)) {
        if (val) result.push(key);
      }
    }
  }
  return result.join(' ');
});

jest.mock('src/api/items', () => ({
  useItems: jest.fn(),
}));

jest.mock('src/api/search', () => ({
  useSearch: jest.fn(),
}));

jest.mock('src/api/facets', () => ({
  useFacetsData: jest.fn(),
}));

jest.mock('src/components/OrderBy', () => ({
  useOrderByComponent: jest.fn(),
}));

jest.mock('src/components/FilterBy', () => ({
  useFilterBy: jest.fn(),
}));

jest.mock('src/components/GroupSelector', () => ({
  useGroupSelectorComponent: jest.fn(),
}));

jest.mock('src/hooks/updateSearchParamsHook', () => ({
  useUpdateSearchParams: jest.fn(),
}));

jest.mock('src/hooks/facets', () => ({
  useFacets: jest.fn(),
}));

jest.mock('src/components/Facets', () => {
  const React = require('react');
  const makeMock =
    (name: string) =>
    (props: any) =>
      React.createElement('div', { 'data-testid': name });

  return {
    FacetPanel: ({ children, facets }: { children: React.ReactNode; facets: any }) =>
      React.createElement('div', { 'data-testid': 'facet-panel' }, children),
    FacetDrawer: ({
      children,
      isOpen,
      onClose,
      facets,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
      onClose: () => void;
      facets: any;
    }) =>
      isOpen
        ? React.createElement('div', { 'data-testid': 'facet-drawer' }, children)
        : null,
    FacetMobileButton: ({ onClick, activeFacetCount }: any) =>
      React.createElement(
        'button',
        { 'data-testid': 'facet-mobile-button', onClick },
        `Filters (${activeFacetCount})`
      ),
    ActiveFacetChips: makeMock('active-facet-chips'),
    GenreSection: ({ genres }: any) =>
      React.createElement('div', { 'data-testid': 'genre-section', 'data-genres': JSON.stringify(genres) }),
    YearSection: makeMock('year-section'),
    RatingSection: makeMock('rating-section'),
    LanguageSection: makeMock('language-section'),
    CreatorSection: makeMock('creator-section'),
    StatusSection: makeMock('status-section'),
    PublisherSection: makeMock('publisher-section'),
    MediaTypeSection: makeMock('media-type-section'),
  };
});

jest.mock('src/components/GridItem', () => {
  const React = require('react');
  return {
    GridItem: ({ mediaItem }: any) =>
      React.createElement(
        'div',
        { 'data-testid': `grid-item-${mediaItem.id}` },
        mediaItem.title
      ),
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useItems } from 'src/api/items';
import { useSearch } from 'src/api/search';
import { useFacetsData } from 'src/api/facets';
import { useOrderByComponent } from 'src/components/OrderBy';
import { useFilterBy } from 'src/components/FilterBy';
import { useGroupSelectorComponent } from 'src/components/GroupSelector';
import { useUpdateSearchParams } from 'src/hooks/updateSearchParamsHook';
import { useFacets } from 'src/hooks/facets';
import { PaginatedGridItems, Pagination } from 'src/components/PaginatedGridItems';

// ---------------------------------------------------------------------------
// Shared mock functions
// ---------------------------------------------------------------------------

const mockSearch = jest.fn();
const mockUpdateSearchParams = jest.fn();

// ---------------------------------------------------------------------------
// Default facets object
// ---------------------------------------------------------------------------

const buildDefaultFacets = () => ({
  genres: [],
  setGenres: jest.fn(),
  yearMin: undefined,
  yearMax: undefined,
  setYearMin: jest.fn(),
  setYearMax: jest.fn(),
  ratingMin: undefined,
  ratingMax: undefined,
  setRatingMin: jest.fn(),
  setRatingMax: jest.fn(),
  languages: [],
  setLanguages: jest.fn(),
  creators: [],
  setCreators: jest.fn(),
  publishers: [],
  setPublishers: jest.fn(),
  mediaTypes: [],
  setMediaTypes: jest.fn(),
  status: undefined,
  setStatus: jest.fn(),
  activeFacetCount: 0,
  clearAllFacets: jest.fn(),
  facetParams: {},
});

// ---------------------------------------------------------------------------
// beforeEach – reset all mocks to sensible defaults
// ---------------------------------------------------------------------------

// jsdom does not implement scrollIntoView — mock it globally.
beforeAll(() => {
  if (typeof window !== 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    Object.defineProperty(window.document.body, 'scrollIntoView', {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset scrollIntoView mock each test so call counts stay clean.
  if (typeof window !== 'undefined' && window.document.body.scrollIntoView) {
    (window.document.body.scrollIntoView as jest.Mock).mockClear?.();
  }

  (useItems as jest.Mock).mockReturnValue({
    isLoading: false,
    items: [],
    numberOfPages: 1,
    numberOfItemsTotal: 0,
  });

  (useSearch as jest.Mock).mockReturnValue({
    items: [],
    isLoading: false,
    search: mockSearch,
  });

  (useFacetsData as jest.Mock).mockReturnValue({ facetsData: null });

  (useOrderByComponent as jest.Mock).mockReturnValue({
    orderBy: 'title',
    sortOrder: 'asc',
    OrderByComponent: () =>
      React.createElement('div', { 'data-testid': 'order-by' }),
  });

  (useFilterBy as jest.Mock).mockReturnValue({
    filter: {},
    FilterByComponent: () =>
      React.createElement('div', { 'data-testid': 'filter-by' }),
  });

  (useGroupSelectorComponent as jest.Mock).mockReturnValue({
    selectedGroupId: undefined,
    GroupSelectorComponent: () =>
      React.createElement('div', { 'data-testid': 'group-selector' }),
  });

  (useUpdateSearchParams as jest.Mock).mockReturnValue({
    currentValue: 1,
    updateSearchParams: mockUpdateSearchParams,
  });

  (useFacets as jest.Mock).mockReturnValue(buildDefaultFacets());
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

type PaginatedGridItemsProps = React.ComponentProps<typeof PaginatedGridItems>;

function renderPaginated(
  props: Partial<PaginatedGridItemsProps> = {},
  initialEntry = '/'
) {
  const defaultArgs = { mediaType: 'movie' as any };
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PaginatedGridItems args={defaultArgs} {...props} />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Pagination component tests
// ---------------------------------------------------------------------------

describe('Pagination component', () => {
  it('renders the correct number of page buttons', () => {
    const setPage = jest.fn();
    render(
      <MemoryRouter>
        <Pagination numberOfPages={5} page={1} setPage={setPage} />
      </MemoryRouter>
    );

    // Expect 5 clickable page divs (text 1-5)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('applies bg-blue-500 class to the active page button', () => {
    const setPage = jest.fn();
    render(
      <MemoryRouter>
        <Pagination numberOfPages={3} page={2} setPage={setPage} />
      </MemoryRouter>
    );

    const activeButton = screen.getByText('2');
    expect(activeButton.className).toContain('bg-blue-500');
  });

  it('does NOT apply bg-blue-500 class to non-active page buttons', () => {
    const setPage = jest.fn();
    render(
      <MemoryRouter>
        <Pagination numberOfPages={3} page={2} setPage={setPage} />
      </MemoryRouter>
    );

    const inactiveButton1 = screen.getByText('1');
    const inactiveButton3 = screen.getByText('3');
    expect(inactiveButton1.className).not.toContain('bg-blue-500');
    expect(inactiveButton3.className).not.toContain('bg-blue-500');
  });

  it('applies bg-red-500 class to non-active page buttons', () => {
    const setPage = jest.fn();
    render(
      <MemoryRouter>
        <Pagination numberOfPages={3} page={2} setPage={setPage} />
      </MemoryRouter>
    );

    const inactiveButton1 = screen.getByText('1');
    expect(inactiveButton1.className).toContain('bg-red-500');
  });

  it('calls setPage with the correct page number when clicking a page button', async () => {
    const setPage = jest.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Pagination numberOfPages={4} page={1} setPage={setPage} />
      </MemoryRouter>
    );

    await user.click(screen.getByText('3'));

    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it('renders zero buttons when numberOfPages is 0', () => {
    const setPage = jest.fn();
    const { container } = render(
      <MemoryRouter>
        <Pagination numberOfPages={0} page={1} setPage={setPage} />
      </MemoryRouter>
    );

    // The wrapper div renders but contains no page buttons
    const buttons = container.querySelectorAll('.cursor-pointer');
    expect(buttons.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – loading state', () => {
  it('renders "Loading" text when items are loading', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: true,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });

    renderPaginated();

    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders "Loading" text when search is loading', () => {
    (useSearch as jest.Mock).mockReturnValue({
      items: [],
      isLoading: true,
      search: mockSearch,
    });

    renderPaginated();

    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('does not render grid items while loading', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: true,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated();

    expect(screen.queryByTestId('grid-item-1')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Items display
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – items display', () => {
  it('renders grid items when items are available', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [
        { id: 1, title: 'Movie A' },
        { id: 2, title: 'Movie B' },
      ],
      numberOfPages: 1,
      numberOfItemsTotal: 2,
    });

    renderPaginated();

    expect(screen.getByTestId('grid-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('grid-item-2')).toBeInTheDocument();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Movie B')).toBeInTheDocument();
  });

  it('renders no grid items when items array is empty', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });

    renderPaginated();

    expect(screen.queryByTestId('grid-item-1')).not.toBeInTheDocument();
  });

  it('displays the item count when not loading and no search query', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 5,
    });

    renderPaginated();

    // The Plural with value=5 renders a message containing the count.
    // The resolved ICU string may contain extra whitespace from the template
    // literals in the source (args.year / args.genre substitutions), so use
    // a regex that accepts any surrounding whitespace.
    expect(screen.getByText(/5 item/)).toBeInTheDocument();
  });

  it('displays "1 item" when numberOfItemsTotal is 1 (Plural one branch)', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Solo' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated();

    // The Plural one branch resolves to a message starting with "1 item"
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Search input visibility
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – search input visibility', () => {
  it('renders search input when showSearch=true and args.mediaType is set', () => {
    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // Search button
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('does NOT render search input when showSearch=false', () => {
    renderPaginated({ showSearch: false, args: { mediaType: 'movie' as any } });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does NOT render search input when args.mediaType is undefined', () => {
    renderPaginated({ showSearch: true, args: {} });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// "Search for items or import" empty-state message
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – empty state with showSearch', () => {
  it('renders "Search for items or import" when showSearch=true and noItems=true', () => {
    // noItems=true: items.length===0, not loading, no searchQuery, no filter keys
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });
    (useFilterBy as jest.Mock).mockReturnValue({
      filter: {},
      FilterByComponent: () => React.createElement('div', { 'data-testid': 'filter-by' }),
    });

    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    // The Trans mock renders the id string with component placeholders.
    // We verify that the "import" text appears somewhere in the document —
    // either as a link or as inline text rendered by the Trans component mock.
    const importText = screen.queryByRole('link', { name: 'import' })
      ?? screen.queryByText(/import/i);
    expect(importText).toBeInTheDocument();

    // Also verify the surrounding text fragment is rendered
    expect(screen.getByText(/Search for items/i)).toBeInTheDocument();
  });

  it('does NOT render "Search for items or import" when showSearch=false (even if noItems=true)', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });

    renderPaginated({ showSearch: false });

    expect(screen.queryByText(/Search for items or/)).not.toBeInTheDocument();
  });

  it('does NOT render "Search for items or import" when items exist', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    expect(screen.queryByText(/Search for items or/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sort-order controls
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – sort order controls', () => {
  it('renders OrderByComponent when showSortOrderControls=true', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showSortOrderControls: true });

    expect(screen.getByTestId('order-by')).toBeInTheDocument();
  });

  it('does NOT render OrderByComponent when showSortOrderControls=false', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showSortOrderControls: false });

    expect(screen.queryByTestId('order-by')).not.toBeInTheDocument();
  });

  it('renders FilterByComponent when showSortOrderControls=true and showFacets=false', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showSortOrderControls: true, showFacets: false });

    expect(screen.getByTestId('filter-by')).toBeInTheDocument();
  });

  it('does NOT render FilterByComponent when showFacets=true (even when showSortOrderControls=true)', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showSortOrderControls: true, showFacets: true });

    expect(screen.queryByTestId('filter-by')).not.toBeInTheDocument();
  });

  it('does NOT render sort controls when showSortOrderControls is not provided', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({});

    expect(screen.queryByTestId('order-by')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-by')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Facet UI elements
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – FacetPanel', () => {
  it('renders FacetPanel when showFacets=true', () => {
    renderPaginated({ showFacets: true });

    expect(screen.getByTestId('facet-panel')).toBeInTheDocument();
  });

  it('does NOT render FacetPanel when showFacets=false', () => {
    renderPaginated({ showFacets: false });

    expect(screen.queryByTestId('facet-panel')).not.toBeInTheDocument();
  });

  it('does NOT render FacetPanel when showFacets is not provided', () => {
    renderPaginated({});

    expect(screen.queryByTestId('facet-panel')).not.toBeInTheDocument();
  });
});

describe('PaginatedGridItems – FacetDrawer', () => {
  it('renders FacetDrawer container when showFacets=true (initially closed so null rendered)', () => {
    renderPaginated({ showFacets: true });

    // Drawer is closed by default so it returns null in our mock
    expect(screen.queryByTestId('facet-drawer')).not.toBeInTheDocument();
  });

  it('does NOT render FacetDrawer when showFacets=false', () => {
    renderPaginated({ showFacets: false });

    expect(screen.queryByTestId('facet-drawer')).not.toBeInTheDocument();
  });

  it('opens FacetDrawer when FacetMobileButton is clicked', async () => {
    const user = userEvent.setup();

    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showFacets: true });

    // Click the mobile filter button which sets drawerOpen=true
    const mobileButton = screen.getByTestId('facet-mobile-button');
    await user.click(mobileButton);

    expect(screen.getByTestId('facet-drawer')).toBeInTheDocument();
  });
});

describe('PaginatedGridItems – FacetMobileButton', () => {
  it('renders FacetMobileButton when showFacets=true and not loading', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });

    // noItems would show the empty state, so we need items to be non-empty
    // OR showSearch=false so the noItems branch doesn't trigger
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showFacets: true });

    expect(screen.getByTestId('facet-mobile-button')).toBeInTheDocument();
  });

  it('does NOT render FacetMobileButton when showFacets=false', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showFacets: false });

    expect(screen.queryByTestId('facet-mobile-button')).not.toBeInTheDocument();
  });

  it('displays the activeFacetCount on FacetMobileButton', () => {
    (useFacets as jest.Mock).mockReturnValue({
      ...buildDefaultFacets(),
      activeFacetCount: 3,
    });
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showFacets: true });

    expect(screen.getByTestId('facet-mobile-button').textContent).toContain('3');
  });
});

describe('PaginatedGridItems – ActiveFacetChips', () => {
  it('renders ActiveFacetChips when showFacets=true', () => {
    renderPaginated({ showFacets: true });

    expect(screen.getByTestId('active-facet-chips')).toBeInTheDocument();
  });

  it('does NOT render ActiveFacetChips when showFacets=false', () => {
    renderPaginated({ showFacets: false });

    expect(screen.queryByTestId('active-facet-chips')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Facet sections within the panel
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – facet sections rendered in panel', () => {
  it('renders facet sections when showFacets=true', () => {
    renderPaginated({ showFacets: true });

    expect(screen.getAllByTestId('status-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('genre-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('year-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('language-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('creator-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('publisher-section').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('media-type-section').length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render facet sections when showFacets=false', () => {
    renderPaginated({ showFacets: false });

    expect(screen.queryByTestId('status-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('genre-section')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pagination widget within PaginatedGridItems
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – Pagination widget', () => {
  it('renders Pagination when numberOfPages > 1 and not in search mode', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 3,
      numberOfItemsTotal: 30,
    });

    renderPaginated();

    // Expect page buttons 1, 2, 3
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does NOT render Pagination when numberOfPages is 1', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 5,
    });

    renderPaginated();

    // With only 1 page there should be no "2" pagination button
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('calls updateSearchParams when a Pagination page button is clicked', async () => {
    const user = userEvent.setup();

    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 3,
      numberOfItemsTotal: 30,
    });

    renderPaginated();

    await user.click(screen.getByText('2'));

    expect(mockUpdateSearchParams).toHaveBeenCalledWith(2);
  });
});

// ---------------------------------------------------------------------------
// noItems logic
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – noItems logic (showFacets=false)', () => {
  it('noItems is true when items empty, not loading, no searchQuery, empty filter', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });
    (useFilterBy as jest.Mock).mockReturnValue({
      filter: {},
      FilterByComponent: () => React.createElement('div', { 'data-testid': 'filter-by' }),
    });

    // showSearch=true triggers the noItems message branch
    renderPaginated({ showSearch: true, showFacets: false, args: { mediaType: 'movie' as any } });

    expect(screen.getByText(/Search for items or/)).toBeInTheDocument();
  });

  it('noItems is false when filter has keys (showFacets=false)', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });
    (useFilterBy as jest.Mock).mockReturnValue({
      filter: { onlyOnWatchlist: true },
      FilterByComponent: () => React.createElement('div', { 'data-testid': 'filter-by' }),
    });

    renderPaginated({ showSearch: true, showFacets: false, args: { mediaType: 'movie' as any } });

    // noItems=false so the empty-state message should NOT appear
    expect(screen.queryByText(/Search for items or/)).not.toBeInTheDocument();
  });
});

describe('PaginatedGridItems – noItems logic (showFacets=true)', () => {
  it('noItems is true when items empty, not loading, activeFacetCount=0', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });
    (useFacets as jest.Mock).mockReturnValue({
      ...buildDefaultFacets(),
      activeFacetCount: 0,
    });

    renderPaginated({ showSearch: true, showFacets: true, args: { mediaType: 'movie' as any } });

    expect(screen.getByText(/Search for items or/)).toBeInTheDocument();
  });

  it('noItems is false when activeFacetCount > 0 (showFacets=true)', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [],
      numberOfPages: 1,
      numberOfItemsTotal: 0,
    });
    (useFacets as jest.Mock).mockReturnValue({
      ...buildDefaultFacets(),
      activeFacetCount: 2,
    });

    renderPaginated({ showSearch: true, showFacets: true, args: { mediaType: 'movie' as any } });

    // noItems=false so the empty-state message should NOT appear
    expect(screen.queryByText(/Search for items or/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// facetsData fallback vs real data
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – facetsData', () => {
  it('uses emptyFacets fallback (empty genres array) when facetsData is null', () => {
    (useFacetsData as jest.Mock).mockReturnValue({ facetsData: null });

    renderPaginated({ showFacets: true });

    const genreSection = screen.getAllByTestId('genre-section')[0];
    const genresAttribute = genreSection.getAttribute('data-genres');
    expect(JSON.parse(genresAttribute!)).toEqual([]);
  });

  it('passes real genres to GenreSection when facetsData is available', () => {
    const realFacetsData = {
      genres: ['Action', 'Drama', 'Comedy'],
      years: [2020, 2021, 2022],
      languages: ['en', 'fr'],
      creators: ['Director A'],
      publishers: ['Studio B'],
      mediaTypes: ['movie'],
    };
    (useFacetsData as jest.Mock).mockReturnValue({ facetsData: realFacetsData });

    renderPaginated({ showFacets: true });

    const genreSection = screen.getAllByTestId('genre-section')[0];
    const genresAttribute = genreSection.getAttribute('data-genres');
    expect(JSON.parse(genresAttribute!)).toEqual(['Action', 'Drama', 'Comedy']);
  });
});

// ---------------------------------------------------------------------------
// Search results vs items display
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – search results display', () => {
  it('shows search result count message when a search is active', async () => {
    const user = userEvent.setup();

    (useSearch as jest.Mock).mockReturnValue({
      items: [
        { id: 10, title: 'Found Movie 1' },
        { id: 11, title: 'Found Movie 2' },
      ],
      isLoading: false,
      search: mockSearch,
    });

    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    // Type a search query in the input
    const input = screen.getByRole('textbox');
    await user.type(input, 'action');

    // Submit the form
    const searchButton = screen.getByText('Search');
    await user.click(searchButton);

    // Should render search results (not items from useItems)
    expect(screen.getByTestId('grid-item-10')).toBeInTheDocument();
    expect(screen.getByTestId('grid-item-11')).toBeInTheDocument();
  });

  it('does NOT render Pagination when in search mode (searchQuery active)', async () => {
    const user = userEvent.setup();

    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 5,
      numberOfItemsTotal: 50,
    });

    (useSearch as jest.Mock).mockReturnValue({
      items: [{ id: 10, title: 'Found Movie 1' }],
      isLoading: false,
      search: mockSearch,
    });

    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    const input = screen.getByRole('textbox');
    await user.type(input, 'action');

    const searchButton = screen.getByText('Search');
    await user.click(searchButton);

    // Pagination pages 2-5 should not render when in search mode
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('does NOT render FacetMobileButton when search is active', async () => {
    const user = userEvent.setup();

    (useSearch as jest.Mock).mockReturnValue({
      items: [{ id: 10, title: 'Found Movie 1' }],
      isLoading: false,
      search: mockSearch,
    });

    renderPaginated({ showFacets: true, showSearch: true, args: { mediaType: 'movie' as any } });

    const input = screen.getByRole('textbox');
    await user.type(input, 'action');

    const searchButton = screen.getByText('Search');
    await user.click(searchButton);

    expect(screen.queryByTestId('facet-mobile-button')).not.toBeInTheDocument();
  });

  it('does NOT render OrderByComponent when search is active', async () => {
    const user = userEvent.setup();

    (useSearch as jest.Mock).mockReturnValue({
      items: [{ id: 10, title: 'Found Movie' }],
      isLoading: false,
      search: mockSearch,
    });

    renderPaginated({
      showSearch: true,
      showSortOrderControls: true,
      args: { mediaType: 'movie' as any },
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'action');

    const searchButton = screen.getByText('Search');
    await user.click(searchButton);

    expect(screen.queryByTestId('order-by')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Search result count Plural branches
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – search result Plural message', () => {
  it('shows plural "items" label when search returns more than 1 result', async () => {
    const user = userEvent.setup();

    (useSearch as jest.Mock).mockReturnValue({
      items: [
        { id: 10, title: 'Found Movie 1' },
        { id: 11, title: 'Found Movie 2' },
      ],
      isLoading: false,
      search: mockSearch,
    });

    renderPaginated({ showSearch: true, args: { mediaType: 'movie' as any } });

    const input = screen.getByRole('textbox');
    await user.type(input, 'action');

    await user.click(screen.getByText('Search'));

    // Plural other branch for 2 results
    expect(screen.getByText(/Found.*items.*for.*query/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GridItem appearance – showAddToWatchlistAndMarkAsSeenButtons based on search
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – GridItem rendering', () => {
  it('renders items from items array when no search is active', () => {
    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [
        { id: 1, title: 'Item From Items Array' },
      ],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated();

    expect(screen.getByTestId('grid-item-1')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isStatisticsPage prop forwarding
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – isStatisticsPage prop', () => {
  it('passes isStatisticsPage to useFilterBy', () => {
    renderPaginated({ isStatisticsPage: true, args: { mediaType: 'movie' as any } });

    expect(useFilterBy).toHaveBeenCalledWith(
      'movie',
      true,
      expect.any(Function)
    );
  });

  it('passes isStatisticsPage=false to useFilterBy when not set', () => {
    renderPaginated({ args: { mediaType: 'movie' as any } });

    expect(useFilterBy).toHaveBeenCalledWith(
      'movie',
      false,
      expect.any(Function)
    );
  });
});

// ---------------------------------------------------------------------------
// Facet sections also render inside FacetDrawer when it opens
// ---------------------------------------------------------------------------

describe('PaginatedGridItems – facet sections in FacetDrawer', () => {
  it('renders facet sections inside the drawer when drawer is opened', async () => {
    const user = userEvent.setup();

    (useItems as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [{ id: 1, title: 'Movie A' }],
      numberOfPages: 1,
      numberOfItemsTotal: 1,
    });

    renderPaginated({ showFacets: true });

    const mobileButton = screen.getByTestId('facet-mobile-button');
    await user.click(mobileButton);

    expect(screen.getByTestId('facet-drawer')).toBeInTheDocument();
    // The drawer contains facet sections (2 instances now: panel + drawer)
    expect(screen.getAllByTestId('genre-section').length).toBeGreaterThanOrEqual(2);
  });
});
