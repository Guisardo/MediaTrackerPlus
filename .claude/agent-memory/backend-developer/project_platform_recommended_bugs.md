---
name: platformRecommended sort bug fixes — catalog scope + rated-item exclusion
description: Two bugs fixed in platformRecommended sort: items not in any list were invisible, and already-rated content appeared in recommendations
type: project
---

Two bugs existed in `server/src/knex/queries/items.ts` for the `platformRecommended` sort mode.

**Bug 1 — Items not in any user's watchlist were invisible**

The base filter `query.whereNotNull('anyListItem.mediaItemId')` required items to appear in at least one user's `listItem`. Items that exist in the DB but have never been added to anyone's watchlist (e.g. Private Practice / id=2724 by Shonda Rhimes) were completely invisible even when matching active filters like `creators=Shonda Rhimes`.

Fix: Remove the `anyListItem` base filter entirely for `platformRecommended` mode in both `getItemsKnexSql` (line ~1012) and `getFacetsKnex` (line ~1365). The catalog is now scanned in full; narrowing is delegated to exclusions and caller-supplied filters.

**Bug 2 — Already-rated content appeared in recommendations**

`applyPlatformRecommendedExclusions` excluded fully-seen content but did not exclude items the current user had already rated. So violeta saw Grey's Anatomy (which she rated 5/5) in her recommendations.

Fix: In the non-group branch of `applyPlatformRecommendedExclusions` (after the two `whereRaw` NOT-EXISTS checks), add:

```typescript
query.whereNull('userRating.rating');
query.whereNull('userRating.review');
```

The `userRating` LEFT JOIN is already scoped to the current user (`andOnVal('userRating.userId', userId)`), so these checks affect only that user's ratings.

**Why:** The `anyListItem` join was added to prevent surfacing entirely unknown catalog items, but it over-restricted the pool when filters narrow by creator/genre. The rated-item exclusion was simply missing from the non-group path.

**How to apply:** When modifying the `platformRecommended` base filter in `getItemsKnexSql` or `getFacetsKnex`, do not restore the `anyListItem.mediaItemId IS NOT NULL` gate — it has been intentionally removed. The `applyPlatformRecommendedExclusions` function now handles both seen-item and rated-item exclusions for the non-group path.

**Test impact:** `platformRecommendedIntegration.test.ts` tests that verify sort order now query as a `viewerUser` (id=2, no ratings) rather than the user who did the rating, because rated items are correctly excluded from recommendations for the rating user. The viewer user needs a watchlist row (list id=99) to satisfy `getWatchlistId`.
