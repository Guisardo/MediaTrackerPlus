/**
 * Tests for useGenreSeen and useSeen hooks defined in
 * src/hooks/statisticHooks.ts.
 *
 * Both hooks call useQuery (react-query) with a specific query key and an
 * async function that delegates to mediaTrackerApi.statistics.
 *
 * This suite mocks react-query so that:
 *  - We can control whether useQuery returns a loading, error, or success state
 *  - We can inspect which query key and query function were passed
 *
 * Tests verify:
 *  - Loading state: isFetched is false, data and error are undefined
 *  - Success state: data matches the resolved value, isFetched is true
 *  - Error state: error is populated, isFetched is true
 *  - year=null collapses to null before passing to the API call
 *  - Correct query keys: ['genre', year] for useGenreSeen and ['statistics', year] for useSeen
 *  - The query function calls the correct API method
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

// renderHook polyfill — @testing-library/react v12 does not export renderHook.
function renderHook<T>(callback: () => T): { result: { current: T } } {
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
  return { result };
}
import type { Statistics } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Mocks – must be declared before any imports that use them
// ---------------------------------------------------------------------------

// Capture the latest call to useQuery so we can inspect its key/fn
let capturedQueryKey: unknown = null;
let capturedQueryFn: (() => Promise<unknown>) | null = null;

// Control what useQuery returns
interface UseQueryReturn {
  error: Error | null;
  data: unknown;
  isFetched: boolean;
}

let mockUseQueryReturn: UseQueryReturn = {
  error: null,
  data: undefined,
  isFetched: false,
};

jest.mock('react-query', () => ({
  useQuery: (key: unknown, fn: () => Promise<unknown>) => {
    capturedQueryKey = key;
    capturedQueryFn = fn;
    return mockUseQueryReturn;
  },
}));

// API mock – individual method mocks for assertions on calls
const mockStatisticsGenresinyearList = jest.fn().mockResolvedValue([]);
const mockStatisticsSeeninyearList = jest.fn().mockResolvedValue([]);

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    statistics: {
      statisticsGenresinyearList: (...args: unknown[]) =>
        mockStatisticsGenresinyearList(...args),
      statisticsSeeninyearList: (...args: unknown[]) =>
        mockStatisticsSeeninyearList(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import hooks under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { useGenreSeen, useSeen } from 'src/hooks/statisticHooks';

// ---------------------------------------------------------------------------
// Type alias for the request query parameter
// ---------------------------------------------------------------------------

type YearQuery = Statistics.StatisticsSeeninyearList.RequestQuery;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const yearQuery = (year: number | null): YearQuery => ({ year } as unknown as YearQuery);

const resetCaptures = () => {
  capturedQueryKey = null;
  capturedQueryFn = null;
};

// ---------------------------------------------------------------------------
// useGenreSeen – query key
// ---------------------------------------------------------------------------

describe('useGenreSeen – query key', () => {
  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('uses query key ["genre", { year: 2023 }] for year=2023', () => {
    renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(capturedQueryKey).toEqual(['genre', { year: 2023 }]);
  });

  it('uses query key ["genre", null] when year is null', () => {
    renderHook(() => useGenreSeen(yearQuery(null)));
    expect(capturedQueryKey).toEqual(['genre', null]);
  });

  it('does not include undefined in the query key', () => {
    renderHook(() => useGenreSeen(yearQuery(2024)));
    const [prefix, yearPart] = capturedQueryKey as [string, YearQuery];
    expect(prefix).toBe('genre');
    expect(yearPart).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useGenreSeen – loading state
// ---------------------------------------------------------------------------

describe('useGenreSeen – loading state', () => {
  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('returns isFetched=false when query has not completed', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(false);
  });

  it('returns data=undefined when query is loading', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.data).toBeUndefined();
  });

  it('returns error=null when query is loading', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useGenreSeen – success state
// ---------------------------------------------------------------------------

describe('useGenreSeen – success state', () => {
  const mockGenreData = [{ genre: 'Action', count: 10 }];

  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = {
      error: null,
      data: mockGenreData,
      isFetched: true,
    };
  });

  it('returns the resolved data', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.data).toEqual(mockGenreData);
  });

  it('returns isFetched=true after the query succeeds', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(true);
  });

  it('returns error=null on success', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useGenreSeen – error state
// ---------------------------------------------------------------------------

describe('useGenreSeen – error state', () => {
  const fetchError = new Error('Network error');

  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = {
      error: fetchError,
      data: undefined,
      isFetched: true,
    };
  });

  it('returns the error object', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.error).toBe(fetchError);
  });

  it('returns isFetched=true even on error', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(true);
  });

  it('returns data=undefined on error', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useGenreSeen – query function calls the correct API method
// ---------------------------------------------------------------------------

describe('useGenreSeen – query function', () => {
  beforeEach(() => {
    resetCaptures();
    mockStatisticsGenresinyearList.mockClear();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('query function invokes statisticsGenresinyearList with the year param', async () => {
    const query = yearQuery(2022);
    renderHook(() => useGenreSeen(query));

    expect(capturedQueryFn).not.toBeNull();
    await capturedQueryFn!();

    expect(mockStatisticsGenresinyearList).toHaveBeenCalledTimes(1);
    expect(mockStatisticsGenresinyearList).toHaveBeenCalledWith(query);
  });

  it('query function passes null when year is null', async () => {
    renderHook(() => useGenreSeen(yearQuery(null)));

    await capturedQueryFn!();

    // When year is null the hook sets year=null and passes null to the API
    expect(mockStatisticsGenresinyearList).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// useSeen – query key
// ---------------------------------------------------------------------------

describe('useSeen – query key', () => {
  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('uses query key ["statistics", { year: 2023 }] for year=2023', () => {
    renderHook(() => useSeen(yearQuery(2023)));
    expect(capturedQueryKey).toEqual(['statistics', { year: 2023 }]);
  });

  it('uses query key ["statistics", null] when year is null', () => {
    renderHook(() => useSeen(yearQuery(null)));
    expect(capturedQueryKey).toEqual(['statistics', null]);
  });

  it('uses "statistics" as the first element of the key (not "genre")', () => {
    renderHook(() => useSeen(yearQuery(2024)));
    const [prefix] = capturedQueryKey as [string, unknown];
    expect(prefix).toBe('statistics');
  });
});

// ---------------------------------------------------------------------------
// useSeen – loading state
// ---------------------------------------------------------------------------

describe('useSeen – loading state', () => {
  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('returns isFetched=false when query has not completed', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(false);
  });

  it('returns data=undefined when query is loading', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.data).toBeUndefined();
  });

  it('returns error=null when query is loading', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useSeen – success state
// ---------------------------------------------------------------------------

describe('useSeen – success state', () => {
  const mockSeenData = [{ mediaType: 'movie', count: 42 }];

  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = {
      error: null,
      data: mockSeenData,
      isFetched: true,
    };
  });

  it('returns the resolved data', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.data).toEqual(mockSeenData);
  });

  it('returns isFetched=true after the query succeeds', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useSeen – error state
// ---------------------------------------------------------------------------

describe('useSeen – error state', () => {
  const fetchError = new Error('API unavailable');

  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = {
      error: fetchError,
      data: undefined,
      isFetched: true,
    };
  });

  it('returns the error object', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.error).toBe(fetchError);
  });

  it('returns isFetched=true even on error', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current.isFetched).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useSeen – query function calls the correct API method
// ---------------------------------------------------------------------------

describe('useSeen – query function', () => {
  beforeEach(() => {
    resetCaptures();
    mockStatisticsSeeninyearList.mockClear();
    mockUseQueryReturn = { error: null, data: undefined, isFetched: false };
  });

  it('query function invokes statisticsSeeninyearList with the year param', async () => {
    const query = yearQuery(2022);
    renderHook(() => useSeen(query));

    expect(capturedQueryFn).not.toBeNull();
    await capturedQueryFn!();

    expect(mockStatisticsSeeninyearList).toHaveBeenCalledTimes(1);
    expect(mockStatisticsSeeninyearList).toHaveBeenCalledWith(query);
  });

  it('does NOT call statisticsGenresinyearList (wrong API method)', async () => {
    mockStatisticsGenresinyearList.mockClear();
    renderHook(() => useSeen(yearQuery(2022)));

    await capturedQueryFn!();

    expect(mockStatisticsGenresinyearList).not.toHaveBeenCalled();
  });

  it('query function passes null when year is null', async () => {
    renderHook(() => useSeen(yearQuery(null)));

    await capturedQueryFn!();

    expect(mockStatisticsSeeninyearList).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// Returned shape – both hooks expose { error, data, isFetched }
// ---------------------------------------------------------------------------

describe('useGenreSeen and useSeen – returned shape', () => {
  beforeEach(() => {
    resetCaptures();
    mockUseQueryReturn = { error: null, data: [{ foo: 'bar' }], isFetched: true };
  });

  it('useGenreSeen returns an object with error, data, isFetched keys', () => {
    const { result } = renderHook(() => useGenreSeen(yearQuery(2023)));
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isFetched');
  });

  it('useSeen returns an object with error, data, isFetched keys', () => {
    const { result } = renderHook(() => useSeen(yearQuery(2023)));
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isFetched');
  });
});
