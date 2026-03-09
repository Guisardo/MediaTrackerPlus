import React, { FunctionComponent } from 'react';
import { t, Trans } from '@lingui/macro';

import { isAudiobook, isBook, isVideoGame } from 'src/utils';
import { FacetSection } from './FacetSection';

/**
 * The fixed set of status filter keys and their display labels.
 *
 * These keys are serialized to the `status` URL param as a comma-separated
 * string (e.g. `?status=rated,watchlist,seen`).  The backend in US-006 maps
 * each key to an existing boolean flag on GetItemsArgs:
 *   - rated    → onlyWithUserRating: true
 *   - unrated  → onlyWithoutUserRating: true
 *   - watchlist → onlyOnWatchlist: true
 *   - seen     → onlySeenItems: true
 *
 * The "seen" label is media-type-aware (Watched / Played / Read / Listened).
 */
const STATUS_KEYS = ['rated', 'unrated', 'watchlist', 'seen'] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

/**
 * Returns the media-type-aware display label for the "seen" status option.
 *
 * - audiobook  → "Listened"
 * - book       → "Read"
 * - video_game → "Played"
 * - movie/tv/undefined → "Watched"
 */
function getSeenLabel(mediaType: string | undefined): string {
  if (isAudiobook(mediaType as Parameters<typeof isAudiobook>[0])) {
    return t`Listened`;
  }
  if (isBook(mediaType as Parameters<typeof isBook>[0])) {
    return t`Read`;
  }
  if (isVideoGame(mediaType as Parameters<typeof isVideoGame>[0])) {
    return t`Played`;
  }
  return t`Watched`;
}

/**
 * Returns the human-readable display label for each status filter key.
 *
 * @param key - One of the STATUS_KEYS (rated, unrated, watchlist, seen).
 * @param mediaType - Optional current media type for context-aware "seen" label.
 */
function getStatusLabel(key: StatusKey, mediaType: string | undefined): string {
  switch (key) {
    case 'rated':
      return t`Rated`;
    case 'unrated':
      return t`Unrated`;
    case 'watchlist':
      return t`On watchlist`;
    case 'seen':
      return getSeenLabel(mediaType);
  }
}

/**
 * StatusSection renders the Status accordion section inside FacetPanel.
 *
 * It replaces the FilterByComponent dropdown when showFacets={true} on content
 * list pages.  The section always renders (no data dependency), presenting four
 * fixed checkboxes:
 *   - Rated
 *   - Unrated
 *   - On watchlist
 *   - [media-type-aware seen label]
 *
 * Multiple statuses can be selected simultaneously.  The backend in US-006
 * applies AND logic across all selected status flags (an item must satisfy
 * every checked condition).
 *
 * The "seen" label adapts to the current media type:
 *   - movies / TV → "Watched"
 *   - video_game  → "Played"
 *   - book        → "Read"
 *   - audiobook   → "Listened"
 *   - mixed-content (undefined) → "Watched"
 *
 * When showFacets={false} (e.g. statistics pages), FilterByComponent continues
 * to render unchanged — StatusSection is not used.
 *
 * URL param: `status` — comma-separated keys (e.g. `status=rated,watchlist`).
 */
export const StatusSection: FunctionComponent<{
  /** Currently selected status keys (from useFacets). */
  selectedStatus: string[];
  /** Setter from useFacets — writes status URL param with merge strategy. */
  setStatus: (values: string[]) => void;
  /**
   * Optional current media type filter.  Drives the "seen" label.
   * When undefined the page is showing mixed-content; defaults to "Watched".
   */
  mediaType?: string;
}> = ({ selectedStatus, setStatus, mediaType }) => {
  const hasActiveSelection = selectedStatus.length > 0;

  /**
   * Toggles a status key in the selectedStatus array.
   * When the key is already selected, it is removed.  Otherwise it is appended.
   */
  const handleToggle = (key: StatusKey) => {
    if (selectedStatus.includes(key)) {
      setStatus(selectedStatus.filter((k) => k !== key));
    } else {
      setStatus([...selectedStatus, key]);
    }
  };

  return (
    <FacetSection title={t`Status`} hasActiveSelection={hasActiveSelection}>
      <div className="flex flex-col gap-1 py-1">
        {STATUS_KEYS.map((key) => {
          const label = getStatusLabel(key, mediaType);
          const checked = selectedStatus.includes(key);
          const checkboxId = `facet-status-${key}`;

          return (
            <label
              key={key}
              htmlFor={checkboxId}
              className="flex items-center gap-2 cursor-pointer select-none text-sm"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(key)}
                className="accent-blue-500"
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
      {hasActiveSelection && (
        <p className="text-xs text-gray-400 mt-1">
          <Trans>Item must match all selected statuses</Trans>
        </p>
      )}
    </FacetSection>
  );
};
