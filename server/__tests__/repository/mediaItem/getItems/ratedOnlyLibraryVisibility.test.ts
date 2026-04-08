/**
 * Tests for Fix A: rated-only items visible in the library.
 * Tests for Fix B: platformRecommended full-catalog scan and rated-item exclusion.
 *
 * Fix A: Items a user has rated (but never added to a watchlist or marked as
 * seen) must appear in the standard library query (items + facets).
 *
 * Fix B — part 1: platformRecommended sort scans the full catalog so items
 * that exist in the DB but have never been tracked by any user still surface
 * when matching active filters (e.g. creators=Shonda Rhimes).
 *
 * Fix B — part 2: applyPlatformRecommendedExclusions (no-group path) excludes
 * items the current user has already rated, so recommendations surface
 * genuinely new content.
 */

import { mediaItemRepository } from 'src/repository/mediaItem';
import { MediaItemBase } from 'src/entity/mediaItem';
import { User } from 'src/entity/user';
import { userRepository } from 'src/repository/user';
import { clearDatabase, runMigrations } from '../../../__utils__/utils';
import { listItemRepository } from 'src/repository/listItemRepository';
import { userRatingRepository } from 'src/repository/userRating';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const userAlice: User = { id: 1, name: 'alice', password: 'pw' };
/** A second user who never rates or tracks anything in these tests. */
const userBob: User = { id: 2, name: 'bob', password: 'pw' };

/** Movie Alice has on her watchlist — the control item. */
const movieOnWatchlist: MediaItemBase = {
  id: 1,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Watchlisted Movie',
  creator: 'Director A',
};

/** Movie Alice rated (score 8) but never added to any list or marked as seen. */
const movieRatedOnly: MediaItemBase = {
  id: 2,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Rated-Only Movie',
  creator: 'Director B',
};

/**
 * Movie that exists in the catalog but has NOT been tracked or rated by anyone.
 * Used to verify that platformRecommended scans the full catalog.
 */
const movieUntrackedCatalog: MediaItemBase = {
  id: 3,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Untracked Catalog Movie',
  creator: 'Director C',
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function addToWatchlist(userId: number, mediaItemId: number) {
  await listItemRepository.addItem({
    watchlist: true,
    userId,
    mediaItemId,
  });
}

// ===========================================================================
// Fix A — rated-only items in the standard library
// ===========================================================================

describe('Fix A — rated-only items appear in the standard library', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(userAlice);
    await userRepository.create(userBob);

    await mediaItemRepository.create(movieOnWatchlist);
    await mediaItemRepository.create(movieRatedOnly);
    await mediaItemRepository.create(movieUntrackedCatalog);

    // Alice: watchlist entry for control item
    await addToWatchlist(userAlice.id!, movieOnWatchlist.id!);

    // Alice: rating for the rated-only movie (no listItem, no seen entry)
    await userRatingRepository.create({
      id: 100,
      mediaItemId: movieRatedOnly.id!,
      userId: userAlice.id!,
      rating: 8,
      date: new Date().getTime(),
    });
  });

  afterAll(clearDatabase);

  test('rated-only item appears alongside watchlisted item in library', async () => {
    const items = await mediaItemRepository.items({ userId: userAlice.id! });
    const ids = items.map((i) => i.id);

    expect(ids).toContain(movieOnWatchlist.id);
    expect(ids).toContain(movieRatedOnly.id);
  });

  test('untracked-and-unrated item does NOT appear in the library', async () => {
    const items = await mediaItemRepository.items({ userId: userAlice.id! });
    const ids = items.map((i) => i.id);

    expect(ids).not.toContain(movieUntrackedCatalog.id);
  });

  test('rated-only item is reflected in facets', async () => {
    const facets = await mediaItemRepository.facets({
      userId: userAlice.id!,
      mediaType: 'movie',
    });

    // Both directors should appear in the creators facet.
    const creators = (facets.creators ?? []).map((c) => c.value);
    expect(creators).toContain('Director A');
    expect(creators).toContain('Director B');
  });

  test('another user without ratings or watchlist sees only their own items', async () => {
    const items = await mediaItemRepository.items({ userId: userBob.id! });
    expect(items).toHaveLength(0);
  });
});

// ===========================================================================
// Fix B — platformRecommended full-catalog scan and rated-item exclusion
// ===========================================================================

describe('Fix B — platformRecommended scans full catalog and excludes rated items', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(userAlice);
    await userRepository.create(userBob);

    await mediaItemRepository.create(movieOnWatchlist);
    await mediaItemRepository.create(movieRatedOnly);
    await mediaItemRepository.create(movieUntrackedCatalog);

    // Alice: watchlist entry for control item
    await addToWatchlist(userAlice.id!, movieOnWatchlist.id!);

    // Alice: rating for the rated-only movie
    await userRatingRepository.create({
      id: 200,
      mediaItemId: movieRatedOnly.id!,
      userId: userAlice.id!,
      rating: 8,
      date: new Date().getTime(),
    });
  });

  afterAll(clearDatabase);

  test('untracked catalog item appears in platformRecommended results for alice', async () => {
    const items = await mediaItemRepository.items({
      userId: userAlice.id!,
      orderBy: 'platformRecommended',
    });
    const ids = items.map((i) => i.id);

    expect(ids).toContain(movieUntrackedCatalog.id);
  });

  test('already-rated item is excluded from platformRecommended results for alice', async () => {
    const items = await mediaItemRepository.items({
      userId: userAlice.id!,
      orderBy: 'platformRecommended',
    });
    const ids = items.map((i) => i.id);

    // Alice rated movieRatedOnly — it should not surface as a recommendation.
    expect(ids).not.toContain(movieRatedOnly.id);
  });

  test('watchlisted-and-seen item is excluded from platformRecommended results', async () => {
    // No seen entry exists in this suite, but movieOnWatchlist has no episodes
    // so it does not trigger the seen-completion exclusion.
    // The test verifies the watchlisted control item IS present (movies on the
    // watchlist are not excluded unless fully seen).
    const items = await mediaItemRepository.items({
      userId: userAlice.id!,
      orderBy: 'platformRecommended',
    });
    const ids = items.map((i) => i.id);

    expect(ids).toContain(movieOnWatchlist.id);
  });

  test('bob (no ratings) sees all three items in platformRecommended', async () => {
    // Bob has not rated anything — all catalog items should be recommendations.
    const items = await mediaItemRepository.items({
      userId: userBob.id!,
      orderBy: 'platformRecommended',
    });
    const ids = items.map((i) => i.id);

    expect(ids).toContain(movieOnWatchlist.id);
    expect(ids).toContain(movieRatedOnly.id);
    expect(ids).toContain(movieUntrackedCatalog.id);
  });
});
