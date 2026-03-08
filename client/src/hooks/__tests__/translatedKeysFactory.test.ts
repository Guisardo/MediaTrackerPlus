/**
 * Tests for src/hooks/translatedKeysFactory.ts
 *
 * The hook wraps useMemo and returns a stable API from a Record<Key, Translation>
 * input.  We test:
 *   - translations, keys, entries arrays derived from the input map
 *   - translationToKey  lookup
 *   - keyToTranslation  lookup
 *   - map callback invocation with correct arguments
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useTranslatedKeysFactory } from 'src/hooks/translatedKeysFactory';

// ---------------------------------------------------------------------------
// renderHook polyfill — @testing-library/react v12 does not export renderHook.
// Uses ReactDOM.render + act directly to avoid registering afterEach hooks
// inside test bodies (which Jest forbids).
// ---------------------------------------------------------------------------
function renderHook<T>(callback: () => T): {
  result: { current: T };
  rerender: () => void;
} {
  const result = { current: undefined as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const latestCallback = callback;
  function TestComponent() {
    result.current = latestCallback();
    return null;
  }
  act(() => {
    ReactDOM.render(React.createElement(TestComponent), container);
  });
  return {
    result,
    rerender: () => {
      act(() => {
        ReactDOM.render(React.createElement(TestComponent), container);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_MAP = {
  asc: 'Ascending',
  desc: 'Descending',
  none: 'None',
} as const;

type FixtureKey = keyof typeof FIXTURE_MAP;
type FixtureTranslation = typeof FIXTURE_MAP[FixtureKey];

// ---------------------------------------------------------------------------
// Helper — render the hook with our fixture and return the result
// ---------------------------------------------------------------------------

const renderFactory = (map = FIXTURE_MAP) =>
  renderHook(() => useTranslatedKeysFactory(map)).result.current;

// ---------------------------------------------------------------------------
// translations array
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — translations', () => {
  it('contains all translation values from the input map', () => {
    const { translations } = renderFactory();
    expect(translations).toEqual(
      expect.arrayContaining(['Ascending', 'Descending', 'None'])
    );
  });

  it('has the same length as the number of entries in the map', () => {
    const { translations } = renderFactory();
    expect(translations).toHaveLength(Object.keys(FIXTURE_MAP).length);
  });
});

// ---------------------------------------------------------------------------
// keys array
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — keys', () => {
  it('contains all keys from the input map', () => {
    const { keys } = renderFactory();
    expect(keys).toEqual(expect.arrayContaining(['asc', 'desc', 'none']));
  });

  it('has the same length as the number of entries in the map', () => {
    const { keys } = renderFactory();
    expect(keys).toHaveLength(Object.keys(FIXTURE_MAP).length);
  });
});

// ---------------------------------------------------------------------------
// entries array
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — entries', () => {
  it('contains tuples of [key, translation] for every entry', () => {
    const { entries } = renderFactory();

    expect(entries).toEqual(
      expect.arrayContaining([
        ['asc', 'Ascending'],
        ['desc', 'Descending'],
        ['none', 'None'],
      ])
    );
  });

  it('has the correct length', () => {
    const { entries } = renderFactory();
    expect(entries).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// translationToKey
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — translationToKey', () => {
  it('resolves a translation string back to its key', () => {
    const { translationToKey } = renderFactory();
    expect(translationToKey('Ascending' as FixtureTranslation)).toBe('asc');
    expect(translationToKey('Descending' as FixtureTranslation)).toBe('desc');
    expect(translationToKey('None' as FixtureTranslation)).toBe('none');
  });

  it('returns undefined for an unknown translation', () => {
    const { translationToKey } = renderFactory();
    expect(
      translationToKey('Unknown value' as FixtureTranslation)
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// keyToTranslation
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — keyToTranslation', () => {
  it('resolves a key to its translation string', () => {
    const { keyToTranslation } = renderFactory();
    expect(keyToTranslation('asc' as FixtureKey)).toBe('Ascending');
    expect(keyToTranslation('desc' as FixtureKey)).toBe('Descending');
    expect(keyToTranslation('none' as FixtureKey)).toBe('None');
  });
});

// ---------------------------------------------------------------------------
// map callback
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — map', () => {
  it('invokes the callback once per entry and returns the mapped array', () => {
    const { map } = renderFactory();
    const callback = jest.fn((key: FixtureKey, translation: FixtureTranslation) =>
      `${key}=${translation}`
    );

    const result = map(callback);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(result).toEqual(
      expect.arrayContaining(['asc=Ascending', 'desc=Descending', 'none=None'])
    );
  });

  it('passes key as the first argument and translation as the second', () => {
    const { map } = renderFactory();
    const calls: Array<[string, string]> = [];

    map((key, translation) => {
      calls.push([key, translation]);
      return null;
    });

    const callMap = Object.fromEntries(calls);
    expect(callMap['asc']).toBe('Ascending');
    expect(callMap['desc']).toBe('Descending');
    expect(callMap['none']).toBe('None');
  });

  it('returns an empty array for an empty input map', () => {
    const { result } = renderHook(() =>
      useTranslatedKeysFactory({} as Record<string, string>)
    );
    const { map } = result.current;
    expect(map(jest.fn())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Memoisation — result reference stability
// ---------------------------------------------------------------------------

describe('useTranslatedKeysFactory — memoisation', () => {
  it('returns the same object reference across re-renders with the same input', () => {
    const { result, rerender } = renderHook(() =>
      useTranslatedKeysFactory(FIXTURE_MAP)
    );

    const firstResult = result.current;
    rerender();
    expect(result.current).toBe(firstResult);
  });
});
