import axios, { AxiosInstance } from 'axios';

import { TmdbSimilarClient } from 'src/services/recommendations/TmdbSimilarClient';
import { SimilarItem } from 'src/services/recommendations/types';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const TEST_API_KEY = 'test-api-key-for-unit-tests';

/**
 * Build a mock TMDB /similar result item with sensible defaults.
 */
function makeTmdbItem(overrides: {
  id?: number;
  title?: string;
  name?: string;
  vote_average?: number;
  vote_count?: number;
}): {
  id: number;
  title?: string;
  name?: string;
  vote_average: number;
  vote_count: number;
} {
  return {
    id: overrides.id ?? 550,
    title: overrides.title,
    name: overrides.name,
    vote_average: overrides.vote_average ?? 7.5,
    vote_count: overrides.vote_count ?? 100,
  };
}

/**
 * Build a mock TMDB similar-endpoint response envelope.
 */
function makeTmdbResponse(
  results: ReturnType<typeof makeTmdbItem>[]
): { data: { page: number; results: typeof results; total_pages: number; total_results: number }; status: number } {
  return {
    data: {
      page: 1,
      results,
      total_pages: 1,
      total_results: results.length,
    },
    status: 200,
  };
}

describe('TmdbSimilarClient', () => {
  let mockAxiosGet: jest.Mock;
  let mockAxiosInstance: AxiosInstance;
  let client: TmdbSimilarClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet = jest.fn();
    mockAxiosInstance = { get: mockAxiosGet } as unknown as AxiosInstance;
    client = new TmdbSimilarClient(TEST_API_KEY, mockAxiosInstance);
  });

  // -------------------------------------------------------------------------
  // vote_count filter
  // -------------------------------------------------------------------------

  describe('vote_count filter', () => {
    test('includes items with vote_count >= 10', async () => {
      const item = makeTmdbItem({ id: 1, title: 'Sufficient Votes', vote_count: 10, vote_average: 7.0 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(100, 'movie');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Sufficient Votes');
    });

    test('excludes items with vote_count < 10', async () => {
      const lowVotes = makeTmdbItem({ id: 2, title: 'Too Few Votes', vote_count: 9, vote_average: 8.0 });
      const enoughVotes = makeTmdbItem({ id: 3, title: 'Enough Votes', vote_count: 10, vote_average: 7.0 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([lowVotes, enoughVotes]));

      const results = await client.fetchSimilar(100, 'movie');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Enough Votes');
    });

    test('returns empty array when all items have vote_count < 10', async () => {
      const items = [
        makeTmdbItem({ id: 1, title: 'A', vote_count: 0 }),
        makeTmdbItem({ id: 2, title: 'B', vote_count: 5 }),
        makeTmdbItem({ id: 3, title: 'C', vote_count: 9 }),
      ];
      mockAxiosGet.mockResolvedValue(makeTmdbResponse(items));

      const results = await client.fetchSimilar(100, 'movie');

      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // externalRating=0 coercion
  // -------------------------------------------------------------------------

  describe('vote_average === 0 coercion to null', () => {
    test('coerces vote_average of 0 to null externalRating', async () => {
      const item = makeTmdbItem({ id: 10, title: 'Unreleased Film', vote_average: 0, vote_count: 15 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(100, 'movie');

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBeNull();
    });

    test('preserves positive vote_average as externalRating', async () => {
      const item = makeTmdbItem({ id: 11, title: 'Rated Film', vote_average: 8.4, vote_count: 200 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(100, 'movie');

      expect(results[0].externalRating).toBe(8.4);
    });
  });

  // -------------------------------------------------------------------------
  // HTTP 429 handling
  // -------------------------------------------------------------------------

  describe('HTTP 429 rate-limit handling', () => {
    test('returns empty array on HTTP 429', async () => {
      const rateLimitError = {
        response: { status: 429, headers: { 'retry-after': '60' } },
      };
      mockAxiosGet.mockRejectedValue(rateLimitError);

      const results = await client.fetchSimilar(100, 'movie');

      expect(results).toEqual([]);
    });

    test('logs WARN with Retry-After header value on HTTP 429', async () => {
      const rateLimitError = {
        response: { status: 429, headers: { 'retry-after': '30' } },
      };
      mockAxiosGet.mockRejectedValue(rateLimitError);

      await client.fetchSimilar(200, 'tv');

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const warnMessage = (logger.warn as jest.Mock).mock.calls[0][0] as string;
      expect(warnMessage).toContain('30');
    });

    test('logs WARN with "unknown" when Retry-After header is absent on HTTP 429', async () => {
      const rateLimitError = {
        response: { status: 429, headers: {} },
      };
      mockAxiosGet.mockRejectedValue(rateLimitError);

      await client.fetchSimilar(200, 'movie');

      const warnMessage = (logger.warn as jest.Mock).mock.calls[0][0] as string;
      expect(warnMessage).toContain('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Non-2xx error handling
  // -------------------------------------------------------------------------

  describe('Non-2xx error handling', () => {
    test('throws descriptive Error with HTTP status code on non-2xx non-429 response', async () => {
      const serverError = { response: { status: 500, headers: {} } };
      mockAxiosGet.mockRejectedValue(serverError);

      await expect(client.fetchSimilar(100, 'movie')).rejects.toThrow(
        /HTTP 500/
      );
    });

    test('error message includes endpoint path', async () => {
      const notFoundError = { response: { status: 404, headers: {} } };
      mockAxiosGet.mockRejectedValue(notFoundError);

      await expect(client.fetchSimilar(999, 'tv')).rejects.toThrow(
        /\/3\/tv\/999\/similar/
      );
    });

    test('throws when HTTP status is unknown', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      await expect(client.fetchSimilar(100, 'movie')).rejects.toThrow(
        /HTTP unknown/
      );
    });
  });

  // -------------------------------------------------------------------------
  // Correct endpoint construction
  // -------------------------------------------------------------------------

  describe('Endpoint routing', () => {
    test('calls /3/movie/{id}/similar for mediaType=movie', async () => {
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([]));

      await client.fetchSimilar(550, 'movie');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/movie/550/similar',
        expect.objectContaining({ params: { api_key: TEST_API_KEY } })
      );
    });

    test('calls /3/tv/{id}/similar for mediaType=tv', async () => {
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([]));

      await client.fetchSimilar(1399, 'tv');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/tv/1399/similar',
        expect.objectContaining({ params: { api_key: TEST_API_KEY } })
      );
    });
  });

  // -------------------------------------------------------------------------
  // SimilarItem shape and mediaType mapping
  // -------------------------------------------------------------------------

  describe('SimilarItem mapping', () => {
    test('maps movie result using title field', async () => {
      const item = makeTmdbItem({ id: 550, title: 'Fight Club', vote_average: 8.8, vote_count: 5000 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(1, 'movie');

      const expected: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };
      expect(results[0]).toEqual(expected);
    });

    test('maps TV result using name field', async () => {
      const item = makeTmdbItem({ id: 1399, name: 'Game of Thrones', vote_average: 9.3, vote_count: 8000 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(1, 'tv');

      expect(results[0].title).toBe('Game of Thrones');
      expect(results[0].mediaType).toBe('tv');
      expect(results[0].externalId).toBe('1399');
    });

    test('externalId is always a string', async () => {
      const item = makeTmdbItem({ id: 12345, title: 'Test', vote_count: 100, vote_average: 7.0 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(1, 'movie');

      expect(typeof results[0].externalId).toBe('string');
      expect(results[0].externalId).toBe('12345');
    });

    test('returns up to 20 items from first page (all items from results)', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        makeTmdbItem({ id: i + 1, title: `Movie ${i + 1}`, vote_count: 50, vote_average: 6.0 })
      );
      mockAxiosGet.mockResolvedValue(makeTmdbResponse(items));

      const results = await client.fetchSimilar(1, 'movie');

      expect(results).toHaveLength(20);
    });
  });

  // -------------------------------------------------------------------------
  // Empty results
  // -------------------------------------------------------------------------

  describe('Empty results handling', () => {
    test('returns empty array when API returns no results', async () => {
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([]));

      const results = await client.fetchSimilar(1, 'movie');

      expect(results).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // externalRating out-of-range validation
  // -------------------------------------------------------------------------

  describe('externalRating out-of-range validation', () => {
    test('coerces externalRating > 10 to null', async () => {
      const item = makeTmdbItem({ id: 1, title: 'Bogus Rating', vote_average: 11, vote_count: 100 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(1, 'movie');

      expect(results[0].externalRating).toBeNull();
    });

    test('coerces negative externalRating to null', async () => {
      const item = makeTmdbItem({ id: 2, title: 'Negative Rating', vote_average: -1, vote_count: 100 });
      mockAxiosGet.mockResolvedValue(makeTmdbResponse([item]));

      const results = await client.fetchSimilar(1, 'movie');

      expect(results[0].externalRating).toBeNull();
    });
  });
});
