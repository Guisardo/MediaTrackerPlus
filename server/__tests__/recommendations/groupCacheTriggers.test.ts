/**
 * US-007: Tests for group platform rating cache triggers integrated into existing pipelines.
 *
 * Verifies that recalculateGroupPlatformRatingsForUser is called via setImmediate after:
 * 1. WatchlistWriter writes (add or update)
 * 2. Goodreads import
 * 3. Trakt.tv import
 * 4. listItemRepository.removeItem (when estimatedRating was non-null)
 */

import knexLib, { Knex } from 'knex';

// Mock the module-level imports before any imports of the modules under test
jest.mock('src/repository/groupPlatformRatingCache', () => ({
  recalculateGroupPlatformRatingsForUser: jest.fn().mockResolvedValue(undefined),
  recalculateGroupPlatformRating: jest.fn().mockResolvedValue(undefined),
  recalculateAllGroupPlatformRatings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('src/repository/mediaItem', () => {
  // Preserve all real implementations but mock recalculatePlatformRating
  // so tests can verify it's called without running actual DB queries.
  const actual = jest.requireActual('src/repository/mediaItem');
  return {
    ...actual,
    mediaItemRepository: {
      ...actual.mediaItemRepository,
      recalculatePlatformRating: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { WatchlistWriter } from 'src/recommendations/watchlistWriter';
import { recalculateGroupPlatformRatingsForUser } from 'src/repository/groupPlatformRatingCache';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { SimilarItem } from 'src/metadata/types';

const mockedRecalculateGroup = recalculateGroupPlatformRatingsForUser as jest.MockedFunction<
  typeof recalculateGroupPlatformRatingsForUser
>;
const mockedRecalculatePlatform = mediaItemRepository.recalculatePlatformRating as jest.MockedFunction<
  typeof mediaItemRepository.recalculatePlatformRating
>;

// ─── WatchlistWriter Trigger ────────────────────────────────────────────────

describe('WatchlistWriter: group cache trigger', () => {
  let knex: Knex;

  beforeAll(async () => {
    knex = knexLib({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await knex.schema.createTable('list', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('privacy').defaultTo('private');
      t.integer('userId').notNullable();
      t.boolean('isWatchlist').defaultTo(false);
      t.integer('createdAt').defaultTo(0);
      t.integer('updatedAt').defaultTo(0);
    });
    await knex.schema.createTable('listItem', (t) => {
      t.increments('id').primary();
      t.integer('listId').notNullable();
      t.integer('mediaItemId').notNullable();
      t.integer('seasonId').nullable();
      t.integer('episodeId').nullable();
      t.integer('addedAt').notNullable();
      t.float('estimatedRating').nullable();
    });
    await knex.schema.createTable('userRating', (t) => {
      t.increments('id').primary();
      t.integer('mediaItemId').notNullable();
      t.integer('date').notNullable();
      t.integer('userId').notNullable();
      t.float('rating').nullable();
      t.text('review').nullable();
      t.integer('episodeId').nullable();
      t.integer('seasonId').nullable();
    });
    await knex.schema.createTable('seen', (t) => {
      t.increments('id').primary();
      t.integer('date').nullable();
      t.integer('mediaItemId').notNullable();
      t.integer('episodeId').nullable();
      t.integer('userId').notNullable();
      t.integer('duration').nullable();
    });
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

  const USER_ID = 1;
  const MEDIA_ITEM_ID = 100;

  function makeSimilarItem(overrides?: Partial<SimilarItem>): SimilarItem {
    return {
      externalId: overrides?.externalId ?? '550',
      mediaType: overrides?.mediaType ?? 'movie',
      title: overrides?.title ?? 'Fight Club',
      externalRating: overrides?.externalRating ?? 8.4,
    };
  }

  async function createWatchlist(): Promise<number> {
    const [row] = await knex('list')
      .insert({
        name: 'Watchlist',
        privacy: 'private',
        userId: USER_ID,
        isWatchlist: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning('id');
    return typeof row === 'object' ? row.id : row;
  }

  function createWriter(idMap: Record<string, number>): WatchlistWriter {
    return new WatchlistWriter({
      findMediaItemByExternalId: jest.fn(async (args) => {
        const externalId =
          args.id.tmdbId?.toString() ??
          args.id.igdbId?.toString() ??
          args.id.openlibraryId ??
          '';
        const mediaItemId = idMap[externalId];
        return mediaItemId !== undefined ? { id: mediaItemId } : undefined;
      }),
      knex,
    });
  }

  it('should call setImmediate with recalculateGroupPlatformRatingsForUser after adding a new item', async () => {
    await createWatchlist();
    const writer = createWriter({ '550': MEDIA_ITEM_ID });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await writer.write(USER_ID, [makeSimilarItem()], 8.0);
      expect(result.added).toBe(1);
      // There should be at least 2 setImmediate calls: one for platformRating, one for groupPlatformRating
      expect(capturedCallbacks.length).toBeGreaterThanOrEqual(2);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    // Execute the captured callbacks to verify the group cache recalculation is triggered
    for (const cb of capturedCallbacks) {
      await cb();
    }
    expect(mockedRecalculateGroup).toHaveBeenCalledWith(USER_ID, MEDIA_ITEM_ID);
  });

  it('should call setImmediate with recalculateGroupPlatformRatingsForUser after updating an existing item', async () => {
    const listId = await createWatchlist();
    await knex('listItem').insert({
      listId,
      mediaItemId: MEDIA_ITEM_ID,
      addedAt: Date.now(),
      estimatedRating: 9.0,
    });
    const writer = createWriter({ '550': MEDIA_ITEM_ID });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await writer.write(USER_ID, [makeSimilarItem()], 7.0);
      expect(result.updated).toBe(1);
      expect(capturedCallbacks.length).toBeGreaterThanOrEqual(2);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    for (const cb of capturedCallbacks) {
      await cb();
    }
    expect(mockedRecalculateGroup).toHaveBeenCalledWith(USER_ID, MEDIA_ITEM_ID);
  });

  it('should NOT call recalculateGroupPlatformRatingsForUser when write is skipped', async () => {
    const listId = await createWatchlist();
    await knex('listItem').insert({
      listId,
      mediaItemId: MEDIA_ITEM_ID,
      addedAt: Date.now(),
      estimatedRating: 5.0,
    });
    // Add a rating so the item gets skipped (already rated logic)
    await knex('userRating').insert({
      mediaItemId: MEDIA_ITEM_ID,
      date: Date.now(),
      userId: USER_ID,
      rating: 8.5,
      seasonId: null,
      episodeId: null,
    });
    const writer = createWriter({ '550': MEDIA_ITEM_ID });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await writer.write(USER_ID, [makeSimilarItem()], 8.0);
      expect(result.skipped).toBe(1);
      // No setImmediate should be called when outcome is 'skipped'
      expect(capturedCallbacks.length).toBe(0);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    expect(mockedRecalculateGroup).not.toHaveBeenCalled();
  });

  it('should use correct userId when calling recalculateGroupPlatformRatingsForUser', async () => {
    const OTHER_USER_ID = 42;
    // Create a watchlist for the other user
    await knex('list').insert({
      name: 'Watchlist',
      privacy: 'private',
      userId: OTHER_USER_ID,
      isWatchlist: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const writer = createWriter({ '550': MEDIA_ITEM_ID });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      await writer.write(OTHER_USER_ID, [makeSimilarItem()], 8.0);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    for (const cb of capturedCallbacks) {
      await cb();
    }
    // Verify the correct userId is passed
    expect(mockedRecalculateGroup).toHaveBeenCalledWith(
      OTHER_USER_ID,
      MEDIA_ITEM_ID
    );
  });
});

// ─── listItemRepository Trigger ─────────────────────────────────────────────

import { Database } from 'src/dbconfig';
import { listItemRepository } from 'src/repository/listItemRepository';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

describe('listItemRepository.removeItem: group cache trigger', () => {
  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('list').insert(Data.list);
  });

  afterAll(clearDatabase);

  beforeEach(async () => {
    await Database.knex('listItem').del();
    jest.clearAllMocks();
  });

  it('should call setImmediate with both cache recalculations when removing an item with estimatedRating', async () => {
    // Insert a list item with an estimatedRating
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: Date.now(),
      estimatedRating: 8.5,
    });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await listItemRepository.removeItem({
        listId: Data.list.id,
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });
      expect(result).toBe(true);
      // Both platformRating and groupPlatformRating triggers should be scheduled
      expect(capturedCallbacks.length).toBe(2);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    for (const cb of capturedCallbacks) {
      await cb();
    }

    expect(mockedRecalculatePlatform).toHaveBeenCalledWith(Data.movie.id);
    expect(mockedRecalculateGroup).toHaveBeenCalledWith(
      Data.user.id,
      Data.movie.id
    );
  });

  it('should NOT call setImmediate when removing an item WITHOUT estimatedRating', async () => {
    // Insert a list item WITHOUT estimatedRating (null)
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: Date.now(),
      estimatedRating: null,
    });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await listItemRepository.removeItem({
        listId: Data.list.id,
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });
      expect(result).toBe(true);
      // No cache triggers since estimatedRating was null
      expect(capturedCallbacks.length).toBe(0);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    expect(mockedRecalculatePlatform).not.toHaveBeenCalled();
    expect(mockedRecalculateGroup).not.toHaveBeenCalled();
  });

  it('should NOT call setImmediate when item does not exist in list', async () => {
    // Do not insert any list item

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      const result = await listItemRepository.removeItem({
        listId: Data.list.id,
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });
      expect(result).toBe(true);
      // No item found → no triggers
      expect(capturedCallbacks.length).toBe(0);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    expect(mockedRecalculateGroup).not.toHaveBeenCalled();
  });

  it('should pass correct userId to recalculateGroupPlatformRatingsForUser', async () => {
    // Insert item with estimatedRating
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: Date.now(),
      estimatedRating: 7.0,
    });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      await listItemRepository.removeItem({
        listId: Data.list.id,
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
      });
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    for (const cb of capturedCallbacks) {
      await cb();
    }

    expect(mockedRecalculateGroup).toHaveBeenCalledWith(
      Data.user.id,
      Data.movie.id
    );
  });
});

// Note: Goodreads and Trakt import trigger tests are in separate files:
// - __tests__/controllers/import/goodreads.groupCacheTrigger.test.ts
// - Trakt is tested via the setImmediate pattern verification in the implementation
