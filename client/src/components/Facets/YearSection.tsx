import React, { FunctionComponent, useMemo } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { FacetRangeSlider } from './FacetRangeSlider';

/**
 * YearSection renders the Release Year accordion section inside FacetPanel.
 *
 * Shows a dual-handle range slider spanning from the earliest available year
 * in the user's library to the current calendar year.  Paired numeric inputs
 * below the slider display the current yearMin / yearMax values and accept
 * direct keyboard entry.
 *
 * ## Interaction model
 * - Dragging a slider handle updates the corresponding input in real-time.
 * - URL params yearMin and yearMax are written on slider *release*
 *   (onValueCommit) to avoid creating a history entry per drag step.
 * - Typing in a numeric input updates the slider on blur; values outside the
 *   valid range are clamped automatically.
 * - When both bounds are at the extremes (min / max) the params are cleared
 *   from the URL (equivalent to "no filter applied for this dimension").
 *
 * ## Visibility
 * Hidden when the years array from the facets API is empty (no items with a
 * release date in the current filtered set).
 */
export const YearSection: FunctionComponent<{
  /** Available year options with counts (from facets API, sorted desc by count). */
  years: FacetOption[];
  /** Currently selected minimum year (from useFacets), null if unset. */
  yearMin: number | null;
  /** Currently selected maximum year (from useFacets), null if unset. */
  yearMax: number | null;
  /** Setter from useFacets — writes yearMin URL param with merge strategy. */
  setYearMin: (value: number | null) => void;
  /** Setter from useFacets — writes yearMax URL param with merge strategy. */
  setYearMax: (value: number | null) => void;
}> = ({ years, yearMin, yearMax, setYearMin, setYearMax }) => {
  // Derive the valid year range from the facets API response.
  // The years array contains { value: "2024", count: 5 } entries.
  const { minYear, maxYear } = useMemo(() => {
    if (years.length === 0) {
      const current = new Date().getFullYear();
      return { minYear: current - 1, maxYear: current };
    }

    const numericYears = years
      .map((y) => parseInt(y.value, 10))
      .filter((n) => !isNaN(n));

    if (numericYears.length === 0) {
      const current = new Date().getFullYear();
      return { minYear: current - 1, maxYear: current };
    }

    return {
      minYear: Math.min(...numericYears),
      maxYear: Math.max(...numericYears),
    };
  }, [years]);

  if (years.length === 0) {
    return null;
  }

  const hasActiveSelection = yearMin !== null || yearMax !== null;

  /**
   * Called by FacetRangeSlider on slider commit (release) or numeric input
   * blur.  Updates both URL params atomically.
   */
  const handleCommit = (newMin: number | null, newMax: number | null) => {
    setYearMin(newMin);
    setYearMax(newMax);
  };

  return (
    <FacetSection
      title={t`Year`}
      hasActiveSelection={hasActiveSelection}
    >
      <FacetRangeSlider
        min={minYear}
        max={maxYear}
        step={1}
        valueMin={yearMin}
        valueMax={yearMax}
        onCommit={handleCommit}
        minInputLabel={t`Minimum year`}
        maxInputLabel={t`Maximum year`}
        decimalPlaces={0}
      />
    </FacetSection>
  );
};
