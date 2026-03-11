import { Database } from 'src/dbconfig';
import {
  recalculateGroupPlatformRating,
  recalculateAllGroupPlatformRatings,
  recalculateGroupPlatformRatingsForUser,
} from 'src/repository/groupPlatformRatingCache';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Tests for the group platform rating cache computation functions.
 *
 * Covers:
 * 1. recalculateGroupPlatformRating: single member, multi-member average,
 *    partial ratings, NULL when no members have ratings, stale cache cleanup.
 * 2. recalculateAllGroupPlatformRatings: bulk upsert for all media items in a
 *    group, cleanup of stale entries, consistency with individual recalculation.
 * 3. recalculateGroupPlatformRatingsForUser: updates all groups a user belongs
 *    to when their estimated rating changes.
 * 4. The 3-table join path: listItem -> list -> userGroupMember — verifies that
 *    only group members' estimatedRating values are included.
 * 5. Edge cases: single member, no watchlist items, no estimated ratings,
 *    concurrent upserts.
 */
describe('group platform rating cache', () => {
  // Test users
  const user1 = { id: 10, name: 'user1', admin: false, password: 'pw', publicReviews: false };
  const user2 = { id: 11, name: 'user2', admin: false, password: 'pw', publicReviews: false };
  const user3 = { id: 12, name: 'user3', admin: false, password: 'pw', publicReviews: false };
  const nonMemberUser = { id: 13, name: 'nonmember', admin: false, password: 'pw', publicReviews: false };

  // Watchlists (one per user)
  const watchlist1 = {
    id: 10, userId: user1.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
    allowComments: false, displayNumbers: false,
  };
  const watchlist2 = {
    id: 11, userId: user2.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
    allowComments: false, displayNumbers: false,
  };
  const watchlist3 = {
    id: 12, userId: user3.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
    allowComments: false, displayNumbers: false,
  };
  const nonMemberWatchlist = {
    id: 13, userId: nonMemberUser.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
    allowComments: false, displayNumbers: false,
  };

  // Media items
  const movieA = {
    id: 10, lastTimeUpdated: Date.now(), mediaType: 'movie',
    source: 'tmdb', title: 'Movie A', tmdbId: 10001,
  };
  const movieB = {
    id: 11, lastTimeUpdated: Date.now(), mediaType: 'movie',
    source: 'tmdb', title: 'Movie B', tmdbId: 10002,
  };
  const movieC = {
    id: 12, lastTimeUpdated: Date.now(), mediaType: 'movie',
    source: 'tmdb', title: 'Movie C', tmdbId: 10003,
  };

  // Groups
  const groupAlpha = { id: 1, name: 'Alpha Group', createdBy: user1.id, createdAt: Date.now() };
  const groupBeta = { id: 2, name: 'Beta Group', createdBy: user2.id, createdAt: Date.now() };

  beforeAll(async () => {
    await runMigrations();

    // Seed users
    await Database.knex('user').insert([user1, user2, user3, nonMemberUser]);

    // Seed media items
    await Database.knex('mediaItem').insert([movieA, movieB, movieC]);

    // Seed watchlists
    await Database.knex('list').insert([watchlist1, watchlist2, watchlist3, nonMemberWatchlist]);

    // Seed groups
    await Database.knex('userGroup').insert([groupAlpha, groupBeta]);

    // Seed group memberships
    // Alpha: user1 (admin), user2 (viewer), user3 (viewer)
    await Database.knex('userGroupMember').insert([
      { groupId: groupAlpha.id, userId: user1.id, role: 'admin', addedAt: Date.now() },
      { groupId: groupAlpha.id, userId: user2.id, role: 'viewer', addedAt: Date.now() },
      { groupId: groupAlpha.id, userId: user3.id, role: 'viewer', addedAt: Date.now() },
    ]);
    // Beta: user1 (admin), user3 (viewer)
    await Database.knex('userGroupMember').insert([
      { groupId: groupBeta.id, userId: user1.id, role: 'admin', addedAt: Date.now() },
      { groupId: groupBeta.id, userId: user3.id, role: 'viewer', addedAt: Date.now() },
    ]);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    // Clean up listItems, userRatings, and cached ratings between tests
    await Database.knex('listItem').delete();
    await Database.knex('userRating').delete();
    await Database.knex('groupPlatformRating').delete();
  });

  // ─── recalculateGroupPlatformRating ─────────────────────────────────────────

  describe('recalculateGroupPlatformRating()', () => {
    test('correct average when multiple members have ratings for the same media item', async () => {
      // user1 has estimatedRating 8, user2 has 6, user3 has 4
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
        { listId: watchlist3.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(8, 6, 4) = 6
      expect(cached.rating).toBeCloseTo(6, 5);
    });

    test('NULL result when no members have ratings for the media item', async () => {
      // No listItem rows with estimatedRating for movieA from any group member
      // Pre-seed a stale cache row to verify it gets cleaned up
      await Database.knex('groupPlatformRating').insert({
        groupId: groupAlpha.id,
        mediaItemId: movieA.id,
        rating: 7.5,
      });

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      // Stale row should be deleted
      expect(cached).toBeUndefined();
    });

    test('correct result when some members have ratings and others do not', async () => {
      // user1 has estimatedRating 9, user2 has null, user3 has 5
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 9 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: null },
        { listId: watchlist3.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 5 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(9, 5) = 7 (null excluded)
      expect(cached.rating).toBeCloseTo(7, 5);
    });

    test('only group members estimatedRatings are included — non-member ratings excluded', async () => {
      // nonMemberUser has a high rating, but is NOT in groupAlpha
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
        { listId: nonMemberWatchlist.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 10 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // Only user1's rating of 4 should be included (nonMemberUser excluded)
      expect(cached.rating).toBeCloseTo(4, 5);
    });

    test('group with single member returns that members rating', async () => {
      // groupBeta has user1 and user3. Only user1 has a rating.
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 7.5 },
      ]);

      await recalculateGroupPlatformRating(groupBeta.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupBeta.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      expect(cached.rating).toBeCloseTo(7.5, 5);
    });

    test('member with no watchlist items for the media item is excluded from average', async () => {
      // user1 and user2 have entries; user3 has no listItem for movieA at all
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(8, 6) = 7 (user3 has no listItem, so not counted)
      expect(cached.rating).toBeCloseTo(7, 5);
    });

    test('upsert correctly updates an existing cache row', async () => {
      // Pre-seed cache with old value
      await Database.knex('groupPlatformRating').insert({
        groupId: groupAlpha.id,
        mediaItemId: movieA.id,
        rating: 3.0,
      });

      // New estimatedRatings
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 9 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 7 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(9, 7) = 8 (old value of 3.0 should be replaced)
      expect(cached.rating).toBeCloseTo(8, 5);

      // Verify only one row exists (no duplicates)
      const count = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .count('* as cnt')
        .first();
      expect(Number(count!.cnt)).toBe(1);
    });

    test('concurrent upserts for the same (groupId, mediaItemId) produce correct final result', async () => {
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
      ]);

      // Fire two concurrent recalculations
      await Promise.all([
        recalculateGroupPlatformRating(groupAlpha.id, movieA.id),
        recalculateGroupPlatformRating(groupAlpha.id, movieA.id),
      ]);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // Both should compute the same value; final result should be AVG(8, 6) = 7
      expect(cached.rating).toBeCloseTo(7, 5);

      // Verify only one row exists
      const count = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .count('* as cnt')
        .first();
      expect(Number(count!.cnt)).toBe(1);
    });
  });

  // ─── recalculateAllGroupPlatformRatings ─────────────────────────────────────

  describe('recalculateAllGroupPlatformRatings()', () => {
    test('all media items for a group are recalculated', async () => {
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
        { listId: watchlist1.id, mediaItemId: movieB.id, addedAt: Date.now(), estimatedRating: 9 },
        { listId: watchlist3.id, mediaItemId: movieB.id, addedAt: Date.now(), estimatedRating: 5 },
        { listId: watchlist2.id, mediaItemId: movieC.id, addedAt: Date.now(), estimatedRating: 7 },
      ]);

      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      const cachedA = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      const cachedB = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieB.id })
        .first();
      const cachedC = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieC.id })
        .first();

      // movieA: AVG(8, 6) = 7
      expect(cachedA).toBeDefined();
      expect(cachedA.rating).toBeCloseTo(7, 5);

      // movieB: AVG(9, 5) = 7
      expect(cachedB).toBeDefined();
      expect(cachedB.rating).toBeCloseTo(7, 5);

      // movieC: AVG(7) = 7
      expect(cachedC).toBeDefined();
      expect(cachedC.rating).toBeCloseTo(7, 5);
    });

    test('bulk upsert produces same results as individual recalculation', async () => {
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
        { listId: watchlist1.id, mediaItemId: movieB.id, addedAt: Date.now(), estimatedRating: 6 },
      ]);

      // First: compute individually
      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);
      await recalculateGroupPlatformRating(groupAlpha.id, movieB.id);

      const individualA = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      const individualB = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieB.id })
        .first();

      // Reset cache
      await Database.knex('groupPlatformRating').delete();

      // Now: compute in bulk
      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      const bulkA = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      const bulkB = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieB.id })
        .first();

      // Results should match
      expect(bulkA.rating).toBeCloseTo(individualA.rating, 5);
      expect(bulkB.rating).toBeCloseTo(individualB.rating, 5);
    });

    test('stale cache entries are cleaned up when membership changes', async () => {
      // Pre-seed cache for movieC with a value
      await Database.knex('groupPlatformRating').insert({
        groupId: groupAlpha.id,
        mediaItemId: movieC.id,
        rating: 5.0,
      });

      // Only movieA has estimatedRatings from group members — movieC no longer valid
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
      ]);

      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      // movieA should have a cache entry
      const cachedA = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      expect(cachedA).toBeDefined();
      expect(cachedA.rating).toBeCloseTo(8, 5);

      // movieC stale entry should be deleted
      const cachedC = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieC.id })
        .first();
      expect(cachedC).toBeUndefined();
    });

    test('clears all cache rows when no members have any ratings', async () => {
      // Pre-seed cache entries
      await Database.knex('groupPlatformRating').insert([
        { groupId: groupAlpha.id, mediaItemId: movieA.id, rating: 5 },
        { groupId: groupAlpha.id, mediaItemId: movieB.id, rating: 6 },
      ]);

      // No listItems with estimatedRating from any group member
      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      const remaining = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id });

      expect(remaining).toHaveLength(0);
    });

    test('does not affect cache rows for other groups', async () => {
      // Seed data for both groups
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
      ]);

      // Pre-seed Beta group cache
      await Database.knex('groupPlatformRating').insert({
        groupId: groupBeta.id,
        mediaItemId: movieB.id,
        rating: 9.0,
      });

      // Recalculate only Alpha
      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      // Beta's cache should be untouched
      const betaCached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupBeta.id, mediaItemId: movieB.id })
        .first();
      expect(betaCached).toBeDefined();
      expect(betaCached.rating).toBeCloseTo(9.0, 5);
    });
  });

  // ─── recalculateGroupPlatformRatingsForUser ────────────────────────────────

  describe('recalculateGroupPlatformRatingsForUser()', () => {
    test('updates all groups a user belongs to for a specific media item', async () => {
      // user1 is in both groupAlpha and groupBeta
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        // user3 also in both groups — contributes different rating
        { listId: watchlist3.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
      ]);

      await recalculateGroupPlatformRatingsForUser(user1.id, movieA.id);

      // groupAlpha: members are user1, user2, user3
      // user1 has 8, user3 has 4, user2 has nothing → AVG(8, 4) = 6
      const cachedAlpha = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      expect(cachedAlpha).toBeDefined();
      expect(cachedAlpha.rating).toBeCloseTo(6, 5);

      // groupBeta: members are user1 and user3
      // user1 has 8, user3 has 4 → AVG(8, 4) = 6
      const cachedBeta = await Database.knex('groupPlatformRating')
        .where({ groupId: groupBeta.id, mediaItemId: movieA.id })
        .first();
      expect(cachedBeta).toBeDefined();
      expect(cachedBeta.rating).toBeCloseTo(6, 5);
    });

    test('does not update groups the user does not belong to', async () => {
      // nonMemberUser is not in any group
      await Database.knex('listItem').insert([
        { listId: nonMemberWatchlist.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 10 },
      ]);

      await recalculateGroupPlatformRatingsForUser(nonMemberUser.id, movieA.id);

      // No cache entries should be created for any group
      const allCached = await Database.knex('groupPlatformRating');
      expect(allCached).toHaveLength(0);
    });

    test('updates only the specified media item, not other items', async () => {
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
        { listId: watchlist1.id, mediaItemId: movieB.id, addedAt: Date.now(), estimatedRating: 5 },
      ]);

      // Only recalculate for movieA
      await recalculateGroupPlatformRatingsForUser(user1.id, movieA.id);

      // movieA should have cache entries
      const cachedA = await Database.knex('groupPlatformRating')
        .where({ mediaItemId: movieA.id });
      expect(cachedA.length).toBeGreaterThan(0);

      // movieB should NOT have any cache entries
      const cachedB = await Database.knex('groupPlatformRating')
        .where({ mediaItemId: movieB.id });
      expect(cachedB).toHaveLength(0);
    });

    test('handles user in multiple groups with different member compositions', async () => {
      // user1 in Alpha (user1, user2, user3) and Beta (user1, user3)
      // user2 has a rating only in Alpha context
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 10 },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
      ]);

      await recalculateGroupPlatformRatingsForUser(user1.id, movieA.id);

      // groupAlpha: user1=10, user2=6 → AVG(10, 6) = 8
      const cachedAlpha = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      expect(cachedAlpha).toBeDefined();
      expect(cachedAlpha.rating).toBeCloseTo(8, 5);

      // groupBeta: only user1=10 (user2 is not in Beta) → AVG(10) = 10
      const cachedBeta = await Database.knex('groupPlatformRating')
        .where({ groupId: groupBeta.id, mediaItemId: movieA.id })
        .first();
      expect(cachedBeta).toBeDefined();
      expect(cachedBeta.rating).toBeCloseTo(10, 5);
    });
  });

  // ─── 3-table join path verification ────────────────────────────────────────

  describe('3-table join path (listItem -> list -> userGroupMember)', () => {
    test('estimatedRating from a non-watchlist list owned by a group member is included', async () => {
      // Create a non-watchlist list for user1
      const customListId = 99;
      await Database.knex('list').insert({
        id: customListId, userId: user1.id, name: 'Custom List', privacy: 'private',
        sortBy: 'recently-added', sortOrder: 'desc',
        createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: false,
        allowComments: false, displayNumbers: false,
      });

      try {
        await Database.knex('listItem').insert([
          { listId: customListId, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 7 },
        ]);

        await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

        const cached = await Database.knex('groupPlatformRating')
          .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
          .first();

        expect(cached).toBeDefined();
        // The rating from the custom list should be included
        expect(cached.rating).toBeCloseTo(7, 5);
      } finally {
        await Database.knex('listItem').where('listId', customListId).delete();
        await Database.knex('list').where('id', customListId).delete();
      }
    });

    test('multiple listItems from same user for same media item are all included in average', async () => {
      // user1 has movieA in both watchlist and a custom list with different estimatedRatings
      const customListId = 98;
      await Database.knex('list').insert({
        id: customListId, userId: user1.id, name: 'Another List', privacy: 'private',
        sortBy: 'recently-added', sortOrder: 'desc',
        createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: false,
        allowComments: false, displayNumbers: false,
      });

      try {
        await Database.knex('listItem').insert([
          { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 8 },
          { listId: customListId, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 6 },
        ]);

        await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

        const cached = await Database.knex('groupPlatformRating')
          .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
          .first();

        expect(cached).toBeDefined();
        // AVG(8, 6) = 7 — both listItems from user1 are included
        expect(cached.rating).toBeCloseTo(7, 5);
      } finally {
        await Database.knex('listItem').where('listId', customListId).delete();
        await Database.knex('list').where('id', customListId).delete();
      }
    });

    test('listItem from a list owned by a non-member user is excluded', async () => {
      // nonMemberUser has estimatedRating for movieA, but is NOT a member of groupAlpha
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
        { listId: nonMemberWatchlist.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 10 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // Only user1's rating of 4 (nonMemberUser's 10 is excluded)
      expect(cached.rating).toBeCloseTo(4, 5);
    });
  });

  // ─── userRating.rating signal inclusion ─────────────────────────────────────

  describe('userRating.rating included in group cache computation', () => {
    test('userRating alone (no estimatedRating) produces correct average', async () => {
      // user1 has an explicit item-level rating of 8 for movieA in groupAlpha
      await Database.knex('userRating').insert([
        {
          mediaItemId: movieA.id, userId: user1.id, rating: 8,
          date: Date.now(), episodeId: null, seasonId: null,
        },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      expect(cached.rating).toBeCloseTo(8, 5);
    });

    test('userRating and estimatedRating are averaged together', async () => {
      // user1 has explicit rating 9; user2 has estimatedRating 5
      await Database.knex('userRating').insert([
        {
          mediaItemId: movieA.id, userId: user1.id, rating: 9,
          date: Date.now(), episodeId: null, seasonId: null,
        },
      ]);
      await Database.knex('listItem').insert([
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 5 },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(9, 5) = 7
      expect(cached.rating).toBeCloseTo(7, 5);
    });

    test('multiple group members with userRatings are averaged correctly', async () => {
      // user1=6, user2=8, user3=4 — all explicit ratings
      await Database.knex('userRating').insert([
        { mediaItemId: movieA.id, userId: user1.id, rating: 6, date: Date.now(), episodeId: null, seasonId: null },
        { mediaItemId: movieA.id, userId: user2.id, rating: 8, date: Date.now(), episodeId: null, seasonId: null },
        { mediaItemId: movieA.id, userId: user3.id, rating: 4, date: Date.now(), episodeId: null, seasonId: null },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // AVG(6, 8, 4) = 6
      expect(cached.rating).toBeCloseTo(6, 5);
    });

    test('episode and season userRatings are excluded — only item-level ratings count', async () => {
      // Create a minimal tvShow + season + episode to satisfy FK constraints.
      // user1 will have an episode-level rating; user2 a season-level rating.
      // Only user3's item-level rating (episodeId IS NULL AND seasonId IS NULL) should count.
      const tvShowId = 50;
      const seasonId = 50;
      const episodeId = 50;
      await Database.knex('mediaItem').insert({
        id: tvShowId, lastTimeUpdated: Date.now(), mediaType: 'tv',
        source: 'tmdb', title: 'Test TV Show', tmdbId: 50001,
      });
      await Database.knex('season').insert({
        id: seasonId, seasonNumber: 1, tvShowId, numberOfEpisodes: 1,
        title: 'Season 1', isSpecialSeason: false,
      });
      await Database.knex('episode').insert({
        id: episodeId, episodeNumber: 1, seasonId, tvShowId,
        seasonNumber: 1, isSpecialEpisode: false,
        seasonAndEpisodeNumber: 1001, title: 'Episode 1',
      });

      try {
        await Database.knex('userRating').insert([
          // Episode-level rating — must be excluded
          { mediaItemId: tvShowId, userId: user1.id, rating: 10, date: Date.now(), episodeId, seasonId: null },
          // Season-level rating — must be excluded
          { mediaItemId: tvShowId, userId: user2.id, rating: 10, date: Date.now(), episodeId: null, seasonId },
          // Item-level rating — must be included
          { mediaItemId: tvShowId, userId: user3.id, rating: 4,  date: Date.now(), episodeId: null, seasonId: null },
        ]);

        await recalculateGroupPlatformRating(groupAlpha.id, tvShowId);

        const cached = await Database.knex('groupPlatformRating')
          .where({ groupId: groupAlpha.id, mediaItemId: tvShowId })
          .first();

        expect(cached).toBeDefined();
        // Only user3's item-level rating of 4 should be included; episode + season ratings excluded
        expect(cached.rating).toBeCloseTo(4, 5);
      } finally {
        // Delete in FK-safe order: userRating → episode → season → mediaItem
        await Database.knex('userRating').where('mediaItemId', tvShowId).delete();
        await Database.knex('groupPlatformRating').where('mediaItemId', tvShowId).delete();
        await Database.knex('episode').where('id', episodeId).delete();
        await Database.knex('season').where('id', seasonId).delete();
        await Database.knex('mediaItem').where('id', tvShowId).delete();
      }
    });

    test('userRating from a non-group member is excluded', async () => {
      // nonMemberUser has a high rating but is NOT in groupAlpha
      await Database.knex('userRating').insert([
        { mediaItemId: movieA.id, userId: user1.id,       rating: 4,  date: Date.now(), episodeId: null, seasonId: null },
        { mediaItemId: movieA.id, userId: nonMemberUser.id, rating: 10, date: Date.now(), episodeId: null, seasonId: null },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      expect(cached).toBeDefined();
      // Only user1's rating; nonMemberUser excluded
      expect(cached.rating).toBeCloseTo(4, 5);
    });

    test('recalculateAllGroupPlatformRatings includes userRating in bulk computation', async () => {
      // user1 has explicit ratings for movieA and movieB; user2 has estimatedRating for movieA
      await Database.knex('userRating').insert([
        { mediaItemId: movieA.id, userId: user1.id, rating: 8, date: Date.now(), episodeId: null, seasonId: null },
        { mediaItemId: movieB.id, userId: user1.id, rating: 6, date: Date.now(), episodeId: null, seasonId: null },
      ]);
      await Database.knex('listItem').insert([
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 4 },
      ]);

      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      const cachedA = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();
      const cachedB = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieB.id })
        .first();

      // movieA: AVG(8 from userRating, 4 from estimatedRating) = 6
      expect(cachedA).toBeDefined();
      expect(cachedA.rating).toBeCloseTo(6, 5);

      // movieB: AVG(6 from userRating only) = 6
      expect(cachedB).toBeDefined();
      expect(cachedB.rating).toBeCloseTo(6, 5);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('media item with no estimated ratings from any group member returns null', async () => {
      // listItem exists but estimatedRating is NULL
      await Database.knex('listItem').insert([
        { listId: watchlist1.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: null },
        { listId: watchlist2.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: null },
      ]);

      await recalculateGroupPlatformRating(groupAlpha.id, movieA.id);

      const cached = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id, mediaItemId: movieA.id })
        .first();

      // No valid ratings → no cache entry
      expect(cached).toBeUndefined();
    });

    test('recalculateAll with no listItems at all clears all group cache', async () => {
      // Pre-seed cache entries
      await Database.knex('groupPlatformRating').insert([
        { groupId: groupAlpha.id, mediaItemId: movieA.id, rating: 5 },
        { groupId: groupAlpha.id, mediaItemId: movieB.id, rating: 6 },
      ]);

      // No listItem rows in the database at all
      await recalculateAllGroupPlatformRatings(groupAlpha.id);

      const remaining = await Database.knex('groupPlatformRating')
        .where({ groupId: groupAlpha.id });
      expect(remaining).toHaveLength(0);
    });

    test('recalculateForUser with user who belongs to no groups is a no-op', async () => {
      await Database.knex('listItem').insert([
        { listId: nonMemberWatchlist.id, mediaItemId: movieA.id, addedAt: Date.now(), estimatedRating: 10 },
      ]);

      // nonMemberUser belongs to no groups
      await recalculateGroupPlatformRatingsForUser(nonMemberUser.id, movieA.id);

      const allCached = await Database.knex('groupPlatformRating');
      expect(allCached).toHaveLength(0);
    });

    test('recalculateAll handles >500 rated items without hitting SQLite compound SELECT limit', async () => {
      // SQLite limits compound SELECT to 500 terms; Knex bulk insert generates one term per row.
      // Use 501 items to verify the chunked upsert path is exercised.
      const ITEM_COUNT = 501;
      const BASE_ID = 5000;

      const manyItems = Array.from({ length: ITEM_COUNT }, (_, i) => ({
        id: BASE_ID + i,
        lastTimeUpdated: Date.now(),
        mediaType: 'movie',
        source: 'tmdb',
        title: `BulkMovie${i}`,
        tmdbId: BASE_ID + i,
      }));

      // Insert in chunks of 200 to stay well under SQLite's compound SELECT limit
      const CHUNK = 200;
      for (let i = 0; i < manyItems.length; i += CHUNK) {
        await Database.knex('mediaItem').insert(manyItems.slice(i, i + CHUNK));
      }

      // Seed one list item per media item on user1's watchlist (a group member)
      const listItems = manyItems.map((item) => ({
        listId: watchlist1.id,
        mediaItemId: item.id,
        addedAt: Date.now(),
        estimatedRating: 3,
      }));
      for (let i = 0; i < listItems.length; i += CHUNK) {
        await Database.knex('listItem').insert(listItems.slice(i, i + CHUNK));
      }

      // Should not throw even though 501 > 500 SQLite compound SELECT limit
      await expect(
        recalculateAllGroupPlatformRatings(groupAlpha.id)
      ).resolves.toBeUndefined();

      // All 501 items should have a cache entry
      const cached = await Database.knex('groupPlatformRating').where({ groupId: groupAlpha.id });
      expect(cached).toHaveLength(ITEM_COUNT);
      expect(cached.every((r: { rating: number }) => r.rating === 3)).toBe(true);

      // Clean up: delete in FK-safe order (listItem references mediaItem).
      // afterEach also cleans listItem/groupPlatformRating but runs after the test body,
      // so we must remove listItems before we can delete the extra mediaItems here.
      const ids = manyItems.map((m) => m.id);
      await Database.knex('listItem').whereIn('mediaItemId', ids).delete();
      await Database.knex('mediaItem').whereIn('id', ids).delete();
    });
  });
});
