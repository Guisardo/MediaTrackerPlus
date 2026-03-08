import React, { FunctionComponent } from 'react';
import { Trans } from '@lingui/macro';

/**
 * FacetMobileButton renders a "Filters" toolbar button that matches the
 * existing OrderBy / FilterBy button style (flex, cursor-pointer, select-none,
 * Material icon + label).
 *
 * When any facets are active, a small circular badge appears beside the label
 * showing the count of active facet dimensions.
 *
 * Renders only on screens < 1024px (lg:hidden) — on larger screens the
 * persistent sidebar replaces this button.
 */
export const FacetMobileButton: FunctionComponent<{
  activeFacetCount: number;
  onClick: () => void;
}> = ({ activeFacetCount, onClick }) => {
  return (
    <div
      className="flex lg:hidden ml-2 cursor-pointer select-none items-center"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="material-icons" aria-hidden="true">
        tune
      </span>
      &nbsp;
      <Trans>Filters</Trans>
      {activeFacetCount > 0 && (
        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold leading-none text-white bg-blue-500 rounded-full">
          {activeFacetCount}
        </span>
      )}
    </div>
  );
};
