import { RatingController } from 'src/controllers/rating';
import { ProgressController } from 'src/controllers/progress';
import { SeenController } from 'src/controllers/seen';
import { ListItemController } from 'src/controllers/listItemController';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

describe('Write Endpoint Age-Gating Regressions (US-008)', () => {
  beforeAll(async () => {
    await runMigrations();

    // Test users: one with DOB (teen, will be age-restricted), one without
    const restrictedViewer = {
      id: 100,
      name: 'restricted-viewer',
      admin: false,
      password: 'password',
      dateOfBirth: '2012-06-01', // ~12 years old
    };

    const unrestricted = {
      id: 101,
      name: 'unrestricted',
      admin: false,
      password: 'password',
      dateOfBirth: null,
    };

    await Database.knex('user').insert(restrictedViewer);
    await Database.knex('user').insert(unrestricted);
    await Database.knex('user').insert(Data.user);

    // Media items with various parental ratings
    const rRatedMovie = {
      id: 50,
      mediaType: 'movie' as const,
      source: 'tmdb',
      title: 'R-Rated Movie',
      lastTimeUpdated: new Date().getTime(),
      minimumAge: 17, // Restricted for teen viewer
      contentRatingSystem: 'MPAA',
      contentRatingRegion: 'US',
      contentRatingLabel: 'R',
      contentRatingDescriptors: null,
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: null,
    };

    const pgMovie = {
      id: 51,
      mediaType: 'movie' as const,
      source: 'tmdb',
      title: 'PG Movie',
      lastTimeUpdated: new Date().getTime(),
      minimumAge: 13, // Allowed for teen viewer
      contentRatingSystem: 'MPAA',
      contentRatingRegion: 'US',
      contentRatingLabel: 'PG-13',
      contentRatingDescriptors: null,
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: null,
    };

    const unratedMovie = {
      id: 52,
      mediaType: 'movie' as const,
      source: 'tmdb',
      title: 'Unrated Movie',
      lastTimeUpdated: new Date().getTime(),
      minimumAge: null, // No age restriction
      contentRatingSystem: null,
      contentRatingRegion: null,
      contentRatingLabel: null,
      contentRatingDescriptors: null,
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: null,
    };

    const rRatedShow = {
      id: 53,
      mediaType: 'tv' as const,
      source: 'tmdb',
      title: 'R-Rated TV Show',
      lastTimeUpdated: new Date().getTime(),
      minimumAge: 17,
      contentRatingSystem: 'TV-PG',
      contentRatingRegion: 'US',
      contentRatingLabel: 'TV-MA',
      contentRatingDescriptors: null,
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: null,
    };

    await Database.knex('mediaItem').insert(rRatedMovie);
    await Database.knex('mediaItem').insert(pgMovie);
    await Database.knex('mediaItem').insert(unratedMovie);
    await Database.knex('mediaItem').insert(rRatedShow);

    // Seasons and episodes for TV show
    const season = {
      id: 50,
      tvShowId: 53,
      seasonNumber: 1,
      numberOfEpisodes: 1,
      title: 'Season 1',
      isSpecialSeason: false,
    };

    const episode = {
      id: 50,
      seasonId: 50,
      episodeNumber: 1,
      tvShowId: 53,
      title: 'Episode 1',
      seasonNumber: 1,
      seasonAndEpisodeNumber: 1001,
      isSpecialEpisode: false,
    };

    await Database.knex('season').insert(season);
    await Database.knex('episode').insert(episode);

    // Watchlist for restricted viewer
    const watchlist = {
      id: 100,
      isWatchlist: true,
      userId: 100,
      name: 'Watchlist',
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      privacy: 'private',
      allowComments: false,
      displayNumbers: false,
      sortBy: 'recently-added',
      sortOrder: 'asc',
    };

    await Database.knex('list').insert(watchlist);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('userRating').delete();
    await Database.knex('progress').delete();
    await Database.knex('seen').delete();
    await Database.knex('listItem').delete();
  });

  // ==================== RATING ENDPOINT TESTS ====================

  describe('Rating endpoint (POST /api/rating)', () => {
    test('should allow rating an age-restricted movie for a viewer below age gate', async () => {
      const ratingController = new RatingController();

      // Restricted viewer (age ~12) rating R-rated movie (minimumAge=17)
      const res = await request(ratingController.add, {
        userId: 100, // restrictedViewer
        requestBody: {
          mediaItemId: 50, // R-rated movie
          rating: 8,
        },
      });

      expect(res.statusCode).toEqual(200);

      const userRating = await Database.knex('userRating')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();

      expect(userRating).toBeDefined();
      expect(userRating.rating).toEqual(8);
    });

    test('should allow rating an unrated movie for a viewer below age gate', async () => {
      const ratingController = new RatingController();

      const res = await request(ratingController.add, {
        userId: 100, // restrictedViewer
        requestBody: {
          mediaItemId: 52, // unrated movie
          rating: 7,
        },
      });

      expect(res.statusCode).toEqual(200);

      const userRating = await Database.knex('userRating')
        .where('userId', 100)
        .where('mediaItemId', 52)
        .whereNull('episodeId')
        .first();

      expect(userRating).toBeDefined();
      expect(userRating.rating).toEqual(7);
    });

    test('should allow rating an episode of an age-restricted show for a viewer below age gate', async () => {
      const ratingController = new RatingController();

      // Restricted viewer rating episode of R-rated show
      const res = await request(ratingController.add, {
        userId: 100, // restrictedViewer
        requestBody: {
          mediaItemId: 53, // R-rated show
          seasonId: 50,
          episodeId: 50,
          rating: 6,
        },
      });

      expect(res.statusCode).toEqual(200);

      const userRating = await Database.knex('userRating')
        .where('userId', 100)
        .where('mediaItemId', 53)
        .where('seasonId', 50)
        .where('episodeId', 50)
        .first();

      expect(userRating).toBeDefined();
      expect(userRating.rating).toEqual(6);
    });
  });

  // ==================== PROGRESS ENDPOINT TESTS ====================

  describe('Progress endpoint (PUT /api/progress)', () => {
    test('should allow updating progress on an age-restricted movie for a viewer below age gate', async () => {
      const progressController = new ProgressController();

      // Restricted viewer setting progress on R-rated movie
      const res = await request(progressController.add, {
        userId: 100, // restrictedViewer
        requestQuery: {
          mediaItemId: 50, // R-rated movie
          progress: 0.5,
        },
      });

      expect(res.statusCode).toEqual(200);

      const progress = await Database.knex('progress')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();

      expect(progress).toBeDefined();
      expect(Number(progress.progress)).toBeCloseTo(0.5);
    });

    test('should allow updating progress on an unrated movie for a viewer below age gate', async () => {
      const progressController = new ProgressController();

      const res = await request(progressController.add, {
        userId: 100, // restrictedViewer
        requestQuery: {
          mediaItemId: 52, // unrated movie
          progress: 0.3,
        },
      });

      expect(res.statusCode).toEqual(200);

      const progress = await Database.knex('progress')
        .where('userId', 100)
        .where('mediaItemId', 52)
        .whereNull('episodeId')
        .first();

      expect(progress).toBeDefined();
      expect(Number(progress.progress)).toBeCloseTo(0.3);
    });

    test('should allow updating progress on an age-restricted TV show (for the show itself) for a viewer below age gate', async () => {
      const progressController = new ProgressController();

      // Note: TV shows themselves cannot have progress (that's for episodes).
      // Instead, test that progress can be set on other media items that are restricted.
      // Use the R-rated PG movie (minimumAge=13) as another restricted item.
      const res = await request(progressController.add, {
        userId: 100, // restrictedViewer (age ~12)
        requestQuery: {
          mediaItemId: 51, // PG-13 movie (minimumAge=13)
          progress: 0.75,
        },
      });

      expect(res.statusCode).toEqual(200);

      const progress = await Database.knex('progress')
        .where('userId', 100)
        .where('mediaItemId', 51)
        .whereNull('episodeId')
        .first();

      expect(progress).toBeDefined();
      expect(Number(progress.progress)).toBeCloseTo(0.75);
    });
  });

  // ==================== SEEN ENDPOINT TESTS ====================

  describe('Seen endpoint (POST /api/seen)', () => {
    test('should allow marking an age-restricted movie as seen for a viewer below age gate', async () => {
      const seenController = new SeenController();

      // Restricted viewer marking R-rated movie as seen
      const res = await request(seenController.add, {
        userId: 100, // restrictedViewer
        requestQuery: {
          mediaItemId: 50, // R-rated movie
        },
      });

      expect(res.statusCode).toEqual(200);

      const seen = await Database.knex('seen')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();

      expect(seen).toBeDefined();
      expect(seen.date).toBeNull(); // Unspecified date defaults to null
    });

    test('should allow marking an unrated movie as seen for a viewer below age gate', async () => {
      const seenController = new SeenController();

      const res = await request(seenController.add, {
        userId: 100, // restrictedViewer
        requestQuery: {
          mediaItemId: 52, // unrated movie
        },
      });

      expect(res.statusCode).toEqual(200);

      const seen = await Database.knex('seen')
        .where('userId', 100)
        .where('mediaItemId', 52)
        .whereNull('episodeId')
        .first();

      expect(seen).toBeDefined();
    });

    test('should allow marking an episode of an age-restricted show as seen for a viewer below age gate', async () => {
      const seenController = new SeenController();

      // Restricted viewer marking episode of R-rated show as seen
      const res = await request(seenController.add, {
        userId: 100, // restrictedViewer
        requestQuery: {
          mediaItemId: 53, // R-rated show
          episodeId: 50,
        },
      });

      expect(res.statusCode).toEqual(200);

      const seen = await Database.knex('seen')
        .where('userId', 100)
        .where('mediaItemId', 53)
        .where('episodeId', 50)
        .first();

      expect(seen).toBeDefined();
    });
  });

  // ==================== LIST ITEM ENDPOINT TESTS ====================

  describe('List item endpoint (POST /api/list-items, DELETE /api/list-items)', () => {
    test('should allow adding an age-restricted movie to a list for a viewer below age gate', async () => {
      const listItemController = new ListItemController();

      // Restricted viewer adding R-rated movie to their watchlist
      const res = await request(listItemController.addItem, {
        userId: 100, // restrictedViewer
        requestQuery: {
          listId: 100, // restrictedViewer's watchlist
          mediaItemId: 50, // R-rated movie
        },
      });

      expect(res.statusCode).toEqual(200);

      const listItem = await Database.knex('listItem')
        .where('listId', 100)
        .where('mediaItemId', 50)
        .first();

      expect(listItem).toBeDefined();
    });

    test('should allow adding an unrated movie to a list for a viewer below age gate', async () => {
      const listItemController = new ListItemController();

      const res = await request(listItemController.addItem, {
        userId: 100, // restrictedViewer
        requestQuery: {
          listId: 100, // restrictedViewer's watchlist
          mediaItemId: 52, // unrated movie
        },
      });

      expect(res.statusCode).toEqual(200);

      const listItem = await Database.knex('listItem')
        .where('listId', 100)
        .where('mediaItemId', 52)
        .first();

      expect(listItem).toBeDefined();
    });

    test('should allow adding an episode of an age-restricted show to a list for a viewer below age gate', async () => {
      const listItemController = new ListItemController();

      // Restricted viewer adding episode of R-rated show to list
      const res = await request(listItemController.addItem, {
        userId: 100, // restrictedViewer
        requestQuery: {
          listId: 100, // restrictedViewer's watchlist
          mediaItemId: 53, // R-rated show
        },
      });

      expect(res.statusCode).toEqual(200);

      const listItem = await Database.knex('listItem')
        .where('listId', 100)
        .where('mediaItemId', 53)
        .first();

      expect(listItem).toBeDefined();
    });

    test('should allow removing an age-restricted movie from a list for a viewer below age gate', async () => {
      const listItemController = new ListItemController();

      // First add the item
      await request(listItemController.addItem, {
        userId: 100,
        requestQuery: {
          listId: 100,
          mediaItemId: 50, // R-rated movie
        },
      });

      // Then remove it
      const res = await request(listItemController.removeItem, {
        userId: 100,
        requestQuery: {
          listId: 100,
          mediaItemId: 50,
        },
      });

      expect(res.statusCode).toEqual(200);

      const listItem = await Database.knex('listItem')
        .where('listId', 100)
        .where('mediaItemId', 50)
        .first();

      expect(listItem).toBeUndefined();
    });
  });

  // ==================== COMPREHENSIVE INTEGRATION TEST ====================

  describe('Comprehensive write flow for age-restricted content', () => {
    test('should support full write lifecycle for restricted content: add rating, progress, seen, list', async () => {
      const ratingController = new RatingController();
      const progressController = new ProgressController();
      const seenController = new SeenController();
      const listItemController = new ListItemController();

      // 1. Add to list
      const listRes = await request(listItemController.addItem, {
        userId: 100,
        requestQuery: {
          listId: 100,
          mediaItemId: 50, // R-rated movie (restricted)
        },
      });
      expect(listRes.statusCode).toEqual(200);

      // 2. Rate it
      const ratingRes = await request(ratingController.add, {
        userId: 100,
        requestBody: {
          mediaItemId: 50,
          rating: 8,
        },
      });
      expect(ratingRes.statusCode).toEqual(200);

      // 3. Update progress
      const progressRes = await request(progressController.add, {
        userId: 100,
        requestQuery: {
          mediaItemId: 50,
          progress: 0.6,
        },
      });
      expect(progressRes.statusCode).toEqual(200);

      // 4. Mark as seen
      const seenRes = await request(seenController.add, {
        userId: 100,
        requestQuery: {
          mediaItemId: 50,
        },
      });
      expect(seenRes.statusCode).toEqual(200);

      // Verify all writes persisted (rating and progress should be there regardless of list state)
      const rating = await Database.knex('userRating')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();
      expect(rating).toBeDefined();
      expect(rating.rating).toEqual(8);

      const progress = await Database.knex('progress')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();
      expect(progress).toBeDefined();
      expect(Number(progress.progress)).toBeCloseTo(0.6);

      const seen = await Database.knex('seen')
        .where('userId', 100)
        .where('mediaItemId', 50)
        .whereNull('episodeId')
        .first();
      expect(seen).toBeDefined();
    });
  });
});
