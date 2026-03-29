/**
 * Tests for src/api/details.ts
 *
 * Covers plain exported async functions:
 *   - detailsKey
 *   - setRating (mediaItem rating)
 *   - removeFromWatchlist
 *   - addToWatchlist
 *   - markAsSeen
 *   - markAsUnseen (by seenId and by mediaItem)
 *   - addToProgress
 *   - setLastSeenEpisode
 *   - removeFromSeenHistory
 * And the React Query hook:
 *   - useDetails
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/App', () => ({
  queryClient: {
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    setQueriesData: jest.fn(),
    getQueryData: jest.fn(),
    removeQueries: jest.fn(),
    setQueryData: jest.fn(),
  },
}));

jest.mock('src/api/api', () => ({
  mediaTrackerApi: {
    details: {
      get: jest.fn(),
      updateMetadata: jest.fn(),
    },
    rating: {
      add: jest.fn(),
    },
    watchlist: {
      delete: jest.fn(),
      add: jest.fn(),
    },
    seen: {
      add: jest.fn(),
      delete: jest.fn(),
      deleteById: jest.fn(),
    },
    progress: {
      add: jest.fn(),
    },
  },
}));

import {
  detailsKey,
  setRating,
  removeFromWatchlist,
  addToWatchlist,
  markAsSeen,
  markAsUnseen,
  addToProgress,
  setLastSeenEpisode,
  removeFromSeenHistory,
  useDetails,
} from 'src/api/details';
import { mediaTrackerApi } from 'src/api/api';
import { queryClient as appQueryClient } from 'src/App';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const makeMediaItem = (overrides = {}) =>
  ({
    id: 1,
    title: 'Test Movie',
    mediaType: 'movie',
    source: 'tmdb',
    ...overrides,
  } as any);

const makeSeason = (overrides = {}) =>
  ({
    id: 10,
    seasonNumber: 1,
    tvShowId: 1,
    ...overrides,
  } as any);

const makeEpisode = (overrides = {}) =>
  ({
    id: 100,
    episodeNumber: 1,
    seasonNumber: 1,
    tvShowId: 1,
    ...overrides,
  } as any);

// ---------------------------------------------------------------------------
// React Query test helpers
// ---------------------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const DetailsHarness: React.FC<{ mediaItemId: number }> = ({ mediaItemId }) => {
  const result = useDetails(mediaItemId);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { 'data-testid': 'isLoading' }, String(result.isLoading)),
    React.createElement(
      'span',
      { 'data-testid': 'mediaItem' },
      JSON.stringify(result.mediaItem ?? null)
    )
  );
};

const renderDetails = (mediaItemId: number) => {
  const client = createTestQueryClient();
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(DetailsHarness, { mediaItemId })
    )
  );
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Provide a default response so updateMediaItem doesn't throw
  (appQueryClient.getQueryData as jest.Mock).mockReturnValue(undefined);
  (appQueryClient.invalidateQueries as jest.Mock).mockResolvedValue(undefined);
  (mediaTrackerApi.details.get as jest.Mock).mockResolvedValue(makeMediaItem());
});

// ---------------------------------------------------------------------------
// detailsKey
// ---------------------------------------------------------------------------

describe('detailsKey', () => {
  it('returns a stable array with the mediaItemId', () => {
    expect(detailsKey(123)).toEqual(['details', 123]);
  });

  it('returns different keys for different ids', () => {
    expect(detailsKey(1)).not.toEqual(detailsKey(2));
  });
});

// ---------------------------------------------------------------------------
// useDetails hook
// ---------------------------------------------------------------------------

describe('useDetails', () => {
  it('starts in loading state', () => {
    renderDetails(1);
    expect(screen.getByTestId('isLoading').textContent).toBe('true');
  });

  it('calls details.get with the mediaItemId', async () => {
    const mockItem = makeMediaItem({ id: 42, title: 'The Movie' });
    (mediaTrackerApi.details.get as jest.Mock).mockResolvedValue(mockItem);

    renderDetails(42);

    await waitFor(() => {
      expect(mediaTrackerApi.details.get).toHaveBeenCalledWith(42);
    });
  });

  it('resolves mediaItem from the API', async () => {
    const mockItem = makeMediaItem({
      id: 5,
      title: 'Test',
      trailers: [
        {
          id: 'youtube:test-trailer',
          title: 'Official trailer',
          kind: 'trailer',
          language: 'en',
          isOfficial: true,
          provider: 'tmdb',
          embedUrl: 'https://www.youtube.com/embed/test-trailer',
          externalUrl: 'https://www.youtube.com/watch?v=test-trailer',
        },
      ],
    });
    (mediaTrackerApi.details.get as jest.Mock).mockResolvedValue(mockItem);

    renderDetails(5);

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('mediaItem').textContent!)).toEqual(
      mockItem
    );
  });
});

// ---------------------------------------------------------------------------
// setRating
// ---------------------------------------------------------------------------

describe('setRating', () => {
  it('calls rating.add with mediaItemId and rating for a plain mediaItem', async () => {
    (mediaTrackerApi.rating.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 7 });
    await setRating({ mediaItem, rating: 8 });

    expect(mediaTrackerApi.rating.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 7, rating: 8 })
    );
  });

  it('calls rating.add with seasonId when a season is provided', async () => {
    (mediaTrackerApi.rating.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 7 });
    const season = makeSeason({ id: 10, tvShowId: 7 });
    await setRating({ mediaItem, season, rating: 7 });

    expect(mediaTrackerApi.rating.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 7, seasonId: 10, rating: 7 })
    );
  });

  it('calls rating.add with episodeId when an episode is provided', async () => {
    (mediaTrackerApi.rating.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 7 });
    const episode = makeEpisode({ id: 100, tvShowId: 7 });
    await setRating({ mediaItem, episode, rating: 9 });

    expect(mediaTrackerApi.rating.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 7, episodeId: 100, rating: 9 })
    );
  });

  it('also passes review when provided', async () => {
    (mediaTrackerApi.rating.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 1 });
    await setRating({ mediaItem, rating: 8, review: 'Great film!' });

    expect(mediaTrackerApi.rating.add).toHaveBeenCalledWith(
      expect.objectContaining({ review: 'Great film!' })
    );
  });
});

// ---------------------------------------------------------------------------
// removeFromWatchlist
// ---------------------------------------------------------------------------

describe('removeFromWatchlist', () => {
  it('calls watchlist.delete with mediaItemId', async () => {
    (mediaTrackerApi.watchlist.delete as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 3 });
    await removeFromWatchlist({ mediaItem });

    expect(mediaTrackerApi.watchlist.delete).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 3 })
    );
  });

  it('invalidates list queries after removing from watchlist', async () => {
    (mediaTrackerApi.watchlist.delete as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 3 });
    await removeFromWatchlist({ mediaItem });

    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['list'] });
    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lists'] });
    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['listItems'] });
  });

  it('passes seasonId when a season is provided', async () => {
    (mediaTrackerApi.watchlist.delete as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 3 });
    const season = makeSeason({ id: 20, tvShowId: 3 });
    await removeFromWatchlist({ mediaItem, season });

    expect(mediaTrackerApi.watchlist.delete).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 3, seasonId: 20 })
    );
  });
});

// ---------------------------------------------------------------------------
// addToWatchlist
// ---------------------------------------------------------------------------

describe('addToWatchlist', () => {
  it('calls watchlist.add with mediaItemId', async () => {
    (mediaTrackerApi.watchlist.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 4 });
    await addToWatchlist({ mediaItem });

    expect(mediaTrackerApi.watchlist.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 4 })
    );
  });

  it('invalidates list queries after adding to watchlist', async () => {
    (mediaTrackerApi.watchlist.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 4 });
    await addToWatchlist({ mediaItem });

    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['list'] });
    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lists'] });
  });
});

// ---------------------------------------------------------------------------
// markAsSeen
// ---------------------------------------------------------------------------

describe('markAsSeen', () => {
  it('calls seen.add with mediaItemId', async () => {
    (mediaTrackerApi.seen.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 5 });
    await markAsSeen({ mediaItem });

    expect(mediaTrackerApi.seen.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 5 })
    );
  });

  it('passes seasonId and episodeId when provided', async () => {
    (mediaTrackerApi.seen.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 5 });
    const season = makeSeason({ id: 30, tvShowId: 5 });
    const episode = makeEpisode({ id: 300, tvShowId: 5 });
    await markAsSeen({ mediaItem, season, episode });

    expect(mediaTrackerApi.seen.add).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaItemId: 5,
        seasonId: 30,
        episodeId: 300,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// markAsUnseen
// ---------------------------------------------------------------------------

describe('markAsUnseen', () => {
  it('calls seen.deleteById when seenId is provided', async () => {
    (mediaTrackerApi.seen.deleteById as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 6 });
    await markAsUnseen({ mediaItem, seenId: 99 });

    expect(mediaTrackerApi.seen.deleteById).toHaveBeenCalledWith(99);
    expect(mediaTrackerApi.seen.delete).not.toHaveBeenCalled();
  });

  it('calls seen.delete when seenId is not provided', async () => {
    (mediaTrackerApi.seen.delete as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 6 });
    await markAsUnseen({ mediaItem });

    expect(mediaTrackerApi.seen.delete).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 6 })
    );
    expect(mediaTrackerApi.seen.deleteById).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addToProgress
// ---------------------------------------------------------------------------

describe('addToProgress', () => {
  it('calls progress.add with mediaItemId, progress, and duration', async () => {
    (mediaTrackerApi.progress.add as jest.Mock).mockResolvedValue(undefined);

    await addToProgress({ mediaItemId: 7, progress: 0.5, duration: 7200000 });

    expect(mediaTrackerApi.progress.add).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 7, progress: 0.5, duration: 7200000 })
    );
  });

  it('invalidates details and items queries', async () => {
    (mediaTrackerApi.progress.add as jest.Mock).mockResolvedValue(undefined);

    await addToProgress({ mediaItemId: 7, progress: 0.5 });

    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith(
      { queryKey: detailsKey(7) }
    );
    expect(appQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items'] });
  });
});

// ---------------------------------------------------------------------------
// setLastSeenEpisode
// ---------------------------------------------------------------------------

describe('setLastSeenEpisode', () => {
  it('calls seen.add with lastSeenEpisodeId', async () => {
    (mediaTrackerApi.seen.add as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 8 });
    const episode = makeEpisode({ id: 400, tvShowId: 8 });
    await setLastSeenEpisode({
      mediaItem,
      episode,
      lastSeenAt: 'now',
    } as any);

    expect(mediaTrackerApi.seen.add).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaItemId: 8,
        lastSeenEpisodeId: 400,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// removeFromSeenHistory
// ---------------------------------------------------------------------------

describe('removeFromSeenHistory', () => {
  it('calls seen.delete with mediaItemId', async () => {
    (mediaTrackerApi.seen.delete as jest.Mock).mockResolvedValue(undefined);

    const mediaItem = makeMediaItem({ id: 9 });
    await removeFromSeenHistory(mediaItem);

    expect(mediaTrackerApi.seen.delete).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: 9 })
    );
  });
});
