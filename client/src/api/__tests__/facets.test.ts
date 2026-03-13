/**
 * Tests for src/api/facets.ts – useFacetsData hook.
 *
 * Covers:
 *   - useFacetsData fetches facet counts when enabled=true (default)
 *   - useFacetsData does NOT fetch when enabled=false
 *   - Returns correct data structure after fetch resolves
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    items: {
      facets: jest.fn(),
    },
  },
}));

import { useFacetsData } from 'src/api/facets';
import { mediaTrackerApi } from 'src/api/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

interface FacetsDataHarnessProps {
  args: Record<string, unknown>;
  enabled?: boolean;
}

const FacetsDataHarness: React.FC<FacetsDataHarnessProps> = ({
  args,
  enabled,
}) => {
  const result = useFacetsData(args as any, enabled);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'span',
      { 'data-testid': 'isLoadingFacets' },
      String(result.isLoadingFacets)
    ),
    React.createElement(
      'span',
      { 'data-testid': 'facetsData' },
      JSON.stringify(result.facetsData ?? null)
    )
  );
};

const renderFacetsData = (props: FacetsDataHarnessProps) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(FacetsDataHarness, props)
    )
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFacetsData', () => {
  it('starts with isLoadingFacets=true when enabled (default)', () => {
    (mediaTrackerApi.items.facets as jest.Mock).mockResolvedValue({
      genres: [],
    });

    renderFacetsData({ args: { mediaType: 'movie' } });

    expect(screen.getByTestId('isLoadingFacets').textContent).toBe('true');
  });

  it('calls items.facets with the provided args', async () => {
    const mockResponse = { genres: [{ value: 'Action', count: 10 }] };
    (mediaTrackerApi.items.facets as jest.Mock).mockResolvedValue(mockResponse);

    renderFacetsData({ args: { mediaType: 'movie', genres: 'Action' } });

    await waitFor(() => {
      expect(mediaTrackerApi.items.facets).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: 'movie', genres: 'Action' })
      );
    });
  });

  it('resolves facetsData from the API', async () => {
    const mockResponse = { genres: [{ value: 'Action', count: 5 }] };
    (mediaTrackerApi.items.facets as jest.Mock).mockResolvedValue(mockResponse);

    renderFacetsData({ args: { mediaType: 'movie' } });

    await waitFor(() => {
      expect(screen.getByTestId('isLoadingFacets').textContent).toBe('false');
    });

    expect(
      JSON.parse(screen.getByTestId('facetsData').textContent!)
    ).toEqual(mockResponse);
  });

  it('does NOT call items.facets when enabled=false', async () => {
    (mediaTrackerApi.items.facets as jest.Mock).mockResolvedValue({});

    renderFacetsData({ args: { mediaType: 'movie' }, enabled: false });

    // Wait a tick to confirm no call was made
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mediaTrackerApi.items.facets).not.toHaveBeenCalled();
  });

  it('returns isLoadingFacets=false when enabled=false', async () => {
    renderFacetsData({ args: { mediaType: 'movie' }, enabled: false });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByTestId('isLoadingFacets').textContent).toBe('false');
  });
});
