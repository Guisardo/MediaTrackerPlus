import React, { FunctionComponent } from 'react';
import { t, Trans } from '@lingui/macro';

import { isAudiobook, isBook, isVideoGame } from 'src/utils';
import { UseFacetsResult } from 'src/hooks/facets';

/**
 * Returns a human-readable display label for a status key in the context of a
 * chip (e.g. "Rated", "On watchlist", "Watched", "Played", etc.).
 *
 * Mirrors the label logic in StatusSection so labels are consistent.
 */
function getStatusChipLabel(
  key: string,
  mediaType: string | undefined
): string {
  switch (key) {
    case 'rated':
      return t`Rated`;
    case 'unrated':
      return t`Unrated`;
    case 'watchlist':
      return t`On watchlist`;
    case 'seen': {
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
    default:
      return key;
  }
}

/**
 * Returns the context-aware label for the "creators" dimension chip.
 *
 * Mirrors the logic in CreatorSection for consistency.
 */
function getCreatorDimensionLabel(mediaType: string | undefined): string {
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
      return t`Creator`;
  }
}

/**
 * Maps raw media type enum values to human-readable display labels.
 *
 * Mirrors the logic in MediaTypeSection for consistency.
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
 * A single removable chip representing one active facet selection.
 *
 * Shows a dimension label, a value, and an × button to remove it.
 * When `onRemove` is omitted the chip is not dismissable (used for ranges
 * which are cleared via the setter with null values).
 */
const FacetChip: FunctionComponent<{
  /** Dimension label, e.g. "Genre" or "Year". */
  dimensionLabel: string;
  /** The selected value(s) to display, e.g. "Action" or "2010–2020". */
  value: string;
  /** Called when the user clicks the × button. */
  onRemove: () => void;
}> = ({ dimensionLabel, value, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 whitespace-nowrap flex-shrink-0">
    <span className="text-blue-600 dark:text-blue-400 font-semibold">
      {dimensionLabel}:
    </span>
    <span>{value}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={t`Remove ${dimensionLabel}: ${value} filter`}
      className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
    >
      <span className="material-icons text-xs leading-none" aria-hidden="true">
        close
      </span>
    </button>
  </span>
);

/**
 * ActiveFacetChips renders a horizontal row of removable chips representing
 * every active facet selection in the current URL state.
 *
 * The row is only rendered when at least one facet is active.  On mobile the
 * row uses `overflow-x-auto` to scroll horizontally rather than wrapping.
 *
 * Chip semantics:
 *   - Multi-value dimensions (genres, languages, creators, publishers,
 *     mediaTypes) → one chip per selected value.
 *   - Status → one chip per selected status key (e.g. "Rated", "Watched").
 *   - Year range  → single chip showing "2010–2020" (or one-sided if only one
 *     bound is set).
 *   - Rating range → single chip showing "6.5–10.0".
 *
 * Clicking × on a chip:
 *   - Multi-value: removes that value from the selected array via its setter.
 *   - Range: clears both bounds via setYearMin(null)/setYearMax(null) or
 *     setRatingMin(null)/setRatingMax(null) for a one-click range reset.
 *   - Individual range bound removal is not supported — click × resets the
 *     whole range at once (UX simplicity).
 *
 * A "Clear all" button at the right end of the row calls clearAllFacets().
 *
 * @prop facets     The UseFacetsResult returned by useFacets().
 * @prop mediaType  Optional current media type for context-aware chip labels.
 */
export const ActiveFacetChips: FunctionComponent<{
  /** All facet state and setters from useFacets(). */
  facets: UseFacetsResult;
  /**
   * Optional current media type for context-aware labels on the "creators"
   * dimension chip (Director / Author / Developer / Creator) and the "seen"
   * status chip (Watched / Played / Read / Listened).
   */
  mediaType?: string;
}> = ({ facets, mediaType }) => {
  const {
    genres,
    setGenres,
    languages,
    setLanguages,
    creators,
    setCreators,
    publishers,
    setPublishers,
    mediaTypes,
    setMediaTypes,
    status,
    setStatus,
    yearMin,
    yearMax,
    setYearMin,
    setYearMax,
    ratingMin,
    ratingMax,
    setRatingMin,
    setRatingMax,
    activeFacetCount,
    clearAllFacets,
  } = facets;

  // Nothing to render when no facets are active.
  if (activeFacetCount === 0) {
    return null;
  }

  // ── Helpers to build chip value labels ─────────────────────────────────

  /**
   * Builds the display label for a year range chip.
   * Shows both bounds ("2010–2020"), or a one-sided bound ("2010–" / "–2020").
   */
  const yearRangeLabel = (): string => {
    if (yearMin !== null && yearMax !== null) {
      return `${yearMin}–${yearMax}`;
    }
    if (yearMin !== null) {
      return `${yearMin}–`;
    }
    return `–${yearMax}`;
  };

  /**
   * Builds the display label for a rating range chip.
   * Shows both bounds ("6.5–10.0"), or a one-sided bound.
   */
  const ratingRangeLabel = (): string => {
    if (ratingMin !== null && ratingMax !== null) {
      return `${ratingMin.toFixed(1)}–${ratingMax.toFixed(1)}`;
    }
    if (ratingMin !== null) {
      return `${ratingMin.toFixed(1)}–`;
    }
    return `–${(ratingMax as number).toFixed(1)}`;
  };

  const creatorDimensionLabel = getCreatorDimensionLabel(mediaType);

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-1 min-w-0"
      aria-label={t`Active filters`}
    >
      {/* ── Genre chips ──────────────────────────────────────────────── */}
      {genres.map((genre) => (
        <FacetChip
          key={`genre-${genre}`}
          dimensionLabel={t`Genre`}
          value={genre}
          onRemove={() => setGenres(genres.filter((g) => g !== genre))}
        />
      ))}

      {/* ── Language chips ───────────────────────────────────────────── */}
      {languages.map((lang) => (
        <FacetChip
          key={`language-${lang}`}
          dimensionLabel={t`Language`}
          value={
            (() => {
              try {
                return new Intl.DisplayNames(['en'], {
                  type: 'language',
                }).of(lang) ?? lang;
              } catch {
                return lang;
              }
            })()
          }
          onRemove={() =>
            setLanguages(languages.filter((l) => l !== lang))
          }
        />
      ))}

      {/* ── Creator chips (Director / Author / Developer / Creator) ──── */}
      {creators.map((creator) => (
        <FacetChip
          key={`creator-${creator}`}
          dimensionLabel={creatorDimensionLabel}
          value={creator}
          onRemove={() =>
            setCreators(creators.filter((c) => c !== creator))
          }
        />
      ))}

      {/* ── Publisher chips ──────────────────────────────────────────── */}
      {publishers.map((publisher) => (
        <FacetChip
          key={`publisher-${publisher}`}
          dimensionLabel={t`Publisher`}
          value={publisher}
          onRemove={() =>
            setPublishers(publishers.filter((p) => p !== publisher))
          }
        />
      ))}

      {/* ── Media Type chips ─────────────────────────────────────────── */}
      {mediaTypes.map((mt) => (
        <FacetChip
          key={`mediatype-${mt}`}
          dimensionLabel={t`Media Type`}
          value={getMediaTypeDisplayLabel(mt)}
          onRemove={() =>
            setMediaTypes(mediaTypes.filter((m) => m !== mt))
          }
        />
      ))}

      {/* ── Status chips ─────────────────────────────────────────────── */}
      {status.map((statusKey) => (
        <FacetChip
          key={`status-${statusKey}`}
          dimensionLabel={t`Status`}
          value={getStatusChipLabel(statusKey, mediaType)}
          onRemove={() =>
            setStatus(status.filter((s) => s !== statusKey))
          }
        />
      ))}

      {/* ── Year range chip (single chip for the whole range) ────────── */}
      {(yearMin !== null || yearMax !== null) && (
        <FacetChip
          dimensionLabel={t`Year`}
          value={yearRangeLabel()}
          onRemove={() => {
            setYearMin(null);
            setYearMax(null);
          }}
        />
      )}

      {/* ── Rating range chip (single chip for the whole range) ─────── */}
      {(ratingMin !== null || ratingMax !== null) && (
        <FacetChip
          dimensionLabel={t`Rating`}
          value={ratingRangeLabel()}
          onRemove={() => {
            setRatingMin(null);
            setRatingMax(null);
          }}
        />
      )}

      {/* ── Clear all button ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={clearAllFacets}
        className="ml-1 flex-shrink-0 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded whitespace-nowrap"
      >
        <Trans>Clear all</Trans>
      </button>
    </div>
  );
};
