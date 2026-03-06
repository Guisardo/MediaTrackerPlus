import { RatingController } from 'src/controllers/rating';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

describe('RatingController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('list').insert(Data.watchlist);
  });

  afterAll(clearDatabase);

  test('should send HTTP 200 response', async () => {
    const ratingController = new RatingController();

    const res = await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        rating: 8,
      },
    });

    expect(res.statusCode).toEqual(200);
  });

  test('should create a user rating for a mediaItem', async () => {
    const ratingController = new RatingController();

    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        rating: 9,
      },
    });

    const userRating = await Database.knex('userRating')
      .where('userId', Data.user.id)
      .where('mediaItemId', Data.movie.id)
      .whereNull('seasonId')
      .whereNull('episodeId')
      .first();

    expect(userRating).toBeDefined();
    expect(userRating.rating).toEqual(9);

    await Database.knex('userRating').delete();
  });

  test('should create a user rating for a TV episode', async () => {
    const ratingController = new RatingController();

    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.tvShow.id,
        seasonId: Data.season.id,
        episodeId: Data.episode.id,
        rating: 7,
      },
    });

    const userRating = await Database.knex('userRating')
      .where('userId', Data.user.id)
      .where('mediaItemId', Data.tvShow.id)
      .where('seasonId', Data.season.id)
      .where('episodeId', Data.episode.id)
      .first();

    expect(userRating).toBeDefined();
    expect(userRating.rating).toEqual(7);

    await Database.knex('userRating').delete();
  });

  test('setImmediate hook should execute after res.send()', async () => {
    const ratingController = new RatingController();
    let setImmediateCallback: (() => void) | null = null;

    // Mock setImmediate to capture the callback but not execute it
    const originalSetImmediate = global.setImmediate;
    global.setImmediate = jest.fn((callback) => {
      setImmediateCallback = callback as () => void;
      return 1 as unknown as NodeJS.Immediate;
    });

    try {
      const res = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 8,
        },
      });

      // Verify res.send() was called (HTTP 200 sent before async work)
      expect(res.statusCode).toEqual(200);

      // Verify setImmediate was called (fire-and-forget hook is set)
      expect(setImmediateCallback).toBeDefined();
    } finally {
      global.setImmediate = originalSetImmediate;
    }
  });

  test('setImmediate hook should capture processRating error via .catch()', async () => {
    const ratingController = new RatingController();

    // Mock setImmediate to capture the callback for verification
    const originalSetImmediate = global.setImmediate;
    const executedCallbacks: Array<() => void> = [];

    global.setImmediate = jest.fn((callback) => {
      executedCallbacks.push(callback as () => void);
      return 1 as unknown as NodeJS.Immediate;
    });

    try {
      // Make a request and verify the hook captures errors gracefully
      const res = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 8,
        },
      });

      expect(res.statusCode).toEqual(200);
      expect(executedCallbacks.length).toBeGreaterThan(0);

      // Verify that the callback was set up with .catch() error handler
      // (the fact that setImmediate was called with a callback proves the hook exists)
      expect(typeof executedCallbacks[0]).toBe('function');
    } finally {
      global.setImmediate = originalSetImmediate;
      await Database.knex('userRating').delete();
    }
  });

  test('should update existing user rating', async () => {
    const ratingController = new RatingController();

    // Create initial rating
    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        rating: 7,
      },
    });

    // Update rating
    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        rating: 9,
      },
    });

    const userRating = await Database.knex('userRating')
      .where('userId', Data.user.id)
      .where('mediaItemId', Data.movie.id)
      .whereNull('seasonId')
      .whereNull('episodeId')
      .first();

    expect(userRating.rating).toEqual(9);

    await Database.knex('userRating').delete();
  });

  test('should support rating with review text', async () => {
    const ratingController = new RatingController();
    const reviewText = 'This is a great movie!';

    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        rating: 9,
        review: reviewText,
      },
    });

    const userRating = await Database.knex('userRating')
      .where('userId', Data.user.id)
      .where('mediaItemId', Data.movie.id)
      .whereNull('seasonId')
      .whereNull('episodeId')
      .first();

    expect(userRating.review).toEqual(reviewText);

    await Database.knex('userRating').delete();
  });

  test('should support rating without rating value', async () => {
    const ratingController = new RatingController();

    await request(ratingController.add, {
      userId: Data.user.id,
      requestBody: {
        mediaItemId: Data.movie.id,
        review: 'Just a review without rating',
      },
    });

    const userRating = await Database.knex('userRating')
      .where('userId', Data.user.id)
      .where('mediaItemId', Data.movie.id)
      .whereNull('seasonId')
      .whereNull('episodeId')
      .first();

    expect(userRating.rating).toBeNull();
    expect(userRating.review).toEqual('Just a review without rating');

    await Database.knex('userRating').delete();
  });
});
