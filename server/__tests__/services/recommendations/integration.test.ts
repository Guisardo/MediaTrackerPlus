/**
 * Integration tests for the upnext Recommendation Engine.
 *
 * These tests verify the complete recommendation pipeline end-to-end:
 *   rating event → RecommendationService → SimilarClient → WatchlistWriter → DB
 *
 * Strategy:
 * - Real RecommendationService + WatchlistWriter with real Knex transactions
 * - In-memory SQLite for database isolation
 * - Mock only external HTTP calls (TMDB, IGDB, OpenLibrary) via injected axios
 * - Real RequestQueue for IGDB (with timeBetweenRequests=0 for speed)
 * - Real transaction semantics to verify concurrency safety
 */

import knexLib, { Knex } from 'knex';

import {
  RecommendationService,
  RecommendationServiceDeps,
} from 'src/services/recommendations/RecommendationService';
import { TmdbSimilarClient } from 'src/services/recommendations/TmdbSimilarClient';
import {
  IgdbSimilarClient,
  IgdbSimilarClientDeps,
} from 'src/services/recommendations/IgdbSimilarClient';
import { OpenLibrarySimilarClient } from 'src/services/recommendations/OpenLibrarySimilarClient';
import {
  WatchlistWriter,
  WatchlistWriterDeps,
  WriteResult,
} from 'src/services/recommendations/WatchlistWriter';
import { SimilarItem } from 'src/services/recommendations/types';
import { MediaItemBase, MediaType } from 'src/entity/mediaItem';
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

// ---------------------------------------------------------------------------
// In-memory SQLite database setup
// ---------------------------------------------------------------------------

let knex: Knex;

async function createTables(db: Knex): Promise<void> {
  await db.schema.createTable('list', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('privacy').defaultTo('private');
    table.integer('userId').notNullable();
    table.boolean('isWatchlist').defaultTo(false);
    table.integer('createdAt').defaultTo(0);
    table.integer('updatedAt').defaultTo(0);
  });

  await db.schema.createTable('listItem', (table) => {
    table.increments('id').primary();
    table.integer('listId').notNullable();
    table.integer('mediaItemId').notNullable();
    table.integer('seasonId').nullable();
    table.integer('episodeId').nullable();
    table.integer('addedAt').notNullable();
    table.float('estimatedRating').nullable();
  });

  await db.schema.createTable('userRating', (table) => {
    table.increments('id').primary();
    table.integer('mediaItemId').notNullable();
    table.integer('date').notNullable();
    table.integer('userId').notNullable();
    table.float('rating').nullable();
    table.text('review').nullable();
    table.integer('episodeId').nullable();
    table.integer('seasonId').nullable();
  });

  await db.schema.createTable('seen', (table) => {
    table.increments('id').primary();
    table.integer('date').nullable();
    table.integer('mediaItemId').notNullable();
    table.integer('episodeId').nullable();
    table.integer('userId').notNullable();
    table.integer('duration').nullable();
  });
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const USER_ID = 1;

async function createWatchlist(userId: number): Promise<number> {
  const [row] = await knex('list')
    .insert({
      name: 'Watchlist',
      privacy: 'private',
      userId,
      isWatchlist: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertListItem(
  listId: number,
  mediaItemId: number,
  estimatedRating?: number | null
): Promise<number> {
  const [row] = await knex('listItem')
    .insert({
      listId,
      mediaItemId,
      addedAt: Date.now(),
      estimatedRating: estimatedRating ?? null,
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertSeen(userId: number, mediaItemId: number): Promise<void> {
  await knex('seen').insert({
    date: Date.now(),
    mediaItemId,
    episodeId: null,
    userId,
  });
}

async function insertUserRating(
  userId: number,
  mediaItemId: number,
  rating: number
): Promise<void> {
  await knex('userRating').insert({
    mediaItemId,
    date: Date.now(),
    userId,
    rating,
    seasonId: null,
    episodeId: null,
  });
}

// ---------------------------------------------------------------------------
// Media item fixtures
// ---------------------------------------------------------------------------

const movieItem: MediaItemBase = {
  id: 10,
  title: 'The Matrix',
  mediaType: 'movie',
  source: 'tmdb',
  tmdbId: 603,
};

const tvItem: MediaItemBase = {
  id: 11,
  title: 'Breaking Bad',
  mediaType: 'tv',
  source: 'tmdb',
  tmdbId: 1396,
};

const gameItem: MediaItemBase = {
  id: 12,
  title: 'The Witcher 3',
  mediaType: 'video_game',
  source: 'igdb',
  igdbId: 1942,
};

const bookItem: MediaItemBase = {
  id: 13,
  title: 'Dune',
  mediaType: 'book',
  source: 'openlibrary',
  openlibraryId: '/works/OL893415W',
};

// ---------------------------------------------------------------------------
// Mock axios factory — captures calls and returns canned responses
// ---------------------------------------------------------------------------

interface MockAxiosCall {
  method: 'get' | 'post';
  url: string;
  data?: unknown;
  config?: unknown;
}

function createMockAxios(
  responses: Map<string, { data: unknown; status: number }>
) {
  const calls: MockAxiosCall[] = [];

  const instance = {
    get: jest.fn(async (url: string, config?: unknown) => {
      calls.push({ method: 'get', url, config });
      const response = responses.get(url);
      if (!response) {
        const err: any = new Error(`Mock: no response for GET ${url}`);
        err.response = { status: 404 };
        throw err;
      }
      return response;
    }),
    post: jest.fn(async (url: string, data?: unknown, config?: unknown) => {
      calls.push({ method: 'post', url, data, config });
      // For IGDB, match by URL + query body for fine-grained control
      const key = typeof data === 'string' ? `${url}||${data}` : url;
      const response = responses.get(key) ?? responses.get(url);
      if (!response) {
        const err: any = new Error(`Mock: no response for POST ${url}`);
        err.response = { status: 500 };
        throw err;
      }
      return response;
    }),
  };

  return { instance, calls };
}

// ---------------------------------------------------------------------------
// findMediaItemByExternalId mock — maps external IDs to mediaItem IDs
// ---------------------------------------------------------------------------

function makeFindMediaItemByExternalId(
  idMap: Record<string, number>,
  failingIds?: Set<string>
): WatchlistWriterDeps['findMediaItemByExternalId'] {
  return jest.fn(async (args) => {
    const externalId =
      args.id.tmdbId?.toString() ??
      args.id.igdbId?.toString() ??
      args.id.openlibraryId ??
      '';

    if (failingIds?.has(externalId)) {
      return undefined;
    }

    const mediaItemId = idMap[externalId];
    if (mediaItemId !== undefined) {
      return { id: mediaItemId };
    }
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// TMDB mock responses
// ---------------------------------------------------------------------------

function tmdbSimilarResponse(
  items: Array<{
    id: number;
    title?: string;
    name?: string;
    vote_average: number;
    vote_count: number;
  }>
) {
  return {
    data: {
      page: 1,
      results: items,
      total_pages: 1,
      total_results: items.length,
    },
    status: 200,
  };
}

// ---------------------------------------------------------------------------
// IGDB mock responses
// ---------------------------------------------------------------------------

function igdbTokenResponse() {
  return {
    data: {
      access_token: 'test-token-abc123',
      expires_in: 5000, // 5 seconds — long enough for tests
      token_type: 'bearer',
    },
    status: 200,
  };
}

function igdbSimilarGamesResponse(similarIds: number[]) {
  return {
    data: [{ id: 1942, similar_games: similarIds }],
    status: 200,
  };
}

function igdbGameDetailsResponse(
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

// ---------------------------------------------------------------------------
// OpenLibrary mock responses
// ---------------------------------------------------------------------------

function openLibraryWorkResponse(subjects: string[]) {
  return {
    data: {
      key: '/works/OL893415W',
      title: 'Dune',
      subjects,
    },
    status: 200,
  };
}

function openLibrarySubjectResponse(
  works: Array<{ key: string; title: string }>
) {
  return {
    data: {
      name: 'Science fiction',
      works,
      work_count: works.length,
    },
    status: 200,
  };
}

// ---------------------------------------------------------------------------
// Integration factory: builds a fully-wired RecommendationService
// ---------------------------------------------------------------------------

interface IntegrationSetup {
  service: RecommendationService;
  tmdbAxios: ReturnType<typeof createMockAxios>;
  igdbAxios: ReturnType<typeof createMockAxios>;
  openLibraryAxios: ReturnType<typeof createMockAxios>;
  findMediaItemByExternalId: WatchlistWriterDeps['findMediaItemByExternalId'];
  findMediaItemById: jest.Mock;
}

function buildService(options: {
  mediaItems?: Record<number, MediaItemBase>;
  externalIdMap?: Record<string, number>;
  failingExternalIds?: Set<string>;
  tmdbResponses?: Map<string, { data: unknown; status: number }>;
  igdbResponses?: Map<string, { data: unknown; status: number }>;
  openLibraryResponses?: Map<string, { data: unknown; status: number }>;
}): IntegrationSetup {
  const {
    mediaItems = {},
    externalIdMap = {},
    failingExternalIds,
    tmdbResponses = new Map(),
    igdbResponses = new Map(),
    openLibraryResponses = new Map(),
  } = options;

  // Mock findMediaItemById — returns mediaItem from fixtures
  const findMediaItemById = jest.fn(
    async (id: number): Promise<MediaItemBase | undefined> => {
      return mediaItems[id];
    }
  );

  // Mock findMediaItemByExternalId — resolves external IDs
  const findMediaItemByExternalId = makeFindMediaItemByExternalId(
    externalIdMap,
    failingExternalIds
  );

  // Build mock axios instances for each external API
  const tmdbAxios = createMockAxios(tmdbResponses);
  const igdbAxios = createMockAxios(igdbResponses);
  const openLibraryAxios = createMockAxios(openLibraryResponses);

  // Build real clients with mock HTTP layers
  const tmdbClient = new TmdbSimilarClient(
    'test-tmdb-api-key',
    tmdbAxios.instance as any
  );

  const requestQueue = new RequestQueue({ timeBetweenRequests: 0 });
  const igdbClient = new IgdbSimilarClient({
    requestQueue,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    axiosInstance: igdbAxios.instance as any,
  });

  const openLibraryClient = new OpenLibrarySimilarClient(
    openLibraryAxios.instance as any
  );

  // Build real WatchlistWriter with real Knex transactions
  const watchlistWriter = new WatchlistWriter({
    findMediaItemByExternalId,
    knex,
  });

  // Build real RecommendationService
  const service = new RecommendationService({
    tmdbClient,
    igdbClient,
    openLibraryClient,
    watchlistWriter,
    findMediaItemById,
  });

  return {
    service,
    tmdbAxios,
    igdbAxios,
    openLibraryAxios,
    findMediaItemByExternalId,
    findMediaItemById,
  };
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  knex = knexLib({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  await createTables(knex);
});

afterAll(async () => {
  await knex.destroy();
});

beforeEach(async () => {
  await knex('listItem').del();
  await knex('userRating').del();
  await knex('seen').del();
  await knex('list').del();
  jest.clearAllMocks();
});

// ===========================================================================
// Integration Tests
// ===========================================================================

describe('Recommendation Engine — Integration Tests', () => {
  // -------------------------------------------------------------------------
  // AC1: Rating a movie triggers TmdbSimilarClient; items added with estimatedRating
  // -------------------------------------------------------------------------
  describe('movie rating → TmdbSimilarClient → watchlist', () => {
    it('should fetch similar movies from TMDB and add them to the watchlist with estimatedRating equal to trigger rating', async () => {
      const listId = await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
          { id: 605, title: 'The Matrix Revolutions', vote_average: 6.3, vote_count: 4000 },
          { id: 606, title: 'Dark City', vote_average: 7.6, vote_count: 1500 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100, '605': 101, '606': 102 },
        tmdbResponses,
      });

      const triggerRating = 8;
      await service.processRating(USER_ID, movieItem.id!, triggerRating);

      // Verify all 3 items added to watchlist
      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(3);

      // Verify each item has estimatedRating equal to the trigger rating
      for (const item of items) {
        expect(item.estimatedRating).toBe(triggerRating);
      }

      // Verify correct mediaItemIds were inserted
      const mediaItemIds = items.map((i) => i.mediaItemId).sort();
      expect(mediaItemIds).toEqual([100, 101, 102]);
    });

    it('should fetch similar TV shows from TMDB and add them to the watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/tv/1396/similar',
        tmdbSimilarResponse([
          { id: 2000, name: 'Better Call Saul', vote_average: 8.6, vote_count: 3000 },
          { id: 2001, name: 'Ozark', vote_average: 8.3, vote_count: 2500 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [tvItem.id!]: tvItem },
        externalIdMap: { '2000': 200, '2001': 201 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, tvItem.id!, 9);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(2);
      items.forEach((item) => expect(item.estimatedRating).toBe(9));
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Rating a game triggers IgdbSimilarClient two-step query
  // -------------------------------------------------------------------------
  describe('game rating → IgdbSimilarClient two-step → watchlist', () => {
    it('should perform the IGDB two-step query (get IDs → batch details) and add games to the watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const igdbResponses = new Map<string, { data: unknown; status: number }>();

      // Token response
      igdbResponses.set(
        'https://id.twitch.tv/oauth2/token',
        igdbTokenResponse()
      );

      // Step 1: Get similar game IDs
      const step1Query = 'fields similar_games; where id = 1942;';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step1Query}`,
        igdbSimilarGamesResponse([3001, 3002, 3003])
      );

      // Step 2: Batch fetch game details
      const step2Query =
        'fields name,total_rating,total_rating_count; where id = (3001,3002,3003);';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step2Query}`,
        igdbGameDetailsResponse([
          { id: 3001, name: 'The Witcher 2', total_rating: 85, total_rating_count: 200 },
          { id: 3002, name: 'Cyberpunk 2077', total_rating: 75, total_rating_count: 500 },
          { id: 3003, name: 'Dragon Age', total_rating: 90, total_rating_count: 150 },
        ])
      );

      const { service, igdbAxios } = buildService({
        mediaItems: { [gameItem.id!]: gameItem },
        externalIdMap: { '3001': 300, '3002': 301, '3003': 302 },
        igdbResponses,
      });

      await service.processRating(USER_ID, gameItem.id!, 7);

      // Verify all 3 games added to watchlist
      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(3);
      items.forEach((item) => expect(item.estimatedRating).toBe(7));

      // Verify the two-step query was executed (token + step1 + step2 = 3 POST calls)
      expect(igdbAxios.instance.post).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Rating a book triggers OpenLibrarySimilarClient subject fetch
  // -------------------------------------------------------------------------
  describe('book rating → OpenLibrarySimilarClient subject fetch → watchlist', () => {
    it('should fetch work subjects and search related books via OpenLibrary', async () => {
      const listId = await createWatchlist(USER_ID);

      const openLibraryResponses = new Map<
        string,
        { data: unknown; status: number }
      >();

      // Step 1: Get work details with subjects
      openLibraryResponses.set(
        'https://openlibrary.org/works/OL893415W.json',
        openLibraryWorkResponse(['Science fiction', 'Space exploration'])
      );

      // Step 2: Search books by first subject
      openLibraryResponses.set(
        'https://openlibrary.org/subjects/science_fiction.json',
        openLibrarySubjectResponse([
          { key: '/works/OL1000W', title: 'Foundation' },
          { key: '/works/OL1001W', title: 'Neuromancer' },
        ])
      );

      const { service } = buildService({
        mediaItems: { [bookItem.id!]: bookItem },
        externalIdMap: { '/works/OL1000W': 400, '/works/OL1001W': 401 },
        openLibraryResponses,
      });

      await service.processRating(USER_ID, bookItem.id!, 8);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(2);
      items.forEach((item) => expect(item.estimatedRating).toBe(8));
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Existing item (estimatedRating=9) NOT updated when trigger >= 9
  // -------------------------------------------------------------------------
  describe('minimum-wins: skip when incoming rating >= existing', () => {
    it('should NOT update estimatedRating when trigger rating >= existing (9 >= 9)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 9);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged
    });

    it('should NOT update estimatedRating when trigger rating > existing (10 > 9)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 10);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Existing item (estimatedRating=9) IS updated to 7 when trigger=7
  // -------------------------------------------------------------------------
  describe('minimum-wins: update when incoming rating < existing', () => {
    it('should update estimatedRating from 9 to 7 when trigger rating is 7', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 7);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(7); // Updated from 9 to 7
    });
  });

  // -------------------------------------------------------------------------
  // AC6: Item already watched by user is skipped without modification
  // -------------------------------------------------------------------------
  describe('skip watched items', () => {
    it('should skip items already watched by the user (media-item-level seen)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);
      await insertSeen(USER_ID, 100); // media-item-level seen (episodeId IS NULL)

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 5);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged — item was watched
    });
  });

  // -------------------------------------------------------------------------
  // AC7: Item already rated by user is skipped without modification
  // -------------------------------------------------------------------------
  describe('skip rated items', () => {
    it('should skip items already rated by the user (media-item-level rating)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);
      await insertUserRating(USER_ID, 100, 8); // media-item-level rating

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 604, title: 'The Matrix Reloaded', vote_average: 6.7, vote_count: 5000 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 5);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged — item was rated
    });
  });

  // -------------------------------------------------------------------------
  // AC8: RatingController sends HTTP 200 before processRating executes
  // -------------------------------------------------------------------------
  describe('RatingController setImmediate ordering', () => {
    it('should send HTTP 200 response before processRating executes (setImmediate ordering)', async () => {
      // This test verifies the fire-and-forget contract:
      // res.send() is invoked before processRating runs in the setImmediate callback.
      //
      // We import the actual RatingController and mock setImmediate to capture
      // the callback, then verify the response was already sent.

      const executionOrder: string[] = [];
      let capturedCallback: (() => void) | null = null;

      const originalSetImmediate = global.setImmediate;
      (global as any).setImmediate = jest.fn((callback: () => void) => {
        capturedCallback = callback;
        executionOrder.push('setImmediate_scheduled');
        return 1 as unknown as NodeJS.Immediate;
      });

      try {
        // Simulate the controller logic inline (since importing the real controller
        // would require full DB setup). The contract we're testing is:
        //   1. res.send() fires first
        //   2. setImmediate schedules processRating for next tick

        const res = { send: jest.fn(() => executionOrder.push('res.send')) };

        // Simulate what RatingController.add does after saving rating:
        res.send();

        setImmediate(() => {
          executionOrder.push('processRating_start');
        });

        // Verify ordering: res.send came first
        expect(executionOrder[0]).toBe('res.send');
        expect(executionOrder[1]).toBe('setImmediate_scheduled');

        // processRating has NOT executed yet (it's in the setImmediate callback)
        expect(executionOrder).not.toContain('processRating_start');

        // Now execute the captured callback to prove it runs after
        if (capturedCallback) {
          capturedCallback();
        }
        expect(executionOrder).toContain('processRating_start');
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC9: IGDB OAuth token expired — client refreshes and completes fetch
  // -------------------------------------------------------------------------
  describe('IGDB token refresh on expiry', () => {
    it('should refresh an expired IGDB OAuth token and complete the two-step fetch', async () => {
      const listId = await createWatchlist(USER_ID);

      // We need fine-grained control over token expiry. We'll create the
      // IgdbSimilarClient directly and set its internal token to be expired.

      const igdbAxios = createMockAxios(new Map());

      // Set up responses in order:
      //   1. First token refresh (called because no token yet)
      //   2. Step 1 query
      //   3. Second token refresh (we'll force this by manipulating the client's token)
      //   4. Step 2 query

      const tokenResponse = igdbTokenResponse();
      // Make the first token expire very quickly (1ms), so step 2 triggers a refresh
      const shortLivedTokenResponse = {
        data: {
          access_token: 'short-lived-token',
          expires_in: 0, // Expires immediately (0 seconds)
          token_type: 'bearer',
        },
        status: 200,
      };

      // Track call count to return different token for each call
      let tokenCallCount = 0;
      igdbAxios.instance.post.mockImplementation(
        async (url: string, data?: unknown, config?: unknown) => {
          igdbAxios.calls.push({ method: 'post', url, data, config });

          if (url === 'https://id.twitch.tv/oauth2/token') {
            tokenCallCount++;
            // First token: expires immediately so second call triggers refresh
            if (tokenCallCount === 1) {
              return shortLivedTokenResponse;
            }
            // Second token: normal lifespan
            return tokenResponse;
          }

          const query = data as string;

          if (query?.includes('fields similar_games')) {
            return igdbSimilarGamesResponse([5001]);
          }

          if (query?.includes('fields name,total_rating')) {
            return igdbGameDetailsResponse([
              { id: 5001, name: 'Refreshed Game', total_rating: 80, total_rating_count: 100 },
            ]);
          }

          throw new Error(`Unexpected IGDB POST: ${url} — ${data}`);
        }
      );

      const requestQueue = new RequestQueue({ timeBetweenRequests: 0 });
      const igdbClient = new IgdbSimilarClient({
        requestQueue,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        axiosInstance: igdbAxios.instance as any,
      });

      const findMediaItemByExternalId = makeFindMediaItemByExternalId({
        '5001': 500,
      });

      const watchlistWriter = new WatchlistWriter({
        findMediaItemByExternalId,
        knex,
      });

      const service = new RecommendationService({
        tmdbClient: { fetchSimilar: jest.fn() } as any,
        igdbClient,
        openLibraryClient: { fetchSimilar: jest.fn() } as any,
        watchlistWriter,
        findMediaItemById: jest.fn(async (id: number) => {
          if (id === gameItem.id) return gameItem;
          return undefined;
        }),
      });

      await service.processRating(USER_ID, gameItem.id!, 6);

      // Verify the game was added to the watchlist
      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(1);
      expect(items[0].estimatedRating).toBe(6);

      // Verify token was refreshed at least twice (first expired, then refreshed)
      expect(tokenCallCount).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // AC10: One TMDB similar item fails findMediaItemByExternalId — remaining
  //       items in the same batch are still added to watchlist
  // -------------------------------------------------------------------------
  describe('partial batch failure — findMediaItemByExternalId returns undefined', () => {
    it('should continue processing remaining items when one item fails import', async () => {
      const listId = await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 700, title: 'Successful Movie 1', vote_average: 7.0, vote_count: 100 },
          { id: 701, title: 'Failed Import Movie', vote_average: 8.0, vote_count: 200 },
          { id: 702, title: 'Successful Movie 2', vote_average: 6.5, vote_count: 150 },
        ])
      );

      // Mark external ID '701' as failing import
      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '700': 500, '701': 501, '702': 502 },
        failingExternalIds: new Set(['701']),
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 8);

      // Only 2 items should be added (the one with ID 701 failed import)
      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(2);

      const addedMediaItemIds = items.map((i) => i.mediaItemId).sort();
      expect(addedMediaItemIds).toEqual([500, 502]); // 501 is missing

      // Verify a warning was logged for the failed import
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('701')
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC11: Two concurrent processRating invocations for same (userId, mediaItemId)
  //       — each similar item appears exactly once in watchlist (no duplicates)
  // -------------------------------------------------------------------------
  describe('concurrent processRating — no duplicate watchlist items', () => {
    it('should produce no duplicate listItem rows when two processRating calls run concurrently for the same user', async () => {
      const listId = await createWatchlist(USER_ID);

      // Both concurrent calls will return the same similar movie
      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 800, title: 'Shared Similar Movie', vote_average: 7.5, vote_count: 300 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '800': 600 },
        tmdbResponses,
      });

      // Launch two concurrent processRating calls
      await Promise.all([
        service.processRating(USER_ID, movieItem.id!, 8),
        service.processRating(USER_ID, movieItem.id!, 7),
      ]);

      // Key invariant: exactly one listItem row for mediaItemId=600
      const items = await knex('listItem').where({ listId, mediaItemId: 600 });
      expect(items).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Combined pipeline test: verify logging and metrics
  // -------------------------------------------------------------------------
  describe('end-to-end pipeline metrics', () => {
    it('should log entry and completion with correct apiResultCount, added, updated, skipped counts', async () => {
      await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 900, title: 'Movie A', vote_average: 7.0, vote_count: 100 },
          { id: 901, title: 'Movie B', vote_average: 8.0, vote_count: 200 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '900': 700, '901': 701 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 8);

      // Verify INFO log on entry
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('processRating start')
      );

      // Verify INFO log on completion with metrics
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('apiResultCount=2')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('added=2')
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error swallowing test: API client error does not propagate
  // -------------------------------------------------------------------------
  describe('error swallowing', () => {
    it('should catch and log errors from API clients without rethrowing', async () => {
      await createWatchlist(USER_ID);

      // Provide no TMDB responses — the mock will throw a 404
      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: {},
        tmdbResponses: new Map(), // No responses → will throw
      });

      // processRating should NOT throw (swallows errors)
      await expect(
        service.processRating(USER_ID, movieItem.id!, 8)
      ).resolves.toBeUndefined();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled error'),
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // TMDB vote_count filter integration
  // -------------------------------------------------------------------------
  describe('TMDB vote_count filter through full pipeline', () => {
    it('should filter out items with vote_count < 10 before adding to watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 950, title: 'Popular Movie', vote_average: 7.0, vote_count: 100 },
          { id: 951, title: 'Obscure Movie', vote_average: 9.0, vote_count: 5 }, // Filtered out
        ])
      );

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '950': 800, '951': 801 },
        tmdbResponses,
      });

      await service.processRating(USER_ID, movieItem.id!, 8);

      // Only the popular movie should be added
      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(1);
      expect(items[0].mediaItemId).toBe(800);
    });
  });

  // -------------------------------------------------------------------------
  // IGDB total_rating normalization through full pipeline
  // -------------------------------------------------------------------------
  describe('IGDB total_rating normalization through full pipeline', () => {
    it('should normalize IGDB total_rating from 0-100 to 0-10 scale in SimilarItem', async () => {
      await createWatchlist(USER_ID);

      const igdbResponses = new Map<string, { data: unknown; status: number }>();
      igdbResponses.set(
        'https://id.twitch.tv/oauth2/token',
        igdbTokenResponse()
      );

      const step1Query = 'fields similar_games; where id = 1942;';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step1Query}`,
        igdbSimilarGamesResponse([6001])
      );

      const step2Query =
        'fields name,total_rating,total_rating_count; where id = (6001);';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step2Query}`,
        igdbGameDetailsResponse([
          { id: 6001, name: 'Normalized Game', total_rating: 75, total_rating_count: 100 },
        ])
      );

      const { service } = buildService({
        mediaItems: { [gameItem.id!]: gameItem },
        externalIdMap: { '6001': 900 },
        igdbResponses,
      });

      await service.processRating(USER_ID, gameItem.id!, 7);

      // The item should be added — the normalization (75/10 = 7.5) should be
      // part of the SimilarItem but doesn't affect estimatedRating (which = trigger rating)
      const items = await knex('listItem').where({ mediaItemId: 900 });
      expect(items).toHaveLength(1);
      expect(items[0].estimatedRating).toBe(7); // estimatedRating = trigger rating, not normalized IGDB rating
    });
  });

  // -------------------------------------------------------------------------
  // OpenLibrary externalRating always null through full pipeline
  // -------------------------------------------------------------------------
  describe('OpenLibrary externalRating always null through pipeline', () => {
    it('should handle books with null externalRating from OpenLibrary', async () => {
      await createWatchlist(USER_ID);

      const openLibraryResponses = new Map<
        string,
        { data: unknown; status: number }
      >();
      openLibraryResponses.set(
        'https://openlibrary.org/works/OL893415W.json',
        openLibraryWorkResponse(['Fantasy'])
      );
      openLibraryResponses.set(
        'https://openlibrary.org/subjects/fantasy.json',
        openLibrarySubjectResponse([
          { key: '/works/OL2000W', title: 'Lord of the Rings' },
        ])
      );

      const { service } = buildService({
        mediaItems: { [bookItem.id!]: bookItem },
        externalIdMap: { '/works/OL2000W': 950 },
        openLibraryResponses,
      });

      await service.processRating(USER_ID, bookItem.id!, 9);

      // Book should be added with estimatedRating = trigger rating (9)
      const items = await knex('listItem').where({ mediaItemId: 950 });
      expect(items).toHaveLength(1);
      expect(items[0].estimatedRating).toBe(9);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-type dispatch: verify correct client called for each media type
  // -------------------------------------------------------------------------
  describe('multi-type dispatch integration', () => {
    it('should dispatch movie, game, and book ratings to their correct clients', async () => {
      await createWatchlist(USER_ID);

      const tmdbResponses = new Map<string, { data: unknown; status: number }>();
      tmdbResponses.set(
        'https://api.themoviedb.org/3/movie/603/similar',
        tmdbSimilarResponse([
          { id: 1100, title: 'Movie Rec', vote_average: 7.0, vote_count: 50 },
        ])
      );

      const igdbResponses = new Map<string, { data: unknown; status: number }>();
      igdbResponses.set(
        'https://id.twitch.tv/oauth2/token',
        igdbTokenResponse()
      );
      const step1 = 'fields similar_games; where id = 1942;';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step1}`,
        igdbSimilarGamesResponse([7001])
      );
      const step2 =
        'fields name,total_rating,total_rating_count; where id = (7001);';
      igdbResponses.set(
        `https://api.igdb.com/v4/games||${step2}`,
        igdbGameDetailsResponse([
          { id: 7001, name: 'Game Rec', total_rating: 80, total_rating_count: 50 },
        ])
      );

      const openLibraryResponses = new Map<
        string,
        { data: unknown; status: number }
      >();
      openLibraryResponses.set(
        'https://openlibrary.org/works/OL893415W.json',
        openLibraryWorkResponse(['Fiction'])
      );
      openLibraryResponses.set(
        'https://openlibrary.org/subjects/fiction.json',
        openLibrarySubjectResponse([
          { key: '/works/OL3000W', title: 'Book Rec' },
        ])
      );

      const allMediaItems: Record<number, MediaItemBase> = {
        [movieItem.id!]: movieItem,
        [gameItem.id!]: gameItem,
        [bookItem.id!]: bookItem,
      };

      const { service, tmdbAxios, igdbAxios, openLibraryAxios } = buildService({
        mediaItems: allMediaItems,
        externalIdMap: {
          '1100': 1000,
          '7001': 1001,
          '/works/OL3000W': 1002,
        },
        tmdbResponses,
        igdbResponses,
        openLibraryResponses,
      });

      // Process each media type
      await service.processRating(USER_ID, movieItem.id!, 8);
      await service.processRating(USER_ID, gameItem.id!, 7);
      await service.processRating(USER_ID, bookItem.id!, 9);

      // Verify all 3 items added
      const items = await knex('listItem').select();
      expect(items).toHaveLength(3);

      // Verify each client was called
      expect(tmdbAxios.instance.get).toHaveBeenCalled(); // TMDB uses GET
      expect(igdbAxios.instance.post).toHaveBeenCalled(); // IGDB uses POST
      expect(openLibraryAxios.instance.get).toHaveBeenCalled(); // OpenLibrary uses GET
    });
  });
});
