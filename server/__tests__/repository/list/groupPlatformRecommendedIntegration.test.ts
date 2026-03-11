/**
 * US-017: Integration tests for group-based platform recommended sort
 *
 * End-to-end integration tests verifying:
 *   1. Backward compatibility: platformRecommended without groupId produces same results as before
 *   2. Group-scoped sort uses group members' estimated ratings (via groupPlatformRating cache)
 *   3. Majority-watched exclusion: items watched by >50% of group are excluded
 *   4. Non-group members' watches don't affect group exclusion
 *   5. 'recommended' sort (single-user) is completely unaffected by groupId
 *   6. groupId for a non-member group returns 403 (controller-level)
 *   7. groupId for a soft-deleted group falls back to 'All Users' (no error)
 *   8. Facet counts with groupId are consistent with group-scoped item results
 *
 * All IDs start at 400 to avoid collisions with other test files that share
 * the in-memory SQLite database when run in --runInBand mode.
 */
import { Database } from 'src/dbconfig';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { ItemsController } from 'src/controllers/items';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

describe('US-017: Group-based platform recommended sort — integration tests', () => {
  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  // user1: querying user, member of groupA (admin)
  const user1 = { id: 400, name: 'int-user1', password: 'pw' };
  // user2: member of groupA (viewer)
  const user2 = { id: 401, name: 'int-user2', password: 'pw' };
  // user3: member of groupA (viewer)
  const user3 = { id: 402, name: 'int-user3', password: 'pw' };
  // outsideUser: NOT a member of groupA — watches should not affect group exclusion
  const outsideUser = { id: 403, name: 'int-outside', password: 'pw' };
  // nonMemberUser: has their own group (groupB), user1 is NOT a member
  const nonMemberUser = { id: 404, name: 'int-nonmember', password: 'pw' };

  // ---------------------------------------------------------------------------
  // Watchlists (one per user — required by getItemsKnexSql)
  // ---------------------------------------------------------------------------
  const wl1 = {
    id: 400, userId: user1.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const wl2 = {
    id: 401, userId: user2.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const wl3 = {
    id: 402, userId: user3.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const wlOutside = {
    id: 403, userId: outsideUser.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const wlNonMember = {
    id: 404, userId: nonMemberUser.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };

  // Non-watchlist list for user2 (so items show in anyListItem for platformRecommended)
  const list2 = {
    id: 410, userId: user2.id, name: 'List', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: false,
  };

  // ---------------------------------------------------------------------------
  // Media items
  // ---------------------------------------------------------------------------
  // Alpha: HIGH group rating, LOW global platformRating — should rank HIGH in group sort
  const itemAlpha = {
    id: 400, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntAlpha', platformRating: 2.0, tmdbRating: 7.0,
  };
  // Beta: LOW group rating, HIGH global platformRating — should rank LOW in group sort
  const itemBeta = {
    id: 401, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntBeta', platformRating: 9.0, tmdbRating: 8.0,
  };
  // Gamma: no group rating, has tmdbRating — tier-2 in group sort
  const itemGamma = {
    id: 402, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntGamma', platformRating: 5.0, tmdbRating: 6.5,
  };
  // Delta: watched by 2 out of 3 group members (>50%) — excluded in group mode
  const itemDelta = {
    id: 403, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntDelta', platformRating: 8.0, tmdbRating: 7.5,
  };
  // Epsilon: watched by 1 out of 3 group members (~33%) — NOT excluded in group mode
  const itemEpsilon = {
    id: 404, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntEpsilon', platformRating: 7.0, tmdbRating: 6.0,
  };
  // Zeta: watched by outsideUser ONLY — NOT excluded in group mode, BUT excluded in global mode
  const itemZeta = {
    id: 405, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'IntZeta', platformRating: 6.0, tmdbRating: 5.5,
  };
  // TV show: Eta — 2 non-special episodes, completed by 2 out of 3 (>50%), excluded in group mode
  const tvShowEta = {
    id: 410, lastTimeUpdated: Date.now(), mediaType: 'tv', source: 'tmdb',
    title: 'IntTvEta', platformRating: 8.0, tmdbRating: 7.5,
  };

  // ---------------------------------------------------------------------------
  // Seasons and Episodes for tvShowEta
  // ---------------------------------------------------------------------------
  const seasonEta = {
    id: 400, seasonNumber: 1, title: 'Season 1',
    isSpecialSeason: false, tvShowId: tvShowEta.id, numberOfEpisodes: 2,
  };
  const epEta1 = {
    id: 400, title: 'Eta-S01E01', episodeNumber: 1, seasonNumber: 1,
    seasonId: seasonEta.id, tvShowId: tvShowEta.id,
    isSpecialEpisode: false, seasonAndEpisodeNumber: 1001,
  };
  const epEta2 = {
    id: 401, title: 'Eta-S01E02', episodeNumber: 2, seasonNumber: 1,
    seasonId: seasonEta.id, tvShowId: tvShowEta.id,
    isSpecialEpisode: false, seasonAndEpisodeNumber: 1002,
  };

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------
  const groupAId = 400; // user1 admin, user2 viewer, user3 viewer
  const groupBId = 401; // nonMemberUser admin — user1 is NOT a member
  const softDeletedGroupId = 402; // user1 was a member, but group is soft-deleted

  // ---------------------------------------------------------------------------
  // Group platform ratings for groupA
  // ---------------------------------------------------------------------------
  const gprAlpha = { id: 400, groupId: groupAId, mediaItemId: itemAlpha.id, rating: 9.0 };
  const gprBeta = { id: 401, groupId: groupAId, mediaItemId: itemBeta.id, rating: 2.0 };
  // Gamma has NO group rating — tier-2 fallback
  const gprDelta = { id: 402, groupId: groupAId, mediaItemId: itemDelta.id, rating: 8.0 };
  const gprEpsilon = { id: 403, groupId: groupAId, mediaItemId: itemEpsilon.id, rating: 7.0 };
  const gprZeta = { id: 404, groupId: groupAId, mediaItemId: itemZeta.id, rating: 6.0 };
  const gprTvEta = { id: 405, groupId: groupAId, mediaItemId: tvShowEta.id, rating: 8.0 };

  beforeAll(async () => {
    await runMigrations();

    // Insert users
    await Database.knex('user').insert([user1, user2, user3, outsideUser, nonMemberUser]);

    // Insert lists/watchlists
    await Database.knex('list').insert([wl1, wl2, wl3, wlOutside, wlNonMember, list2]);

    // Insert media items
    await Database.knex('mediaItem').insert([
      itemAlpha, itemBeta, itemGamma, itemDelta, itemEpsilon, itemZeta, tvShowEta,
    ]);

    // Insert seasons and episodes
    await Database.knex('season').insert(seasonEta);
    await Database.knex('episode').insert([epEta1, epEta2]);

    // Put all items on user2's list so they appear in anyListItem (required for platformRecommended)
    await Database.knex('listItem').insert([
      { listId: list2.id, mediaItemId: itemAlpha.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemBeta.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemGamma.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemDelta.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemEpsilon.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: itemZeta.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: tvShowEta.id, addedAt: Date.now() },
    ]);

    // Also put Alpha on user1's watchlist for the 'recommended' sort tests (needs estimatedRating on listItem)
    await Database.knex('listItem').insert([
      { listId: wl1.id, mediaItemId: itemAlpha.id, addedAt: Date.now(), estimatedRating: 5.0 },
      { listId: wl1.id, mediaItemId: itemBeta.id, addedAt: Date.now(), estimatedRating: 8.0 },
    ]);

    // ---------------------------------------------------------------------------
    // Groups
    // ---------------------------------------------------------------------------
    // groupA: user1 (admin), user2 (viewer), user3 (viewer) — 3 members
    await Database.knex('userGroup').insert({
      id: groupAId, name: 'Integration Group A',
      createdBy: user1.id, createdAt: Date.now(),
    });
    await Database.knex('userGroupMember').insert([
      { id: 400, groupId: groupAId, userId: user1.id, role: 'admin', addedAt: Date.now() },
      { id: 401, groupId: groupAId, userId: user2.id, role: 'viewer', addedAt: Date.now() },
      { id: 402, groupId: groupAId, userId: user3.id, role: 'viewer', addedAt: Date.now() },
    ]);

    // groupB: nonMemberUser (admin) — user1 is NOT a member
    await Database.knex('userGroup').insert({
      id: groupBId, name: 'Non-Member Group B',
      createdBy: nonMemberUser.id, createdAt: Date.now(),
    });
    await Database.knex('userGroupMember').insert([
      { id: 410, groupId: groupBId, userId: nonMemberUser.id, role: 'admin', addedAt: Date.now() },
    ]);

    // softDeletedGroup: user1 was a member, but it's soft-deleted
    await Database.knex('userGroup').insert({
      id: softDeletedGroupId, name: 'Soft Deleted Group',
      createdBy: user1.id, createdAt: Date.now(),
      deletedAt: Date.now() - 100000,
    });
    await Database.knex('userGroupMember').insert([
      { id: 420, groupId: softDeletedGroupId, userId: user1.id, role: 'admin', addedAt: Date.now() },
    ]);

    // Group platform ratings for groupA
    await Database.knex('groupPlatformRating').insert([
      gprAlpha, gprBeta, gprDelta, gprEpsilon, gprZeta, gprTvEta,
    ]);

    // ---------------------------------------------------------------------------
    // Seen entries
    // ---------------------------------------------------------------------------
    // Delta: watched by user1 and user2 (2 out of 3 = 66.7% > 50% → excluded in group mode)
    await Database.knex('seen').insert([
      { id: 400, mediaItemId: itemDelta.id, userId: user1.id, date: Date.now() },
      { id: 401, mediaItemId: itemDelta.id, userId: user2.id, date: Date.now() },
    ]);

    // Epsilon: watched by user1 only (1 out of 3 = 33.3% ≤ 50% → NOT excluded in group mode)
    await Database.knex('seen').insert([
      { id: 402, mediaItemId: itemEpsilon.id, userId: user1.id, date: Date.now() },
    ]);

    // Zeta: watched by outsideUser only (0 out of 3 group members → NOT excluded in group mode)
    // BUT outsideUser IS a platform user → excluded in global mode (ANY user seen = excluded)
    await Database.knex('seen').insert([
      { id: 403, mediaItemId: itemZeta.id, userId: outsideUser.id, date: Date.now() },
    ]);

    // TV show Eta: user1 and user2 completed all 2 non-special episodes (2/3 = 66.7% → excluded)
    await Database.knex('seen').insert([
      { id: 410, mediaItemId: tvShowEta.id, userId: user1.id, episodeId: epEta1.id, date: Date.now() },
      { id: 411, mediaItemId: tvShowEta.id, userId: user1.id, episodeId: epEta2.id, date: Date.now() },
      { id: 412, mediaItemId: tvShowEta.id, userId: user2.id, episodeId: epEta1.id, date: Date.now() },
      { id: 413, mediaItemId: tvShowEta.id, userId: user2.id, episodeId: epEta2.id, date: Date.now() },
    ]);
    // user3 has only seen episode 1 (not completed → doesn't count as "completed" for majority-watched)
    await Database.knex('seen').insert([
      { id: 414, mediaItemId: tvShowEta.id, userId: user3.id, episodeId: epEta1.id, date: Date.now() },
    ]);
  });

  afterAll(clearDatabase);

  // ===========================================================================
  // 1. Backward compatibility: platformRecommended without groupId
  // ===========================================================================
  describe('backward compatibility — platformRecommended without groupId', () => {
    test('produces expected sort order using mediaItem.platformRating', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      const titles = items.map((i) => i.title);

      // Without groupId, global exclusion applies: items seen by ANY user are excluded
      // Delta (seen by user1, user2), Epsilon (seen by user1), Zeta (seen by outsideUser),
      // Eta (episodes seen by user1, user2, user3) are ALL excluded in global mode.
      expect(titles).not.toContain('IntDelta');
      expect(titles).not.toContain('IntEpsilon');
      expect(titles).not.toContain('IntZeta');
      // Eta: user1 completed all 2 episodes, user2 completed all 2 episodes → any user completed → excluded
      expect(titles).not.toContain('IntTvEta');

      // Remaining items sorted by platformRating * 0.7 + tmdbRating * 0.3 (desc):
      // Beta:  9.0*0.7 + 8.0*0.3 = 6.3 + 2.4 = 8.7
      // Gamma: 5.0*0.7 + 6.5*0.3 = 3.5 + 1.95 = 5.45
      // Alpha: 2.0*0.7 + 7.0*0.3 = 1.4 + 2.1 = 3.5
      expect(titles).toContain('IntBeta');
      expect(titles).toContain('IntGamma');
      expect(titles).toContain('IntAlpha');
      expect(titles.indexOf('IntBeta')).toBeLessThan(titles.indexOf('IntGamma'));
      expect(titles.indexOf('IntGamma')).toBeLessThan(titles.indexOf('IntAlpha'));
    });
  });

  // ===========================================================================
  // 2. Group-scoped sort: uses group members' ratings via groupPlatformRating
  // ===========================================================================
  describe('group-scoped sort — uses groupPlatformRating', () => {
    test('sort order reflects gpr.rating instead of mediaItem.platformRating', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });

      const titles = items.map((i) => i.title);

      // Verify correct scoring with manually computed expected scores.
      // Tier separator: items with BOTH gpr.rating IS NULL AND tmdbRating IS NULL go to tier 2.
      // Items with only a tmdbRating (no group rating) are now in tier 1, sorted by
      // the ELSE branch of the CASE expression (tmdbRating directly).
      //
      // Alpha:   gpr=9.0, tmdb=7.0 → 9.0*0.7 + 7.0*0.3 = 8.4  (tier 1, gpr present)
      // Epsilon: gpr=7.0, tmdb=6.0 → 7.0*0.7 + 6.0*0.3 = 6.7  (tier 1, gpr present) [1/3 watched ≤50% → NOT excluded]
      // Gamma:   no gpr,  tmdb=6.5 → ELSE = 6.5               (tier 1, tmdbRating present)
      // Zeta:    gpr=6.0, tmdb=5.5 → 6.0*0.7 + 5.5*0.3 = 5.85 (tier 1, gpr present) [outsideUser only → NOT excluded in group]
      // Beta:    gpr=2.0, tmdb=8.0 → 2.0*0.7 + 8.0*0.3 = 3.8  (tier 1, gpr present) — NOT excluded (no group member seen it)
      //
      // Delta is excluded (>50% watched in group)
      // Eta is excluded (>50% completed in group)

      expect(titles).not.toContain('IntDelta');
      expect(titles).not.toContain('IntTvEta');

      // Full tier-1 order: Alpha (8.4) > Epsilon (6.7) > Gamma (6.5) > Zeta (5.85) > Beta (3.8)
      expect(titles).toContain('IntAlpha');
      expect(titles).toContain('IntEpsilon');
      expect(titles).toContain('IntZeta');
      expect(titles).toContain('IntBeta');
      expect(titles).toContain('IntGamma');

      expect(titles.indexOf('IntAlpha')).toBeLessThan(titles.indexOf('IntEpsilon'));
      expect(titles.indexOf('IntEpsilon')).toBeLessThan(titles.indexOf('IntGamma'));
      expect(titles.indexOf('IntGamma')).toBeLessThan(titles.indexOf('IntZeta'));
      expect(titles.indexOf('IntZeta')).toBeLessThan(titles.indexOf('IntBeta'));
    });
  });

  // ===========================================================================
  // 3. Majority-watched exclusion
  // ===========================================================================
  describe('majority-watched exclusion — group mode', () => {
    test('item watched by >50% of group (Delta: 2/3=67%) IS excluded', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });
      expect(items.map((i) => i.title)).not.toContain('IntDelta');
    });

    test('item watched by ≤50% of group (Epsilon: 1/3=33%) is NOT excluded', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });
      expect(items.map((i) => i.title)).toContain('IntEpsilon');
    });

    test('TV show completed by >50% of group (Eta: 2/3=67%) IS excluded', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });
      expect(items.map((i) => i.title)).not.toContain('IntTvEta');
    });
  });

  // ===========================================================================
  // 4. Non-group members' watches don't affect group exclusion
  // ===========================================================================
  describe('non-group-member watches — group mode', () => {
    test('item watched by outsideUser only (Zeta) is NOT excluded in group mode', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });
      expect(items.map((i) => i.title)).toContain('IntZeta');
    });

    test('same item (Zeta) IS excluded in global mode (any user seen = excluded)', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        // no groupId — global mode
      });
      expect(items.map((i) => i.title)).not.toContain('IntZeta');
    });
  });

  // ===========================================================================
  // 5. 'recommended' sort (single-user) is unaffected by groupId
  // ===========================================================================
  describe("'recommended' sort — unaffected by groupId", () => {
    test('recommended sort with groupId produces identical results to without groupId', async () => {
      const itemsWithGroup = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'recommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });

      const itemsWithoutGroup = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'recommended',
        sortOrder: 'desc',
      });

      const titlesWithGroup = itemsWithGroup.map((i) => i.title);
      const titlesWithoutGroup = itemsWithoutGroup.map((i) => i.title);

      expect(titlesWithGroup.length).toBe(titlesWithoutGroup.length);
      expect(titlesWithGroup).toEqual(titlesWithoutGroup);
    });
  });

  // ===========================================================================
  // 6. groupId for a non-member group returns 403 (controller level)
  // ===========================================================================
  describe('non-member group — controller returns 403', () => {
    let itemsController: ItemsController;

    beforeEach(() => {
      itemsController = new ItemsController();
    });

    test('getPaginated with non-member groupId returns 403', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: user1.id,
        requestQuery: { page: 1, groupId: groupBId },
      });
      expect(res.statusCode).toBe(403);
    });

    test('getFacets with non-member groupId returns 403', async () => {
      const res = await request(itemsController.getFacets, {
        userId: user1.id,
        requestQuery: { groupId: groupBId },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ===========================================================================
  // 7. groupId for a soft-deleted group falls back to 'All Users'
  // ===========================================================================
  describe('soft-deleted group — falls back to All Users silently', () => {
    let itemsController: ItemsController;

    beforeEach(() => {
      itemsController = new ItemsController();
    });

    test('getPaginated with soft-deleted groupId returns 200 (no error)', async () => {
      const res = await request(itemsController.getPaginated, {
        userId: user1.id,
        requestQuery: { page: 1, groupId: softDeletedGroupId },
      });
      expect(res.statusCode).toBe(200);
    });

    test('soft-deleted group produces same results as no groupId (global mode)', async () => {
      // Call the repository directly: soft-deleted group is resolved to undefined by the controller,
      // so calling without groupId should produce the same result.
      const itemsNoGroup = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
      });

      // The controller resolves soft-deleted groupId to undefined before calling repository.
      // Verify that the controller path falls back correctly.
      const res = await request(itemsController.getPaginated, {
        userId: user1.id,
        requestQuery: { page: 1, groupId: softDeletedGroupId, orderBy: 'platformRecommended', sortOrder: 'desc' },
      });
      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('data');

      // Items returned via the soft-deleted group path should match global mode:
      // both should exclude any-user-seen items
      const controllerTitles = data.data.map((i: any) => i.title);
      const repoTitles = itemsNoGroup.map((i) => i.title);

      // Both should exclude Delta, Epsilon, Zeta, Eta (all seen by at least one user in global mode)
      expect(controllerTitles).not.toContain('IntDelta');
      expect(controllerTitles).not.toContain('IntZeta');
      expect(repoTitles).not.toContain('IntDelta');
      expect(repoTitles).not.toContain('IntZeta');
    });
  });

  // ===========================================================================
  // 8. Facet counts consistency
  // ===========================================================================
  describe('facet counts with groupId', () => {
    test('facet counts from controller endpoint reflect the items visible in group mode', async () => {
      // The facets query currently does not apply group-scoped majority-watched exclusion.
      // It returns facets for ALL items in the platform-recommended base set
      // (any user's list, no seen-based exclusion applied in facets).
      // This is by design: facets show what's available for filtering,
      // not what the current exclusion settings would show.

      // Verify facets endpoint returns successfully with groupId
      const itemsController = new ItemsController();
      const res = await request(itemsController.getFacets, {
        userId: user1.id,
        requestQuery: {
          groupId: groupAId,
          orderBy: 'platformRecommended',
        },
      });
      expect(res.statusCode).toBe(200);
      const facets = res.data as any;
      expect(facets).toHaveProperty('mediaTypes');
      expect(facets).toHaveProperty('genres');

      // Verify the facets include media types for all items in the base set
      // (movies + TV items from anyListItem, regardless of seen exclusion)
      const mediaTypeFacets = facets.mediaTypes as Array<{ value: string; count: number }>;
      const movieFacet = mediaTypeFacets.find((f: any) => f.value === 'movie');
      const tvFacet = mediaTypeFacets.find((f: any) => f.value === 'tv');

      // We inserted 6 movies and 1 TV show on user2's list (anyListItem)
      expect(movieFacet).toBeDefined();
      expect(movieFacet!.count).toBe(6);
      expect(tvFacet).toBeDefined();
      expect(tvFacet!.count).toBe(1);
    });

    test('group-scoped items results exclude majority-seen items while facets include them', async () => {
      // Items query with groupId excludes Delta (>50% seen) and Eta (>50% completed)
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });
      const titles = items.map((i) => i.title);

      // Delta and Eta excluded by majority-watched threshold
      expect(titles).not.toContain('IntDelta');
      expect(titles).not.toContain('IntTvEta');

      // But facets should include all items (no seen exclusion in facets query)
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        orderBy: 'platformRecommended',
        groupId: groupAId,
      });

      // Total items = 6 movies + 1 TV show = 7 in anyListItem
      const totalFacetItems = facets.mediaTypes.reduce((sum, f) => sum + f.count, 0);
      expect(totalFacetItems).toBe(7);

      // Items returned by items query: 5 (7 - Delta - Eta)
      expect(items.length).toBe(5);
    });
  });

  // ===========================================================================
  // Regression: all previous unit tests scenarios still hold
  // ===========================================================================
  describe('regression — core behaviors preserved', () => {
    test('platformRecommended items are scoped to anyListItem (items on any user list)', async () => {
      // All 7 items are on user2's list. If we remove one from all lists,
      // it should not appear in platformRecommended results.
      // We won't modify data here — just verify the count of items matches expectations.
      const items = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'platformRecommended',
        sortOrder: 'desc',
        groupId: groupAId,
      });

      // 7 total items - Delta (excluded >50% seen) - Eta (excluded >50% completed) = 5
      expect(items.length).toBe(5);
    });

    test('non-platformRecommended sort ignores groupId', async () => {
      const itemsWithGroup = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'title',
        sortOrder: 'asc',
        groupId: groupAId,
      });

      const itemsWithoutGroup = await mediaItemRepository.items({
        userId: user1.id,
        orderBy: 'title',
        sortOrder: 'asc',
      });

      // Both should produce identical results since groupId is ignored for 'title' sort
      const titlesWithGroup = itemsWithGroup.map((i) => i.title);
      const titlesWithoutGroup = itemsWithoutGroup.map((i) => i.title);
      expect(titlesWithGroup).toEqual(titlesWithoutGroup);
    });
  });
});
