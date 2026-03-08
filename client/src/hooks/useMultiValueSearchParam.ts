import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook for reading and writing a comma-separated multi-value URL query param.
 *
 * Uses the merge strategy: always spreads all existing params before writing
 * the new value so that no other param (orderBy, sortOrder, etc.) is dropped.
 *
 * When the new value is an empty array the param is removed from the URL.
 * When the new value is non-empty it is written as a comma-separated string.
 *
 * @param paramName  - the URL query param key (e.g. 'genres', 'languages')
 * @param onchange   - optional callback fired after the param is updated
 *                     (use this to reset pagination)
 */
export const useMultiValueSearchParam = (
  paramName: string,
  onchange?: () => void
): {
  values: string[];
  setValues: (newValues: string[]) => void;
} => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawValue = searchParams.get(paramName);

  /**
   * Parse comma-separated URL param value into an array of trimmed, non-empty
   * strings.  Returns an empty array when the param is absent.
   */
  const values: string[] = rawValue
    ? rawValue
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
    : [];

  /**
   * Write a new set of values to the URL param, merging with all existing
   * params.  Removes the param entirely when the array is empty so the URL
   * stays clean.
   *
   * orderBy and sortOrder are preserved as part of the spread merge; no
   * explicit handling is needed because we never call setSearchParams with a
   * bare object.
   */
  const setValues = useCallback(
    (newValues: string[]) => {
      const currentEntries = Object.fromEntries(searchParams.entries());

      // Remove 'page' param to reset pagination to page 1 on any facet change.
      const { page: _page, ...withoutPage } = currentEntries;

      if (newValues.length === 0) {
        // Remove the param rather than writing an empty string.
        const { [paramName]: _removed, ...rest } = withoutPage;
        setSearchParams(rest);
      } else {
        setSearchParams({
          ...withoutPage,
          [paramName]: newValues.join(','),
        });
      }

      if (onchange) {
        onchange();
      }
    },
    [paramName, onchange, searchParams, setSearchParams]
  );

  return { values, setValues };
};
