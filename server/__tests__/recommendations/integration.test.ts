/**
 * Integration tests for the upnext Recommendation Engine.
 *
 * These tests verify the complete recommendation pipeline end-to-end:
 *   rating event → RecommendationService → metadataProviders.similar() → WatchlistWriter → DB
 *
 * Strategy:
 * - Real RecommendationService + WatchlistWriter with real Knex transactions
 * - In-memory SQLite for database isolation
 * - Mock metadataProviders.similar() via injected mock — no real HTTP calls
 * - Real transaction semantics to verify concurrency safety
 */

import knexLib, { Knex } from 'knex';

import {
  RecommendationService,
  RecommendationServiceDeps,
  SimilarityProviders,
} from 'src/recommendations/recommendationService';
import {
  WatchlistWriter,
  WatchlistWriterDeps,
  WriteResult,
} from 'src/recommendations/watchlistWriter';
import { SimilarItem } from 'src/metadata/types';
import { MediaItemBase, MediaType } from 'src/entity/mediaItem';
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
// Integration factory: builds a fully-wired RecommendationService
// ---------------------------------------------------------------------------

interface IntegrationSetup {
  service: RecommendationService;
  mockProviders: { similar: jest.Mock };
  findMediaItemByExternalId: WatchlistWriterDeps['findMediaItemByExternalId'];
  findMediaItemById: jest.Mock;
}

function buildService(options: {
  mediaItems?: Record<number, MediaItemBase>;
  externalIdMap?: Record<string, number>;
  failingExternalIds?: Set<string>;
  similarItemsMap?: Record<number, SimilarItem[]>;
}): IntegrationSetup {
  const {
    mediaItems = {},
    externalIdMap = {},
    failingExternalIds,
    similarItemsMap = {},
  } = options;

  const findMediaItemById = jest.fn(
    async (id: number): Promise<MediaItemBase | undefined> => {
      return mediaItems[id];
    }
  );

  const findMediaItemByExternalId = makeFindMediaItemByExternalId(
    externalIdMap,
    failingExternalIds
  );

  const mockProviders: { similar: jest.Mock } = {
    similar: jest.fn(async (mediaItem: MediaItemBase) => {
      return similarItemsMap[mediaItem.id!] ?? [];
    }),
  };

  const watchlistWriter = new WatchlistWriter({
    findMediaItemByExternalId,
    knex,
  });

  const service = new RecommendationService({
    metadataProviders: mockProviders as SimilarityProviders,
    watchlistWriter,
    findMediaItemById,
  });

  return {
    service,
    mockProviders,
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
  // AC1: Rating a movie triggers similar(); items added with estimatedRating
  // -------------------------------------------------------------------------
  describe('movie rating → similar() → watchlist', () => {
    it('should add similar movies to the watchlist with estimatedRating equal to trigger rating', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100, '605': 101, '606': 102 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
            { externalId: '605', mediaType: 'movie', title: 'The Matrix Revolutions', externalRating: 6.3 },
            { externalId: '606', mediaType: 'movie', title: 'Dark City', externalRating: 7.6 },
          ],
        },
      });

      const triggerRating = 8;
      await service.processRating(USER_ID, movieItem.id!, triggerRating);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(3);

      for (const item of items) {
        expect(item.estimatedRating).toBe(triggerRating);
      }

      const mediaItemIds = items.map((i) => i.mediaItemId).sort();
      expect(mediaItemIds).toEqual([100, 101, 102]);
    });

    it('should add similar TV shows to the watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [tvItem.id!]: tvItem },
        externalIdMap: { '2000': 200, '2001': 201 },
        similarItemsMap: {
          [tvItem.id!]: [
            { externalId: '2000', mediaType: 'tv', title: 'Better Call Saul', externalRating: 8.6 },
            { externalId: '2001', mediaType: 'tv', title: 'Ozark', externalRating: 8.3 },
          ],
        },
      });

      await service.processRating(USER_ID, tvItem.id!, 9);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(2);
      items.forEach((item) => expect(item.estimatedRating).toBe(9));
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Rating a game triggers similar() for video_game
  // -------------------------------------------------------------------------
  describe('game rating → similar() → watchlist', () => {
    it('should add similar games to the watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [gameItem.id!]: gameItem },
        externalIdMap: { '3001': 300, '3002': 301, '3003': 302 },
        similarItemsMap: {
          [gameItem.id!]: [
            { externalId: '3001', mediaType: 'video_game', title: 'The Witcher 2', externalRating: 8.5 },
            { externalId: '3002', mediaType: 'video_game', title: 'Cyberpunk 2077', externalRating: 7.5 },
            { externalId: '3003', mediaType: 'video_game', title: 'Dragon Age', externalRating: 9.0 },
          ],
        },
      });

      await service.processRating(USER_ID, gameItem.id!, 7);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(3);
      items.forEach((item) => expect(item.estimatedRating).toBe(7));
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Rating a book triggers similar() for book
  // -------------------------------------------------------------------------
  describe('book rating → similar() → watchlist', () => {
    it('should add similar books to the watchlist', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [bookItem.id!]: bookItem },
        externalIdMap: { '/works/OL1000W': 400, '/works/OL1001W': 401 },
        similarItemsMap: {
          [bookItem.id!]: [
            { externalId: '/works/OL1000W', mediaType: 'book', title: 'Foundation', externalRating: null },
            { externalId: '/works/OL1001W', mediaType: 'book', title: 'Neuromancer', externalRating: null },
          ],
        },
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

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
          ],
        },
      });

      await service.processRating(USER_ID, movieItem.id!, 9);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged
    });

    it('should NOT update estimatedRating when trigger rating > existing (10 > 9)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
          ],
        },
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

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
          ],
        },
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
      await insertSeen(USER_ID, 100);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
          ],
        },
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
      await insertUserRating(USER_ID, 100, 8);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '604': 100 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '604', mediaType: 'movie', title: 'The Matrix Reloaded', externalRating: 6.7 },
          ],
        },
      });

      await service.processRating(USER_ID, movieItem.id!, 5);

      const item = await knex('listItem').where({ mediaItemId: 100 }).first();
      expect(item.estimatedRating).toBe(9); // Unchanged — item was rated
    });
  });

  // -------------------------------------------------------------------------
  // AC8: One item fails findMediaItemByExternalId — remaining items still added
  // -------------------------------------------------------------------------
  describe('partial batch failure — findMediaItemByExternalId returns undefined', () => {
    it('should continue processing remaining items when one item fails import', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '700': 500, '701': 501, '702': 502 },
        failingExternalIds: new Set(['701']),
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '700', mediaType: 'movie', title: 'Successful Movie 1', externalRating: 7.0 },
            { externalId: '701', mediaType: 'movie', title: 'Failed Import Movie', externalRating: 8.0 },
            { externalId: '702', mediaType: 'movie', title: 'Successful Movie 2', externalRating: 6.5 },
          ],
        },
      });

      await service.processRating(USER_ID, movieItem.id!, 8);

      const items = await knex('listItem').where({ listId });
      expect(items).toHaveLength(2);

      const addedMediaItemIds = items.map((i) => i.mediaItemId).sort();
      expect(addedMediaItemIds).toEqual([500, 502]);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('701')
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC9: Two concurrent processRating calls for same (userId, mediaItemId)
  //      — each similar item appears exactly once (no duplicates)
  // -------------------------------------------------------------------------
  describe('concurrent processRating — no duplicate watchlist items', () => {
    it('should produce no duplicate listItem rows when two processRating calls run concurrently', async () => {
      const listId = await createWatchlist(USER_ID);

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '800': 600 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '800', mediaType: 'movie', title: 'Shared Similar Movie', externalRating: 7.5 },
          ],
        },
      });

      await Promise.all([
        service.processRating(USER_ID, movieItem.id!, 8),
        service.processRating(USER_ID, movieItem.id!, 7),
      ]);

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

      const { service } = buildService({
        mediaItems: { [movieItem.id!]: movieItem },
        externalIdMap: { '900': 700, '901': 701 },
        similarItemsMap: {
          [movieItem.id!]: [
            { externalId: '900', mediaType: 'movie', title: 'Movie A', externalRating: 7.0 },
            { externalId: '901', mediaType: 'movie', title: 'Movie B', externalRating: 8.0 },
          ],
        },
      });

      await service.processRating(USER_ID, movieItem.id!, 8);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('processRating start')
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('apiResultCount=2')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('added=2')
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error swallowing: mockProviders.similar() throws → no rethrow, error logged
  // -------------------------------------------------------------------------
  describe('error swallowing', () => {
    it('should catch and log errors from mockProviders.similar() without rethrowing', async () => {
      await createWatchlist(USER_ID);

      const findMediaItemById = jest.fn(async () => movieItem);
      const mockProviders: { similar: jest.Mock } = {
        similar: jest.fn().mockRejectedValue(new Error('Provider failure')),
      };

      const watchlistWriter = new WatchlistWriter({
        findMediaItemByExternalId: makeFindMediaItemByExternalId({}),
        knex,
      });

      const service = new RecommendationService({
        metadataProviders: mockProviders as SimilarityProviders,
        watchlistWriter,
        findMediaItemById,
      });

      await expect(
        service.processRating(USER_ID, movieItem.id!, 8)
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled error'),
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });
});
