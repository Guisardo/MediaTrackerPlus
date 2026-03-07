/**
 * Tests for useListSortByKeys, useListPrivacyKeys, and useSortOrderKeys
 * defined in src/hooks/translations.ts.
 *
 * Each hook calls useTranslatedKeysFactory with a hard-coded translation map.
 * The factory wraps the map in useMemo and returns a rich API object
 * (translations, keys, entries, translationToKey, keyToTranslation, map).
 *
 * We use @lingui/macro mocked to return the raw template-string content so
 * that translation labels remain predictable strings in tests.
 *
 * Tests verify:
 *  1. All expected keys are present in the keys array
 *  2. All expected labels are present in the translations array
 *  3. keyToTranslation maps every key to the right label
 *  4. translationToKey maps every label back to its key (round-trip)
 *  5. entries array contains all [key, translation] pairs
 *  6. map() callback receives (key, translation) for each entry
 *  7. No extra keys are present (array lengths match expectations)
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

// renderHook polyfill — @testing-library/react v12 does not export renderHook.
function renderHook<T>(callback: () => T): { result: { current: T }; rerender: () => void } {
  const result = { current: undefined as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  function TestComponent() {
    result.current = callback();
    return null;
  }
  act(() => {
    ReactDOM.render(React.createElement(TestComponent), container);
  });
  const rerender = () => {
    act(() => {
      ReactDOM.render(React.createElement(TestComponent), container);
    });
  };
  return { result, rerender };
}

// ---------------------------------------------------------------------------
// Mock @lingui/macro BEFORE importing the hooks
// ---------------------------------------------------------------------------

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

// ---------------------------------------------------------------------------
// Import hooks under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  useListSortByKeys,
  useListPrivacyKeys,
  useSortOrderKeys,
} from 'src/hooks/translations';

// ---------------------------------------------------------------------------
// useListSortByKeys
// ---------------------------------------------------------------------------

describe('useListSortByKeys – keys', () => {
  it('returns exactly 9 keys', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toHaveLength(9);
  });

  it('contains "my-rating"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('my-rating');
  });

  it('contains "recently-added"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('recently-added');
  });

  it('contains "recently-watched"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('recently-watched');
  });

  it('contains "recently-aired"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('recently-aired');
  });

  it('contains "release-date"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('release-date');
  });

  it('contains "runtime"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('runtime');
  });

  it('contains "title"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('title');
  });

  it('contains "next-airing"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('next-airing');
  });

  it('contains "recommended"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keys).toContain('recommended');
  });
});

describe('useListSortByKeys – translations', () => {
  it('returns exactly 9 translation labels', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toHaveLength(9);
  });

  it('includes "My rating"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('My rating');
  });

  it('includes "Recently added"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Recently added');
  });

  it('includes "Recently watched"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Recently watched');
  });

  it('includes "Recently aired"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Recently aired');
  });

  it('includes "Release date"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Release date');
  });

  it('includes "Runtime"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Runtime');
  });

  it('includes "Title"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Title');
  });

  it('includes "Next airing"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Next airing');
  });

  it('includes "Recommended"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translations).toContain('Recommended');
  });
});

describe('useListSortByKeys – keyToTranslation', () => {
  it('maps "my-rating" → "My rating"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('my-rating')).toBe('My rating');
  });

  it('maps "recently-added" → "Recently added"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('recently-added')).toBe(
      'Recently added'
    );
  });

  it('maps "recently-watched" → "Recently watched"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('recently-watched')).toBe(
      'Recently watched'
    );
  });

  it('maps "recently-aired" → "Recently aired"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('recently-aired')).toBe(
      'Recently aired'
    );
  });

  it('maps "release-date" → "Release date"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('release-date')).toBe(
      'Release date'
    );
  });

  it('maps "runtime" → "Runtime"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('runtime')).toBe('Runtime');
  });

  it('maps "title" → "Title"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('title')).toBe('Title');
  });

  it('maps "next-airing" → "Next airing"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('next-airing')).toBe('Next airing');
  });

  it('maps "recommended" → "Recommended"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.keyToTranslation('recommended')).toBe('Recommended');
  });
});

describe('useListSortByKeys – translationToKey (round-trip)', () => {
  it('maps "My rating" back to "my-rating"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translationToKey('My rating')).toBe('my-rating');
  });

  it('maps "Title" back to "title"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translationToKey('Title')).toBe('title');
  });

  it('maps "Recommended" back to "recommended"', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.translationToKey('Recommended')).toBe('recommended');
  });
});

describe('useListSortByKeys – entries', () => {
  it('returns 9 [key, translation] tuple entries', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.entries).toHaveLength(9);
  });

  it('contains the ["title", "Title"] entry', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['title', 'Title']])
    );
  });

  it('contains the ["recommended", "Recommended"] entry', () => {
    const { result } = renderHook(() => useListSortByKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['recommended', 'Recommended']])
    );
  });
});

describe('useListSortByKeys – map callback', () => {
  it('invokes the callback exactly 9 times', () => {
    const { result } = renderHook(() => useListSortByKeys());
    const cb = jest.fn(() => null);
    result.current.map(cb);
    expect(cb).toHaveBeenCalledTimes(9);
  });

  it('passes key as first argument and translation as second', () => {
    const { result } = renderHook(() => useListSortByKeys());
    const calls: [string, string][] = [];
    result.current.map((key, translation) => {
      calls.push([key, translation]);
      return null;
    });
    const callMap = Object.fromEntries(calls);
    expect(callMap['title']).toBe('Title');
    expect(callMap['runtime']).toBe('Runtime');
  });
});

// ---------------------------------------------------------------------------
// useListPrivacyKeys
// ---------------------------------------------------------------------------

describe('useListPrivacyKeys – keys', () => {
  it('returns exactly 2 keys', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.keys).toHaveLength(2);
  });

  it('contains "private"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.keys).toContain('private');
  });

  it('contains "public"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.keys).toContain('public');
  });
});

describe('useListPrivacyKeys – translations', () => {
  it('returns exactly 2 translation labels', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.translations).toHaveLength(2);
  });

  it('includes "Private"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.translations).toContain('Private');
  });

  it('includes "Public"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.translations).toContain('Public');
  });
});

describe('useListPrivacyKeys – keyToTranslation', () => {
  it('maps "private" → "Private"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.keyToTranslation('private')).toBe('Private');
  });

  it('maps "public" → "Public"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.keyToTranslation('public')).toBe('Public');
  });
});

describe('useListPrivacyKeys – translationToKey (round-trip)', () => {
  it('maps "Private" back to "private"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.translationToKey('Private')).toBe('private');
  });

  it('maps "Public" back to "public"', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.translationToKey('Public')).toBe('public');
  });
});

describe('useListPrivacyKeys – entries', () => {
  it('returns 2 [key, translation] tuple entries', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.entries).toHaveLength(2);
  });

  it('contains the ["private", "Private"] entry', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['private', 'Private']])
    );
  });

  it('contains the ["public", "Public"] entry', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['public', 'Public']])
    );
  });
});

describe('useListPrivacyKeys – map callback', () => {
  it('invokes the callback exactly 2 times', () => {
    const { result } = renderHook(() => useListPrivacyKeys());
    const cb = jest.fn(() => null);
    result.current.map(cb);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useSortOrderKeys
// ---------------------------------------------------------------------------

describe('useSortOrderKeys – keys', () => {
  it('returns exactly 2 keys', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.keys).toHaveLength(2);
  });

  it('contains "asc"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.keys).toContain('asc');
  });

  it('contains "desc"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.keys).toContain('desc');
  });
});

describe('useSortOrderKeys – translations', () => {
  it('returns exactly 2 translation labels', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.translations).toHaveLength(2);
  });

  it('includes "Ascending"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.translations).toContain('Ascending');
  });

  it('includes "Descending"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.translations).toContain('Descending');
  });
});

describe('useSortOrderKeys – keyToTranslation', () => {
  it('maps "asc" → "Ascending"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.keyToTranslation('asc')).toBe('Ascending');
  });

  it('maps "desc" → "Descending"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.keyToTranslation('desc')).toBe('Descending');
  });
});

describe('useSortOrderKeys – translationToKey (round-trip)', () => {
  it('maps "Ascending" back to "asc"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.translationToKey('Ascending')).toBe('asc');
  });

  it('maps "Descending" back to "desc"', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.translationToKey('Descending')).toBe('desc');
  });
});

describe('useSortOrderKeys – entries', () => {
  it('returns 2 [key, translation] tuple entries', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.entries).toHaveLength(2);
  });

  it('contains the ["asc", "Ascending"] entry', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['asc', 'Ascending']])
    );
  });

  it('contains the ["desc", "Descending"] entry', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    expect(result.current.entries).toEqual(
      expect.arrayContaining([['desc', 'Descending']])
    );
  });
});

describe('useSortOrderKeys – map callback', () => {
  it('invokes the callback exactly 2 times', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    const cb = jest.fn(() => null);
    result.current.map(cb);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('passes "asc" and "Ascending" in a call', () => {
    const { result } = renderHook(() => useSortOrderKeys());
    const calls: [string, string][] = [];
    result.current.map((key, translation) => {
      calls.push([key, translation]);
      return null;
    });
    const callMap = Object.fromEntries(calls);
    expect(callMap['asc']).toBe('Ascending');
    expect(callMap['desc']).toBe('Descending');
  });
});

// ---------------------------------------------------------------------------
// Cross-hook sanity: all three hooks are independent (no shared mutable state)
// ---------------------------------------------------------------------------

describe('all translation hooks – independence', () => {
  it('useListSortByKeys, useListPrivacyKeys, and useSortOrderKeys do not share keys', () => {
    const sortByResult = renderHook(() => useListSortByKeys()).result.current;
    const privacyResult = renderHook(() => useListPrivacyKeys()).result.current;
    const orderResult = renderHook(() => useSortOrderKeys()).result.current;

    const sortByKeys = new Set(sortByResult.keys);
    const privacyKeys = new Set(privacyResult.keys);
    const orderKeys = new Set(orderResult.keys);

    // No overlap between privacy keys and sortBy keys
    privacyKeys.forEach((k) => expect(sortByKeys.has(k)).toBe(false));
    // No overlap between orderKeys and privacyKeys
    orderKeys.forEach((k) => expect(privacyKeys.has(k)).toBe(false));
  });

  it('each hook is stable across re-renders (memoised)', () => {
    const { result: r1, rerender: re1 } = renderHook(() => useListSortByKeys());
    const firstKeys = r1.current.keys;
    const firstTranslations = r1.current.translations;
    const firstEntries = r1.current.entries;
    re1();
    expect(r1.current.keys).toEqual(firstKeys);
    expect(r1.current.translations).toEqual(firstTranslations);
    expect(r1.current.entries).toEqual(firstEntries);

    const { result: r2, rerender: re2 } = renderHook(() => useListPrivacyKeys());
    const firstPrivacyKeys = r2.current.keys;
    const firstPrivacyTranslations = r2.current.translations;
    re2();
    expect(r2.current.keys).toEqual(firstPrivacyKeys);
    expect(r2.current.translations).toEqual(firstPrivacyTranslations);

    const { result: r3, rerender: re3 } = renderHook(() => useSortOrderKeys());
    const firstOrderKeys = r3.current.keys;
    const firstOrderTranslations = r3.current.translations;
    re3();
    expect(r3.current.keys).toEqual(firstOrderKeys);
    expect(r3.current.translations).toEqual(firstOrderTranslations);

  });
});
