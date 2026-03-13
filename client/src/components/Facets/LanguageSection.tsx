import React, { FunctionComponent, useMemo } from 'react';
import { t } from '@lingui/macro';

import { FacetOption } from 'mediatracker-api';
import { FacetSection } from './FacetSection';
import { ExpandableList } from './ExpandableList';

/**
 * LanguageSection renders the Language accordion section inside FacetPanel.
 *
 * Maps language codes to human-readable display names using the browser's
 * native Intl.DisplayNames API (e.g., 'en' -> 'English', 'fr' -> 'French').
 * This provides zero-bundle-size locale resolution without any hardcoded
 * language mapping table.
 *
 * Lists all available languages sorted by count descending (as returned by the
 * facets API).  Multiple languages can be selected simultaneously; each
 * selection updates the languages URL param and resets pagination to page 1
 * via the setter from useFacets.
 *
 * The section is hidden when only one language is present in facet data
 * (no filtering value).
 *
 * Count badges update reactively whenever the facets API refetches (triggered
 * by other facet param changes in the parent component).
 */
export const LanguageSection: FunctionComponent<{
  /** Available language options sorted by count descending (from facets API). */
  languages: FacetOption[];
  /** Currently selected language values (from useFacets). */
  selectedLanguages: string[];
  /** Setter from useFacets — writes languages URL param with merge strategy. */
  setLanguages: (values: string[]) => void;
}> = ({ languages, selectedLanguages, setLanguages }) => {
  // Hide section if there's no filtering value (0 or 1 language).
  if (languages.length <= 1) {
    return null;
  }

  return (
    <LanguageSectionInner
      languages={languages}
      selectedLanguages={selectedLanguages}
      setLanguages={setLanguages}
    />
  );
};

/**
 * Inner rendering component that handles display label transformation.
 *
 * Separated so that hooks (useMemo) are only called when the section is
 * actually visible (mirrors the MediaTypeSection pattern).
 */
const LanguageSectionInner: FunctionComponent<{
  languages: FacetOption[];
  selectedLanguages: string[];
  setLanguages: (values: string[]) => void;
}> = ({ languages, selectedLanguages, setLanguages }) => {
  // Create a display name mapper using browser's Intl.DisplayNames API.
  // This handles all language codes and provides localized names.
  const displayNameMapper = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      // Fallback if Intl.DisplayNames is not supported (very rare).
      return null;
    }
  }, []);

  /**
   * Transform FacetOption items to use display names instead of raw language codes.
   * Falls back to the raw code if mapping fails.
   */
  const languagesWithDisplayNames = useMemo(
    () =>
      languages.map((option) => ({
        ...option,
        // Use display name if available, otherwise use the raw code.
        displayLabel: displayNameMapper ? displayNameMapper.of(option.value) || option.value : option.value,
      })),
    [languages, displayNameMapper]
  );

  const handleToggle = (value: string, checked: boolean) => {
    if (checked) {
      setLanguages([...selectedLanguages, value]);
    } else {
      setLanguages(selectedLanguages.filter((v) => v !== value));
    }
  };

  return (
    <FacetSection
      title={t`Language`}
      hasActiveSelection={selectedLanguages.length > 0}
    >
      <ExpandableList items={languagesWithDisplayNames as unknown[]} maxVisible={15}>
        {(visibleItems) => (
          <ul className="space-y-1">
            {(visibleItems as Array<FacetOption & { displayLabel: string }>).map((option) => {
              const isChecked = selectedLanguages.includes(option.value);
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
