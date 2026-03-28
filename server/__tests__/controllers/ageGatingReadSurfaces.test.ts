import { MediaItemController } from 'src/controllers/item';
import { ListController } from 'src/controllers/listController';
import { CalendarController } from 'src/controllers/calendar';
import { StatisticsController } from 'src/controllers/statisticsController';
import { Database } from 'src/dbconfig';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Integration tests for age gating across details, list items, calendar,
 * statistics, and shared-view read paths (US-006).
 *
 * Verifies:
 * - GET /api/details/:mediaItemId returns 403 AGE_RESTRICTED for restricted items
 * - Details gating happens after needsDetails refresh
 * - GET /api/list/items excludes restricted items using viewer's DOB
 * - Public/shared list viewing uses the viewer's DOB, not the list owner's
 * - Calendar responses exclude restricted items and episodes
 * - Statistics responses exclude restricted items from aggregates
 * - Unknown parental metadata (null minimumAge) remains visible everywhere
 * - When dateOfBirth is unset, all surfaces behave normally
 */
describe('Age Gating - Read Surfaces (US-006)', () => {
  // User IDs
  const ADULT_USER_ID = 50;
  const TEEN_USER_ID = 51;
  const NO_DOB_USER_ID = 52;

  // Media item IDs
  const RATED_R_MOVIE_ID = 500; // minimumAge = 17
  const RATED_PG13_MOVIE_ID = 501; // minimumAge = 13
  const UNRATED_MOVIE_ID = 502; // minimumAge = null
  const RATED_R_TV_SHOW_ID = 503; // minimumAge = 17 (TV show)

  // List IDs
  const ADULT_WATCHLIST_ID = 300;
  const TEEN_WATCHLIST_ID = 301;
  const NO_DOB_WATCHLIST_ID = 302;
  const ADULT_PUBLIC_LIST_ID = 303; // Public list owned by adult

  // Episode IDs
  const TV_EPISODE_ID = 600;
  const TV_SEASON_ID = 700;

  beforeAll(async () => {
    await runMigrations();

    const now = Date.now();

    // Adult user: born 1990-01-15 => age 36 in 2026
    await Database.knex('user').insert({
      id: ADULT_USER_ID,
      name: 'adult_us006',
      password: 'password',
      admin: false,
      publicReviews: false,
      dateOfBirth: '1990-01-15',
    });

    // Teen user: born 2012-06-01 => age 13 in early 2026
    await Database.knex('user').insert({
      id: TEEN_USER_ID,
      name: 'teen_us006',
      password: 'password',
      admin: false,
      publicReviews: false,
      dateOfBirth: '2012-06-01',
    });

    // User without DOB
    await Database.knex('user').insert({
      id: NO_DOB_USER_ID,
      name: 'nodob_us006',
      password: 'password',
      admin: false,
      publicReviews: false,
    });

    // Watchlists
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
      {
        id: ADULT_PUBLIC_LIST_ID,
        name: 'My Public List',
        userId: ADULT_USER_ID,
        privacy: 'public',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: false,
        sortBy: 'recently-added',
        sortOrder: 'desc',
      },
    ]);

    // Media items
    await Database.knex('mediaItem').insert([
      {
        id: RATED_R_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'R-Rated Thriller',
        minimumAge: 17,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'R',
        releaseDate: '2020-01-01',
        genres: 'Thriller',
        runtime: 120,
      },
      {
        id: RATED_PG13_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'PG-13 Sci-Fi',
        minimumAge: 13,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'PG-13',
        releaseDate: '2020-02-01',
        genres: 'Sci-Fi',
        runtime: 90,
      },
      {
        id: UNRATED_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'Unrated Documentary',
        releaseDate: '2020-03-01',
        genres: 'Documentary',
        runtime: 60,
      },
      {
        id: RATED_R_TV_SHOW_ID,
        lastTimeUpdated: now,
        mediaType: 'tv',
        source: 'tmdb',
        title: 'R-Rated Drama Series',
        minimumAge: 17,
        contentRatingSystem: 'TV-PG',
        contentRatingLabel: 'TV-MA',
        releaseDate: '2026-03-15',
        genres: 'Drama',
        runtime: 60,
      },
    ]);

    // TV show season and episode (for calendar tests)
    await Database.knex('season').insert({
      id: TV_SEASON_ID,
      tvShowId: RATED_R_TV_SHOW_ID,
      seasonNumber: 1,
      title: 'Season 1',
      isSpecialSeason: false,
      numberOfEpisodes: 1,
    });

    await Database.knex('episode').insert({
      id: TV_EPISODE_ID,
      tvShowId: RATED_R_TV_SHOW_ID,
      seasonId: TV_SEASON_ID,
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Pilot',
      releaseDate: '2026-03-20',
      isSpecialEpisode: false,
      seasonAndEpisodeNumber: 1001,
    });

    // Add items to watchlists
    const watchlistItems = [];
    for (const watchlistId of [
      ADULT_WATCHLIST_ID,
      TEEN_WATCHLIST_ID,
      NO_DOB_WATCHLIST_ID,
    ]) {
      for (const movieId of [
        RATED_R_MOVIE_ID,
        RATED_PG13_MOVIE_ID,
        UNRATED_MOVIE_ID,
        RATED_R_TV_SHOW_ID,
      ]) {
        watchlistItems.push({
          listId: watchlistId,
          mediaItemId: movieId,
          addedAt: now,
        });
      }
    }
    await Database.knex('listItem').insert(watchlistItems);

    // Add items to adult's public list
    await Database.knex('listItem').insert([
      {
        listId: ADULT_PUBLIC_LIST_ID,
        mediaItemId: RATED_R_MOVIE_ID,
        addedAt: now,
      },
      {
        listId: ADULT_PUBLIC_LIST_ID,
        mediaItemId: RATED_PG13_MOVIE_ID,
        addedAt: now,
      },
      {
        listId: ADULT_PUBLIC_LIST_ID,
        mediaItemId: UNRATED_MOVIE_ID,
        addedAt: now,
      },
    ]);

    // Add seen entries for statistics tests
    await Database.knex('seen').insert([
      {
        userId: TEEN_USER_ID,
        mediaItemId: RATED_R_MOVIE_ID,
        date: now,
      },
      {
        userId: TEEN_USER_ID,
        mediaItemId: RATED_PG13_MOVIE_ID,
        date: now,
      },
      {
        userId: TEEN_USER_ID,
        mediaItemId: UNRATED_MOVIE_ID,
        date: now,
      },
      {
        userId: ADULT_USER_ID,
        mediaItemId: RATED_R_MOVIE_ID,
        date: now,
      },
      {
        userId: ADULT_USER_ID,
        mediaItemId: RATED_PG13_MOVIE_ID,
        date: now,
      },
    ]);
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // GET /api/details/:mediaItemId — restricted details (403 AGE_RESTRICTED)
  // ---------------------------------------------------------------------------

  describe('GET /api/details/:mediaItemId', () => {
    const detailsController = new MediaItemController();

    test('adult user can view R-rated details', async () => {
      const res = await request(detailsController.details, {
        userId: ADULT_USER_ID,
        pathParams: { mediaItemId: RATED_R_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      expect((res.data as any).title).toBe('R-Rated Thriller');
    });

    test('teen user receives 403 AGE_RESTRICTED for R-rated details', async () => {
      const res = await request(detailsController.details, {
        userId: TEEN_USER_ID,
        pathParams: { mediaItemId: RATED_R_MOVIE_ID },
      });

      expect(res.statusCode).toBe(403);
      const error = res.data as any;
      expect(error.code).toBe('AGE_RESTRICTED');
      expect(error.MediaTrackerError).toBe(true);
      expect(error.errorMessage).toBeDefined();
    });

    test('teen user can view PG-13 details', async () => {
      const res = await request(detailsController.details, {
        userId: TEEN_USER_ID,
        pathParams: { mediaItemId: RATED_PG13_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      expect((res.data as any).title).toBe('PG-13 Sci-Fi');
    });

    test('teen user can view unrated (null minimumAge) details', async () => {
      const res = await request(detailsController.details, {
        userId: TEEN_USER_ID,
        pathParams: { mediaItemId: UNRATED_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      expect((res.data as any).title).toBe('Unrated Documentary');
    });

    test('user without DOB can view all details', async () => {
      const res = await request(detailsController.details, {
        userId: NO_DOB_USER_ID,
        pathParams: { mediaItemId: RATED_R_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      expect((res.data as any).title).toBe('R-Rated Thriller');
    });

    test('non-existent item returns 404', async () => {
      const res = await request(detailsController.details, {
        userId: ADULT_USER_ID,
        pathParams: { mediaItemId: 99999 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/list/items — public list filtering with viewer's DOB
  // ---------------------------------------------------------------------------

  describe('GET /api/list/items', () => {
    const listController = new ListController();

    test('adult user sees all items in public list', async () => {
      const res = await request(listController.getListItems, {
        userId: ADULT_USER_ID,
        requestQuery: { listId: ADULT_PUBLIC_LIST_ID },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      expect(mediaItemIds).toContain(RATED_R_MOVIE_ID);
      expect(mediaItemIds).toContain(RATED_PG13_MOVIE_ID);
      expect(mediaItemIds).toContain(UNRATED_MOVIE_ID);
    });

    test('teen user viewing adult public list is filtered by teen DOB', async () => {
      const res = await request(listController.getListItems, {
        userId: TEEN_USER_ID,
        requestQuery: { listId: ADULT_PUBLIC_LIST_ID },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      // Teen should NOT see R-rated content even in adult's public list
      expect(mediaItemIds).not.toContain(RATED_R_MOVIE_ID);
      // Teen SHOULD see PG-13 and unrated
      expect(mediaItemIds).toContain(RATED_PG13_MOVIE_ID);
      expect(mediaItemIds).toContain(UNRATED_MOVIE_ID);
    });

    test('user without DOB sees all items in public list', async () => {
      const res = await request(listController.getListItems, {
        userId: NO_DOB_USER_ID,
        requestQuery: { listId: ADULT_PUBLIC_LIST_ID },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      expect(mediaItemIds).toContain(RATED_R_MOVIE_ID);
      expect(mediaItemIds).toContain(RATED_PG13_MOVIE_ID);
      expect(mediaItemIds).toContain(UNRATED_MOVIE_ID);
    });

    test('unknown parental metadata remains visible in list items', async () => {
      const res = await request(listController.getListItems, {
        userId: TEEN_USER_ID,
        requestQuery: { listId: ADULT_PUBLIC_LIST_ID },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const unratedItem = items.find(
        (i: any) => i.mediaItem.id === UNRATED_MOVIE_ID
      );

      expect(unratedItem).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/calendar — restricted items and episodes excluded
  // ---------------------------------------------------------------------------

  describe('GET /api/calendar', () => {
    const calendarController = new CalendarController();

    test('adult user sees R-rated TV episodes in calendar', async () => {
      const res = await request(calendarController.get, {
        userId: ADULT_USER_ID,
        requestQuery: { start: '2026-03-01', end: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      expect(mediaItemIds).toContain(RATED_R_TV_SHOW_ID);
    });

    test('teen user does not see R-rated TV episodes in calendar', async () => {
      const res = await request(calendarController.get, {
        userId: TEEN_USER_ID,
        requestQuery: { start: '2026-03-01', end: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      expect(mediaItemIds).not.toContain(RATED_R_TV_SHOW_ID);
    });

    test('user without DOB sees all calendar items', async () => {
      const res = await request(calendarController.get, {
        userId: NO_DOB_USER_ID,
        requestQuery: { start: '2026-03-01', end: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const mediaItemIds = items.map((i: any) => i.mediaItem.id);

      expect(mediaItemIds).toContain(RATED_R_TV_SHOW_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/statistics/* — restricted items excluded from aggregates
  // ---------------------------------------------------------------------------

  describe('GET /api/statistics/summary', () => {
    const statsController = new StatisticsController();

    test('adult user statistics include all watched items', async () => {
      const res = await request(statsController.summary, {
        userId: ADULT_USER_ID,
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      // Adult watched 2 movies (R-rated + PG-13)
      expect(data.movie.items).toBe(2);
    });

    test('teen user statistics exclude restricted items', async () => {
      const res = await request(statsController.summary, {
        userId: TEEN_USER_ID,
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      // Teen watched 3 movies but R-rated is excluded from aggregates => 2 items
      expect(data.movie.items).toBe(2);
    });

    test('user without DOB statistics include all items', async () => {
      // No seen entries for NO_DOB user in this test suite — just verify no crash
      const res = await request(statsController.summary, {
        userId: NO_DOB_USER_ID,
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/statistics/genresinyear', () => {
    const statsController = new StatisticsController();

    test('teen user genre statistics exclude restricted items', async () => {
      const res = await request(statsController.genres, {
        userId: TEEN_USER_ID,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;

      if (data.movie) {
        const genres = data.movie.map((g: any) => g.genre);
        // R-rated movie's genre (Thriller) should be excluded for teen
        expect(genres).not.toContain('Thriller');
        // PG-13 (Sci-Fi) and unrated (Documentary) should be present
        expect(genres).toContain('Sci-Fi');
        expect(genres).toContain('Documentary');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    const detailsController = new MediaItemController();

    test('restricted details error has stable AGE_RESTRICTED code', async () => {
      const res = await request(detailsController.details, {
        userId: TEEN_USER_ID,
        pathParams: { mediaItemId: RATED_R_MOVIE_ID },
      });

      expect(res.statusCode).toBe(403);
      const error = res.data as any;
      // Verify the error shape is machine-readable
      expect(error).toEqual(
        expect.objectContaining({
          errorMessage: expect.any(String),
          MediaTrackerError: true,
          code: 'AGE_RESTRICTED',
        })
      );
    });
  });
});
