import React, { FunctionComponent, useMemo } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { FacetRangeSlider } from './FacetRangeSlider';

/**
 * RatingSection renders the TMDB Rating accordion section inside FacetPanel.
 *
 * Shows a dual-handle range slider spanning from 0 to 10 with 0.5-step increments.
 * Paired numeric inputs below the slider display the current ratingMin / ratingMax
 * values and accept direct keyboard entry.
 *
 * ## Interaction model
 * - Dragging a slider handle updates the corresponding input in real-time.
 * - URL params ratingMin and ratingMax are written on slider *release*
 *   (onValueCommit) to avoid creating a history entry per drag step.
 * - Typing in a numeric input updates the slider on blur; values outside the
 *   valid range (0-10) are clamped automatically and snapped to 0.5 increments.
 * - When both bounds are at the extremes (0 / 10) the params are cleared
 *   from the URL (equivalent to "no filter applied for this dimension").
 *
 * ## Visibility
 * Renders when the facets response includes rating data (always visible since
 * ratings are typically available for all media items).
 */
export const RatingSection: FunctionComponent<{
  /** Available rating options with counts (from facets API, sorted desc by count). */
  ratings: FacetOption[];
  /** Currently selected minimum rating (from useFacets), null if unset. */
  ratingMin: number | null;
  /** Currently selected maximum rating (from useFacets), null if unset. */
  ratingMax: number | null;
  /** Setter from useFacets — writes ratingMin URL param with merge strategy. */
  setRatingMin: (value: number | null) => void;
  /** Setter from useFacets — writes ratingMax URL param with merge strategy. */
  setRatingMax: (value: number | null) => void;
}> = ({ ratings, ratingMin, ratingMax, setRatingMin, setRatingMax }) => {
  if (ratings.length === 0) {
    return null;
  }

  const hasActiveSelection = ratingMin !== null || ratingMax !== null;

  /**
   * Called by FacetRangeSlider on slider commit (release) or numeric input
   * blur.  Updates both URL params atomically.
   */
  const handleCommit = (newMin: number | null, newMax: number | null) => {
    setRatingMin(newMin);
    setRatingMax(newMax);
  };

  return (
    <FacetSection
      title={t`Rating`}
      hasActiveSelection={hasActiveSelection}
    >
      <FacetRangeSlider
        min={0}
        max={10}
        step={0.5}
        valueMin={ratingMin}
        valueMax={ratingMax}
        onCommit={handleCommit}
        minInputLabel={t`Minimum rating`}
        maxInputLabel={t`Maximum rating`}
        decimalPlaces={1}
      />
    </FacetSection>
  );
};
