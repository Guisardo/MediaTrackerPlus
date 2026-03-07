import { Database } from 'src/dbconfig';
import { listRepository } from 'src/repository/list';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

// ---------------------------------------------------------------------------
// Pure score helpers — mirrors the formula in client/src/hooks/sortedList.ts
// ---------------------------------------------------------------------------

function computeScore(
  estimatedRating: number | null | undefined,
  tmdbRating: number | null | undefined
): number | undefined {
  if (estimatedRating == null) {
    return undefined;
  }
  if (tmdbRating != null) {
    return estimatedRating * 0.6 + tmdbRating * 0.4;
  }
  return estimatedRating;
}

type SimplifiedListItem = {
  estimatedRating?: number | null;
  mediaItem: { title: string; tmdbRating?: number | null };
};

function sortByRecommended(items: SimplifiedListItem[]): SimplifiedListItem[] {
  return [...items].sort((a, b) => {
    const scoreA = computeScore(
      a.estimatedRating,
      a.mediaItem.tmdbRating
    );
    const scoreB = computeScore(
      b.estimatedRating,
      b.mediaItem.tmdbRating
    );

    if (scoreA == null && scoreB == null) {
      return a.mediaItem.title.localeCompare(b.mediaItem.title);
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
    return a.mediaItem.title.localeCompare(b.mediaItem.title);
  });
}

// ---------------------------------------------------------------------------
// Pure unit tests for the score formula and sort ordering
// ---------------------------------------------------------------------------

describe('recommended sort — score formula (pure unit tests)', () => {
  test('score formula: both estimatedRating and tmdbRating present', () => {
    const score = computeScore(8.0, 7.0);
    // 8.0 * 0.6 + 7.0 * 0.4 = 4.8 + 2.8 = 7.6
    expect(score).toBeCloseTo(7.6, 10);
  });

  test('score formula: tmdbRating is null — falls back to estimatedRating only', () => {
    const score = computeScore(8.0, null);
    expect(score).toBe(8.0);
  });

  test('score formula: tmdbRating is undefined — falls back to estimatedRating only', () => {
    const score = computeScore(8.0, undefined);
    expect(score).toBe(8.0);
  });

  test('score formula: estimatedRating is null — returns undefined (sorts last)', () => {
    const score = computeScore(null, 7.0);
    expect(score).toBeUndefined();
  });

  test('score formula: estimatedRating is undefined — returns undefined (sorts last)', () => {
    const score = computeScore(undefined, 7.0);
    expect(score).toBeUndefined();
  });

  test('score formula: fractional values (e.g., 7.5 estimatedRating, 6.0 tmdbRating)', () => {
    const score = computeScore(7.5, 6.0);
    // 7.5 * 0.6 + 6.0 * 0.4 = 4.5 + 2.4 = 6.9
    expect(score).toBeCloseTo(6.9, 10);
  });
});

describe('recommended sort — ordering (pure unit tests)', () => {
  test('higher score sorts before lower score', () => {
    const items: SimplifiedListItem[] = [
      { estimatedRating: 6.0, mediaItem: { title: 'Low', tmdbRating: 6.0 } },
      { estimatedRating: 9.0, mediaItem: { title: 'High', tmdbRating: 8.0 } },
    ];
    const sorted = sortByRecommended(items);
    // High: 9.0*0.6 + 8.0*0.4 = 5.4 + 3.2 = 8.6
    // Low:  6.0*0.6 + 6.0*0.4 = 3.6 + 2.4 = 6.0
    expect(sorted[0].mediaItem.title).toBe('High');
    expect(sorted[1].mediaItem.title).toBe('Low');
  });

  test('null estimatedRating sorts last — after all scored items', () => {
    const items: SimplifiedListItem[] = [
      { estimatedRating: null, mediaItem: { title: 'No score', tmdbRating: 9.0 } },
      { estimatedRating: 3.0, mediaItem: { title: 'Low score', tmdbRating: null } },
      { estimatedRating: 8.0, mediaItem: { title: 'High score', tmdbRating: null } },
    ];
    const sorted = sortByRecommended(items);
    expect(sorted[0].mediaItem.title).toBe('High score');
    expect(sorted[1].mediaItem.title).toBe('Low score');
    expect(sorted[2].mediaItem.title).toBe('No score');
  });

  test('null tmdbRating falls back to estimatedRating only (no formula)', () => {
    // Item A: estimatedRating=7, tmdbRating=null → score=7
    // Item B: estimatedRating=6, tmdbRating=9   → score=6*0.6+9*0.4=3.6+3.6=7.2
    const items: SimplifiedListItem[] = [
      { estimatedRating: 6.0, mediaItem: { title: 'Item B', tmdbRating: 9.0 } },
      { estimatedRating: 7.0, mediaItem: { title: 'Item A', tmdbRating: null } },
    ];
    const sorted = sortByRecommended(items);
    // Item B score=7.2 > Item A score=7.0 → B first
    expect(sorted[0].mediaItem.title).toBe('Item B');
    expect(sorted[1].mediaItem.title).toBe('Item A');
  });

  test('multiple items with null estimatedRating sort by title among themselves', () => {
    const items: SimplifiedListItem[] = [
      { estimatedRating: null, mediaItem: { title: 'Zebra', tmdbRating: 8.0 } },
      { estimatedRating: null, mediaItem: { title: 'Alpha', tmdbRating: 5.0 } },
      { estimatedRating: 5.0, mediaItem: { title: 'Middle', tmdbRating: null } },
    ];
    const sorted = sortByRecommended(items);
    expect(sorted[0].mediaItem.title).toBe('Middle');
    expect(sorted[1].mediaItem.title).toBe('Alpha');
    expect(sorted[2].mediaItem.title).toBe('Zebra');
  });

  test('equal scores sort alphabetically by title', () => {
    const items: SimplifiedListItem[] = [
      { estimatedRating: 7.0, mediaItem: { title: 'Zorro', tmdbRating: null } },
      { estimatedRating: 7.0, mediaItem: { title: 'Alpha', tmdbRating: null } },
    ];
    const sorted = sortByRecommended(items);
    expect(sorted[0].mediaItem.title).toBe('Alpha');
    expect(sorted[1].mediaItem.title).toBe('Zorro');
  });

  test('all items have null estimatedRating — sort entirely by title', () => {
    const items: SimplifiedListItem[] = [
      { estimatedRating: null, mediaItem: { title: 'Zorro', tmdbRating: 9.0 } },
      { estimatedRating: null, mediaItem: { title: 'Alpha', tmdbRating: 5.0 } },
      { estimatedRating: null, mediaItem: { title: 'Middle', tmdbRating: null } },
    ];
    const sorted = sortByRecommended(items);
    expect(sorted[0].mediaItem.title).toBe('Alpha');
    expect(sorted[1].mediaItem.title).toBe('Middle');
    expect(sorted[2].mediaItem.title).toBe('Zorro');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: listRepository.items() exposes estimatedRating / tmdbRating
// ---------------------------------------------------------------------------

describe('listRepository.items() — estimatedRating and tmdbRating exposure', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('mediaItem').insert({
      ...Data.movie,
      tmdbRating: 7.5,
    });
    await Database.knex('mediaItem').insert(Data.videoGame);
    await Database.knex('list').insert(Data.list);
    await Database.knex('list').insert(Data.watchlist);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
  });

  test('estimatedRating is returned when set on the listItem', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
      estimatedRating: 8.5,
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.estimatedRating).toBe(8.5);
  });

  test('estimatedRating is undefined when not set on the listItem', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.estimatedRating).toBeUndefined();
  });

  test('tmdbRating is returned from mediaItem when set', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.mediaItem.tmdbRating).toBe(7.5);
  });

  test('tmdbRating is undefined for items without tmdbRating (e.g., video games)', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.videoGame.id,
      addedAt: new Date().getTime(),
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.mediaItem.tmdbRating).toBeUndefined();
  });

  test('both estimatedRating and tmdbRating returned together', async () => {
    await Database.knex('listItem').insert({
      listId: Data.list.id,
      mediaItemId: Data.movie.id,
      addedAt: new Date().getTime(),
      estimatedRating: 9.0,
    });

    const [item] = await listRepository.items({
      listId: Data.list.id,
      userId: Data.user.id,
    });

    expect(item.estimatedRating).toBe(9.0);
    expect(item.mediaItem.tmdbRating).toBe(7.5);
  });
});
