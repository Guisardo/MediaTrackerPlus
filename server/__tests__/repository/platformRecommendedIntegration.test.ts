import { RatingController } from 'src/controllers/rating';
import { Database } from 'src/dbconfig';
import { listRepository } from 'src/repository/list';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Integration tests for the Platform Recommended Sort feature (US-010).
 *
 * These tests verify the complete data flow across multiple components:
 *   rating write → platformRating cache update → sort query → correct ordering
 *
 * Covers:
 * 1. Single user rates item → cache updates → sort reflects score
 * 2. Multiple users rate same item → average → sort uses correct average
 * 3. Rating cleared via null → cache recalculates → sort order updates
 * 4. Items with no platform ratings sort below all rated items regardless of tmdbRating
 * 5. Newly created list defaults to platform-recommended sort
 * 6. Client-side sort function produces same ordering as server-side for identical data
 */

// ---------------------------------------------------------------------------
// Helper: execute all captured setImmediate callbacks and flush microtasks
// ---------------------------------------------------------------------------

async function executeSetImmediateCallbacks(
  capturedCallbacks: Array<() => void>,
  originalSetImmediate: typeof setImmediate
): Promise<void> {
  for (const cb of capturedCallbacks) {
    cb();
  }
  await new Promise<void>((resolve) => originalSetImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Helper: mock setImmediate to capture callbacks
// ---------------------------------------------------------------------------

function mockSetImmediate(): {
  capturedCallbacks: Array<() => void>;
  originalSetImmediate: typeof setImmediate;
} {
  const capturedCallbacks: Array<() => void> = [];
  const originalSetImmediate = global.setImmediate;

  global.setImmediate = jest.fn((callback) => {
    capturedCallbacks.push(callback as () => void);
    return 1 as unknown as NodeJS.Immediate;
  }) as unknown as typeof setImmediate;

  return { capturedCallbacks, originalSetImmediate };
}

// ---------------------------------------------------------------------------
// Helper: client-side score computation (mirrors client/src/hooks/sortedList.ts)
// ---------------------------------------------------------------------------

function clientComputeScore(
  platformRating: number | null | undefined,
  tmdbRating: number | null | undefined
): number | undefined {
  if (platformRating == null) {
    return undefined;
  }
  if (tmdbRating != null) {
    return platformRating * 0.7 + tmdbRating * 0.3;
  }
  return platformRating;
}

type ClientItem = {
  platformRating?: number | null;
  tmdbRating?: number | null;
  title: string;
};

function clientSortByPlatformRecommended(items: ClientItem[]): ClientItem[] {
  return [...items].sort((a, b) => {
    // Tier 1: items with platformRating (real community ratings) sort before
    // Tier 2: items without platformRating (unrated on this platform).
    const tierA = a.platformRating != null ? 0 : 1;
    const tierB = b.platformRating != null ? 0 : 1;

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Tier 1: rank by 70/30 blend (clientComputeScore returns a number).
    // Tier 2: rank by tmdbRating descending; null tmdbRating sorts last.
    if (tierA === 0) {
      const scoreA = clientComputeScore(a.platformRating, a.tmdbRating)!;
      const scoreB = clientComputeScore(b.platformRating, b.tmdbRating)!;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.title.localeCompare(b.title);
    }

    // Tier 2 — clientComputeScore returns undefined; sort by tmdbRating directly.
    const tmdbA = a.tmdbRating ?? undefined;
    const tmdbB = b.tmdbRating ?? undefined;
    if (tmdbA == null && tmdbB == null) return a.title.localeCompare(b.title);
    if (tmdbA == null) return 1;
    if (tmdbB == null) return -1;
    if (tmdbB !== tmdbA) return tmdbB - tmdbA;
    return a.title.localeCompare(b.title);
  });
}

// ===========================================================================
// Integration test: rating write → cache update → sort query → correct order
// ===========================================================================

describe('Platform Recommended Sort — end-to-end integration', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('mediaItem').insert({
      ...Data.movie,
      tmdbRating: 7.0,
    });
    await Database.knex('mediaItem').insert({
      ...Data.tvShow,
      tmdbRating: 8.0,
    });
    await Database.knex('mediaItem').insert(Data.videoGame);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('list').insert(Data.watchlist);
    // Add all media items to the watchlist
    await Database.knex('listItem').insert([
      {
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
      },
      {
        listId: Data.watchlist.id,
        mediaItemId: Data.tvShow.id,
        addedAt: Date.now(),
      },
      {
        listId: Data.watchlist.id,
        mediaItemId: Data.videoGame.id,
        addedAt: Date.now(),
      },
    ]);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('userRating').delete();
    await Database.knex('seen').delete();
    await Database.knex('mediaItem')
      .whereIn('id', [Data.movie.id, Data.tvShow.id, Data.videoGame.id])
      .update({ platformRating: null });
    await Database.knex('listItem')
      .whereIn('mediaItemId', [Data.movie.id, Data.tvShow.id, Data.videoGame.id])
      .update({ estimatedRating: null });

    // autoMarkAsSeen removes non-TV items from the watchlist when they are rated.
    // Re-insert any listItems that were deleted so each test starts with a full set.
    const existingListItems = await Database.knex('listItem')
      .whereIn('mediaItemId', [Data.movie.id, Data.tvShow.id, Data.videoGame.id])
      .whereNull('seasonId')
      .whereNull('episodeId')
      .where('listId', Data.watchlist.id)
      .select('mediaItemId');
    const existingMediaItemIds = new Set(
      existingListItems.map((row) => row.mediaItemId)
    );
    const allMediaItemIds = [Data.movie.id, Data.tvShow.id, Data.videoGame.id];
    const toRestore = allMediaItemIds
      .filter((id) => !existingMediaItemIds.has(id))
      .map((id) => ({
        listId: Data.watchlist.id,
        mediaItemId: id,
        addedAt: Date.now(),
      }));
    if (toRestore.length > 0) {
      await Database.knex('listItem').insert(toRestore);
    }
  });

  // ─── Test 1: user rates item → cache updates → sort reflects the new score ──

  test('user rates item via controller, platformRating cache updates, platform-recommended sort reflects the new score correctly', async () => {
    const ratingController = new RatingController();
    const { capturedCallbacks, originalSetImmediate } = mockSetImmediate();

    try {
      // User rates the movie with an 8
      const res = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 8,
        },
      });

      expect(res.statusCode).toEqual(200);

      // Execute setImmediate callbacks to trigger cache update
      await executeSetImmediateCallbacks(
        capturedCallbacks,
        originalSetImmediate
      );

      // Verify platformRating was updated in the database
      const movieRow = await Database.knex('mediaItem')
        .where('id', Data.movie.id)
        .first();
      expect(movieRow.platformRating).toBeCloseTo(8, 5);

      // autoMarkAsSeen marks the movie as seen and removes it from the watchlist.
      // Clear those side effects before querying platform-recommended results so the
      // test focuses on sort order (not the seen/watchlist removal behaviour).
      await Database.knex('seen').delete();
      const movieListItem = await Database.knex('listItem')
        .where({ listId: Data.watchlist.id, mediaItemId: Data.movie.id })
        .whereNull('seasonId')
        .whereNull('episodeId')
        .first();
      if (!movieListItem) {
        await Database.knex('listItem').insert({
          listId: Data.watchlist.id,
          mediaItemId: Data.movie.id,
          addedAt: Date.now(),
        });
      }

      // Now query items with platform-recommended sort
      const items = await mediaItemRepository.items({
        userId: Data.user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      // Movie (platformRating=8, tmdbRating=7) → score = 8*0.7 + 7*0.3 = 7.7
      // TvShow (platformRating=null) and VideoGame (platformRating=null) → sort to bottom
      expect(items[0].title).toBe('movie');
      expect(items[0].platformRating).toBeCloseTo(8, 5);

      // The null-platformRating items (tier 2) should come after, sorted by tmdbRating descending
      const nullItems = items.slice(1);
      expect(nullItems.every((i) => !i.platformRating)).toBe(true);
    } finally {
      global.setImmediate = originalSetImmediate;
    }
  });

  // ─── Test 2: multiple users rate same item → sort uses correct average ───────

  test('multiple users rate same item, sort uses correct average across all users', async () => {
    const ratingController = new RatingController();

    // User 1 rates the movie
    const mock1 = mockSetImmediate();
    try {
      const res1 = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 6,
        },
      });
      expect(res1.statusCode).toEqual(200);
      await executeSetImmediateCallbacks(
        mock1.capturedCallbacks,
        mock1.originalSetImmediate
      );
    } finally {
      global.setImmediate = mock1.originalSetImmediate;
    }

    // User 2 rates the same movie
    const mock2 = mockSetImmediate();
    try {
      const res2 = await request(ratingController.add, {
        userId: Data.user2.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 10,
        },
      });
      expect(res2.statusCode).toEqual(200);
      await executeSetImmediateCallbacks(
        mock2.capturedCallbacks,
        mock2.originalSetImmediate
      );
    } finally {
      global.setImmediate = mock2.originalSetImmediate;
    }

    // Verify the average is (6 + 10) / 2 = 8
    const movieRow = await Database.knex('mediaItem')
      .where('id', Data.movie.id)
      .first();
    expect(movieRow.platformRating).toBeCloseTo(8, 5);

    // Also rate the tvShow so we can test ordering of two rated items
    const mock3 = mockSetImmediate();
    try {
      const res3 = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.tvShow.id,
          rating: 5,
        },
      });
      expect(res3.statusCode).toEqual(200);
      await executeSetImmediateCallbacks(
        mock3.capturedCallbacks,
        mock3.originalSetImmediate
      );
    } finally {
      global.setImmediate = mock3.originalSetImmediate;
    }

    // autoMarkAsSeen marks rated items as seen and removes non-TV items from the
    // watchlist. Clear those side effects before querying platform-recommended results
    // so the test focuses on sort order driven by platformRating, not seen-state filtering.
    await Database.knex('seen').delete();
    const movieListItemAfterRating = await Database.knex('listItem')
      .where({ listId: Data.watchlist.id, mediaItemId: Data.movie.id })
      .whereNull('seasonId')
      .whereNull('episodeId')
      .first();
    if (!movieListItemAfterRating) {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
      });
    }

    // Query items sorted by platform-recommended
    const items = await mediaItemRepository.items({
      userId: Data.user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Movie: platformRating=8, tmdbRating=7 → score = 8*0.7 + 7*0.3 = 7.7
    // TvShow: platformRating=5, tmdbRating=8 → score = 5*0.7 + 8*0.3 = 5.9
    // VideoGame: platformRating=null → sorts last
    expect(items[0].title).toBe('movie');
    expect(items[1].title).toBe('title'); // tvShow title is 'title'
    expect(items[2].title).toBe('video_game');
  });

  // ─── Test 3: rating cleared → cache recalculates → sort order updates ────────

  test('rating cleared via null write, platformRating recalculates, sort order updates accordingly', async () => {
    const ratingController = new RatingController();

    // Both users rate the movie
    await Database.knex('userRating').insert([
      {
        mediaItemId: Data.movie.id,
        userId: Data.user.id,
        rating: 9,
        date: Date.now(),
        seasonId: null,
        episodeId: null,
      },
      {
        mediaItemId: Data.movie.id,
        userId: Data.user2.id,
        rating: 5,
        date: Date.now(),
        seasonId: null,
        episodeId: null,
      },
    ]);
    await mediaItemRepository.recalculatePlatformRating(Data.movie.id);

    // Verify initial state: (9 + 5) / 2 = 7
    let movieRow = await Database.knex('mediaItem')
      .where('id', Data.movie.id)
      .first();
    expect(movieRow.platformRating).toBeCloseTo(7, 5);

    // User 2 clears their rating via the controller
    const { capturedCallbacks, originalSetImmediate } = mockSetImmediate();
    try {
      const res = await request(ratingController.add, {
        userId: Data.user2.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: null,
        },
      });
      expect(res.statusCode).toEqual(200);
      await executeSetImmediateCallbacks(
        capturedCallbacks,
        originalSetImmediate
      );
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    // After clear: only user1's rating of 9 remains → platformRating = 9
    movieRow = await Database.knex('mediaItem')
      .where('id', Data.movie.id)
      .first();
    expect(movieRow.platformRating).toBeCloseTo(9, 5);

    // Verify sort reflects updated score
    const items = await mediaItemRepository.items({
      userId: Data.user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Movie now has platformRating=9, tmdbRating=7 → score = 9*0.7 + 7*0.3 = 8.4
    expect(items[0].title).toBe('movie');
    expect(items[0].platformRating).toBeCloseTo(9, 5);
  });

  // ─── Test 4: items with no platform ratings sort below rated items ───────────

  test('items with no platform ratings sort below all rated items regardless of external tmdbRating', async () => {
    // Ensure no seen entries exist — previous tests may have triggered autoMarkAsSeen
    // via ratingController.add, which would exclude items from the platformSeen filter.
    await Database.knex('seen').delete();

    // Set estimatedRating on the video game's listItem — this is the correct mechanism
    // for populating platformRating (recalculatePlatformRating reads listItem.estimatedRating,
    // not userRating.rating, which belongs to the user-explicit rating pipeline).
    await Database.knex('listItem')
      .where({ mediaItemId: Data.videoGame.id, listId: Data.watchlist.id })
      .update({ estimatedRating: 3 });
    await mediaItemRepository.recalculatePlatformRating(Data.videoGame.id);

    // Video game now has platformRating=3, no tmdbRating → tier 1
    // Movie has no platformRating but tmdbRating=7 → tier 2
    // TvShow has no platformRating but tmdbRating=8 → tier 2
    const items = await mediaItemRepository.items({
      userId: Data.user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Video game (tier 1, platformRating=3) must sort ABOVE movie and tvShow despite
    // their higher tmdbRatings — tier-1 items always precede tier-2 items.
    expect(items[0].title).toBe('video_game');

    // Tier-2 items sort by tmdbRating descending: TvShow (8.0) > Movie (7.0)
    const tier2Items = items.slice(1);
    expect(tier2Items.every((i) => !i.platformRating)).toBe(true);
    expect(tier2Items[0].title).toBe('title'); // tvShow: tmdbRating=8.0
    expect(tier2Items[1].title).toBe('movie'); // movie: tmdbRating=7.0
  });
});

// ===========================================================================
// Integration test: new list defaults to platform-recommended sort
// ===========================================================================

describe('Platform Recommended Sort — new list default', () => {
  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(Data.user);
  });

  afterAll(clearDatabase);

  test('newly created list defaults to platform-recommended sort', async () => {
    const newList = await listRepository.create({
      userId: Data.user.id,
      name: 'My New List',
    });

    expect(newList).toBeDefined();
    expect(newList!.sortBy).toBe('platform-recommended');
  });

  test('newly created list can override default sort', async () => {
    const newList = await listRepository.create({
      userId: Data.user.id,
      name: 'Custom Sort List',
      sortBy: 'recently-added',
    });

    expect(newList).toBeDefined();
    expect(newList!.sortBy).toBe('recently-added');
  });
});

// ===========================================================================
// Integration test: client-side sort matches server-side for identical data
// ===========================================================================

describe('Platform Recommended Sort — client/server consistency', () => {
  const user = {
    id: 1,
    name: 'consistencyUser',
    password: 'password',
  };

  const watchlist = {
    id: 1,
    userId: user.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // Five items with varied platformRating/tmdbRating combinations
  const itemA = {
    id: 1,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Alpha',
    platformRating: 9.0,
    tmdbRating: 6.0,
    // score = 9*0.7 + 6*0.3 = 6.3 + 1.8 = 8.1
  };

  const itemB = {
    id: 2,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Beta',
    platformRating: 7.0,
    tmdbRating: 9.0,
    // score = 7*0.7 + 9*0.3 = 4.9 + 2.7 = 7.6
  };

  const itemC = {
    id: 3,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Charlie',
    platformRating: 5.0,
    // score = 5.0 (no tmdbRating)
  };

  const itemD = {
    id: 4,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Delta',
    tmdbRating: 10.0,
    // platformRating=null → sorts last regardless of high tmdbRating
  };

  const itemE = {
    id: 5,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Echo',
    // both null → sorts last, alphabetical
  };

  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(user);
    await Database.knex('mediaItem').insert([
      itemA,
      itemB,
      itemC,
      itemD,
      itemE,
    ]);
    await Database.knex('list').insert(watchlist);
    await Database.knex('listItem').insert([
      { listId: watchlist.id, mediaItemId: itemA.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: itemB.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: itemC.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: itemD.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: itemE.id, addedAt: Date.now() },
    ]);
  });

  afterAll(clearDatabase);

  test('client-side sort produces same title ordering as server-side SQL sort for identical data', async () => {
    // --- Server-side: query items with platformRecommended SQL sort ---
    const serverItems = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    const serverOrder = serverItems.map((i) => i.title);

    // --- Client-side: sort the same data using the client algorithm ---
    const clientData: ClientItem[] = [
      {
        platformRating: itemA.platformRating,
        tmdbRating: itemA.tmdbRating,
        title: itemA.title,
      },
      {
        platformRating: itemB.platformRating,
        tmdbRating: itemB.tmdbRating,
        title: itemB.title,
      },
      {
        platformRating: itemC.platformRating ?? null,
        tmdbRating: undefined,
        title: itemC.title,
      },
      {
        platformRating: null,
        tmdbRating: itemD.tmdbRating,
        title: itemD.title,
      },
      { platformRating: null, tmdbRating: null, title: itemE.title },
    ];

    const clientSorted = clientSortByPlatformRecommended(clientData);
    const clientOrder = clientSorted.map((i) => i.title);

    // Expected order:
    // 1. Alpha (score 8.1)
    // 2. Beta  (score 7.6)
    // 3. Charlie (score 5.0)
    // 4. Delta (null platformRating → last, alphabetically)
    // 5. Echo  (null platformRating → last, alphabetically)
    expect(serverOrder).toEqual(clientOrder);
    expect(serverOrder).toEqual([
      'Alpha',
      'Beta',
      'Charlie',
      'Delta',
      'Echo',
    ]);
  });

  test('client and server agree on ordering when sortOrder is asc (score-based sorts ignore direction)', async () => {
    // Server with sortOrder='asc'
    const serverItems = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'asc',
    });

    const serverOrderAsc = serverItems.map((i) => i.title);

    // Client-side sort (always descending for score-based)
    const clientData: ClientItem[] = [
      {
        platformRating: itemA.platformRating,
        tmdbRating: itemA.tmdbRating,
        title: itemA.title,
      },
      {
        platformRating: itemB.platformRating,
        tmdbRating: itemB.tmdbRating,
        title: itemB.title,
      },
      {
        platformRating: itemC.platformRating ?? null,
        tmdbRating: undefined,
        title: itemC.title,
      },
      {
        platformRating: null,
        tmdbRating: itemD.tmdbRating,
        title: itemD.title,
      },
      { platformRating: null, tmdbRating: null, title: itemE.title },
    ];

    const clientSorted = clientSortByPlatformRecommended(clientData);
    const clientOrder = clientSorted.map((i) => i.title);

    // Both should produce the same descending-score order
    expect(serverOrderAsc).toEqual(clientOrder);
  });

  test('client and server scores match numerically for items with both ratings', async () => {
    const serverItems = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Alpha: server should expose platformRating=9.0
    const alpha = serverItems.find((i) => i.title === 'Alpha');
    expect(alpha?.platformRating).toBe(9.0);

    // Compute client score for Alpha and verify it matches the expected value
    const clientScoreAlpha = clientComputeScore(9.0, 6.0);
    // 9.0 * 0.7 + 6.0 * 0.3 = 6.3 + 1.8 = 8.1
    expect(clientScoreAlpha).toBeCloseTo(8.1, 10);

    // Beta: server should expose platformRating=7.0
    const beta = serverItems.find((i) => i.title === 'Beta');
    expect(beta?.platformRating).toBe(7.0);

    const clientScoreBeta = clientComputeScore(7.0, 9.0);
    // 7.0 * 0.7 + 9.0 * 0.3 = 4.9 + 2.7 = 7.6
    expect(clientScoreBeta).toBeCloseTo(7.6, 10);

    // Verify ordering is consistent: Alpha > Beta
    expect(clientScoreAlpha!).toBeGreaterThan(clientScoreBeta!);
  });

  test('client and server agree that null-platformRating items sort below scored items regardless of tmdbRating', async () => {
    const serverItems = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Delta has tmdbRating=10.0 but null platformRating
    // Charlie has platformRating=5.0 (no tmdbRating)
    const deltaIndex = serverItems.findIndex((i) => i.title === 'Delta');
    const charlieIndex = serverItems.findIndex((i) => i.title === 'Charlie');

    // Charlie (scored) must sort before Delta (null platformRating)
    expect(charlieIndex).toBeLessThan(deltaIndex);

    // Verify client-side agrees
    const clientScoreCharlie = clientComputeScore(5.0, undefined);
    const clientScoreDelta = clientComputeScore(null, 10.0);
    expect(clientScoreCharlie).toBe(5.0);
    expect(clientScoreDelta).toBeUndefined();
  });
});

// ===========================================================================
// Integration test: full cycle — rating → recalculate → list sort via listRepository
// ===========================================================================

describe('Platform Recommended Sort — listRepository.items() integration', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
    await Database.knex('mediaItem').insert({
      ...Data.movie,
      tmdbRating: 7.0,
    });
    await Database.knex('mediaItem').insert({
      ...Data.tvShow,
      tmdbRating: 8.0,
    });
    await Database.knex('mediaItem').insert(Data.videoGame);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('list').insert(Data.list);
    // Add items to the custom list
    await Database.knex('listItem').insert([
      {
        listId: Data.list.id,
        mediaItemId: Data.movie.id,
        addedAt: Date.now(),
      },
      {
        listId: Data.list.id,
        mediaItemId: Data.tvShow.id,
        addedAt: Date.now(),
      },
      {
        listId: Data.list.id,
        mediaItemId: Data.videoGame.id,
        addedAt: Date.now(),
      },
    ]);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('userRating').delete();
    await Database.knex('seen').delete();
    await Database.knex('mediaItem')
      .whereIn('id', [Data.movie.id, Data.tvShow.id, Data.videoGame.id])
      .update({ platformRating: null });
    await Database.knex('listItem')
      .whereIn('mediaItemId', [Data.movie.id, Data.tvShow.id, Data.videoGame.id])
      .update({ estimatedRating: null });
  });

  test('listRepository.items() returns platformRating and sorts correctly after rating writes', async () => {
    // Set estimatedRating on listItems — recalculatePlatformRating reads listItem.estimatedRating,
    // not userRating.rating.
    await Database.knex('listItem')
      .where({ mediaItemId: Data.movie.id, listId: Data.list.id })
      .update({ estimatedRating: 9 });
    await Database.knex('listItem')
      .where({ mediaItemId: Data.tvShow.id, listId: Data.list.id })
      .update({ estimatedRating: 5 });

    await Promise.all([
      mediaItemRepository.recalculatePlatformRating(Data.movie.id),
      mediaItemRepository.recalculatePlatformRating(Data.tvShow.id),
    ]);

    // Fetch list items — they should include platformRating
    const items = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    const movie = items.find((i) => i.mediaItem.title === 'movie');
    const tvShow = items.find((i) => i.mediaItem.title === 'title');
    const videoGame = items.find((i) => i.mediaItem.title === 'video_game');

    expect(movie?.mediaItem.platformRating).toBeCloseTo(9, 5);
    expect(tvShow?.mediaItem.platformRating).toBeCloseTo(5, 5);
    expect(videoGame?.mediaItem.platformRating).toBeUndefined();
  });

  test('full cycle: rating via controller → cache update → listRepository.items() exposes updated platformRating', async () => {
    const ratingController = new RatingController();
    const { capturedCallbacks, originalSetImmediate } = mockSetImmediate();

    try {
      const res = await request(ratingController.add, {
        userId: Data.user.id,
        requestBody: {
          mediaItemId: Data.movie.id,
          rating: 7,
        },
      });

      expect(res.statusCode).toEqual(200);
      await executeSetImmediateCallbacks(
        capturedCallbacks,
        originalSetImmediate
      );
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    // Fetch via listRepository.items() and verify platformRating is exposed
    const items = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    const movie = items.find((i) => i.mediaItem.title === 'movie');
    expect(movie?.mediaItem.platformRating).toBeCloseTo(7, 5);
  });
});
