import { AxiosInstance } from 'axios';

import {
  IgdbSimilarClient,
  IgdbSimilarClientDeps,
} from 'src/services/recommendations/IgdbSimilarClient';
import { SimilarItem } from 'src/services/recommendations/types';
import { RequestQueue } from 'src/requestQueue';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

/**
 * Build a mock IGDB Step 1 response — game with similar_games IDs.
 */
function makeStep1Response(similarGameIds: number[]) {
  return {
    data: [{ id: 1000, similar_games: similarGameIds }],
    status: 200,
  };
}

/**
 * Build a mock IGDB Step 1 response with NO similar_games field.
 */
function makeStep1ResponseEmpty() {
  return {
    data: [{ id: 1000 }],
    status: 200,
  };
}

/**
 * Build a mock IGDB Step 1 response that returns empty array (no game found).
 */
function makeStep1ResponseNoGame() {
  return {
    data: [] as Array<{ id: number; similar_games?: number[] }>,
    status: 200,
  };
}

/**
 * Build a mock IGDB Step 2 response — game details with name and rating.
 */
function makeStep2Response(
  games: Array<{
    id: number;
    name: string;
    total_rating?: number;
    total_rating_count?: number;
  }>
) {
  return {
    data: games,
    status: 200,
  };
}

/**
 * Build a valid OAuth token response.
 */
function makeTokenResponse(overrides?: {
  expires_in?: number;
}) {
  return {
    data: {
      access_token: 'mock-access-token',
      expires_in: overrides?.expires_in ?? 5000,
      token_type: 'bearer',
    },
    status: 200,
  };
}

/**
 * Create a mock RequestQueue that executes immediately without delay.
 */
function createMockRequestQueue(): RequestQueue {
  const mockQueue = {
    request: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
  };
  return mockQueue as unknown as RequestQueue;
}

/**
 * Create a mock axios instance.
 */
function createMockAxios(): { post: jest.Mock } & AxiosInstance {
  const mockPost = jest.fn();
  return { post: mockPost } as unknown as { post: jest.Mock } & AxiosInstance;
}

/**
 * Create IgdbSimilarClient with standard test dependencies.
 */
function createClient(overrides?: Partial<IgdbSimilarClientDeps>) {
  const requestQueue = createMockRequestQueue();
  const axiosInstance = createMockAxios();

  const deps: IgdbSimilarClientDeps = {
    requestQueue,
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    axiosInstance,
    ...overrides,
  };

  const client = new IgdbSimilarClient(deps);
  return { client, requestQueue, axiosInstance, deps };
}

describe('IgdbSimilarClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Two-step flow: Step 1 → Step 2
  // ---------------------------------------------------------------------------

  describe('Two-step fetch flow', () => {
    test('Step 1 queries similar_games, Step 2 fetches details for returned IDs', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      // Call 1: token
      mockPost.mockResolvedValueOnce(makeTokenResponse());
      // Call 2: Step 1 — get similar_games IDs
      mockPost.mockResolvedValueOnce(makeStep1Response([101, 102, 103]));
      // Call 3: token check (cached, won't be called)
      // Call 4: Step 2 — batch fetch details
      mockPost.mockResolvedValueOnce(
        makeStep2Response([
          { id: 101, name: 'Game A', total_rating: 80, total_rating_count: 50 },
          { id: 102, name: 'Game B', total_rating: 65, total_rating_count: 30 },
          { id: 103, name: 'Game C', total_rating: 90, total_rating_count: 100 },
        ])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(3);

      // Verify Step 1 query
      const step1Call = mockPost.mock.calls[1];
      expect(step1Call[0]).toContain('/v4/games');
      expect(step1Call[1]).toContain('fields similar_games');
      expect(step1Call[1]).toContain('where id = 1000');

      // Verify Step 2 query
      const step2Call = mockPost.mock.calls[2];
      expect(step2Call[0]).toContain('/v4/games');
      expect(step2Call[1]).toContain('fields name,total_rating,total_rating_count');
      expect(step2Call[1]).toContain('where id = (101,102,103)');
    });

    test('returns empty array when source game has no similar_games field', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1ResponseEmpty());

      const results = await client.fetchSimilar(1000);

      expect(results).toEqual([]);
      // Only 2 POST calls: token + Step 1 (no Step 2)
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    test('returns empty array when source game is not found', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1ResponseNoGame());

      const results = await client.fetchSimilar(99999);

      expect(results).toEqual([]);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    test('returns empty array when similar_games is empty array', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([]));

      const results = await client.fetchSimilar(1000);

      expect(results).toEqual([]);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // total_rating normalization (0–100 → 0–10)
  // ---------------------------------------------------------------------------

  describe('total_rating normalization', () => {
    test('normalizes total_rating 75 to externalRating 7.5', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([201]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 201, name: 'Normalized Game', total_rating: 75, total_rating_count: 20 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBe(7.5);
    });

    test('normalizes total_rating 100 to externalRating 10.0', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([202]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 202, name: 'Perfect Game', total_rating: 100, total_rating_count: 500 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results[0].externalRating).toBe(10.0);
    });

    test('normalizes total_rating 1 to externalRating 0.1', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([203]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 203, name: 'Terrible Game', total_rating: 1, total_rating_count: 10 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results[0].externalRating).toBeCloseTo(0.1);
    });

    test('sets externalRating to null when total_rating is 0', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([204]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 204, name: 'Unrated Game', total_rating: 0, total_rating_count: 0 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBeNull();
    });

    test('sets externalRating to null when total_rating is undefined', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([205]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 205, name: 'No Rating Game' }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBeNull();
    });

    test('coerces negative normalized rating to null', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([206]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 206, name: 'Bogus Game', total_rating: -50 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBeNull();
    });

    test('coerces rating > 100 (normalized > 10) to null', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([207]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 207, name: 'Overrated Game', total_rating: 110 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(1);
      expect(results[0].externalRating).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // SimilarItem shape and mapping
  // ---------------------------------------------------------------------------

  describe('SimilarItem mapping', () => {
    test('produces correctly shaped SimilarItem with mediaType = game', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([301]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 301, name: 'The Witcher 3', total_rating: 92, total_rating_count: 1000 }])
      );

      const results = await client.fetchSimilar(1000);

      const expected: SimilarItem = {
        externalId: '301',
        mediaType: 'game',
        title: 'The Witcher 3',
        externalRating: 9.2,
      };
      expect(results[0]).toEqual(expected);
    });

    test('externalId is always a string', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([12345]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 12345, name: 'Test Game', total_rating: 50 }])
      );

      const results = await client.fetchSimilar(1000);

      expect(typeof results[0].externalId).toBe('string');
      expect(results[0].externalId).toBe('12345');
    });

    test('skips games with no name', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([401, 402]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([
          { id: 401, name: '', total_rating: 80 },
          { id: 402, name: 'Valid Game', total_rating: 70 },
        ])
      );

      const results = await client.fetchSimilar(1000);

      // Empty name is falsy → filtered out
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Valid Game');
    });
  });

  // ---------------------------------------------------------------------------
  // OAuth token refresh
  // ---------------------------------------------------------------------------

  describe('Token management', () => {
    test('acquires token before first API call', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([]));

      await client.fetchSimilar(1000);

      // First call should be to the token endpoint
      const tokenCall = mockPost.mock.calls[0];
      expect(tokenCall[0]).toBe('https://id.twitch.tv/oauth2/token');
      expect(tokenCall[2]).toEqual(
        expect.objectContaining({
          params: {
            client_id: TEST_CLIENT_ID,
            client_secret: TEST_CLIENT_SECRET,
            grant_type: 'client_credentials',
          },
        })
      );
    });

    test('reuses cached token when not within 60s of expiry', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      // First fetchSimilar: token + Step 1 (empty)
      mockPost.mockResolvedValueOnce(makeTokenResponse({ expires_in: 5000 }));
      mockPost.mockResolvedValueOnce(makeStep1Response([]));
      await client.fetchSimilar(1000);

      // Second fetchSimilar: should reuse token (no extra token call)
      mockPost.mockResolvedValueOnce(makeStep1Response([]));
      await client.fetchSimilar(2000);

      // Total: 1 token + 1 Step1 + 1 Step1 = 3 calls
      expect(mockPost).toHaveBeenCalledTimes(3);
      // Only first call is to token endpoint
      expect(mockPost.mock.calls[0][0]).toBe('https://id.twitch.tv/oauth2/token');
      // Second and third calls are to IGDB API
      expect(mockPost.mock.calls[1][0]).toContain('/v4/games');
      expect(mockPost.mock.calls[2][0]).toContain('/v4/games');
    });

    test('refreshes token when within 60s of expiry', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      // First call: token with very short expiry (30 seconds → within 60s buffer)
      mockPost.mockResolvedValueOnce(makeTokenResponse({ expires_in: 30 }));
      mockPost.mockResolvedValueOnce(makeStep1Response([]));
      await client.fetchSimilar(1000);

      // Second call: should refresh token because 30s < 60s buffer
      mockPost.mockResolvedValueOnce(makeTokenResponse({ expires_in: 5000 }));
      mockPost.mockResolvedValueOnce(makeStep1Response([]));
      await client.fetchSimilar(2000);

      // Total: token1 + Step1 + token2 + Step1 = 4 calls
      expect(mockPost).toHaveBeenCalledTimes(4);
      expect(mockPost.mock.calls[0][0]).toBe('https://id.twitch.tv/oauth2/token');
      expect(mockPost.mock.calls[2][0]).toBe('https://id.twitch.tv/oauth2/token');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared RequestQueue injection and usage
  // ---------------------------------------------------------------------------

  describe('Shared RequestQueue usage', () => {
    test('all API requests flow through the injected RequestQueue', async () => {
      const requestQueue = createMockRequestQueue();
      const { client, axiosInstance } = createClient({ requestQueue });
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([501]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 501, name: 'Queued Game', total_rating: 60 }])
      );

      await client.fetchSimilar(1000);

      // Token + Step 1 + Step 2 = 3 calls through the queue
      expect(requestQueue.request).toHaveBeenCalledTimes(3);
    });

    test('uses the SAME RequestQueue instance provided at construction', async () => {
      const requestQueue = createMockRequestQueue();
      const { client } = createClient({ requestQueue });

      // Verify it's the same reference by checking the spy
      const { axiosInstance } = createClient({ requestQueue });
      const mockPost = axiosInstance.post as jest.Mock;

      // Create a new client with the SAME queue
      const client2Axios = createMockAxios();
      const client2 = new IgdbSimilarClient({
        requestQueue,
        clientId: TEST_CLIENT_ID,
        clientSecret: TEST_CLIENT_SECRET,
        axiosInstance: client2Axios,
      });

      client2Axios.post.mockResolvedValueOnce(makeTokenResponse());
      client2Axios.post.mockResolvedValueOnce(makeStep1Response([]));
      await client2.fetchSimilar(1000);

      // Both clients use the same requestQueue reference
      expect(requestQueue.request).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  describe('Error propagation', () => {
    test('throws when token acquisition fails', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockRejectedValueOnce(new Error('Network error during token fetch'));

      await expect(client.fetchSimilar(1000)).rejects.toThrow('Network error during token fetch');
    });

    test('throws when Step 1 API call fails', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockRejectedValueOnce(new Error('IGDB API error on Step 1'));

      await expect(client.fetchSimilar(1000)).rejects.toThrow('IGDB API error on Step 1');
    });

    test('throws when Step 2 API call fails', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([601]));
      mockPost.mockRejectedValueOnce(new Error('IGDB API error on Step 2'));

      await expect(client.fetchSimilar(1000)).rejects.toThrow('IGDB API error on Step 2');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('Edge cases', () => {
    test('handles Step 2 returning fewer games than requested', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      // Step 1 returns 3 IDs
      mockPost.mockResolvedValueOnce(makeStep1Response([701, 702, 703]));
      // Step 2 returns only 2 games (one might have been deleted)
      mockPost.mockResolvedValueOnce(
        makeStep2Response([
          { id: 701, name: 'Still Exists', total_rating: 80 },
          { id: 703, name: 'Also Exists', total_rating: 70 },
        ])
      );

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.externalId)).toEqual(['701', '703']);
    });

    test('handles Step 2 returning empty array', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([801, 802]));
      mockPost.mockResolvedValueOnce(makeStep2Response([]));

      const results = await client.fetchSimilar(1000);

      expect(results).toEqual([]);
    });

    test('handles multiple similar games (up to 20)', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      const ids = Array.from({ length: 20 }, (_, i) => 900 + i);
      const details = ids.map((id) => ({
        id,
        name: `Game ${id}`,
        total_rating: 50 + id % 50,
        total_rating_count: 10,
      }));

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response(ids));
      mockPost.mockResolvedValueOnce(makeStep2Response(details));

      const results = await client.fetchSimilar(1000);

      expect(results).toHaveLength(20);
    });

    test('logs debug message when no similar games found', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([]));

      await client.fetchSimilar(1000);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No similar games found for igdbId=1000')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // API request format
  // ---------------------------------------------------------------------------

  describe('API request format', () => {
    test('sends POST requests with correct headers', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([1001]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 1001, name: 'Header Test', total_rating: 60 }])
      );

      await client.fetchSimilar(1000);

      // Verify Step 1 headers (index 1 is the Step 1 call)
      const step1Headers = mockPost.mock.calls[1][2]?.headers;
      expect(step1Headers).toEqual({
        Authorization: 'Bearer mock-access-token',
        'Client-ID': TEST_CLIENT_ID,
      });

      // Verify Step 2 headers
      const step2Headers = mockPost.mock.calls[2][2]?.headers;
      expect(step2Headers).toEqual({
        Authorization: 'Bearer mock-access-token',
        'Client-ID': TEST_CLIENT_ID,
      });
    });

    test('sends Apicalypse query as POST body string', async () => {
      const { client, axiosInstance } = createClient();
      const mockPost = axiosInstance.post as jest.Mock;

      mockPost.mockResolvedValueOnce(makeTokenResponse());
      mockPost.mockResolvedValueOnce(makeStep1Response([1002]));
      mockPost.mockResolvedValueOnce(
        makeStep2Response([{ id: 1002, name: 'Body Test', total_rating: 55 }])
      );

      await client.fetchSimilar(5000);

      // Step 1 body
      const step1Body = mockPost.mock.calls[1][1] as string;
      expect(typeof step1Body).toBe('string');
      expect(step1Body).toContain('fields similar_games');
      expect(step1Body).toContain('where id = 5000');

      // Step 2 body
      const step2Body = mockPost.mock.calls[2][1] as string;
      expect(typeof step2Body).toBe('string');
      expect(step2Body).toContain('fields name,total_rating,total_rating_count');
      expect(step2Body).toContain('where id = (1002)');
    });
  });
});
