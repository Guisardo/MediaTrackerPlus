import React, { FunctionComponent, useMemo } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { ExpandableList } from './ExpandableList';

/**
 * Maps raw media type enum values to human-readable display labels.
 *
 * Matches the label convention used in GridItem.tsx so labels are consistent
 * across the UI.  The default branch returns the raw value to future-proof
 * against any new media types added to the backend.
 */
function getMediaTypeDisplayLabel(value: string): string {
  switch (value) {
    case 'movie':
      return t`Movie`;
    case 'tv':
      return t`TV Show`;
    case 'book':
      return t`Book`;
    case 'audiobook':
      return t`Audiobook`;
    case 'video_game':
      return t`Video game`;
    default:
      return value;
  }
}

/**
 * MediaTypeSection renders the Media Type accordion section inside FacetPanel.
 *
 * This section is only shown on mixed-content pages (Watchlist, Upcoming,
 * In Progress) where the user may have multiple media types in their library.
 * On single-type pages (ItemsPage — already scoped to one type), the mediaType
 * prop will be set and this section will not render.
 *
 * Each media type present in the user's library is shown as a checkbox with a
 * human-readable display label (e.g., 'Movie', 'TV Show') and an item count.
 * Multiple types can be selected simultaneously (OR logic), updating the
 * mediaTypes URL param.
 *
 * Count badges update reactively whenever the facets API refetches (triggered
 * by other facet param changes in the parent component).
 */
export const MediaTypeSection: FunctionComponent<{
  /** Available media type options sorted by count descending (from facets API). */
  mediaTypes: FacetOption[];
  /** Currently selected media type values (from useFacets). */
  selectedMediaTypes: string[];
  /** Setter from useFacets — writes mediaTypes URL param with merge strategy. */
  setMediaTypes: (values: string[]) => void;
  /**
   * Optional current media type filter.
   * When set (e.g., 'movie' on an ItemsPage), this section is hidden because
   * the page is already scoped to a single type.
   * When undefined (mixed-content pages like Watchlist), the section renders
   * if mediaType data exists.
   */
  mediaType?: string;
}> = ({ mediaTypes, selectedMediaTypes, setMediaTypes, mediaType }) => {
  // On single-type pages the page is already scoped; hide the section.
  if (mediaType !== undefined) {
    return null;
  }

  // Hide when no media type data is present in the facets response.
  if (mediaTypes.length === 0) {
    return null;
  }

  return (
    <MediaTypeSectionInner
      mediaTypes={mediaTypes}
      selectedMediaTypes={selectedMediaTypes}
      setMediaTypes={setMediaTypes}
    />
  );
};

/**
 * Inner rendering component that handles display label transformation.
 *
 * Separated so that hooks (useMemo) are only called when the section is
 * actually visible.
 */
const MediaTypeSectionInner: FunctionComponent<{
  mediaTypes: FacetOption[];
  selectedMediaTypes: string[];
  setMediaTypes: (values: string[]) => void;
}> = ({ mediaTypes, selectedMediaTypes, setMediaTypes }) => {
  /**
   * Augment each FacetOption with a human-readable display label while keeping
   * the raw enum value for URL param tracking and checkbox state.
   */
  const mediaTypesWithDisplayLabels = useMemo(
    () =>
      mediaTypes.map((option) => ({
        ...option,
        displayLabel: getMediaTypeDisplayLabel(option.value),
      })),
    [mediaTypes]
  );

  const handleToggle = (value: string, checked: boolean) => {
    if (checked) {
      setMediaTypes([...selectedMediaTypes, value]);
    } else {
      setMediaTypes(selectedMediaTypes.filter((v) => v !== value));
    }
  };

  return (
    <FacetSection
      title={t`Media Type`}
      hasActiveSelection={selectedMediaTypes.length > 0}
    >
      <ExpandableList items={mediaTypesWithDisplayLabels as unknown[]} maxVisible={15}>
        {(visibleItems) => (
          <ul className="space-y-1">
            {(visibleItems as Array<FacetOption & { displayLabel: string }>).map((option) => {
              const isChecked = selectedMediaTypes.includes(option.value);
              const inputId = `facet-checkbox-${option.value.replace(/\s+/g, '-').toLowerCase()}`;

              return (
                <li key={option.value} className="flex items-center justify-between">
                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-2 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200 select-none min-w-0 flex-1"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      className="flex-shrink-0 accent-blue-500 cursor-pointer"
                      checked={isChecked}
                      onChange={(e) => handleToggle(option.value, e.target.checked)}
                    />
                    <span className="truncate">{option.displayLabel}</span>
                  </label>
                  <span
                    className="ml-2 flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums"
                    aria-hidden="true"
                  >
                    {option.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ExpandableList>
    </FacetSection>
  );
};
