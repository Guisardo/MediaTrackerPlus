import React, { FunctionComponent } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { FacetCheckboxList } from './FacetCheckboxList';

/**
 * GenreSection renders the Genre accordion section inside FacetPanel.
 *
 * Lists all available genres sorted by count descending (as returned by the
 * facets API).  Up to 15 genres are shown by default; a "Show more / Show less"
 * toggle appears when the list has more items (provided by FacetCheckboxList
 * via ExpandableList).
 *
 * Multiple genres can be selected simultaneously; each selection updates the
 * genres URL param and resets pagination to page 1 via the setter from
 * useFacets.
 *
 * Count badges update reactively whenever the facets API refetches (triggered
 * by other facet param changes in the parent component).
 */
export const GenreSection: FunctionComponent<{
  /** Available genre options sorted by count descending (from facets API). */
  genres: FacetOption[];
  /** Currently selected genre values (from useFacets). */
  selectedGenres: string[];
  /** Setter from useFacets — writes genres URL param with merge strategy. */
  setGenres: (values: string[]) => void;
}> = ({ genres, selectedGenres, setGenres }) => {
  if (genres.length === 0) {
    return null;
  }

  return (
    <FacetSection
      title={t`Genre`}
      hasActiveSelection={selectedGenres.length > 0}
    >
      <FacetCheckboxList
        items={genres}
        selectedValues={selectedGenres}
        onSelectionChange={setGenres}
      />
    </FacetSection>
  );
};
