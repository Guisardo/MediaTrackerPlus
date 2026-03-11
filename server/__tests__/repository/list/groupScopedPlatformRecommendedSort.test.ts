/**
 * Tests for US-009: Group-scoped platform-recommended sort
 *
 * Verifies that when a groupId is provided with orderBy === 'platformRecommended',
 * the sort uses gpr.rating (from groupPlatformRating) instead of mediaItem.platformRating,
 * and that the LEFT JOIN on groupPlatformRating is only added when groupId is provided.
 */
import { Database } from 'src/dbconfig';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

// ---------------------------------------------------------------------------
// Test data for group-scoped platform-recommended sort
//
// All IDs start at 200 to avoid collisions with other test files that share
// the in-memory SQLite database when run in --runInBand mode.
// ---------------------------------------------------------------------------

describe("mediaItemRepository.items({ orderBy: 'platformRecommended', groupId }) — group-scoped sort", () => {
  const user1 = { id: 200, name: 'user-group-sort-1', password: 'password' };
  const user2 = { id: 201, name: 'user-group-sort-2', password: 'password' };
  const user3 = { id: 202, name: 'user-group-sort-3', password: 'password' };

  // user1's watchlist (required by getItemsKnexSql to find watchlistId)
  const watchlist = {
    id: 200,
    userId: user1.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // User lists for user2 and user3 (needed so anyListItem shows these items)
  const list2 = {
    id: 201,
    userId: user2.id,
    name: 'List 2',
    privacy: 'private',
    sortBy: 'recently-added',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: false,
  };
  const list3 = {
    id: 202,
    userId: user3.id,
    name: 'List 3',
    privacy: 'private',
    sortBy: 'recently-added',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: false,
  };

  // user2's watchlist (required so they can have a list)
  const watchlist2 = {
    id: 203,
    userId: user2.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // user3's watchlist
  const watchlist3 = {
    id: 204,
    userId: user3.id,
    name: 'Watchlist',
    privacy: 'private',
    sortBy: 'recently-watched',
    sortOrder: 'desc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isWatchlist: true,
  };

  // Alpha: high group rating (9.0) — should rank first in group-scoped sort
  const itemAlpha = {
    id: 200,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Alpha',
    // Global platformRating is LOW (3.0) — group rating is HIGH (9.0)
    // With groupId: ranked 1st (group-scoped). Without groupId: ranked last (global).
    platformRating: 3.0,
    tmdbRating: 7.0,
  };

  // Beta: low group rating (2.0) — should rank last in group-scoped sort
  const itemBeta = {
    id: 201,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Beta',
    // Global platformRating is HIGH (9.0) — group rating is LOW (2.0)
    // With groupId: ranked last (group-scoped). Without groupId: ranked 1st (global).
    platformRating: 9.0,
    tmdbRating: 8.0,
  };

  // Gamma: no group rating at all — should use tmdbRating as tier-2 fallback
  const itemGamma = {
    id: 202,
    lastTimeUpdated: Date.now(),
    mediaType: 'movie',
    source: 'tmdb',
    title: 'Gamma',
    // No platformRating, no group rating — pure tmdbRating-only item
    tmdbRating: 6.5,
  };

  const groupId = 200;

  // Group platform ratings: Alpha has high group rating, Beta has low group rating
  // Gamma has NO groupPlatformRating entry (acts as tier-2)
  const groupAlphaRating = {
    id: 200,
    groupId: groupId,
    mediaItemId: itemAlpha.id,
    rating: 9.0,
  };

  const groupBetaRating = {
    id: 201,
    groupId: groupId,
    mediaItemId: itemBeta.id,
    rating: 2.0,
  };

  beforeAll(async () => {
    await runMigrations();

    // Insert users
    await Database.knex('user').insert(user1);
    await Database.knex('user').insert(user2);
    await Database.knex('user').insert(user3);

    // Insert media items
    await Database.knex('mediaItem').insert(itemAlpha);
    await Database.knex('mediaItem').insert(itemBeta);
    await Database.knex('mediaItem').insert(itemGamma);

    // Insert lists/watchlists
    await Database.knex('list').insert(watchlist);
    await Database.knex('list').insert(watchlist2);
    await Database.knex('list').insert(watchlist3);
    await Database.knex('list').insert(list2);
    await Database.knex('list').insert(list3);

    // Put all items on user2's list and user3's list so they appear in anyListItem
    await Database.knex('listItem').insert([
      { listId: list2.id, mediaItemId: itemAlpha.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemBeta.id, addedAt: Date.now() },
      { listId: list3.id, mediaItemId: itemGamma.id, addedAt: Date.now() },
    ]);

    // Insert group platform ratings
    await Database.knex('userGroup').insert({
      id: groupId,
      name: 'Test Group',
      createdBy: user1.id,
      createdAt: Date.now(),
    });
    await Database.knex('userGroupMember').insert([
      { id: 200, groupId, userId: user1.id, role: 'admin', addedAt: Date.now() },
      { id: 201, groupId, userId: user2.id, role: 'viewer', addedAt: Date.now() },
    ]);
    await Database.knex('groupPlatformRating').insert(groupAlphaRating);
    await Database.knex('groupPlatformRating').insert(groupBetaRating);
  });

  afterAll(clearDatabase);

  test('with groupId: uses gpr.rating in the scoring formula — Alpha (gpr=9.0) ranks before Beta (gpr=2.0)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    // Alpha: gpr.rating=9.0, tmdbRating=7.0 → score = 9.0*0.7 + 7.0*0.3 = 6.3 + 2.1 = 8.4 (tier 1)
    // Beta: gpr.rating=2.0, tmdbRating=8.0 → score = 2.0*0.7 + 8.0*0.3 = 1.4 + 2.4 = 3.8 (tier 1)
    // Gamma: no gpr.rating → tier 2, tmdbRating=6.5
    expect(titles).toContain('Alpha');
    expect(titles).toContain('Beta');
    expect(titles).toContain('Gamma');
    // Alpha (8.4) before Beta (3.8) before Gamma (tier 2)
    expect(titles.indexOf('Alpha')).toBeLessThan(titles.indexOf('Beta'));
    expect(titles.indexOf('Beta')).toBeLessThan(titles.indexOf('Gamma'));
  });

  test('without groupId: uses mediaItem.platformRating — Beta (platformRating=9.0) ranks before Alpha (platformRating=3.0)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      // no groupId
    });

    const titles = items.map((i) => i.title);
    // Beta: platformRating=9.0, tmdbRating=8.0 → score = 9.0*0.7 + 8.0*0.3 = 6.3 + 2.4 = 8.7 (tier 1)
    // Alpha: platformRating=3.0, tmdbRating=7.0 → score = 3.0*0.7 + 7.0*0.3 = 2.1 + 2.1 = 4.2 (tier 1)
    // Gamma: no platformRating → tier 2
    expect(titles.indexOf('Beta')).toBeLessThan(titles.indexOf('Alpha'));
    expect(titles.indexOf('Alpha')).toBeLessThan(titles.indexOf('Gamma'));
  });

  test('non-platformRecommended sort ignores groupId completely', async () => {
    // With 'title' sort and groupId provided, groupId should be ignored
    const itemsWithGroup = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'title',
      sortOrder: 'asc',
      groupId,
    });

    const itemsWithoutGroup = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'title',
      sortOrder: 'asc',
    });

    // Both queries should produce identical results (same count and same order)
    expect(itemsWithGroup.length).toBe(itemsWithoutGroup.length);
    const titlesWithGroup = itemsWithGroup.map((i) => i.title);
    const titlesWithoutGroup = itemsWithoutGroup.map((i) => i.title);
    expect(titlesWithGroup).toEqual(titlesWithoutGroup);
  });

  test('with groupId: item with no groupPlatformRating entry (Gamma) falls to tier-2 (gpr.rating IS NULL)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    // Gamma has no groupPlatformRating entry → gpr.rating IS NULL → tier 2
    // Alpha and Beta both have gpr.rating → tier 1
    const gammaIndex = titles.indexOf('Gamma');
    const alphaIndex = titles.indexOf('Alpha');
    const betaIndex = titles.indexOf('Beta');

    // Both Alpha and Beta (tier 1) should rank before Gamma (tier 2)
    expect(alphaIndex).toBeLessThan(gammaIndex);
    expect(betaIndex).toBeLessThan(gammaIndex);
  });

  test('with groupId: gpr.rating-only (no tmdbRating) correctly uses gpr.rating alone in formula', async () => {
    // Insert a new item with a group rating but NO tmdbRating
    const itemDelta = {
      id: 210,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Delta',
      // no tmdbRating, no platformRating
    };
    const groupDeltaRating = {
      id: 210,
      groupId,
      mediaItemId: itemDelta.id,
      rating: 7.5,
    };

    await Database.knex('mediaItem').insert(itemDelta);
    await Database.knex('listItem').insert({
      listId: list2.id,
      mediaItemId: itemDelta.id,
      addedAt: Date.now(),
    });
    await Database.knex('groupPlatformRating').insert(groupDeltaRating);

    try {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId,
      });

      const titles = items.map((i) => i.title);
      const deltaIndex = titles.indexOf('Delta');
      const gammaIndex = titles.indexOf('Gamma');

      // Delta: gpr.rating=7.5, tmdbRating=null → score = 7.5 (gpr alone, tier 1)
      // Gamma: gpr.rating=null, tmdbRating=6.5 → tier 2
      // Delta (tier 1) should rank before Gamma (tier 2)
      expect(deltaIndex).toBeLessThan(gammaIndex);
    } finally {
      await Database.knex('groupPlatformRating')
        .where('mediaItemId', itemDelta.id)
        .delete();
      await Database.knex('listItem').where('mediaItemId', itemDelta.id).delete();
      await Database.knex('mediaItem').where('id', itemDelta.id).delete();
    }
  });
});
