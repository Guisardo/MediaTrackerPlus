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
  if (platformRating == null) {
    return undefined;
  }
  if (tmdbRating != null) {
    return platformRating * 0.7 + tmdbRating * 0.3;
  }
  return platformRating;
}

type SimplifiedItem = {
  platformRating?: number | null;
  title: string;
  tmdbRating?: number | null;
};

function sortByPlatformRecommended(items: SimplifiedItem[]): SimplifiedItem[] {
  return [...items].sort((a, b) => {
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

  test('score formula: platformRating is null — returns undefined (sorts last)', () => {
    const score = computeScore(null, 7.0);
    expect(score).toBeUndefined();
  });

  test('score formula: platformRating is undefined — returns undefined (sorts last)', () => {
    const score = computeScore(undefined, 7.0);
    expect(score).toBeUndefined();
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

  test('null platformRating sorts last — after all scored items', () => {
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

  test('multiple items with null platformRating sort by title among themselves', () => {
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'Zebra', tmdbRating: 8.0 },
      { platformRating: null, title: 'Alpha', tmdbRating: 5.0 },
      { platformRating: 5.0, title: 'Middle', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Middle');
    expect(sorted[1].title).toBe('Alpha');
    expect(sorted[2].title).toBe('Zebra');
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

  test('all items have null platformRating — sort entirely by title', () => {
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'Zorro', tmdbRating: 9.0 },
      { platformRating: null, title: 'Alpha', tmdbRating: 5.0 },
      { platformRating: null, title: 'Middle', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Middle');
    expect(sorted[2].title).toBe('Zorro');
  });

  test('item with platformRating = 0 sorts before items with null platformRating', () => {
    const items: SimplifiedItem[] = [
      { platformRating: null, title: 'No rating', tmdbRating: 9.0 },
      { platformRating: 0, title: 'Zero rating', tmdbRating: null },
      { platformRating: 5.0, title: 'Good rating', tmdbRating: null },
    ];
    const sorted = sortByPlatformRecommended(items);
    // Scored items first: Good rating (5.0), Zero rating (0.0)
    // Null last: No rating
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

  // Gamma: platformRating=null → sorts last (after all scored items), then by title
  const itemGamma = {
    id: 3,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Gamma',
    tmdbRating: 9.0,
    // platformRating intentionally omitted (null) — should sort last
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

  test('higher combined score sorts before lower score — Alpha (8.7) > Beta (7.0) > Gamma (null)', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    expect(items.length).toBe(3);
    // Alpha: 9.0*0.7 + 8.0*0.3 = 8.7
    // Beta:  7.0 (no tmdbRating, formula falls back to platformRating only)
    // Gamma: null platformRating → last
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

  test('when only platformRating is available (no tmdbRating) — score equals platformRating only', async () => {
    // itemBeta has platformRating=7.0 and no tmdbRating
    // itemGamma has no platformRating but tmdbRating=9.0
    // Beta must score above Gamma even though Gamma has higher external rating
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    const betaIndex = items.findIndex((i) => i.title === 'Beta');
    const gammaIndex = items.findIndex((i) => i.title === 'Gamma');

    expect(betaIndex).toBeLessThan(gammaIndex);
  });

  test('items with platformRating IS NULL sort below all items that have any platform rating', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
    });

    // Gamma has null platformRating — must come after both Alpha and Beta
    expect(items[items.length - 1].title).toBe('Gamma');
  });

  test('sortOrder asc still produces descending score order — score-based sort ignores direction', async () => {
    const items = await mediaItemRepository.items({
      userId: user.id,
      orderBy: 'platformRecommended',
      sortOrder: 'asc',
    });

    // Score-based sorts must always order by score descending regardless of sortOrder
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

  test('item with platformRating = 0 treated as valid scored item — does not sort to bottom', async () => {
    const itemZeroRating = {
      id: 6,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'ZeroRated',
      platformRating: 0,
    };

    await Database.knex('mediaItem').insert(itemZeroRating);
    await Database.knex('listItem').insert({
      listId: watchlist.id,
      mediaItemId: itemZeroRating.id,
      addedAt: Date.now(),
    });

    try {
      const items = await mediaItemRepository.items({
        userId: user.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      const gammaIndex = items.findIndex((i) => i.title === 'Gamma');
      const zeroRatedIndex = items.findIndex((i) => i.title === 'ZeroRated');

      // ZeroRated has platformRating=0 (valid scored item)
      // Gamma has platformRating=null (sorts to bottom)
      // ZeroRated must appear before Gamma
      expect(zeroRatedIndex).toBeLessThan(gammaIndex);
    } finally {
      await Database.knex('listItem')
        .where('mediaItemId', itemZeroRating.id)
        .delete();
      await Database.knex('mediaItem').where('id', itemZeroRating.id).delete();
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

  test('items with null platformRating sort after scored items and then by title alphabetically', async () => {
    const itemAaaa = {
      id: 7,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Aaaa',
      tmdbRating: 9.5,
      // platformRating intentionally null — must sort after scored items, then alphabetically
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
      // Scored items first: Alpha (8.7), Beta (7.0)
      expect(items[0].title).toBe('Alpha');
      expect(items[1].title).toBe('Beta');
      // Null-platformRating items last, sorted alphabetically: Aaaa < Gamma
      expect(items[2].title).toBe('Aaaa');
      expect(items[3].title).toBe('Gamma');
    } finally {
      await Database.knex('listItem').where('mediaItemId', itemAaaa.id).delete();
      await Database.knex('mediaItem').where('id', itemAaaa.id).delete();
    }
  });
});
