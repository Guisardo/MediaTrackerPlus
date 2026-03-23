import { ItemsController } from 'src/controllers/items';
import { SearchController } from 'src/controllers/search';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Integration tests for viewer-based age gating across items, paginated,
 * facets, and search endpoints.
 *
 * Verifies:
 * - Items with minimumAge > viewer's age are excluded from GET /api/items
 * - Items with minimumAge > viewer's age are excluded from GET /api/items/paginated
 * - Facet counts only include age-eligible items
 * - Search excludes age-restricted items that have a resolved minimumAge
 * - Items with null minimumAge (unknown parental metadata) remain visible
 * - When dateOfBirth is unset, all items are returned unchanged
 * - Paginated response includes ageGatingActive metadata
 */
describe('Age Gating Integration', () => {
  // User IDs
  const ADULT_USER_ID = 10;
  const TEEN_USER_ID = 11;
  const NO_DOB_USER_ID = 12;

  // Media item IDs
  const RATED_R_MOVIE_ID = 200; // minimumAge = 17
  const RATED_PG13_MOVIE_ID = 201; // minimumAge = 13
  const UNRATED_MOVIE_ID = 202; // minimumAge = null
  const RATED_G_MOVIE_ID = 203; // minimumAge = 0

  const ADULT_WATCHLIST_ID = 100;
  const TEEN_WATCHLIST_ID = 101;
  const NO_DOB_WATCHLIST_ID = 102;

  beforeAll(async () => {
    await runMigrations();

    // Adult user: born 1990-01-15 => age 36 in 2026
    await Database.knex('user').insert({
      id: ADULT_USER_ID,
      name: 'adult',
      password: 'password',
      admin: false,
      publicReviews: false,
      dateOfBirth: '1990-01-15',
    });

    // Teen user: born 2012-06-01 => age 13 in 2026 (before June birthday)
    // or age 14 (after June 1). We'll use a fixed reference for age computation.
    await Database.knex('user').insert({
      id: TEEN_USER_ID,
      name: 'teen',
      password: 'password',
      admin: false,
      publicReviews: false,
      dateOfBirth: '2012-06-01',
    });

    // User without DOB
    await Database.knex('user').insert({
      id: NO_DOB_USER_ID,
      name: 'nodob',
      password: 'password',
      admin: false,
      publicReviews: false,
    });

    // Watchlists for each user
    const now = Date.now();
    await Database.knex('list').insert([
      {
        id: ADULT_WATCHLIST_ID,
        name: 'Watchlist',
        userId: ADULT_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
      {
        id: TEEN_WATCHLIST_ID,
        name: 'Watchlist',
        userId: TEEN_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
      {
        id: NO_DOB_WATCHLIST_ID,
        name: 'Watchlist',
        userId: NO_DOB_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
    ]);

    // Media items with different minimum ages
    await Database.knex('mediaItem').insert([
      {
        id: RATED_R_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'R-Rated Action Movie',
        minimumAge: 17,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'R',
        releaseDate: '2020-01-01',
        genres: 'Action',
      },
      {
        id: RATED_PG13_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'PG-13 Adventure',
        minimumAge: 13,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'PG-13',
        releaseDate: '2020-02-01',
        genres: 'Adventure',
      },
      {
        id: UNRATED_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'Unrated Indie Film',
        releaseDate: '2020-03-01',
        genres: 'Drama',
      },
      {
        id: RATED_G_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'G-Rated Family Film',
        minimumAge: 0,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'G',
        releaseDate: '2020-04-01',
        genres: 'Family',
      },
    ]);

    // Add all movies to all users' watchlists
    const listItems = [];
    for (const watchlistId of [
      ADULT_WATCHLIST_ID,
      TEEN_WATCHLIST_ID,
      NO_DOB_WATCHLIST_ID,
    ]) {
      for (const movieId of [
        RATED_R_MOVIE_ID,
        RATED_PG13_MOVIE_ID,
        UNRATED_MOVIE_ID,
        RATED_G_MOVIE_ID,
      ]) {
        listItems.push({
          listId: watchlistId,
          mediaItemId: movieId,
          addedAt: now,
        });
      }
    }
    await Database.knex('listItem').insert(listItems);
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // GET /api/items (non-paginated)
  // ---------------------------------------------------------------------------

  describe('GET /api/items', () => {
    const itemsController = new ItemsController();

    test('adult user sees all items', async () => {
      const res = await request(itemsController.get, {
        userId: ADULT_USER_ID,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const ids = items.map((i: any) => i.id);

      expect(ids).toContain(RATED_R_MOVIE_ID);
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
      expect(ids).toContain(RATED_G_MOVIE_ID);
    });

    test('teen user is excluded from R-rated item', async () => {
      const res = await request(itemsController.get, {
        userId: TEEN_USER_ID,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const ids = items.map((i: any) => i.id);

      // Teen (age 13-14) should NOT see R-rated (minimumAge=17)
      expect(ids).not.toContain(RATED_R_MOVIE_ID);
      // Teen SHOULD see PG-13 (minimumAge=13), unrated (null), and G (minimumAge=0)
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
      expect(ids).toContain(RATED_G_MOVIE_ID);
    });

    test('user without DOB sees all items unchanged', async () => {
      const res = await request(itemsController.get, {
        userId: NO_DOB_USER_ID,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const ids = items.map((i: any) => i.id);

      expect(ids).toContain(RATED_R_MOVIE_ID);
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
      expect(ids).toContain(RATED_G_MOVIE_ID);
    });

    test('items with null minimumAge remain visible to all users', async () => {
      const res = await request(itemsController.get, {
        userId: TEEN_USER_ID,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const unratedItem = items.find((i: any) => i.id === UNRATED_MOVIE_ID);

      expect(unratedItem).toBeDefined();
      expect(unratedItem.minimumAge).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/items/paginated
  // ---------------------------------------------------------------------------

  describe('GET /api/items/paginated', () => {
    const itemsController = new ItemsController();

    test('adult user paginated response includes all items', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: ADULT_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      const ids = data.data.map((i: any) => i.id);

      expect(ids).toContain(RATED_R_MOVIE_ID);
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
      expect(ids).toContain(RATED_G_MOVIE_ID);
      expect(data.total).toBe(4);
    });

    test('teen user paginated response excludes R-rated item', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: TEEN_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      const ids = data.data.map((i: any) => i.id);

      expect(ids).not.toContain(RATED_R_MOVIE_ID);
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
      expect(ids).toContain(RATED_G_MOVIE_ID);
      expect(data.total).toBe(3);
    });

    test('paginated response includes ageGatingActive=true when DOB is set', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: ADULT_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.ageGatingActive).toBe(true);
    });

    test('paginated response includes ageGatingActive=false when DOB is unset', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: NO_DOB_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.ageGatingActive).toBe(false);
    });

    test('user without DOB paginated response includes all items', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: NO_DOB_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data.total).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/items/facets
  // ---------------------------------------------------------------------------

  describe('GET /api/items/facets', () => {
    const itemsController = new ItemsController();

    test('adult user facets include all genres', async () => {
      const res = await request(itemsController.getFacets, {
        userId: ADULT_USER_ID,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const facets = res.data as any;
      const genreValues = facets.genres.map((g: any) => g.value);

      expect(genreValues).toContain('Action');
      expect(genreValues).toContain('Adventure');
      expect(genreValues).toContain('Drama');
      expect(genreValues).toContain('Family');
    });

    test('teen user facets exclude genres from age-restricted items', async () => {
      const res = await request(itemsController.getFacets, {
        userId: TEEN_USER_ID,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const facets = res.data as any;
      const genreValues = facets.genres.map((g: any) => g.value);

      // The R-rated movie's genre (Action) should not appear since it's the
      // only movie in that genre and is age-restricted for this teen user
      expect(genreValues).not.toContain('Action');
      expect(genreValues).toContain('Adventure');
      expect(genreValues).toContain('Drama');
      expect(genreValues).toContain('Family');
    });

    test('user without DOB facets include all genres', async () => {
      const res = await request(itemsController.getFacets, {
        userId: NO_DOB_USER_ID,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const facets = res.data as any;
      const genreValues = facets.genres.map((g: any) => g.value);

      expect(genreValues).toContain('Action');
      expect(genreValues).toContain('Adventure');
      expect(genreValues).toContain('Drama');
      expect(genreValues).toContain('Family');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/search
  // ---------------------------------------------------------------------------

  describe('GET /api/search', () => {
    const searchController = new SearchController();

    test('search excludes age-restricted items for teen user', async () => {
      // Search uses mediaItemRepository.items() with mediaItemIds,
      // so age filtering applies via the same viewerAge mechanism.
      // We test search indirectly by verifying that items() with
      // mediaItemIds respects viewerAge. The search controller
      // needs metadata provider mocking for full search flow, so
      // we test the IMDB-ID path which uses items() directly.

      // This test verifies the integration at the repository level
      // by calling items() with explicit mediaItemIds and viewerAge
      const { mediaItemRepository } = await import(
        'src/repository/mediaItem'
      );

      const result = await mediaItemRepository.items({
        userId: TEEN_USER_ID,
        mediaItemIds: [RATED_R_MOVIE_ID, RATED_PG13_MOVIE_ID, UNRATED_MOVIE_ID],
        viewerAge: 13,
      });

      const ids = (result as any[]).map((i: any) => i.id);
      // R-rated (minimumAge=17) excluded for 13-year-old
      expect(ids).not.toContain(RATED_R_MOVIE_ID);
      // PG-13 (minimumAge=13) and unrated (null) still visible
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
    });

    test('search returns all items when viewerAge is null', async () => {
      const { mediaItemRepository } = await import(
        'src/repository/mediaItem'
      );

      const result = await mediaItemRepository.items({
        userId: NO_DOB_USER_ID,
        mediaItemIds: [RATED_R_MOVIE_ID, RATED_PG13_MOVIE_ID, UNRATED_MOVIE_ID],
        viewerAge: null,
      });

      const ids = (result as any[]).map((i: any) => i.id);
      expect(ids).toContain(RATED_R_MOVIE_ID);
      expect(ids).toContain(RATED_PG13_MOVIE_ID);
      expect(ids).toContain(UNRATED_MOVIE_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    const itemsController = new ItemsController();

    test('item with minimumAge=0 is visible to all users with DOB', async () => {
      const res = await request(itemsController.get, {
        userId: TEEN_USER_ID,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const gItem = items.find((i: any) => i.id === RATED_G_MOVIE_ID);

      expect(gItem).toBeDefined();
      expect(gItem.minimumAge).toBe(0);
    });

    test('age-gated count is correct in paginated response', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: TEEN_USER_ID,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;

      // Teen sees 3 movies (PG-13, unrated, G) but not R-rated
      expect(data.total).toBe(3);
      expect(data.data).toHaveLength(3);
      expect(data.ageGatingActive).toBe(true);
    });
  });
});
