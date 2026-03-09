import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useMultiValueSearchParam } from 'src/hooks/useMultiValueSearchParam';

/**
 * The subset of query params that represent active facet selections.
 * Matches the relevant fields in Items.Paginated.RequestQuery and
 * Items.Facets.RequestQuery from mediatracker-api.
 */
export interface FacetParams {
  genres?: string | null;
  languages?: string | null;
  creators?: string | null;
  publishers?: string | null;
  mediaTypes?: string | null;
  status?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
}

export interface UseFacetsResult {
  /** Active facet params ready to be forwarded to the API (undefined fields omitted). */
  facetParams: FacetParams;

  /** Count of facet dimensions that have at least one active selection. */
  activeFacetCount: number;

  // Multi-value setters (comma-separated params)
  setGenres: (values: string[]) => void;
  setLanguages: (values: string[]) => void;
  setCreators: (values: string[]) => void;
  setPublishers: (values: string[]) => void;
  setMediaTypes: (values: string[]) => void;
  setStatus: (values: string[]) => void;

  // Range setters (numeric params)
  setYearMin: (value: number | null) => void;
  setYearMax: (value: number | null) => void;
  setRatingMin: (value: number | null) => void;
  setRatingMax: (value: number | null) => void;

  /** Resets all facet URL params and removes them from the URL. */
  clearAllFacets: () => void;

  // Current parsed values for reading in components
  genres: string[];
  languages: string[];
  creators: string[];
  publishers: string[];
  mediaTypes: string[];
  status: string[];
  yearMin: number | null;
  yearMax: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
}

const MULTI_VALUE_FACET_PARAMS = [
  'genres',
  'languages',
  'creators',
  'publishers',
  'mediaTypes',
  'status',
] as const;

const RANGE_FACET_PARAMS = [
  'yearMin',
  'yearMax',
  'ratingMin',
  'ratingMax',
] as const;

/** All URL param names owned by facets. */
export const ALL_FACET_PARAM_NAMES: readonly string[] = [
  ...MULTI_VALUE_FACET_PARAMS,
  ...RANGE_FACET_PARAMS,
];

/**
 * useFacets — single source of truth for all facet URL state.
 *
 * Reads and writes facet selection URL params with a merge strategy that
 * preserves all existing params (including orderBy and sortOrder) on every
 * write.  Any facet change resets pagination to page 1 by calling the
 * optional handleArgumentChange callback.
 *
 * useFacets does NOT own orderBy or sortOrder; those remain managed
 * exclusively by useOrderByComponent.
 *
 * @param handleArgumentChange  Called after each facet change so the caller
 *                              can reset pagination.  Matches the existing
 *                              pattern used by useOrderByComponent and
 *                              useFilterBy.
 */
export const useFacets = (
  handleArgumentChange?: () => void
): UseFacetsResult => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Multi-value params ──────────────────────────────────────────────────
  const { values: genres, setValues: setGenres } = useMultiValueSearchParam(
    'genres',
    handleArgumentChange
  );
  const { values: languages, setValues: setLanguages } =
    useMultiValueSearchParam('languages', handleArgumentChange);
  const { values: creators, setValues: setCreators } =
    useMultiValueSearchParam('creators', handleArgumentChange);
  const { values: publishers, setValues: setPublishers } =
    useMultiValueSearchParam('publishers', handleArgumentChange);
  const { values: mediaTypes, setValues: setMediaTypes } =
    useMultiValueSearchParam('mediaTypes', handleArgumentChange);
  const { values: status, setValues: setStatus } = useMultiValueSearchParam(
    'status',
    handleArgumentChange
  );

  // ── Range (numeric) params ───────────────────────────────────────────────
  const yearMinRaw = searchParams.get('yearMin');
  const yearMaxRaw = searchParams.get('yearMax');
  const ratingMinRaw = searchParams.get('ratingMin');
  const ratingMaxRaw = searchParams.get('ratingMax');

  const yearMin: number | null =
    yearMinRaw !== null ? Number(yearMinRaw) : null;
  const yearMax: number | null =
    yearMaxRaw !== null ? Number(yearMaxRaw) : null;
  const ratingMin: number | null =
    ratingMinRaw !== null ? Number(ratingMinRaw) : null;
  const ratingMax: number | null =
    ratingMaxRaw !== null ? Number(ratingMaxRaw) : null;

  /**
   * Generic numeric-param setter.  Merges with all existing params, always
   * preserving orderBy and sortOrder.  Removes the param when value is null.
   * Resets pagination to page 1.
   */
  const setNumericParam = useCallback(
    (paramName: string, value: number | null) => {
      const currentEntries = Object.fromEntries(searchParams.entries());

      // Remove 'page' param to reset pagination to page 1.
      const { page: _page, ...withoutPage } = currentEntries;

      if (value === null) {
        const { [paramName]: _removed, ...rest } = withoutPage;
        setSearchParams(rest);
      } else {
        setSearchParams({
          ...withoutPage,
          [paramName]: value.toString(),
        });
      }

      if (handleArgumentChange) {
        handleArgumentChange();
      }
    },
    [handleArgumentChange, searchParams, setSearchParams]
  );

  const setYearMin = useCallback(
    (value: number | null) => setNumericParam('yearMin', value),
    [setNumericParam]
  );
  const setYearMax = useCallback(
    (value: number | null) => setNumericParam('yearMax', value),
    [setNumericParam]
  );
  const setRatingMin = useCallback(
    (value: number | null) => setNumericParam('ratingMin', value),
    [setNumericParam]
  );
  const setRatingMax = useCallback(
    (value: number | null) => setNumericParam('ratingMax', value),
    [setNumericParam]
  );

  // ── Clear all ────────────────────────────────────────────────────────────
  /**
   * Removes all facet params from the URL while preserving non-facet params
   * (orderBy, sortOrder, search, year, genre, filter, etc.).
   */
  const clearAllFacets = useCallback(() => {
    const currentEntries = Object.fromEntries(searchParams.entries());
    const facetParamSet = new Set<string>([
      ...MULTI_VALUE_FACET_PARAMS,
      ...RANGE_FACET_PARAMS,
      'page',
    ]);
    const preserved = Object.fromEntries(
      Object.entries(currentEntries).filter(
        ([key]) => !facetParamSet.has(key)
      )
    );
    setSearchParams(preserved);

    if (handleArgumentChange) {
      handleArgumentChange();
    }
  }, [handleArgumentChange, searchParams, setSearchParams]);

  // ── Derived state ────────────────────────────────────────────────────────
  /**
   * Count of dimensions with at least one active selection.
   * Range dimensions count as one dimension even when only one bound is set.
   */
  const activeFacetCount: number = [
    genres.length > 0,
    languages.length > 0,
    creators.length > 0,
    publishers.length > 0,
    mediaTypes.length > 0,
    status.length > 0,
    yearMin !== null || yearMax !== null,
    ratingMin !== null || ratingMax !== null,
  ].filter(Boolean).length;

  // ── Active params object for API calls ───────────────────────────────────
  /**
   * Build the facet query params object to forward to the API.  Only includes
   * keys that have a non-empty / non-null active value so the query stays
   * clean.
   */
  const facetParams: FacetParams = {
    ...(genres.length > 0 ? { genres: genres.join(',') } : {}),
    ...(languages.length > 0 ? { languages: languages.join(',') } : {}),
    ...(creators.length > 0 ? { creators: creators.join(',') } : {}),
    ...(publishers.length > 0 ? { publishers: publishers.join(',') } : {}),
    ...(mediaTypes.length > 0 ? { mediaTypes: mediaTypes.join(',') } : {}),
    ...(status.length > 0 ? { status: status.join(',') } : {}),
    ...(yearMin !== null ? { yearMin } : {}),
    ...(yearMax !== null ? { yearMax } : {}),
    ...(ratingMin !== null ? { ratingMin } : {}),
    ...(ratingMax !== null ? { ratingMax } : {}),
  };

  return {
    facetParams,
    activeFacetCount,
    setGenres,
    setLanguages,
    setCreators,
    setPublishers,
    setMediaTypes,
    setStatus,
    setYearMin,
    setYearMax,
    setRatingMin,
    setRatingMax,
    clearAllFacets,
    genres,
    languages,
    creators,
    publishers,
    mediaTypes,
    status,
    yearMin,
    yearMax,
    ratingMin,
    ratingMax,
  };
};
