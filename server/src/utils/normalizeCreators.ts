/**
 * Utilities for normalizing and splitting creator/author CSV fields.
 *
 * All creator fields (authors, narrators) are stored in the database as
 * comma-separated strings. These utilities ensure consistent trimming,
 * deduplication, and safe round-trip serialization/deserialization.
 */

/**
 * Normalizes an array of creator/author name strings before joining into CSV storage.
 *
 * - Trims leading and trailing whitespace from each name
 * - Filters out empty strings (including names that become empty after trimming)
 * - Deduplicates while preserving the original order of first occurrence
 *
 * @param names - Array of raw name strings (e.g., from provider API responses)
 * @returns Cleaned, deduplicated array of name strings
 *
 * @example
 * normalizeCreatorField(['  J.K. Rowling ', '', 'J.K. Rowling'])
 * // => ['J.K. Rowling']
 *
 * normalizeCreatorField(['Stephen King', '  '])
 * // => ['Stephen King']
 */
export function normalizeCreatorField(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}

/**
 * Splits a stored CSV creator field back into an array of trimmed tokens.
 *
 * Handles the leading-space problem that arises when names are stored with
 * the join(', ') pattern (e.g., "John Doe, Jane Smith" splits to
 * ["John Doe", " Jane Smith"] without trimming).
 *
 * @param csv - Comma-separated string from database, or null
 * @returns Array of trimmed name strings; empty array for null or empty input
 *
 * @example
 * splitCreatorField('John Doe, Jane Smith')
 * // => ['John Doe', 'Jane Smith']
 *
 * splitCreatorField(null)
 * // => []
 *
 * splitCreatorField('')
 * // => []
 */
export function splitCreatorField(csv: string | null): string[] {
  if (!csv) {
    return [];
  }

  return csv
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
