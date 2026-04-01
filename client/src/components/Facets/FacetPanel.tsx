import React, { FunctionComponent } from 'react';
import { Trans } from '@lingui/macro';

import { UseFacetsResult } from 'src/hooks/facets';

/**
 * FacetPanel renders as a persistent 240px sidebar beside the grid on screens
 * >= 1024px (lg breakpoint).  On smaller screens it is hidden — the mobile
 * bottom-drawer variant (US-010) will handle smaller viewports.
 *
 * Always renders a "Filters" header at the top. When filters are active, the
 * label includes an active count and a "Clear all" button appears.  Individual
 * facet dimension sections are rendered as children so downstream stories
 * (US-011 through US-018) can add content without modifying this shell.
 */
export const FacetPanel: FunctionComponent<{
  facets: UseFacetsResult;
  children?: React.ReactNode;
}> = ({ facets, children }) => {
  const { activeFacetCount, clearAllFacets } = facets;

  return (
    <aside
      className="hidden lg:flex flex-col w-60 flex-shrink-0 mr-4 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
      aria-label="Filters"
    >
      {/* Header row — always visible; shows active count and clear button when filters are active */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {activeFacetCount > 0
            ? <Trans>Filters ({activeFacetCount})</Trans>
            : <Trans>Filters</Trans>}
        </span>
        {activeFacetCount > 0 && (
          <button
            type="button"
            onClick={clearAllFacets}
            className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          >
            <Trans>Clear all filters</Trans>
          </button>
        )}
      </div>

      {/* Accordion sections injected by child stories */}
      <div className="flex-1 overflow-y-auto py-1">{children}</div>
    </aside>
  );
};
