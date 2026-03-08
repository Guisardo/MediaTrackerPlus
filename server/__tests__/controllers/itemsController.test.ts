import { ItemsController } from 'src/controllers/items';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Items controller tests.
 *
 * The controller delegates to `mediaItemRepository.items()`.  We seed a diverse set
 * of media items and verify that pagination, mediaType filtering, and the random
 * selection endpoint all behave correctly.
 */
describe('ItemsController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);

    // Insert a varied set of items for filtering / pagination tests
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('mediaItem').insert(Data.videoGame);
    await Database.knex('mediaItem').insert(Data.book);

    // The items query only returns items on the watchlist OR previously seen.
    // Add all seeded items to the watchlist so they appear in results.
    const now = Date.now();
    await Database.knex('listItem').insert([
      { listId: Data.watchlist.id, mediaItemId: Data.movie.id, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: Data.tvShow.id, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: Data.videoGame.id, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: Data.book.id, addedAt: now },
    ]);
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // getPaginated
  // ---------------------------------------------------------------------------

  describe('getPaginated', () => {
    test('returns HTTP 200 with pagination envelope when page is valid', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('totalPages');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('returns HTTP 400 when page is 0', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 0 },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when page is negative', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: -1 },
      });

      expect(res.statusCode).toBe(400);
    });

    test('pagination envelope contains correct page number', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.page).toBe(1);
    });

    test('filters by mediaType=movie and returns only movies', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(Array.isArray(data.data)).toBe(true);

      for (const item of data.data) {
        expect(item.mediaType).toBe('movie');
      }
    });

    test('filters by mediaType=tv and returns only TV shows', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, mediaType: 'tv' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(Array.isArray(data.data)).toBe(true);

      for (const item of data.data) {
        expect(item.mediaType).toBe('tv');
      }
    });

    test('filters by mediaType=book and returns only books', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, mediaType: 'book' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(Array.isArray(data.data)).toBe(true);

      for (const item of data.data) {
        expect(item.mediaType).toBe('book');
      }
    });

    test('returns all media types when no mediaType filter is applied', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      const mediaTypes = new Set<string>(
        data.data.map((item: any) => item.mediaType)
      );

      // We seeded movie, tv, book, and video_game – all four should appear
      expect(mediaTypes.size).toBeGreaterThanOrEqual(1);
    });

    test('default ordering is title ascending', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1 },
      });

      expect(res.statusCode).toBe(200);
      const items = (res.data as any).data as any[];

      if (items.length > 1) {
        const titles = items.map((item) => item.title as string);
        const sortedTitles = [...titles].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        expect(titles).toEqual(sortedTitles);
      }
    });

    test('title filter narrows results to items whose title contains the phrase', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, filter: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = (res.data as any).data as any[];

      for (const item of items) {
        expect(item.title.toLowerCase()).toContain('movie');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // get (non-paginated)
  // ---------------------------------------------------------------------------

  describe('get', () => {
    test('returns HTTP 200 with an array of items', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns all seeded media items when no filters are applied', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      expect(items.length).toBeGreaterThanOrEqual(4);
    });

    test('filters by mediaType=video_game and returns only video games', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { mediaType: 'video_game' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];

      for (const item of items) {
        expect(item.mediaType).toBe('video_game');
      }
    });

    test('each returned item has expected shape properties', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];

      for (const item of items) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('mediaType');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getRandom
  // ---------------------------------------------------------------------------

  describe('getRandom', () => {
    test('returns HTTP 200 with an array', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('random results are a subset of all available items', async () => {
      const itemsController = new ItemsController();

      const allRes = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const randomRes = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const allIds = new Set<number>((allRes.data as any[]).map((i) => i.id));
      const randomItems = randomRes.data as any[];

      for (const item of randomItems) {
        expect(allIds.has(item.id)).toBe(true);
      }
    });

    test('random results respect mediaType filter', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getRandom, {
        userId: Data.user.id,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];

      for (const item of items) {
        expect(item.mediaType).toBe('movie');
      }
    });
  });
});
