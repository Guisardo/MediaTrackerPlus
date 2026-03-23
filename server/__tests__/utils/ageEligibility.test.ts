import {
  computeViewerAge,
  isAgeEligible,
  applyAgeGatingFilter,
} from 'src/utils/ageEligibility';

describe('computeViewerAge', () => {
  test('computes age for a past birthday this year', () => {
    // Reference date: 2026-06-15, DOB: 2000-03-10 => age 26
    const refDate = new Date(2026, 5, 15); // June 15, 2026
    expect(computeViewerAge('2000-03-10', refDate)).toBe(26);
  });

  test('computes age when birthday is later this year', () => {
    // Reference date: 2026-06-15, DOB: 2000-09-20 => age 25 (birthday not yet)
    const refDate = new Date(2026, 5, 15); // June 15, 2026
    expect(computeViewerAge('2000-09-20', refDate)).toBe(25);
  });

  test('computes age on exact birthday', () => {
    // Reference date: 2026-03-10, DOB: 2000-03-10 => age 26 (birthday counts)
    const refDate = new Date(2026, 2, 10); // March 10, 2026
    expect(computeViewerAge('2000-03-10', refDate)).toBe(26);
  });

  test('computes age the day before birthday', () => {
    // Reference date: 2026-03-09, DOB: 2000-03-10 => age 25 (not yet birthday)
    const refDate = new Date(2026, 2, 9); // March 9, 2026
    expect(computeViewerAge('2000-03-10', refDate)).toBe(25);
  });

  test('returns null for null dateOfBirth', () => {
    expect(computeViewerAge(null)).toBeNull();
  });

  test('returns null for undefined dateOfBirth', () => {
    expect(computeViewerAge(undefined)).toBeNull();
  });

  test('returns null for empty string dateOfBirth', () => {
    expect(computeViewerAge('')).toBeNull();
  });

  test('returns null for malformed dateOfBirth', () => {
    expect(computeViewerAge('not-a-date')).toBeNull();
  });

  test('returns null for partial date string', () => {
    expect(computeViewerAge('2000-03')).toBeNull();
  });

  test('clamps negative age to zero', () => {
    // Reference date: 2000-01-01, DOB: 2026-01-01 => would be negative
    const refDate = new Date(2000, 0, 1);
    expect(computeViewerAge('2026-01-01', refDate)).toBe(0);
  });

  test('handles leap year birthdays', () => {
    // Born on Feb 29, reference date March 1 of a non-leap year
    const refDate = new Date(2027, 2, 1); // March 1, 2027 (not a leap year)
    expect(computeViewerAge('2000-02-29', refDate)).toBe(27);
  });

  test('handles January 1st birthday', () => {
    const refDate = new Date(2026, 0, 1); // Jan 1, 2026
    expect(computeViewerAge('2000-01-01', refDate)).toBe(26);
  });

  test('handles December 31st birthday', () => {
    const refDate = new Date(2026, 11, 31); // Dec 31, 2026
    expect(computeViewerAge('2000-12-31', refDate)).toBe(26);
  });
});

describe('isAgeEligible', () => {
  test('viewer with null age is always eligible', () => {
    expect(isAgeEligible(null, 18)).toBe(true);
    expect(isAgeEligible(null, 0)).toBe(true);
    expect(isAgeEligible(null, null)).toBe(true);
  });

  test('item with null minimumAge is always visible', () => {
    expect(isAgeEligible(10, null)).toBe(true);
    expect(isAgeEligible(0, null)).toBe(true);
  });

  test('item with undefined minimumAge is always visible', () => {
    expect(isAgeEligible(10, undefined)).toBe(true);
    expect(isAgeEligible(0, undefined)).toBe(true);
  });

  test('viewer meets minimum age', () => {
    expect(isAgeEligible(18, 18)).toBe(true);
    expect(isAgeEligible(25, 18)).toBe(true);
    expect(isAgeEligible(13, 13)).toBe(true);
  });

  test('viewer below minimum age', () => {
    expect(isAgeEligible(12, 13)).toBe(false);
    expect(isAgeEligible(17, 18)).toBe(false);
    expect(isAgeEligible(0, 1)).toBe(false);
  });
});

describe('applyAgeGatingFilter', () => {
  test('does not modify query when viewerAge is null', () => {
    const query = { where: jest.fn() };
    applyAgeGatingFilter(query, null);
    expect(query.where).not.toHaveBeenCalled();
  });

  test('calls where with filter when viewerAge is set', () => {
    const query = { where: jest.fn() };
    applyAgeGatingFilter(query, 18);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledWith(expect.any(Function));
  });

  test('applies correct filter logic via callback', () => {
    const mockQb = {
      whereNull: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };

    const query = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: jest.fn((callback: (qb: any) => void) => {
        callback(mockQb);
      }),
    };

    applyAgeGatingFilter(query, 13);

    expect(mockQb.whereNull).toHaveBeenCalledWith('mediaItem.minimumAge');
    expect(mockQb.orWhere).toHaveBeenCalledWith('mediaItem.minimumAge', '<=', 13);
  });

  test('uses custom column reference', () => {
    const mockQb = {
      whereNull: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };

    const query = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: jest.fn((callback: (qb: any) => void) => {
        callback(mockQb);
      }),
    };

    applyAgeGatingFilter(query, 18, 'custom.minimumAge');

    expect(mockQb.whereNull).toHaveBeenCalledWith('custom.minimumAge');
    expect(mockQb.orWhere).toHaveBeenCalledWith('custom.minimumAge', '<=', 18);
  });
});
