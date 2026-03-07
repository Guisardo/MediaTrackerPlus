import knexLib, { Knex } from 'knex';
import { WatchlistWriter, WatchlistWriterDeps, WriteResult } from 'src/recommendations/watchlistWriter';
import { SimilarItem } from 'src/metadata/types';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let knex: Knex;

async function createTables(knex: Knex): Promise<void> {
  await knex.schema.createTable('list', (t) => {
    t.increments('id').primary(); t.string('name').notNullable(); t.string('privacy').defaultTo('private');
    t.integer('userId').notNullable(); t.boolean('isWatchlist').defaultTo(false);
    t.integer('createdAt').defaultTo(0); t.integer('updatedAt').defaultTo(0);
  });
  await knex.schema.createTable('listItem', (t) => {
    t.increments('id').primary(); t.integer('listId').notNullable(); t.integer('mediaItemId').notNullable();
    t.integer('seasonId').nullable(); t.integer('episodeId').nullable(); t.integer('addedAt').notNullable();
    t.float('estimatedRating').nullable();
  });
  await knex.schema.createTable('userRating', (t) => {
    t.increments('id').primary(); t.integer('mediaItemId').notNullable(); t.integer('date').notNullable();
    t.integer('userId').notNullable(); t.float('rating').nullable(); t.text('review').nullable();
    t.integer('episodeId').nullable(); t.integer('seasonId').nullable();
  });
  await knex.schema.createTable('seen', (t) => {
    t.increments('id').primary(); t.integer('date').nullable(); t.integer('mediaItemId').notNullable();
    t.integer('episodeId').nullable(); t.integer('userId').notNullable(); t.integer('duration').nullable();
  });
}

async function createWatchlist(userId: number): Promise<number> {
  const [row] = await knex('list').insert({ name: 'Watchlist', privacy: 'private', userId, isWatchlist: true, createdAt: Date.now(), updatedAt: Date.now() }).returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertListItem(listId: number, mediaItemId: number, estimatedRating?: number | null): Promise<number> {
  const [row] = await knex('listItem').insert({ listId, mediaItemId, addedAt: Date.now(), estimatedRating: estimatedRating ?? null }).returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertSeen(userId: number, mediaItemId: number): Promise<void> {
  await knex('seen').insert({ date: Date.now(), mediaItemId, episodeId: null, userId });
}

async function insertUserRating(userId: number, mediaItemId: number, rating: number): Promise<void> {
  await knex('userRating').insert({ mediaItemId, date: Date.now(), userId, rating, seasonId: null, episodeId: null });
}

const USER_ID = 1;

function makeSimilarItem(overrides?: Partial<SimilarItem>): SimilarItem {
  return { externalId: overrides?.externalId ?? '550', mediaType: overrides?.mediaType ?? 'movie', title: overrides?.title ?? 'Fight Club', externalRating: overrides?.externalRating ?? 8.4 };
}

function makeFindMediaItem(idMap: Record<string, number>, failingIds?: Set<string>): WatchlistWriterDeps['findMediaItemByExternalId'] {
  return jest.fn(async (args) => {
    const externalId = args.id.tmdbId?.toString() ?? args.id.igdbId?.toString() ?? args.id.openlibraryId ?? '';
    if (failingIds?.has(externalId)) return undefined;
    const mediaItemId = idMap[externalId];
    return mediaItemId !== undefined ? { id: mediaItemId } : undefined;
  });
}

function createWriter(idMap: Record<string, number>, failingIds?: Set<string>): WatchlistWriter {
  return new WatchlistWriter({ findMediaItemByExternalId: makeFindMediaItem(idMap, failingIds), knex });
}

beforeAll(async () => {
  knex = knexLib({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  await createTables(knex);
});

afterAll(async () => { await knex.destroy(); });

beforeEach(async () => {
  await knex('listItem').del(); await knex('userRating').del(); await knex('seen').del(); await knex('list').del();
  jest.clearAllMocks();
});

describe('WatchlistWriter', () => {
  describe('new item (not on watchlist)', () => {
    it('should add a new item to the watchlist with estimatedRating', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });
      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
      expect(items[0].estimatedRating).toBe(8.0);
    });

    it('should add multiple new items in a single write call', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '100': 1, '200': 2, '300': 3 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '100' }), makeSimilarItem({ externalId: '200' }), makeSimilarItem({ externalId: '300' })], 7.5);
      expect(result).toEqual<WriteResult>({ added: 3, updated: 0, skipped: 0 });
      const listItems = await knex('listItem').where({ listId });
      expect(listItems).toHaveLength(3);
    });

    it('should set addedAt timestamp on new items', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });
      const before = Date.now();
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].addedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('skip when already watched', () => {
    it('should skip items that the user has already watched', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      await insertSeen(USER_ID, 100);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(9.0);
    });

    it('should log at DEBUG level when skipping watched items', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100);
      await insertSeen(USER_ID, 100);
      const writer = createWriter({ '550': 100 });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('already watched'));
    });
  });

  describe('skip when already rated', () => {
    it('should skip items that the user has already rated', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      await insertUserRating(USER_ID, 100, 8.5);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
    });

    it('should log at DEBUG level when skipping rated items', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100);
      await insertUserRating(USER_ID, 100, 8.0);
      const writer = createWriter({ '550': 100 });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('already rated'));
    });
  });

  describe('minimum-wins update strategy', () => {
    it('should update estimatedRating when incoming value is lower', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(7.0);
    });

    it('should keep existing estimatedRating when incoming value is equal', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 7.0);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
    });

    it('should keep existing estimatedRating when incoming value is higher', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 5.0);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 9.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBe(5.0);
    });

    it('should update when existing estimatedRating is null', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, null);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });
    });

    it('should handle fractional rating comparisons correctly', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 7.5);
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.4);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 1, skipped: 0 });
      const items = await knex('listItem').where({ mediaItemId: 100 });
      expect(items[0].estimatedRating).toBeCloseTo(7.4);
    });
  });

  describe('findMediaItemByExternalId failure', () => {
    it('should skip item when findMediaItemByExternalId returns undefined and continue batch', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100, '999': 200 }, new Set(['999']));
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '999' }), makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 1 });
    });

    it('should log WARN when findMediaItemByExternalId returns undefined', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '999': 200 }, new Set(['999']));
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '999' })], 8.0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('findMediaItemByExternalId returned undefined'));
    });

    it('should process all remaining items after an import failure', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '100': 1, '200': 2, '300': 3, '400': 4 }, new Set(['200']));
      const result = await writer.write(USER_ID, [
        makeSimilarItem({ externalId: '100' }), makeSimilarItem({ externalId: '200' }),
        makeSimilarItem({ externalId: '300' }), makeSimilarItem({ externalId: '400' }),
      ], 7.0);
      expect(result).toEqual<WriteResult>({ added: 3, updated: 0, skipped: 1 });
    });
  });

  describe('media type mapping', () => {
    it('should map "movie" to tmdbId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 100 }));
      const writer = new WatchlistWriter({ findMediaItemByExternalId: findFn, knex });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550', mediaType: 'movie' })], 8.0);
      expect(findFn).toHaveBeenCalledWith({ id: { tmdbId: 550 }, mediaType: 'movie' });
    });

    it('should map "tv" to tmdbId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 101 }));
      const writer = new WatchlistWriter({ findMediaItemByExternalId: findFn, knex });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '1399', mediaType: 'tv' })], 9.0);
      expect(findFn).toHaveBeenCalledWith({ id: { tmdbId: 1399 }, mediaType: 'tv' });
    });

    it('should map "video_game" to igdbId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 102 }));
      const writer = new WatchlistWriter({ findMediaItemByExternalId: findFn, knex });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '1000', mediaType: 'video_game' })], 8.0);
      expect(findFn).toHaveBeenCalledWith({ id: { igdbId: 1000 }, mediaType: 'video_game' });
    });

    it('should map "book" to openlibraryId external ID', async () => {
      await createWatchlist(USER_ID);
      const findFn = jest.fn(async () => ({ id: 103 }));
      const writer = new WatchlistWriter({ findMediaItemByExternalId: findFn, knex });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '/works/OL82563W', mediaType: 'book' })], 7.0);
      expect(findFn).toHaveBeenCalledWith({ id: { openlibraryId: '/works/OL82563W' }, mediaType: 'book' });
    });
  });

  describe('concurrent invocations', () => {
    it('should not produce duplicate listItem rows under concurrent writes', async () => {
      const listId = await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });
      const item = makeSimilarItem({ externalId: '550' });
      const [result1, result2] = await Promise.all([writer.write(USER_ID, [item], 8.0), writer.write(USER_ID, [item], 8.0)]);
      const totalAdded = result1.added + result2.added;
      const totalItems = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(totalItems).toHaveLength(1);
      expect(totalAdded).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should return zero counters for an empty items array', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({});
      const result = await writer.write(USER_ID, [], 8.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 0 });
    });

    it('should skip when user has no watchlist', async () => {
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 0, updated: 0, skipped: 1 });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No watchlist found'));
    });

    it('should only check media-item-level seen (not episode-level)', async () => {
      const listId = await createWatchlist(USER_ID);
      await knex('seen').insert({ date: Date.now(), mediaItemId: 100, episodeId: 999, userId: USER_ID });
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });
      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
    });

    it('should only check media-item-level rating (not episode/season-level)', async () => {
      const listId = await createWatchlist(USER_ID);
      await knex('userRating').insert({ mediaItemId: 100, date: Date.now(), userId: USER_ID, rating: 9.0, seasonId: 5, episodeId: null });
      const writer = createWriter({ '550': 100 });
      const result = await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(result).toEqual<WriteResult>({ added: 1, updated: 0, skipped: 0 });
      const items = await knex('listItem').where({ listId, mediaItemId: 100 });
      expect(items).toHaveLength(1);
    });

    it('should handle mixed outcomes in a single batch', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 1, 9.0);
      await insertListItem(listId, 2, 8.0);
      await insertSeen(USER_ID, 2);
      const writer = createWriter({ '100': 1, '200': 2, '300': 3 });
      const result = await writer.write(USER_ID, [
        makeSimilarItem({ externalId: '100' }), makeSimilarItem({ externalId: '200' }), makeSimilarItem({ externalId: '300' }),
      ], 7.0);
      expect(result).toEqual<WriteResult>({ added: 1, updated: 1, skipped: 1 });
      const item1 = await knex('listItem').where({ mediaItemId: 1 }).first();
      expect(item1.estimatedRating).toBe(7.0);
    });
  });

  describe('logging', () => {
    it('should log at DEBUG for add decisions', async () => {
      await createWatchlist(USER_ID);
      const writer = createWriter({ '550': 100 });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 8.0);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Added mediaItemId=100'));
    });

    it('should log at DEBUG for update decisions', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 9.0);
      const writer = createWriter({ '550': 100 });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 7.0);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Updated mediaItemId=100'));
    });

    it('should log at DEBUG for skip decisions (not lower)', async () => {
      const listId = await createWatchlist(USER_ID);
      await insertListItem(listId, 100, 5.0);
      const writer = createWriter({ '550': 100 });
      await writer.write(USER_ID, [makeSimilarItem({ externalId: '550' })], 9.0);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Keeping mediaItemId=100'));
    });
  });
});
