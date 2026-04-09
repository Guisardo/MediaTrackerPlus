---
name: Library query excludes rated-only items fix
description: Items that a user has only rated (no watchlist entry, no seen entry) were invisible in all library queries including facet filtering
type: project
---

Items that a user has only rated (via `userRating`) but never added to a watchlist (`listItem`) and never marked as seen (`seen`) were excluded from library queries. Both `getItemsKnexSql` and `getFacetsKnex` in `server/src/knex/queries/items.ts` had a WHERE clause that only checked `listItem.mediaItemId IS NOT NULL OR lastSeen.mediaItemId IS NOT NULL`.

**Why:** A user with only a rating had NULL for both conditions and was silently filtered out. This caused facet-filtered views (e.g., `#/tv?creators=Shonda+Rhimes`) to return empty for that user even though the item existed.

**How to apply:** Any time the library visibility filter is changed (around lines 1012–1018 for `getItemsKnexSql` and lines 1360–1368 for `getFacetsKnex`), the full condition must be: `listItem IS NOT NULL OR lastSeen IS NOT NULL OR userRating.rating IS NOT NULL OR userRating.review IS NOT NULL`. The `userRating` join was already present in both query builders so no join changes were needed.
