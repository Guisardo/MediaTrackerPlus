import knexLib, { Knex } from 'knex';

import {
  WatchlistWriter,
  WatchlistWriterDeps,
  WriteResult,
} from 'src/services/recommendations/WatchlistWriter';
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

// ---------------------------------------------------------------------------
// In-memory SQLite database for transaction testing
// ---------------------------------------------------------------------------

let knex: Knex;

/** Sets up tables that mirror the real schema relevant to WatchlistWriter. */
async function createTables(knex: Knex): Promise<void> {
  await knex.schema.createTable('list', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('privacy').defaultTo('private');
    table.integer('userId').notNullable();
    table.boolean('isWatchlist').defaultTo(false);
    table.integer('createdAt').defaultTo(0);
    table.integer('updatedAt').defaultTo(0);
  });

  await knex.schema.createTable('listItem', (table) => {
    table.increments('id').primary();
    table.integer('listId').notNullable();
    table.integer('mediaItemId').notNullable();
    table.integer('seasonId').nullable();
    table.integer('episodeId').nullable();
    table.integer('addedAt').notNullable();
    table.float('estimatedRating').nullable();
  });

  await knex.schema.createTable('userRating', (table) => {
    table.increments('id').primary();
    table.integer('mediaItemId').notNullable();
    table.integer('date').notNullable();
    table.integer('userId').notNullable();
    table.float('rating').nullable();
    table.text('review').nullable();
    table.integer('episodeId').nullable();
    table.integer('seasonId').nullable();
  });

  await knex.schema.createTable('seen', (table) => {
    table.increments('id').primary();
    table.integer('date').nullable();
    table.integer('mediaItemId').notNullable();
    table.integer('episodeId').nullable();
    table.integer('userId').notNullable();
    table.integer('duration').nullable();
  });
}

/** Insert a watchlist for the given user and return its list ID. */
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

/** Insert a listItem and return its ID. */
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

/** Insert a seen record (media-item level). */
async function insertSeen(
  userId: number,
  mediaItemId: number
): Promise<void> {
  await knex('seen').insert({
    date: Date.now(),
    mediaItemId,
    episodeId: null,
    userId,
  });
}

/** Insert a user rating (media-item level). */
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
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 1;

/** Build a SimilarItem with sensible defaults. */
function makeSimilarItem(overrides?: Partial<SimilarItem>): SimilarItem {
  return {
    externalId: overrides?.externalId ?? '550',
    mediaType: overrides?.mediaType ?? 'movie',
    title: overrides?.title ?? 'Fight Club',
    externalRating: overrides?.externalRating ?? 8.4,
  };
}

/**
 * Create a mock findMediaItemByExternalId that resolves externalId → mediaItemId.
 * Pass `failingIds` to make specific external IDs return undefined (import failure).
 */
function makeFindMediaItem(
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

/** Create a WatchlistWriter with the given idMap and optional failing IDs. */
function createWriter(
  idMap: Record<string, number>,
  failingIds?: Set<string>
): WatchlistWriter {
  return new WatchlistWriter({
    findMediaItemByExternalId: makeFindMediaItem(idMap, failingIds),
    knex,
  });
}

// ---------------------------------------------------------------------------
// Test suite
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
  // Clear all tables between tests for isolation
  await knex('listItem').del();
  await knex('userRating').del();
  await knex('seen').del();
  await knex('list').del();
  jest.clearAllMocks();
});

describe('WatchlistWriter', () => {
  // -----------------------------------------------------------------------
  // New item insertion
  // -----------------------------------------------------------------------
  describe('new item (not on watchlist)', () => {
    it('should add a new item to the watchlist with estimatedRating', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });

      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
      expect(items[0].estimatedRating).toBe(8.0);
      expect(items[0].listId).toBe(listId);
    });

    it('should add multiple new items in a single write call', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '100': 1, '200': 2, '300': 3 });

      const items = [
        makeSimilarItem({ externalId: '100', title: 'Movie A' }),
        makeSimilarItem({ externalId: '200', title: 'Movie B' }),
        makeSimilarItem({ externalId: '300', title: 'Movie C' }),
      ];

      const result = await writer.write(USER_ID, items, 7.5);

      expect(result).toEqual<WriteResult>({ added: 3, updated: 0, skipped: 0 });

      const listItems = await knex('listItem').where({ listId });
      expect(listItems).toHaveLength(3);
      listItems.forEach((item) => {
        expect(item.estimatedRating).toBe(7.5);
      });
    });

    it('should set addedAt timestamp on new items', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });
      const before = Date.now();

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].addedAt).toBeGreaterThanOrEqual(before);
      expect(items[0].addedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  // -----------------------------------------------------------------------
  // Skip on watched
  // -----------------------------------------------------------------------
  describe('skip when already watched', () => {
    it('should skip items that the user has already watched', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      await insertSeen(USER_ID, 100);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });

      // estimatedRating should remain unchanged
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(9.0);
    });

    it('should log at DEBUG level when skipping watched items', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100);
      await insertSeen(USER_ID, 100);
      const writer = createWriter({ '550': 100 });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already watched')
      );
    });
  });

  // -----------------------------------------------------------------------
  // Skip on rated
  // -----------------------------------------------------------------------
  describe('skip when already rated', () => {
    it('should skip items that the user has already rated', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      await insertUserRating(USER_ID, 100, 8.5);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(9.0);
    });

    it('should log at DEBUG level when skipping rated items', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100);
      await insertUserRating(USER_ID, 100, 8.0);
      const writer = createWriter({ '550': 100 });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already rated')
      );
    });
  });

  // -----------------------------------------------------------------------
  // Minimum-wins update strategy
  // -----------------------------------------------------------------------
  describe('minimum-wins update strategy', () => {
    it('should update estimatedRating when incoming value is lower', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(7.0);
    });

    it('should keep existing estimatedRating when incoming value is equal', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 7.0);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(7.0);
    });

    it('should keep existing estimatedRating when incoming value is higher', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 5.0);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        9.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(5.0);
    });

    it('should update when existing estimatedRating is null', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, null);
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(8.0);
    });

    it('should handle fractional rating comparisons correctly', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 7.5);
      const writer = createWriter({ '550': 100 });

      // 7.4 < 7.5 → should update
      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.4
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });

      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBeCloseTo(7.4);
    });
  });

  // -----------------------------------------------------------------------
  // Import failure handling
  // -----------------------------------------------------------------------
  describe('findMediaItemByExternalId failure', () => {
    it('should skip item when findMediaItemByExternalId returns undefined and continue batch', async () => {
      await createWatchlist(USER_ID);
      const failingIds = new Set(['999']);
      const writer = createWriter({ '550': 100, '999': 200 }, failingIds);

      const items = [
        makeSimilarItem({ externalId: '999', title: 'Failing Movie' }),
        makeSimilarItem({ externalId: '550', title: 'Good Movie' }),
      ];

      const result = await writer.write(USER_ID, items, 8.0);

      // First item fails, second succeeds
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 1 });

      const listItems = await knex('listItem').where({ mediaItemId: 100 });
      expect(listItems).toHaveLength(1);
    });

    it('should log WARN when findMediaItemByExternalId returns undefined', async () => {
      await createWatchlist(USER_ID);
      const failingIds = new Set(['999']);
      const writer = createWriter({ '999': 200 }, failingIds);

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '999' })],
        8.0
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('findMediaItemByExternalId returned undefined')
      );
    });

    it('should process all remaining items after an import failure', async () => {
      await createWatchlist(USER_ID);
      const failingIds = new Set(['200']);
      const writer = createWriter(
        { '100': 1, '200': 2, '300': 3, '400': 4 },
        failingIds
      );

      const items = [
        makeSimilarItem({ externalId: '100', title: 'Movie 1' }),
        makeSimilarItem({ externalId: '200', title: 'Failing Movie' }),
        makeSimilarItem({ externalId: '300', title: 'Movie 3' }),
        makeSimilarItem({ externalId: '400', title: 'Movie 4' }),
      ];

      const result = await writer.write(USER_ID, items, 7.0);

      expect(result).toEqual<WriteResult>({ added: 3, updated: 0, skipped: 1 });
    });
  });

  // -----------------------------------------------------------------------
  // Media type mapping
  // -----------------------------------------------------------------------
  describe('media type mapping', () => {
    it('should map "movie" to tmdbId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 100 }));
      const writer = new WatchlistWriter({
        findMediaItemByExternalId: findFn,
        knex,
      });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550', mediaType: 'movie' })],
        8.0
      );

      expect(findFn).toHaveBeenCalledWith({
        id: { tmdbId: 550 },
        mediaType: 'movie',
      });
    });

    it('should map "tv" to tmdbId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 101 }));
      const writer = new WatchlistWriter({
        findMediaItemByExternalId: findFn,
        knex,
      });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '1399', mediaType: 'tv' })],
        9.0
      );

      expect(findFn).toHaveBeenCalledWith({
        id: { tmdbId: 1399 },
        mediaType: 'tv',
      });
    });

    it('should map "game" to igdbId external ID and mediaType "video_game"', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 102 }));
      const writer = new WatchlistWriter({
        findMediaItemByExternalId: findFn,
        knex,
      });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '1000', mediaType: 'game' })],
        8.0
      );

      expect(findFn).toHaveBeenCalledWith({
        id: { igdbId: 1000 },
        mediaType: 'video_game',
      });
    });

    it('should map "book" to openlibraryId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 103 }));
      const writer = new WatchlistWriter({
        findMediaItemByExternalId: findFn,
        knex,
      });

      await writer.write(
        USER_ID,
        [
          makeSimilarItem({
            externalId: '/works/OL82563W',
            mediaType: 'book',
          }),
        ],
        7.0
      );

      expect(findFn).toHaveBeenCalledWith({
        id: { openlibraryId: '/works/OL82563W' },
        mediaType: 'book',
      });
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent invocations (no duplicate rows)
  // -----------------------------------------------------------------------
  describe('concurrent invocations', () => {
    it('should not produce duplicate listItem rows under concurrent writes', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });

      const item = makeSimilarItem({ externalId: '550' });

      // Launch two concurrent write calls for the same item
      const [result1, result2] = await Promise.all([
        writer.write(USER_ID, [item], 8.0),
        writer.write(USER_ID, [item], 8.0),
      ]);

      // Combined: exactly one add, one skip (or one add, one update depending on race)
      const totalAdded = result1.added + result2.added;
      const totalItems = await knex('listItem').where({ listId, mediaItemId: 100 });

      // The key invariant: exactly one row exists
      expect(totalItems).toHaveLength(1);
      // At least one of the two must have added
      expect(totalAdded).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should return zero counters for an empty items array', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({});

      const result = await writer.write(USER_ID, [], 8.0);

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 0 });
    });

    it('should skip when user has no watchlist', async () => {
      // No watchlist created
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No watchlist found')
      );
    });

    it('should only check media-item-level seen (not episode-level)', async () => {
      const listId = await createWatchlist(USER_ID);
      // Insert an episode-level seen record (episodeId is not null)
      await knex('seen').insert({
        date: Date.now(),
        mediaItemId: 100,
        episodeId: 999,
        userId: USER_ID,
      });
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      // Episode-level seen should NOT block media-item-level recommendation
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });

      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
    });

    it('should only check media-item-level rating (not episode/season-level)', async () => {
      const listId = await createWatchlist(USER_ID);
      // Insert a season-level rating (seasonId is not null)
      await knex('userRating').insert({
        mediaItemId: 100,
        date: Date.now(),
        userId: USER_ID,
        rating: 9.0,
        seasonId: 5,
        episodeId: null,
      });
      const writer = createWriter({ '550': 100 });

      const result = await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      // Season-level rating should NOT block media-item-level recommendation
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });

      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
    });

    it('should handle mixed outcomes in a single batch', async () => {
      const listId = await createWatchlist(USER_ID);
      // mediaItemId=1: already on watchlist with estimatedRating=9 (should update)
      await insertListItem(listId, 1, 9.0);
      // mediaItemId=2: already watched (should skip)
      await insertListItem(listId, 2, 8.0);
      await insertSeen(USER_ID, 2);
      // mediaItemId=3: not on watchlist (should add)

      const writer = createWriter({ '100': 1, '200': 2, '300': 3 });

      const items = [
        makeSimilarItem({ externalId: '100', title: 'Update Me' }),
        makeSimilarItem({ externalId: '200', title: 'Watched' }),
        makeSimilarItem({ externalId: '300', title: 'New Movie' }),
      ];

      const result = await writer.write(USER_ID, items, 7.0);

      expect(result).toEqual<WriteResult>({ added: 1, updated: 1, skipped: 1 });

      // Verify individual outcomes
      const item1 = await knex('listItem').where({ mediaItemId: 1 }).first();
      expect(item1.estimatedRating).toBe(7.0); // Updated from 9.0

      const item2 = await knex('listItem').where({ mediaItemId: 2 }).first();
      expect(item2.estimatedRating).toBe(8.0); // Unchanged (watched)

      const item3 = await knex('listItem').where({ mediaItemId: 3 }).first();
      expect(item3.estimatedRating).toBe(7.0); // Newly added
    });
  });

  // -----------------------------------------------------------------------
  // WriteResult counters
  // -----------------------------------------------------------------------
  describe('WriteResult counters', () => {
    it('should accurately count adds, updates, and skips', async () => {
      const listId = await createWatchlist(USER_ID);
      // Existing item with high estimatedRating (should update)
      await insertListItem(listId, 1, 10.0);
      // Existing item with low estimatedRating (should skip — incoming is higher)
      await insertListItem(listId, 2, 3.0);
      // Existing item already rated (should skip)
      await insertListItem(listId, 3);
      await insertUserRating(USER_ID, 3, 8.0);

      const failingIds = new Set(['500']);
      const writer = createWriter(
        { '100': 1, '200': 2, '300': 3, '400': 4, '500': 5 },
        failingIds
      );

      const items = [
        makeSimilarItem({ externalId: '100', title: 'Update' }),
        makeSimilarItem({ externalId: '200', title: 'Already Low' }),
        makeSimilarItem({ externalId: '300', title: 'Rated' }),
        makeSimilarItem({ externalId: '400', title: 'New' }),
        makeSimilarItem({ externalId: '500', title: 'Import Fail' }),
      ];

      const result = await writer.write(USER_ID, items, 7.0);

      expect(result.added).toBe(1); // mediaItemId=4
      expect(result.updated).toBe(1); // mediaItemId=1 (10.0 → 7.0)
      expect(result.skipped).toBe(3); // mediaItemId=2 (3.0 kept), 3 (rated), 5 (import fail)
    });
  });

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------
  describe('logging', () => {
    it('should log at DEBUG for add decisions', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        8.0
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Added mediaItemId=100')
      );
    });

    it('should log at DEBUG for update decisions', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      const writer = createWriter({ '550': 100 });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        7.0
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Updated mediaItemId=100')
      );
    });

    it('should log at DEBUG for skip decisions (not lower)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 5.0);
      const writer = createWriter({ '550': 100 });

      await writer.write(
        USER_ID,
        [makeSimilarItem({ externalId: '550' })],
        9.0
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Keeping mediaItemId=100')
      );
    });
  });
});
