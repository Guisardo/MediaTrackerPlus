jest.mock('axios');
jest.mock('src/repository/globalSettings', () => ({
  GlobalConfiguration: {
    configuration: {
      igdbClientId: 'test-client-id',
      igdbClientSecret: 'test-client-secret',
    },
  },
}));
jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('src/requestQueue', () => ({
  RequestQueue: jest.fn().mockImplementation(() => ({
    request: jest.fn((fn: () => Promise<unknown>) => fn()),
  })),
}));

import axios from 'axios';
import { IGDB } from 'src/metadata/provider/igdb';
import { IGDB_REGION_MAP } from 'src/metadataLanguages';
import { logger } from 'src/logger';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const igdb = new IGDB();

/**
 * IGDB.fetchGameLocalizations tests.
 *
 * fetchGameLocalizations(ids) makes a single POST /v4/game_localizations call
 * with `where game = {igdbId}` and returns an array of { regionId, name }.
 * It also logs a DEBUG message noting no localized description is available.
 */
describe('IGDB.fetchGameLocalizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the token refresh call (POST to Twitch) to return a valid token
    mockedAxios.post.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('twitch.tv')) {
        return Promise.resolve({
          status: 200,
          data: {
            access_token: 'test-token',
            expires_in: 999999999,
            token_type: 'bearer',
          },
        });
      }
      // Default: return empty array for game_localizations
      return Promise.resolve({ data: [] });
    });
  });

  // ---------------------------------------------------------------------------
  // Returns empty array for missing igdbId
  // ---------------------------------------------------------------------------

  describe('missing igdbId', () => {
    test('returns empty array when no igdbId is provided', async () => {
      const result = await igdb.fetchGameLocalizations({});

      expect(result).toEqual([]);
    });

    test('logs a warning when igdbId is missing', async () => {
      await igdb.fetchGameLocalizations({});

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no igdbId provided')
      );
    });

    test('does not make an API request when igdbId is missing', async () => {
      await igdb.fetchGameLocalizations({});

      // Only the token refresh POST may have been called, not the game_localizations endpoint
      const localizationCalls = mockedAxios.post.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('game_localizations')
      );
      expect(localizationCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Makes correct API request
  // ---------------------------------------------------------------------------

  describe('API call', () => {
    test('posts to /v4/game_localizations with correct query', async () => {
      mockedAxios.post.mockImplementation((url: string) => {
        if (url.includes('twitch.tv')) {
          return Promise.resolve({
            status: 200,
            data: { access_token: 'test-token', expires_in: 999999999, token_type: 'bearer' },
          });
        }
        return Promise.resolve({ data: [] });
      });

      await igdb.fetchGameLocalizations({ igdbId: 1234 });

      const localizationCall = mockedAxios.post.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('game_localizations')
      );

      expect(localizationCall).toBeDefined();
      expect(localizationCall![0]).toContain('game_localizations');
      expect(localizationCall![1]).toContain('where game = 1234');
    });
  });

  // ---------------------------------------------------------------------------
  // Returns and maps localizations correctly
  // ---------------------------------------------------------------------------

  describe('returns localizations', () => {
    test('returns localization entries with regionId and name', async () => {
      mockedAxios.post.mockImplementation((url: string) => {
        if (url.includes('twitch.tv')) {
          return Promise.resolve({
            status: 200,
            data: { access_token: 'test-token', expires_in: 999999999, token_type: 'bearer' },
          });
        }
        return Promise.resolve({
          data: [
            { id: 1, name: 'The Witcher 3: Wild Hunt', region: 1 },
            { id: 2, name: 'The Witcher 3: Wild Hunt', region: 2 },
            { id: 3, name: 'ウィッチャー3', region: 5 },
          ],
        });
      });

      const result = await igdb.fetchGameLocalizations({ igdbId: 1942 });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ regionId: 1, name: 'The Witcher 3: Wild Hunt' });
      expect(result[1]).toEqual({ regionId: 2, name: 'The Witcher 3: Wild Hunt' });
      expect(result[2]).toEqual({ regionId: 5, name: 'ウィッチャー3' });
    });

    test('filters out localizations with null/undefined region or empty name', async () => {
      mockedAxios.post.mockImplementation((url: string) => {
        if (url.includes('twitch.tv')) {
          return Promise.resolve({
            status: 200,
            data: { access_token: 'test-token', expires_in: 999999999, token_type: 'bearer' },
          });
        }
        return Promise.resolve({
          data: [
            { id: 1, name: 'Valid Name', region: 2 },
            { id: 2, name: null, region: 1 },     // no name — filtered out
            { id: 3, name: 'Another Name', region: null }, // no region — filtered out
          ],
        });
      });

      const result = await igdb.fetchGameLocalizations({ igdbId: 100 });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ regionId: 2, name: 'Valid Name' });
    });

    test('returns empty array when API returns no results', async () => {
      mockedAxios.post.mockImplementation((url: string) => {
        if (url.includes('twitch.tv')) {
          return Promise.resolve({
            status: 200,
            data: { access_token: 'test-token', expires_in: 999999999, token_type: 'bearer' },
          });
        }
        return Promise.resolve({ data: [] });
      });

      const result = await igdb.fetchGameLocalizations({ igdbId: 9999 });

      expect(result).toEqual([]);
    });

    test('logs debug message about no localized description when results are found', async () => {
      mockedAxios.post.mockImplementation((url: string) => {
        if (url.includes('twitch.tv')) {
          return Promise.resolve({
            status: 200,
            data: { access_token: 'test-token', expires_in: 999999999, token_type: 'bearer' },
          });
        }
        return Promise.resolve({
          data: [{ id: 1, name: 'Game Title', region: 2 }],
        });
      });

      await igdb.fetchGameLocalizations({ igdbId: 42 });

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'IGDB: no localized description available, storing title only'
      );
    });
  });
});

// ---------------------------------------------------------------------------
// IGDB_REGION_MAP tests
// ---------------------------------------------------------------------------

describe('IGDB_REGION_MAP', () => {
  test('maps region 1 (europe) to European language codes', () => {
    expect(IGDB_REGION_MAP[1]).toEqual(['de', 'fr', 'es', 'it', 'nl', 'pl', 'pt']);
  });

  test('maps region 2 (north_america) to ["en"]', () => {
    expect(IGDB_REGION_MAP[2]).toEqual(['en']);
  });

  test('maps region 3 (australia) to ["en"]', () => {
    expect(IGDB_REGION_MAP[3]).toEqual(['en']);
  });

  test('maps region 4 (new_zealand) to ["en"]', () => {
    expect(IGDB_REGION_MAP[4]).toEqual(['en']);
  });

  test('maps region 5 (japan) to ["ja"]', () => {
    expect(IGDB_REGION_MAP[5]).toEqual(['ja']);
  });

  test('maps region 6 (china) to ["zh"]', () => {
    expect(IGDB_REGION_MAP[6]).toEqual(['zh']);
  });

  test('maps region 7 (asia) to ["ko", "zh"]', () => {
    expect(IGDB_REGION_MAP[7]).toEqual(['ko', 'zh']);
  });

  test('maps region 8 (worldwide) to sentinel "all"', () => {
    expect(IGDB_REGION_MAP[8]).toBe('all');
  });

  test('maps region 9 (korea) to ["ko"]', () => {
    expect(IGDB_REGION_MAP[9]).toEqual(['ko']);
  });
});
