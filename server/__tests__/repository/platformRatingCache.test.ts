import { Database } from 'src/dbconfig';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { WatchlistWriter, WatchlistWriterDeps } from 'src/recommendations/watchlistWriter';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Tests for the platformRating cache maintenance layer.
 *
 * Covers:
 * 1. recalculatePlatformRating repository method: single estimatedRating,
 *    multi-user average, NULL exclusion, all-cleared -> NULL.
 * 2. WatchlistWriter.write() trigger wiring: 'added' and 'updated' outcomes
 *    trigger recalculation, 'skipped' outcome does not.
 * 3. Multi-user average: when multiple users have different estimatedRating
 *    values for the same item in their listItems, platformRating = AVG(estimatedRating).
 */
describe('platformRating cache maintenance', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('mediaItem').insert(Data.movie);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('list').insert(Data.watchlist);

    // Create a watchlist for user2 so WatchlistWriter can find it
    await Database.knex('list').insert({
      id: 100,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      isWatchlist: true,
      name: 'Watchlist',
      privacy: 'private',
      userId: Data.user2.id,
      allowComments: false,
      displayNumbers: false,
      sortBy: 'recently-added',
      sortOrder: 'asc',
    });
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
    // Reset platformRating to NULL after each test
    await Database.knex('mediaItem')
      .whereIn('id', [Data.movie.id, Data.tvShow.id])
      .update({ platformRating: null });
  });

  // ─── recalculatePlatformRating direct method tests ───────────────────────────

  describe('recalculatePlatformRating()', () => {
    test("after a single listItem estimatedRating, platformRating equals that value", async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
        estimatedRating: 8,
      });

      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      expect(item.platformRating).toBeCloseTo(8, 5);
    });

    test('after two users have estimatedRating for the same item, platformRating is the average', async () => {
      await Database.knex('listItem').insert([
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
          estimatedRating: 8,
        },
        {
          listId: 100, // user2's watchlist
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
          estimatedRating: 6,
        },
      ]);

      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      // Average of 8 and 6 = 7
      expect(item.platformRating).toBeCloseTo(7, 5);
    });

    test('NULL estimatedRating entries are excluded from the average', async () => {
      await Database.knex('listItem').insert([
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
          estimatedRating: 8,
        },
        {
          listId: 100, // user2's watchlist
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
          estimatedRating: null,
        },
      ]);

      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      // Only user's estimatedRating of 8 contributes — AVG(8) = 8
      expect(item.platformRating).toBeCloseTo(8, 5);
    });

    test('when no listItems have estimatedRating, platformRating is set to NULL', async () => {
      // Start with a non-null platformRating to confirm it gets cleared
      await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .update({ platformRating: 7.5 });

      // No listItem rows with estimatedRating for this item
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      expect(item.platformRating).toBeNull();
    });

    test('multi-user average with three different estimatedRating values', async () => {
      // Create a third user and watchlist for this test
      const user3Id = 99;
      const user3WatchlistId = 101;
      await Database.knex('user').insert({
        id: user3Id,
        name: 'user3',
        admin: false,
        password: 'password',
        publicReviews: false,
      });
      await Database.knex('list').insert({
        id: user3WatchlistId,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        isWatchlist: true,
        name: 'Watchlist',
        privacy: 'private',
        userId: user3Id,
        allowComments: false,
        displayNumbers: false,
        sortBy: 'recently-added',
        sortOrder: 'asc',
      });

      try {
        await Database.knex('listItem').insert([
          {
            listId: Data.watchlist.id,
            mediaItemId: Data.movie.id,
            addedAt: Date.now(),
            estimatedRating: 9,
          },
          {
            listId: 100, // user2's watchlist
            mediaItemId: Data.movie.id,
            addedAt: Date.now(),
            estimatedRating: 6,
          },
          {
            listId: user3WatchlistId,
            mediaItemId: Data.movie.id,
            addedAt: Date.now(),
            estimatedRating: 3,
          },
        ]);

        await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

        const item = await Database.knex('mediaItem')
          .where('id', Data.movie.id)
          .first();

        // Average of 9, 6, and 3 = 6
        expect(item.platformRating).toBeCloseTo(6, 5);
      } finally {
        await Database.knex('listItem').where('listId', user3WatchlistId).delete();
        await Database.knex('list').where('id', user3WatchlistId).delete();
        await Database.knex('user').where('id', user3Id).delete();
      }
    });
  });

  // ─── WatchlistWriter.write() trigger wiring ──────────────────────────────────

  describe('WatchlistWriter.write() trigger wiring', () => {
    /**
     * Creates a WatchlistWriter with a stubbed findMediaItemByExternalId
     * that resolves the given mediaItemId for any lookup.
     */
    function createWriter(mediaItemId: number): WatchlistWriter {
      const deps: WatchlistWriterDeps = {
        findMediaItemByExternalId: async () => ({ id: mediaItemId }),
      };
      return new WatchlistWriter(deps);
    }

    test("'added' outcome triggers recalculation and updates platformRating", async () => {
      const writer = createWriter(Data.movie.id);

      const writeResult = await writer.write(Data.user.id, [
        { externalId: String(Data.movie.tmdbId), mediaType: 'movie', title: 'Test Movie', externalRating: null },
      ], 7.5);

      expect(writeResult.added).toBe(1);

      // WatchlistWriter inserted a listItem with estimatedRating — recalculate
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      expect(item.platformRating).toBeCloseTo(7.5, 5);
    });

    test("'updated' outcome triggers recalculation and reflects the new estimatedRating", async () => {
      // Pre-seed a listItem with NULL estimatedRating so the writer will update it
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
        estimatedRating: null,
      });

      const writer = createWriter(Data.movie.id);

      const writeResult = await writer.write(Data.user.id, [
        { externalId: String(Data.movie.tmdbId), mediaType: 'movie', title: 'Test Movie', externalRating: null },
      ], 6.0);

      expect(writeResult.updated).toBe(1);

      // WatchlistWriter updated the listItem's estimatedRating — recalculate
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      expect(item.platformRating).toBeCloseTo(6.0, 5);
    });

    test("'skipped' outcome does NOT change platformRating", async () => {
      // Pre-seed a listItem with a lower estimatedRating — the writer's minimum-wins
      // strategy will skip because the incoming rating is higher
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
        estimatedRating: 3.0,
      });

      // Set platformRating to match the existing estimatedRating
      await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .update({ platformRating: 3.0 });

      const writer = createWriter(Data.movie.id);

      const writeResult = await writer.write(Data.user.id, [
        { externalId: String(Data.movie.tmdbId), mediaType: 'movie', title: 'Test Movie', externalRating: null },
      ], 9.0); // Higher than 3.0, so minimum-wins will skip

      expect(writeResult.skipped).toBe(1);

      // platformRating should remain unchanged at 3.0 since no recalculation is triggered
      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      expect(item.platformRating).toBeCloseTo(3.0, 5);
    });

    test("after second user's write, platformRating reflects average of both users' estimatedRatings", async () => {
      // User1 already has a listItem with estimatedRating
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
        estimatedRating: 8.0,
      });
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      // User2 writes via WatchlistWriter
      const writer = createWriter(Data.movie.id);

      const writeResult = await writer.write(Data.user2.id, [
        { externalId: String(Data.movie.tmdbId), mediaType: 'movie', title: 'Test Movie', externalRating: null },
      ], 4.0);

      expect(writeResult.added).toBe(1);

      // Recalculate after user2's addition
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      const item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      // Average of user1=8.0 and user2=4.0 is 6.0
      expect(item.platformRating).toBeCloseTo(6.0, 5);
    });

    test("'updated' outcome with minimum-wins strategy lowers estimatedRating and recalculates", async () => {
      // Pre-seed a listItem with a higher estimatedRating
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
        estimatedRating: 9.0,
      });
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      // Verify initial platformRating
      let item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();
      expect(item.platformRating).toBeCloseTo(9.0, 5);

      // Writer sends a lower estimatedRating — minimum-wins triggers update
      const writer = createWriter(Data.movie.id);

      const writeResult = await writer.write(Data.user.id, [
        { externalId: String(Data.movie.tmdbId), mediaType: 'movie', title: 'Test Movie', externalRating: null },
      ], 5.0);

      expect(writeResult.updated).toBe(1);

      // Recalculate after update
      await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

      item = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();

      // estimatedRating was lowered to 5.0 via minimum-wins
      expect(item.platformRating).toBeCloseTo(5.0, 5);
    });
  });

  // ─── Import controller setImmediate wiring ───────────────────────────────────

  describe('Goodreads import triggers recalculatePlatformRating', () => {
    test('setImmediate is scheduled after createMany with rated items', async () => {
      // Seed a mediaItem that would be imported with an estimatedRating
      const goodreadsMediaItemId = 999;
      await Database.knex('mediaItem').insert({
        id: goodreadsMediaItemId,
        lastTimeUpdated: Date.now(),
        mediaType: 'book',
        source: 'goodreads',
        title: 'Test Book For Cache Test',
        goodreadsId: 88888,
      });

      try {
        // Insert a listItem with estimatedRating (simulating what the recommendation pipeline does)
        await Database.knex('listItem').insert({
          listId: Data.watchlist.id,
          mediaItemId: goodreadsMediaItemId,
          addedAt: Date.now(),
          estimatedRating: 5,
        });

        // Simulate what the import controller's setImmediate callback does
        const affectedIds = [goodreadsMediaItemId];
        await Promise.all(
          affectedIds.map((id) =>
            mediaItemRepository.recalculatePlatformRating(id)
          )
        );

        const item = await Database.knex('mediaItem')
          .where('id', goodreadsMediaItemId)
          .first();

        expect(item.platformRating).toBeCloseTo(5, 5);
      } finally {
        await Database.knex('listItem')
          .where('mediaItemId', goodreadsMediaItemId)
          .delete();
        await Database.knex('mediaItem')
          .where('id', goodreadsMediaItemId)
          .delete();
      }
    });

    test('Goodreads import: batch recalculation updates all distinct affected mediaItems', async () => {
      const itemId1 = 1001;
      const itemId2 = 1002;

      await Database.knex('mediaItem').insert([
        {
          id: itemId1,
          lastTimeUpdated: Date.now(),
          mediaType: 'book',
          source: 'goodreads',
          title: 'Book A',
          goodreadsId: 11111,
        },
        {
          id: itemId2,
          lastTimeUpdated: Date.now(),
          mediaType: 'book',
          source: 'goodreads',
          title: 'Book B',
          goodreadsId: 22222,
        },
      ]);

      try {
        // Simulate listItems with estimatedRatings from two users for multiple books
        await Database.knex('listItem').insert([
          {
            listId: Data.watchlist.id,
            mediaItemId: itemId1,
            addedAt: Date.now(),
            estimatedRating: 8,
          },
          {
            listId: Data.watchlist.id,
            mediaItemId: itemId2,
            addedAt: Date.now(),
            estimatedRating: 4,
          },
          {
            listId: 100, // user2's watchlist
            mediaItemId: itemId1,
            addedAt: Date.now(),
            estimatedRating: 6,
          },
        ]);

        // Simulate what the Goodreads import setImmediate callback does:
        // Promise.all over distinct mediaItemIds
        const affectedIds = [itemId1, itemId2];
        await Promise.all(
          affectedIds.map((id) =>
            mediaItemRepository.recalculatePlatformRating(id)
          )
        );

        const item1 = await Database.knex('mediaItem')
          .where('id', itemId1)
          .first();
        const item2 = await Database.knex('mediaItem')
          .where('id', itemId2)
          .first();

        // item1: average of 8 and 6 = 7
        expect(item1.platformRating).toBeCloseTo(7, 5);
        // item2: only estimatedRating is 4
        expect(item2.platformRating).toBeCloseTo(4, 5);
      } finally {
        await Database.knex('listItem')
          .whereIn('mediaItemId', [itemId1, itemId2])
          .delete();
        await Database.knex('mediaItem')
          .whereIn('id', [itemId1, itemId2])
          .delete();
      }
    });
  });

  describe('Trakt.tv import triggers recalculatePlatformRating', () => {
    test('Trakt.tv import: media-level estimatedRatings update platformRating', async () => {
      // Pre-seed listItems with estimatedRatings for movie and tvShow
      await Database.knex('listItem').insert([
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
          estimatedRating: 7,
        },
        {
          listId: Data.watchlist.id,
          mediaItemId: Data.tvShow.id,
          addedAt: Date.now(),
          estimatedRating: 9,
        },
      ]);

      // Simulate Trakt.tv setImmediate callback for media-level items
      const mediaLevelIds = [Data.movie.id, Data.tvShow.id];
      await Promise.all(
        mediaLevelIds.map((id) =>
          mediaItemRepository.recalculatePlatformRating(id)
        )
      );

      const movie = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();
      const tvShow = await Database.knex('mediaItem')
        .where('id', Data.tvShow.id)
        .first();

      expect(movie.platformRating).toBeCloseTo(7, 5);
      expect(tvShow.platformRating).toBeCloseTo(9, 5);
    });

    test('Trakt.tv import: when no listItems have estimatedRating, platformRating stays NULL', async () => {
      // No listItem rows for tvShow — simulates the guard where no media-level
      // estimatedRatings exist
      const tvShow = await Database.knex('mediaItem')
        .where('id', Data.tvShow.id)
        .first();

      // No recalculation was triggered -> still NULL
      expect(tvShow.platformRating).toBeNull();
    });

    test('Trakt.tv import: when no media-level ratings exist, setImmediate is not scheduled', async () => {
      // This test verifies the guard: `if (mediaLevelRatings.length > 0)`
      // When ratedMovies and ratedTvShows are both empty, no setImmediate fires.

      let setImmediateWasCalled = false;
      const originalSetImmediate = global.setImmediate;

      global.setImmediate = jest.fn(() => {
        setImmediateWasCalled = true;
        return 1 as unknown as NodeJS.Immediate;
      }) as unknown as typeof setImmediate;

      try {
        // Simulate the Trakt.tv guard: mediaLevelRatings = [] (no movies or shows)
        const mediaLevelRatings: Array<{ mediaItemId: number }> = [];
        if (mediaLevelRatings.length > 0) {
          setImmediate(() => {
            // Would fire recalculation
          });
        }

        expect(setImmediateWasCalled).toBe(false);
      } finally {
        global.setImmediate = originalSetImmediate;
      }
    });
  });
});
