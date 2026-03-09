import React, { FunctionComponent } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { FacetCheckboxList } from './FacetCheckboxList';

/**
 * PublisherSection renders the Publisher accordion section inside FacetPanel.
 *
 * The section is only visible when:
 *   - The current page is filtered to video_game media type, OR
 *   - The page is showing mixed-content (no mediaType filter) AND publisher data exists in the facets response
 *
 * On single-type pages (movies, TV, books, audiobooks), publishers are not applicable
 * and the section remains hidden (publishers array is empty).
 *
 * Up to 15 publishers are shown by default; a "Show more / Show less" toggle
 * appears when the list has more entries. Multiple publishers can be selected
 * simultaneously (OR logic within the dimension).
 *
 * Count badges update reactively whenever the facets API refetches (triggered
 * by other facet param changes in the parent component).
 */
export const PublisherSection: FunctionComponent<{
  /** Available publisher options sorted by count descending (from facets API). */
  publishers: FacetOption[];
  /** Currently selected publisher values (from useFacets). */
  selectedPublishers: string[];
  /** Setter from useFacets — writes publishers URL param with merge strategy. */
  setPublishers: (values: string[]) => void;
  /**
   * Optional current media type filter.
   * - When mediaType='video_game', section is visible (if publishers data exists)
   * - When undefined (mixed-content), section is visible only if publishers array has entries
   * - For other types (movie, tv, book, audiobook), section is hidden
   */
  mediaType?: string;
}> = ({ publishers, selectedPublishers, setPublishers, mediaType }) => {
  // Hide section when no publisher data exists or when on a non-games single-type page
  if (publishers.length === 0) {
    return null;
  }

  // On single-type pages (non-games), never show publisher section
  // mediaType is only set on single-type pages; undefined = mixed-content (Watchlist, Upcoming, etc)
  if (mediaType && mediaType !== 'video_game') {
    return null;
  }

  return (
    <FacetSection
      title={t`Publisher`}
      hasActiveSelection={selectedPublishers.length > 0}
    >
      <FacetCheckboxList
        items={publishers}
        selectedValues={selectedPublishers}
        onSelectionChange={setPublishers}
      />
    </FacetSection>
  );
};
