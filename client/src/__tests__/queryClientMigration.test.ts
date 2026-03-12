/**
 * Tests for the TanStack React Query v5 migration (US-002).
 *
 * Covers:
 *   - QueryClient initialises without errors
 *   - keepPreviousData / placeholderData behaviour preserved
 *   - throwOnErrorEnvelope throws for MediaTrackerError responses
 *   - throwOnErrorEnvelope passes through normal data unchanged
 */

import {
  QueryClient,
  QueryCache,
  keepPreviousData,
} from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks – we only need to resolve the modules that App.tsx imports at the
// module level; the actual React rendering is not exercised here.
// ---------------------------------------------------------------------------

jest.mock('src/api/api', () => ({
  FetchError: class FetchError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('src/hooks/darkMode', () => ({}));
jest.mock('src/Router', () => ({}));
jest.mock('src/i18n/i18n', () => ({ setupI18n: jest.fn() }));
jest.mock('src/hooks/fonts', () => ({ useFonts: jest.fn(() => ({ loaded: true })) }));
jest.mock('@lingui/core', () => ({ i18n: {} }));
jest.mock('@lingui/react', () => ({ I18nProvider: jest.fn() }));
jest.mock('@lingui/macro', () => ({ Trans: jest.fn() }));

// Import after mocks so App.tsx module-level side-effects are safe.
import { queryClient, throwOnErrorEnvelope } from 'src/App';

// ---------------------------------------------------------------------------
// 1. QueryClient initialises without errors
// ---------------------------------------------------------------------------

describe('QueryClient initialisation', () => {
  it('exports a QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('has a QueryCache attached', () => {
    expect(queryClient.getQueryCache()).toBeInstanceOf(QueryCache);
  });

  it('sets placeholderData to keepPreviousData in default query options', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.placeholderData).toBe(keepPreviousData);
  });

  it('sets the global select function to throwOnErrorEnvelope', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.select).toBe(throwOnErrorEnvelope);
  });
});

// ---------------------------------------------------------------------------
// 2. keepPreviousData / placeholderData behaviour preserved
// ---------------------------------------------------------------------------

describe('keepPreviousData sentinel', () => {
  it('is a function (v5 sentinel)', () => {
    expect(typeof keepPreviousData).toBe('function');
  });

  it('returns the previous data when called with (previousData, query)', () => {
    const previous = { items: [1, 2, 3] };
    // In v5, keepPreviousData is (previousData, query) => previousData
    const result = (keepPreviousData as Function)(previous, {} as any);
    expect(result).toBe(previous);
  });

  it('returns undefined when there is no previous data', () => {
    const result = (keepPreviousData as Function)(undefined, {} as any);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. throwOnErrorEnvelope
// ---------------------------------------------------------------------------

describe('throwOnErrorEnvelope', () => {
  it('throws an Error when data is a MediaTracker error envelope', () => {
    const errorEnvelope = {
      MediaTrackerError: true,
      errorMessage: 'Something went wrong',
    };

    expect(() => throwOnErrorEnvelope(errorEnvelope)).toThrow(
      'Something went wrong'
    );
  });

  it('returns data unchanged when it is a normal object', () => {
    const normalData = { id: 1, title: 'Test Movie' };
    expect(throwOnErrorEnvelope(normalData)).toBe(normalData);
  });

  it('returns data unchanged when it is an array', () => {
    const arrayData = [{ id: 1 }, { id: 2 }];
    expect(throwOnErrorEnvelope(arrayData)).toBe(arrayData);
  });

  it('returns data unchanged when it is null', () => {
    expect(throwOnErrorEnvelope(null)).toBeNull();
  });

  it('returns data unchanged when it is undefined', () => {
    expect(throwOnErrorEnvelope(undefined)).toBeUndefined();
  });

  it('returns data unchanged when it is a string', () => {
    expect(throwOnErrorEnvelope('hello')).toBe('hello');
  });

  it('returns data unchanged when it is a number', () => {
    expect(throwOnErrorEnvelope(42)).toBe(42);
  });

  it('does not throw when MediaTrackerError is false', () => {
    const data = { MediaTrackerError: false, errorMessage: 'not an error' };
    expect(throwOnErrorEnvelope(data)).toBe(data);
  });

  it('does not throw when errorMessage is missing', () => {
    const data = { MediaTrackerError: true };
    expect(throwOnErrorEnvelope(data)).toBe(data);
  });

  it('does not throw when errorMessage is not a string', () => {
    const data = { MediaTrackerError: true, errorMessage: 123 };
    expect(throwOnErrorEnvelope(data)).toBe(data);
  });
});
