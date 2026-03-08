import React, { FunctionComponent } from 'react';

import { FacetOption } from 'mediatracker-api';
import { ExpandableList } from './ExpandableList';

/**
 * FacetCheckboxList renders a list of facet options as checkboxes with count
 * badges.  It is the shared building block for genre, language, creator, and
 * publisher facet sections.
 *
 * Each item shows:
 *   - A native checkbox (reusing the project's standard checkbox styling)
 *   - The facet value label
 *   - A count badge showing how many items match this facet option
 *
 * Selected items are visually distinct via the accent colour applied to the
 * native checkbox.  Multiple items can be checked simultaneously (OR logic
 * within the dimension is enforced by the parent via useFacets).
 *
 * The list is wrapped in ExpandableList which truncates at 15 items by
 * default and shows a "Show more / Show less" toggle when needed.
 */
export const FacetCheckboxList: FunctionComponent<{
  /** All available facet options sorted by count descending. */
  items: FacetOption[];
  /** Currently selected values for this facet dimension. */
  selectedValues: string[];
  /** Called when a checkbox is toggled; receives the new selection array. */
  onSelectionChange: (newValues: string[]) => void;
  /** Maximum number of items to show before truncating. Defaults to 15. */
  maxVisible?: number;
}> = ({ items, selectedValues, onSelectionChange, maxVisible = 15 }) => {
  const handleToggle = (value: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedValues, value]);
    } else {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    }
  };

  return (
    <ExpandableList items={items as unknown[]} maxVisible={maxVisible}>
      {(visibleItems) => (
        <ul className="space-y-1">
          {(visibleItems as FacetOption[]).map((option) => {
            const isChecked = selectedValues.includes(option.value);
            const inputId = `facet-checkbox-${option.value.replace(/\s+/g, '-').toLowerCase()}`;

            return (
              <li key={option.value} className="flex items-center justify-between">
                <label
                  htmlFor={inputId}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 dark:text-slate-200 select-none min-w-0 flex-1"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    className="flex-shrink-0 accent-blue-500 cursor-pointer"
                    checked={isChecked}
                    onChange={(e) => handleToggle(option.value, e.target.checked)}
                  />
                  <span className="truncate">{option.value}</span>
                </label>
                <span
                  className="ml-2 flex-shrink-0 text-xs text-gray-500 dark:text-slate-400 tabular-nums"
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
  );
};
