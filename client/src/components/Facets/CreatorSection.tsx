import React, { FunctionComponent } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { FacetCheckboxList } from './FacetCheckboxList';

/**
 * Derives a context-aware label for the creator facet section based on the
 * current media type filter.
 *
 * - movies       → "Director"
 * - tv           → "Creator"
 * - book         → "Author"
 * - audiobook    → "Author"
 * - video_game   → "Developer"
 * - undefined    → "Creator" (mixed-content pages: union of all creator fields)
 */
function getCreatorSectionTitle(mediaType: string | undefined): string {
  switch (mediaType) {
    case 'movie':
      return t`Director`;
    case 'tv':
      return t`Creator`;
    case 'book':
    case 'audiobook':
      return t`Author`;
    case 'video_game':
      return t`Developer`;
    default:
      // Mixed-content pages or unknown type — use generic label.
      return t`Creator`;
  }
}

/**
 * CreatorSection renders the creator facet accordion section inside FacetPanel.
 *
 * The section header label changes based on the current mediaType context:
 *   - "Director" for movies
 *   - "Creator" for TV shows
 *   - "Author" for books and audiobooks
 *   - "Developer" for video games
 *   - Generic "Creator" for mixed-content pages (no mediaType filter)
 *
 * On mixed-content pages the backend returns a union of all creator fields
 * (director, creator, authors, developer) into a single list so the generic
 * "Creator" label is appropriate.
 *
 * The section is hidden when the facets API returns no creator data (i.e. the
 * current media type has no creator column populated, or the library is empty).
 *
 * Up to 15 creators are shown by default; a "Show more / Show less" toggle
 * appears when the list has more entries.  Multiple creators can be selected
 * simultaneously (OR logic within the dimension is enforced by the parent via
 * useFacets).
 *
 * Count badges update reactively whenever the facets API refetches (triggered
 * by other facet param changes in the parent component).
 */
export const CreatorSection: FunctionComponent<{
  /**
   * Available creator options sorted by count descending (from facets API).
   * The backend unions director/creator/authors/developer fields depending
   * on the active mediaType filter.
   */
  creators: FacetOption[];
  /** Currently selected creator values (from useFacets). */
  selectedCreators: string[];
  /** Setter from useFacets — writes creators URL param with merge strategy. */
  setCreators: (values: string[]) => void;
  /**
   * Optional current media type filter.  Drives the context-aware section
   * title.  When undefined the page is showing mixed-content (Watchlist,
   * Upcoming, In Progress) and the generic "Creator" label is used.
   */
  mediaType?: string;
}> = ({ creators, selectedCreators, setCreators, mediaType }) => {
  // Hide section when no creator data exists for the current context.
  if (creators.length === 0) {
    return null;
  }

  const title = getCreatorSectionTitle(mediaType);

  return (
    <FacetSection
      title={title}
      hasActiveSelection={selectedCreators.length > 0}
    >
      <FacetCheckboxList
        items={creators}
        selectedValues={selectedCreators}
        onSelectionChange={setCreators}
      />
    </FacetSection>
  );
};
