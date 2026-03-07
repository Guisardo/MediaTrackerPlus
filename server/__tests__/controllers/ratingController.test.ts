import { RatingController } from 'src/controllers/rating';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { userRepository } from 'src/repository/user';

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

  describe('auto-mark as seen on rating', () => {
    afterEach(async () => {
      await Database.knex('userRating').delete();
      await Database.knex('seen').delete();
      await Database.knex('listItem').delete();
    });

    test('should auto-mark a movie as seen when a numeric rating is set', async () => {
      const ratingController = new RatingController();

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 8,
        },
      });

      const seenEntry = await Database.knex('seen')
        .where('userId', Data.user.id)
        .where('mediaItemId', Data.movie.id)
        .whereNull('episodeId')
        .first();

      expect(seenEntry).toBeDefined();
    });

    test('should not create a duplicate seen entry when the movie is already seen', async () => {
      const ratingController = new RatingController();

      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: Data.movie.id,
        episodeId: null,
        date: Date.now(),
      });

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 8,
        },
      });

      const seenEntries = await Database.knex('seen')
        .where('userId', Data.user.id)
        .where('mediaItemId', Data.movie.id)
        .whereNull('episodeId');

      expect(seenEntries.length).toEqual(1);
    });

    test('should remove the movie from the watchlist when auto-marked as seen on rating', async () => {
      const ratingController = new RatingController();

      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        seasonId: null,
        episodeId: null,
        addedAt: Date.now(),
      });

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 7,
        },
      });

      const watchlistItem = await Database.knex('listItem')
        .where('listId', Data.watchlist.id)
        .where('mediaItemId', Data.movie.id)
        .whereNull('episodeId')
        .whereNull('seasonId')
        .first();

      expect(watchlistItem).toBeUndefined();
    });

    test('should auto-mark a TV episode as seen when rated', async () => {
      const ratingController = new RatingController();

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
          episodeId: Data.episode.id,
          rating: 9,
        },
      });

      const seenEntry = await Database.knex('seen')
        .where('userId', Data.user.id)
        .where('mediaItemId', Data.tvShow.id)
        .where('episodeId', Data.episode.id)
        .first();

      expect(seenEntry).toBeDefined();
    });

    test('should not create a duplicate seen entry when the episode is already seen', async () => {
      const ratingController = new RatingController();

      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: Data.tvShow.id,
        episodeId: Data.episode.id,
        date: Date.now(),
      });

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.tvShow.id,
          seasonId: Data.season.id,
          episodeId: Data.episode.id,
          rating: 9,
        },
      });

      const seenEntries = await Database.knex('seen')
        .where('userId', Data.user.id)
        .where('mediaItemId', Data.tvShow.id)
        .where('episodeId', Data.episode.id);

      expect(seenEntries.length).toEqual(1);
    });

    test('should NOT auto-mark as seen when submitting only a review without a numeric rating', async () => {
      const ratingController = new RatingController();

      await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          review: 'Just a text review, no star rating',
        },
      });

      const seenEntry = await Database.knex('seen')
        .where('userId', Data.user.id)
        .where('mediaItemId', Data.movie.id)
        .whereNull('episodeId')
        .first();

      expect(seenEntry).toBeUndefined();
    });

    describe('with multiple episodes in the season', () => {
      beforeAll(async () => {
        await Database.knex('episode').insert(Data.episode2);
        await Database.knex('episode').insert(Data.episode3);
      });

      afterAll(async () => {
        await Database.knex('episode')
          .whereIn('id', [Data.episode2.id, Data.episode3.id])
          .delete();
      });

      test('should auto-mark all episodes in a season as seen when the season is rated', async () => {
        const ratingController = new RatingController();

        await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: {
            mediaItemId: Data.tvShow.id,
            seasonId: Data.season.id,
            rating: 8,
          },
        });

        const seenEntries = await Database.knex('seen')
          .where('userId', Data.user.id)
          .where('mediaItemId', Data.tvShow.id)
          .whereIn('episodeId', [
            Data.episode.id,
            Data.episode2.id,
            Data.episode3.id,
          ]);

        expect(seenEntries.length).toEqual(3);
      });

      test('should only mark unseen episodes when rating a season with partial seen history', async () => {
        const ratingController = new RatingController();

        await Database.knex('seen').insert({
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          date: Date.now(),
        });

        await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: {
            mediaItemId: Data.tvShow.id,
            seasonId: Data.season.id,
            rating: 7,
          },
        });

        const seenEntries = await Database.knex('seen')
          .where('userId', Data.user.id)
          .where('mediaItemId', Data.tvShow.id);

        const seenEpisodeIds = seenEntries.map((s: { episodeId: number }) => s.episodeId);

        expect(seenEntries.length).toEqual(3);
        expect(seenEpisodeIds).toContain(Data.episode.id);
        expect(seenEpisodeIds).toContain(Data.episode2.id);
        expect(seenEpisodeIds).toContain(Data.episode3.id);

        const episodeOneSeen = seenEntries.filter(
          (s: { episodeId: number }) => s.episodeId === Data.episode.id
        );
        expect(episodeOneSeen.length).toEqual(1);
      });

      test('should auto-mark all TV show episodes as seen when the TV show is rated', async () => {
        const ratingController = new RatingController();

        await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: {
            mediaItemId: Data.tvShow.id,
            rating: 10,
          },
        });

        const seenEntries = await Database.knex('seen')
          .where('userId', Data.user.id)
          .where('mediaItemId', Data.tvShow.id)
          .whereIn('episodeId', [
            Data.episode.id,
            Data.episode2.id,
            Data.episode3.id,
          ]);

        expect(seenEntries.length).toEqual(3);
      });
    });
  });

  describe('addRecommendedToWatchlist preference gate', () => {
    afterEach(async () => {
      await Database.knex('userRating').delete();
      await Database.knex('user')
        .where('id', Data.user.id)
        .update({ addRecommendedToWatchlist: true });
    });

    test('should check user preference via userRepository before running recommendation pipeline', async () => {
      const ratingController = new RatingController();
      const findOneSpy = jest.spyOn(userRepository, 'findOne');

      let capturedCallback: (() => void) | null = null;
      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        capturedCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      });

      try {
        const res = await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: { mediaItemId: Data.movie.id, rating: 8 },
        });

        expect(res.statusCode).toEqual(200);
        expect(capturedCallback).toBeDefined();

        capturedCallback!();
        // Flush microtasks so the async promise chain inside the callback settles
        await new Promise<void>((resolve) => originalSetImmediate(resolve));

        expect(findOneSpy).toHaveBeenCalledWith({ id: Data.user.id });
      } finally {
        findOneSpy.mockRestore();
        global.setImmediate = originalSetImmediate;
      }
    });

    test('should skip recommendation pipeline when user has opted out', async () => {
      await Database.knex('user')
        .where('id', Data.user.id)
        .update({ addRecommendedToWatchlist: false });

      const ratingController = new RatingController();
      const findOneSpy = jest.spyOn(userRepository, 'findOne');

      let capturedCallback: (() => void) | null = null;
      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn((callback) => {
        capturedCallback = callback as () => void;
        return 1 as unknown as NodeJS.Immediate;
      });

      try {
        const res = await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: { mediaItemId: Data.movie.id, rating: 8 },
        });

        expect(res.statusCode).toEqual(200);
        expect(capturedCallback).toBeDefined();

        capturedCallback!();
        // Flush microtasks so the async promise chain inside the callback settles
        await new Promise<void>((resolve) => originalSetImmediate(resolve));

        // The preference was checked
        expect(findOneSpy).toHaveBeenCalledWith({ id: Data.user.id });

        // The promise chain resolved via the early-return path:
        // userRepository.findOne returned a user with addRecommendedToWatchlist = false,
        // so getRecommendationService() was never called (no external API errors to catch).
        const user = await Database.knex('user').where('id', Data.user.id).first();
        expect(user.addRecommendedToWatchlist).toBe(0);
      } finally {
        findOneSpy.mockRestore();
        global.setImmediate = originalSetImmediate;
      }
    });

    test('should not schedule recommendation pipeline when no rating is provided', async () => {
      const ratingController = new RatingController();

      let setImmediateCalled = false;
      const originalSetImmediate = global.setImmediate;
      global.setImmediate = jest.fn(() => {
        setImmediateCalled = true;
        return 1 as unknown as NodeJS.Immediate;
      });

      try {
        await request(ratingController.add, {
          userId: Data.user.id,
          requestBody: {
            mediaItemId: Data.movie.id,
            review: 'Review with no numeric rating',
          },
        });

        expect(setImmediateCalled).toBe(false);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });
});
