import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { Items, FacetsResponse } from 'mediatracker-api';
import { mediaTrackerApi } from 'src/api/api';

/**
 * useFacetsData — fetches facet counts from the /api/items/facets endpoint.
 *
 * Accepts the same filter params as the paginated items endpoint so the
 * returned counts always reflect the currently filtered set.  The query is
 * identified by all its args so React Query refetches automatically whenever
 * any param changes.
 *
 * @param args   Filter params forwarded to the facets API.  Typically the
 *               spread of `args` (static page params) combined with
 *               `facetParams` (active facet URL state) from useFacets.
 * @param enabled  When false the query is skipped (e.g. when showFacets is off).
 */
export const useFacetsData = (
  args: Items.Facets.RequestQuery,
  enabled = true
): {
  facetsData: FacetsResponse | undefined;
  isLoadingFacets: boolean;
} => {
  const { data, isFetched } = useQuery({
    queryKey: ['facets', args],
    queryFn: async () => mediaTrackerApi.items.facets(args),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });

  return {
    facetsData: data as FacetsResponse | undefined,
    isLoadingFacets: !isFetched && enabled,
  };
};
