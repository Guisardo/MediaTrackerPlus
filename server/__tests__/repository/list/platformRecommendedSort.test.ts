import { Database } from 'src/dbconfig';
import { listRepository } from 'src/repository/list';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

// ---------------------------------------------------------------------------
// Pure score helpers — mirrors the formula in client/src/hooks/sortedList.ts
// and the SQL CASE expressions in server/src/knex/queries/items.ts
// ---------------------------------------------------------------------------

function computeScore(
  platformRating: number | null | undefined,
  tmdbRating: number | null | undefined
): number | undefined {
  if (platformRating != null && tmdbRating != null) {
    return platformRating * 0.7 + tmdbRating * 0.3;
  }
  if (platformRating != null) {
    return platformRating;
  }
  if (tmdbRating != null) {
    return tmdbRating;
  }
  return undefined;
}

type SimplifiedItem = {
  platformRating?: number | null;
  title: string;
  tmdbRating?: number | null;
};

function sortByPlatformRecommended(items: SimplifiedItem[]): SimplifiedItem[] {
  return [...items].sort((a, b) => {
    // Tier 1: items with platformRating sort before tier 2 (no platformRating).
    const tierA = a.platformRating != null ? 0 : 1;
    const tierB = b.platformRating != null ? 0 : 1;

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within the same tier, rank by score descending.
    const scoreA = computeScore(a.platformRating, a.tmdbRating);
    const scoreB = computeScore(b.platformRating, b.tmdbRating);

    if (scoreA == null && scoreB == null) {
      return a.title.localeCompare(b.title);
    }
    if (scoreA == null) {
      return 1;
    }
    if (scoreB == null) {
      return -1;
    }
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.title.localeCompare(b.title);
  });
}

// ---------------------------------------------------------------------------
// Pure unit tests for the score formula and sort ordering
// ---------------------------------------------------------------------------

describe('platform-recommended sort — score formula (pure unit tests)', () => {
  test('score formula: both platformRating and tmdbRating present — uses 70/30 weighting', () => {
    const score = computeScore(8.0, 7.0);
    // 8.0 * 0.7 + 7.0 * 0.3 = 5.6 + 2.1 = 7.7
    expect(score).toBeCloseTo(7.7, 10);
  });

  test('score formula: tmdbRating is null — falls back to platformRating only', () => {
    const score = computeScore(8.0, null);
    expect(score).toBe(8.0);
  });

  test('score formula: tmdbRating is undefined — falls back to platformRating only', () => {
    const score = computeScore(8.0, undefined);
    expect(score).toBe(8.0);
  });

  test('score formula: platformRating is null but tmdbRating present — falls back to tmdbRating', () => {
    const score = computeScore(null, 7.0);
    expect(score).toBe(7.0);
  });

  test('score formula: platformRating is undefined but tmdbRating present — falls back to tmdbRating', () => {
    const score = computeScore(undefined, 7.0);
    expect(score).toBe(7.0);
  });

  test('score formula: both platformRating and tmdbRating null — returns undefined (sorts last)', () => {
    const score = computeScore(null, null);
    expect(score).toBeUndefined();
  });

  test('score formula: platformRating is null, tmdbRating present — score equals tmdbRating (no weighting)', () => {
    // When only the external rating is available, it is used directly as a proxy score.
    // No weighting is applied since there is no platform signal to blend with.
    expect(computeScore(null, 6.5)).toBe(6.5);
    expect(computeScore(undefined, 9.0)).toBe(9.0);
  });

  test('score formula: platformRating = 0 — treated as valid scored item (does not sort last)', () => {
    const score = computeScore(0, null);
    // 0 is a valid rating — should have a defined score, not undefined
    expect(score).toBeDefined();
    expect(score).toBe(0);
  });

  test('score formula: platformRating = 0 with tmdbRating — uses 70/30 formula', () => {
    const score = computeScore(0, 5.0);
    // 0 * 0.7 + 5.0 * 0.3 = 0 + 1.5 = 1.5
    expect(score).toBeCloseTo(1.5, 10);
  });

  test('score formula: fractional values (e.g., 7.5 platformRating, 6.0 tmdbRating)', () => {
    const score = computeScore(7.5, 6.0);
    // 7.5 * 0.7 + 6.0 * 0.3 = 5.25 + 1.8 = 7.05
    expect(score).toBeCloseTo(7.05, 10);
  });

  test('score formula: 70/30 weighting differs from recommended 60/40', () => {
    // A higher platformRating matters more than a higher tmdbRating
    // Item A: platformRating=9, tmdbRating=5 → 9*0.7 + 5*0.3 = 6.3 + 1.5 = 7.8
    // Item B: platformRating=7, tmdbRating=9 → 7*0.7 + 9*0.3 = 4.9 + 2.7 = 7.6
    const scoreA = computeScore(9.0, 5.0);
    const scoreB = computeScore(7.0, 9.0);
    // 70/30 means A > B
    expect(scoreA).toBeGreaterThan(scoreB!);
    expect(scoreA).toBeCloseTo(7.8, 10);
    expect(scoreB).toBeCloseTo(7.6, 10);
  });
});

describe('platform-recommended sort — ordering (pure unit tests)', () => {
  test('higher score sorts before lower score', () => {
    const items: SimplifiedItem[] = [
      { platformRating: 6.0, title: 'Low', tmdbRating: 6.0 },
      { platformRating: 9.0, title: 'High', tmdbRating: 8.0 },
    ];
    const sorted = sortByPlatformRecommended(items);
    // High: 9.0*0.7 + 8.0*0.3 = 6.3 + 2.4 = 8.7
    // Low:  6.0*0.7 + 6.0*0.3 = 4.2 + 1.8 = 6.0
    expect(sorted[0].title).toBe('High');
    expect(sorted[1].title).toBe('Low');
  });

  test('platform-rated items always rank before tmdbRating-only items regardless of score', () => {
    // Tier 1 (has platformRating): High score (8.0) > Low score (3.0)
    // Tier 2 (no platformRating): No score (tmdbRating=9.0)
    // Even though No score has a higher raw value, it is in tier 2 and sorts last.
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'No score', tmdbRating: 9.0 },
      { platformRating: 3.0, title: 'Low score', tmdbRating: null },
      { platformRating: 8.0, title: 'High score', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('High score');
    expect(sorted[1].title).toBe('Low score');
    expect(sorted[2].title).toBe('No score');
  });

  test('null tmdbRating falls back to platformRating only (no formula)', () => {
    // Item A: platformRating=7, tmdbRating=null → score=7
    // Item B: platformRating=6, tmdbRating=9   → score=6*0.7+9*0.3=4.2+2.7=6.9
    const items: SimplifiedItem[] = [
      { platformRating: 6.0, title: 'Item B', tmdbRating: 9.0 },
      { platformRating: 7.0, title: 'Item A', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    // Item A score=7.0 > Item B score=6.9 → A first
    expect(sorted[0].title).toBe('Item A');
    expect(sorted[1].title).toBe('Item B');
  });

  test('tier-1 item ranks before tier-2 items; within tier 2, higher tmdbRating sorts first', () => {
    // Middle is in tier 1 (has platformRating=5.0); Zebra and Alpha are tier 2.
    // Within tier 2: Zebra (tmdbRating=8.0) > Alpha (tmdbRating=5.0).
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'Zebra', tmdbRating: 8.0 },
      { platformRating: null, title: 'Alpha', tmdbRating: 5.0 },
      { platformRating: 5.0, title: 'Middle', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Middle');
    expect(sorted[1].title).toBe('Zebra');
    expect(sorted[2].title).toBe('Alpha');
  });

  test('equal scores sort alphabetically by title', () => {
    const items: SimplifiedItem[] = [
      { platformRating: 7.0, title: 'Zorro', tmdbRating: null },
      { platformRating: 7.0, title: 'Alpha', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Zorro');
  });

  test('items with neither platformRating nor tmdbRating sort last alphabetically', () => {
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'Zorro', tmdbRating: 9.0 },
      { platformRating: null, title: 'Alpha', tmdbRating: 5.0 },
      { platformRating: null, title: 'Middle', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Zorro');
    expect(sorted[1].title).toBe('Alpha');
    expect(sorted[2].title).toBe('Middle');
  });

  test('tier-1 items (even with low platformRating) always rank before tier-2 tmdbRating-only items', () => {
    // Good rating and Zero rating are tier 1; No rating is tier 2 despite tmdbRating=9.0.
    // Within tier 1: Good rating (5.0) > Zero rating (0).
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'No rating', tmdbRating: 9.0 },
      { platformRating: 0, title: 'Zero rating', tmdbRating: null },
      { platformRating: 5.0, title: 'Good rating', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Good rating');
    expect(sorted[1].title).toBe('Zero rating');
    expect(sorted[2].title).toBe('No rating');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: listRepository.items() exposes platformRating from mediaItem
// ---------------------------------------------------------------------------

describe('listRepository.items() — platformRating exposure', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert({
      ...Data.movie,
      platformRating: 7.5,
      tmdbRating: 8.0,
    });
    await Database.knex('mediaItem').insert(Data.videoGame);
    await Database.knex('list').insert(Data.list);
    await Database.knex('list').insert(Data.watchlist);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
  });

  test('platformRating is returned on mediaItem when set', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.mediaItem.platformRating).toBe(7.5);
  });

  test('platformRating is undefined on mediaItem when not set', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.videoGame.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.mediaItem.platformRating).toBeUndefined();
  });

  test('both platformRating and tmdbRating returned together from mediaItem', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.mediaItem.platformRating).toBe(7.5);
    expect(item.mediaItem.tmdbRating).toBe(8.0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: mediaItemRepository.items() — 'platformRecommended' SQL sort
// Verifies the actual SQL CASE expressions in knex/queries/items.ts execute
// correctly against a live SQLite database and produce the expected row order.
// ---------------------------------------------------------------------------

describe("mediaItemRepository.items({ orderBy: 'platformRecommended' }) — SQL integration", () => {
  const user = {
    id: 1,
    name: 'user',
    password: 'password',
  };

  const watchlist = {
    id: 1,
    userId: 1,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // Alpha: platformRating=9.0, tmdbRating=8.0 → combined score = 9.0*0.7 + 8.0*0.3 = 6.3 + 2.4 = 8.7
  const itemAlpha = {
    id: 1,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Alpha',
    platformRating: 9.0,
    tmdbRating: 8.0,
  };

  // Beta: platformRating=7.0, tmdbRating=null → score = 7.0 (no formula, fallback only)
  const itemBeta = {
    id: 2,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Beta',
    platformRating: 7.0,
  };

  // Gamma: platformRating=null, tmdbRating=9.0 → score = 9.0 (tmdbRating fallback) → sorts first
  const itemGamma = {
    id: 3,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Gamma',
    tmdbRating: 9.0,
    // platformRating intentionally omitted (null) — falls back to tmdbRating
  };

  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(user);
    await Database.knex('mediaItem').insert(itemAlpha);
    await Database.knex('mediaItem').insert(itemBeta);
    await Database.knex('mediaItem').insert(itemGamma);
    await Database.knex('list').insert(watchlist);
    await Database.knex('listItem').insert([
      {
        listId: watchlist.id,
        mediaItemId: itemAlpha.id,
        addedAt: Date.now(),
      },
      {
        listId: watchlist.id,
        mediaItemId: itemBeta.id,
        addedAt: Date.now(),
      },
      {
        listId: watchlist.id,
        mediaItemId: itemGamma.id,
        addedAt: Date.now(),
      },
    ]);
  });

  afterAll(clearDatabase);

  test('tier ordering: Alpha (tier-1 blend 8.7) > Beta (tier-1 platform 7.0) > Gamma (tier-2 tmdb 9.0)', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    expect(items.length).toBe(3);
    // Alpha: tier 1 — 9.0*0.7 + 8.0*0.3 = 8.7
    // Beta:  tier 1 — platformRating only = 7.0
    // Gamma: tier 2 — no platformRating; tmdbRating=9.0 ranks within tier 2 only
    expect(items[0].title).toBe('Alpha');
    expect(items[1].title).toBe('Beta');
    expect(items[2].title).toBe('Gamma');
  });

  test('platformRating is exposed on all items returned by platform-recommended sort', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    const alpha = items.find((i) => i.title === 'Alpha');
    const beta = items.find((i) => i.title === 'Beta');
    const gamma = items.find((i) => i.title === 'Gamma');

    expect(alpha?.platformRating).toBe(9.0);
    expect(beta?.platformRating).toBe(7.0);
    expect(gamma?.platformRating).toBeUndefined();
  });

  test('platform-rated item (Beta, tier 1) always ranks before tmdbRating-only item (Gamma, tier 2)', async () => {
    // Beta has platformRating=7.0 → tier 1
    // Gamma has no platformRating but tmdbRating=9.0 → tier 2
    // Beta sorts before Gamma despite Gamma's higher raw tmdbRating score.
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    const betaIndex = items.findIndex((i) => i.title === 'Beta');
    const gammaIndex = items.findIndex((i) => i.title === 'Gamma');

    expect(betaIndex).toBeLessThan(gammaIndex);
  });

  test('items with BOTH platformRating and tmdbRating null sort last', async () => {
    const itemNoRatings = {
      id: 8,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'NoRatings',
      // both platformRating and tmdbRating intentionally omitted
    };

    await Database.knex('mediaItem').insert(itemNoRatings);
    await Database.knex('listItem').insert({
      listId: watchlist.id,
      mediaItemId: itemNoRatings.id,
      addedAt: Date.now(),
    });

    try {
      const items = await mediaItemRepository.items({
        userId: user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      // NoRatings has neither platformRating nor tmdbRating — must be last
      expect(items[items.length - 1].title).toBe('NoRatings');
    } finally {
      await Database.knex('listItem').where('mediaItemId', itemNoRatings.id).delete();
      await Database.knex('mediaItem').where('id', itemNoRatings.id).delete();
    }
  });

  test('sortOrder asc still produces tier-then-score descending order — score-based sort ignores direction', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'asc',
    });

    // Score-based sorts must always order by tier then score descending regardless of sortOrder
    expect(items.length).toBe(3);
    expect(items[0].title).toBe('Alpha');
    expect(items[1].title).toBe('Beta');
    expect(items[2].title).toBe('Gamma');
  });

  test('equal-score items ordered alphabetically by title ascending', async () => {
    const itemEqual1 = {
      id: 4,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Zorro',
      platformRating: 7.0,
    };
    const itemEqual2 = {
      id: 5,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Arturo',
      platformRating: 7.0,
    };

    await Database.knex('mediaItem').insert(itemEqual1);
    await Database.knex('mediaItem').insert(itemEqual2);
    await Database.knex('listItem').insert([
      {
        listId: watchlist.id,
        mediaItemId: itemEqual1.id,
        addedAt: Date.now(),
      },
      {
        listId: watchlist.id,
        mediaItemId: itemEqual2.id,
        addedAt: Date.now(),
      },
    ]);

    try {
      const items = await mediaItemRepository.items({
        userId: user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      // Beta (7.0), Arturo (7.0), and Zorro (7.0) all have same score
      // Among equal-score items, alphabetical ascending: Arturo < Beta < Zorro
      const titles = items.map((i) => i.title);
      const arturoIdx = titles.indexOf('Arturo');
      const betaIdx = titles.indexOf('Beta');
      const zorroIdx = titles.indexOf('Zorro');

      expect(arturoIdx).toBeLessThan(betaIdx);
      expect(betaIdx).toBeLessThan(zorroIdx);
    } finally {
      await Database.knex('listItem')
        .whereIn('mediaItemId', [itemEqual1.id, itemEqual2.id])
        .delete();
      await Database.knex('mediaItem')
        .whereIn('id', [itemEqual1.id, itemEqual2.id])
        .delete();
    }
  });

  test('item with platformRating = 0 treated as valid scored item — scores above items with neither rating', async () => {
    const itemZeroRating = {
      id: 6,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'ZeroRated',
      platformRating: 0,
    };
    const itemNoRatings = {
      id: 9,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'TrulyUnrated',
      // no platformRating, no tmdbRating
    };

    await Database.knex('mediaItem').insert(itemZeroRating);
    await Database.knex('mediaItem').insert(itemNoRatings);
    await Database.knex('listItem').insert([
      { listId: watchlist.id, mediaItemId: itemZeroRating.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: itemNoRatings.id, addedAt: Date.now() },
    ]);

    try {
      const items = await mediaItemRepository.items({
        userId: user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      const zeroRatedIndex = items.findIndex((i) => i.title === 'ZeroRated');
      const trulyUnratedIndex = items.findIndex((i) => i.title === 'TrulyUnrated');

      // ZeroRated has platformRating=0 (valid scored item, score=0)
      // TrulyUnrated has no ratings at all → sorts last
      expect(zeroRatedIndex).toBeLessThan(trulyUnratedIndex);
    } finally {
      await Database.knex('listItem')
        .whereIn('mediaItemId', [itemZeroRating.id, itemNoRatings.id])
        .delete();
      await Database.knex('mediaItem')
        .whereIn('id', [itemZeroRating.id, itemNoRatings.id])
        .delete();
    }
  });

  test('paginated count query returns correct total when platform-recommended sort is active', async () => {
    const result = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      page: 1,
    });

    // Alpha, Beta, Gamma — 3 items in the watchlist
    expect(result.total).toBe(3);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  test('tier-2 (tmdbRating-only) items sort among themselves by tmdbRating, after all tier-1 items', async () => {
    const itemAaaa = {
      id: 7,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Aaaa',
      tmdbRating: 9.5,
      // platformRating intentionally null → tier 2
    };

    await Database.knex('mediaItem').insert(itemAaaa);
    await Database.knex('listItem').insert({
      listId: watchlist.id,
      mediaItemId: itemAaaa.id,
      addedAt: Date.now(),
    });

    try {
      const items = await mediaItemRepository.items({
        userId: user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      expect(items.length).toBe(4);
      // Tier 1: Alpha (9.0*0.7+8.0*0.3=8.7), Beta (platformRating=7.0)
      // Tier 2: Aaaa (tmdbRating=9.5), Gamma (tmdbRating=9.0) — ranked within tier 2
      expect(items[0].title).toBe('Alpha');
      expect(items[1].title).toBe('Beta');
      expect(items[2].title).toBe('Aaaa');
      expect(items[3].title).toBe('Gamma');
    } finally {
      await Database.knex('listItem').where('mediaItemId', itemAaaa.id).delete();
      await Database.knex('mediaItem').where('id', itemAaaa.id).delete();
    }
  });
});

// ---------------------------------------------------------------------------
// Integration tests: platformSeen filter — items watched by any platform user
// are excluded from the platform-recommended view.
// ---------------------------------------------------------------------------

describe("mediaItemRepository.items({ orderBy: 'platformRecommended' }) — excludes platform-watched items", () => {
  const user1 = { id: 10, name: 'user1', password: 'password' };
  const user2 = { id: 11, name: 'user2', password: 'password' };

  const watchlist = {
    id: 20,
    userId: user1.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  const unwatchedMovie = {
    id: 20,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Unwatched Movie',
    tmdbRating: 7.0,
    platformRating: 8.0,
  };

  const watchedMovie = {
    id: 21,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Watched Movie',
    tmdbRating: 9.0,
    platformRating: 9.5, // high score, but already watched — should be excluded
  };

  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(user1);
    await Database.knex('user').insert(user2);
    await Database.knex('mediaItem').insert(unwatchedMovie);
    await Database.knex('mediaItem').insert(watchedMovie);
    await Database.knex('list').insert(watchlist);
    await Database.knex('listItem').insert([
      { listId: watchlist.id, mediaItemId: unwatchedMovie.id, addedAt: Date.now() },
      { listId: watchlist.id, mediaItemId: watchedMovie.id, addedAt: Date.now() },
    ]);
    // user2 has watched 'Watched Movie' (non-TV: seen entry with episodeId IS NULL)
    await Database.knex('seen').insert({
      mediaItemId: watchedMovie.id,
      userId: user2.id,
      date: Date.now(),
      episodeId: null,
    });
  });

  afterAll(clearDatabase);

  test('item watched by another platform user is excluded from platform-recommended results', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    const titles = items.map((i) => i.title);
    // watchedMovie has higher score (9.5*0.7+9.0*0.3=9.35) but must be excluded
    expect(titles).not.toContain('Watched Movie');
    expect(titles).toContain('Unwatched Movie');
  });

  test('item watched only by the requesting user is also excluded (platform-wide filter)', async () => {
    // user1 watches unwatchedMovie
    await Database.knex('seen').insert({
      mediaItemId: unwatchedMovie.id,
      userId: user1.id,
      date: Date.now(),
      episodeId: null,
    });

    try {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      const titles = items.map((i) => i.title);
      // Both items are now watched by at least one platform user — both excluded
      expect(titles).not.toContain('Unwatched Movie');
      expect(titles).not.toContain('Watched Movie');
    } finally {
      await Database.knex('seen')
        .where('mediaItemId', unwatchedMovie.id)
        .where('userId', user1.id)
        .delete();
    }
  });

  test('other sort orders are not affected by the platform-seen filter', async () => {
    // watchedMovie should still appear when NOT using platform-recommended sort
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'title',
      sortOrder: 'asc',
    });

    const titles = items.map((i) => i.title);
    // Both items present — filter only applies to platformRecommended sort
    expect(titles).toContain('Watched Movie');
    expect(titles).toContain('Unwatched Movie');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: listRepository.items() — platform-recommended broadens scope
// When a list's sortBy is 'platform-recommended', items from ALL platform users'
// lists are surfaced, not just items in the specific list being viewed.
// This ensures every user sees a mixed-content view regardless of which content
// types they personally have added.
// ---------------------------------------------------------------------------

describe("listRepository.items() — platform-recommended scope covers all platform lists", () => {
  const userLucas = { id: 50, name: 'lucas', password: 'password' };
  const userVioleta = { id: 51, name: 'violeta', password: 'password' };

  const movie = {
    id: 50,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Great Movie',
    tmdbRating: 7.5,
  };

  const tvSeries = {
    id: 51,
    lastTimeUpdated: Date.now(),
    mediaType: 'tv',
    source: 'tmdb',
    title: 'Amazing Series',
    tmdbRating: 8.5,
  };

  // Lucas's watchlist (required by items() for watchlist-indicator joins)
  const lucasWatchlist = {
    id: 50,
    userId: userLucas.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-added',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // Lucas's custom list — platform-recommended sort, contains only the movie
  const lucasPlatformList = {
    id: 51,
    userId: userLucas.id,
    name: 'Lucas Platform List',
    privacy: 'private',
    sortBy: 'platform-recommended',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: false,
  };

  // Violeta's watchlist — contains only a TV series
  const violetaWatchlist = {
    id: 52,
    userId: userVioleta.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-added',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(userLucas);
    await Database.knex('user').insert(userVioleta);
    await Database.knex('mediaItem').insert(movie);
    await Database.knex('mediaItem').insert(tvSeries);
    await Database.knex('list').insert(lucasWatchlist);
    await Database.knex('list').insert(lucasPlatformList);
    await Database.knex('list').insert(violetaWatchlist);
    // Lucas's platform list has only the movie
    await Database.knex('listItem').insert({
      listId: lucasPlatformList.id,
      mediaItemId: movie.id,
      addedAt: Date.now(),
    });
    // Violeta's watchlist has only the TV series
    await Database.knex('listItem').insert({
      listId: violetaWatchlist.id,
      mediaItemId: tvSeries.id,
      addedAt: Date.now(),
    });
  });

  afterAll(clearDatabase);

  test('platform-recommended list returns items from all platform lists, mixing content types', async () => {
    // Lucas's list only explicitly contains a movie, but because the sort is
    // 'platform-recommended' the query expands to the full platform item pool,
    // which includes Violeta's TV series.
    const items = await listRepository.items({
      listId: lucasPlatformList.id,
      userId: userLucas.id,
    });

    const titles = items.map((i) => i.mediaItem.title);
    expect(titles).toContain('Great Movie');
    expect(titles).toContain('Amazing Series');
  });

  test('non-platform-recommended list only returns items explicitly in that list', async () => {
    // Temporarily switch Lucas's list to a non-platform-recommended sort.
    await Database.knex('list')
      .where('id', lucasPlatformList.id)
      .update({ sortBy: 'recently-added' });

    try {
      const items = await listRepository.items({
        listId: lucasPlatformList.id,
        userId: userLucas.id,
      });

      const titles = items.map((i) => i.mediaItem.title);
      // Only the movie that Lucas explicitly added should appear.
      expect(titles).toContain('Great Movie');
      expect(titles).not.toContain('Amazing Series');
    } finally {
      await Database.knex('list')
        .where('id', lucasPlatformList.id)
        .update({ sortBy: 'platform-recommended' });
    }
  });
});
