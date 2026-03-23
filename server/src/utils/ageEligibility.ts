/**
 * Shared age-eligibility utilities for viewer-based age gating.
 *
 * Computes viewer age from a `dateOfBirth` string (YYYY-MM-DD) using
 * date-only (calendar day) semantics, and provides a predicate for
 * checking whether a given `minimumAge` threshold is satisfied.
 *
 * Reused by items, facets, search, details, list, calendar, statistics,
 * and notification gating layers.
 */

/**
 * Computes the viewer's age in whole years as of `referenceDate` using
 * date-only (calendar day) arithmetic. Birthday counts as "already that age."
 *
 * @param dateOfBirth - YYYY-MM-DD string stored in the user record.
 * @param referenceDate - The date to compute age relative to. Defaults to today.
 * @returns The viewer's age in whole years, or `null` if `dateOfBirth` is
 *   null, undefined, or unparseable.
 */
export function computeViewerAge(
  dateOfBirth: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const parts = dateOfBirth.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const birthYear = Number(parts[0]);
  const birthMonth = Number(parts[1]);
  const birthDay = Number(parts[2]);

  if (
    Number.isNaN(birthYear) ||
    Number.isNaN(birthMonth) ||
    Number.isNaN(birthDay)
  ) {
    return null;
  }

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1; // getMonth() is 0-indexed
  const refDay = referenceDate.getDate();

  let age = refYear - birthYear;

  // If the birthday hasn't occurred yet this year, subtract one
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
}

/**
 * Returns `true` when the viewer is eligible to see content with the given
 * `minimumAge` threshold.
 *
 * Rules:
 * - If `viewerAge` is `null` (DOB unset), the viewer is eligible (no gating).
 * - If `minimumAge` is `null` or `undefined` (unknown parental metadata),
 *   the item is visible.
 * - Otherwise the viewer must be at least `minimumAge` years old.
 */
export function isAgeEligible(
  viewerAge: number | null,
  minimumAge: number | null | undefined
): boolean {
  if (viewerAge === null) {
    return true;
  }
  if (minimumAge == null) {
    return true;
  }
  return viewerAge >= minimumAge;
}

/**
 * Applies age-gating WHERE clause to a Knex query builder.
 * Items with null `minimumAge` remain visible. Items whose `minimumAge`
 * exceeds the viewer's age are excluded.
 *
 * When `viewerAge` is `null` (DOB unset), no filter is applied, preserving
 * current behavior.
 *
 * @param query - Knex query builder instance to modify in place.
 * @param viewerAge - The viewer's age in whole years, or null if DOB is unset.
 * @param columnRef - The SQL column reference for `minimumAge`.
 *   Defaults to `'mediaItem.minimumAge'`.
 */
export function applyAgeGatingFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  viewerAge: number | null,
  columnRef = 'mediaItem.minimumAge'
): void {
  if (viewerAge === null) {
    return;
  }

  query.where((qb: typeof query) =>
    qb.whereNull(columnRef).orWhere(columnRef, '<=', viewerAge)
  );
}
