# upnext

## What This Is

upnext is a recommendation feature built directly into the MediaTrackerPlus fork. When a user submits a rating, a `RecommendationService` runs asynchronously and queries external metadata APIs (TMDB, IGDB, OpenLibrary) to find similar content, then adds those items to the user's watchlist with an estimated rating derived from the source item. A new "recommended" sort mode surfaces watchlist items in a scored order that blends the estimated rating with external API ratings.

## Core Value

When a user rates something they loved, the next thing they should watch is already waiting for them — ranked, deduped, and ready.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] After a user rating is saved, recommendation processing runs asynchronously without blocking the rating save response
- [ ] Recommendation service queries TMDB "similar" endpoint for movies and TV shows
- [ ] Recommendation service queries OpenLibrary for book recommendations using subject-based search
- [ ] Recommendation service queries IGDB for game recommendations using two-step similar_games query
- [ ] Recommended items are added to the user's watchlist via existing repository layer
- [ ] Items already watched or already rated are skipped (not added)
- [ ] If a recommended item is already on the watchlist, its estimated rating is updated only if the source rating is higher than the current estimated rating
- [ ] Each watchlist item stores an estimated rating in a new `estimatedRating` float column on the listItem schema
- [ ] MediaTrackerPlus exposes a "recommended" watchlist sort option that orders by weighted average of estimatedRating and external API rating (configurable weights)
- [ ] Integration tests run against the local MediaTrackerPlus instance

### Out of Scope

- Recommendations triggered by watch history (ratings only, for v1) — complexity vs. signal quality tradeoff
- Book and game recommendations with high quality (limited free API coverage) — known gap, accept for v1
- TMDB "recommendations" endpoint — using "similar" only for consistent, genre-based results
- UI changes beyond the new sort option — no dedicated recommendations page for v1
- Manual/on-demand recommendation refresh — event-driven only for v1
- Standalone sidecar service — no plugin mechanism exists in MediaTracker; direct fork integration is simpler and eliminates the search-and-import complexity

## Context

### Research Background
An extensive research phase (March 2026) established that no free platform provides recommendation functionality across all media types. Ryot (the main competitor) paywalls recommendations at $60 lifetime. MediaTracker is stale; MediaTrackerPlus is an active but small fork. upnext builds recommendation capability directly into this fork.

### Architecture
- **Approach**: Direct fork modification — recommendation logic lives in `server/src/services/recommendations/`
- **Rating hook**: `RatingController.add()` calls `setImmediate(() => recommendationService.processRating(...))` after `res.send()`, so the rating response is never delayed
- **Provider reuse**: Existing `MetadataProvider<Name>` base class with TMDB, IGDB, OpenLibrary implementations are reused directly — no duplicate API clients
- **Data access**: Direct access via `listItemRepository` and `mediaItemRepository` — no REST API roundtrip, no search-and-import dance
- **Stack**: Node.js + TypeScript backend (Express), SQLite/PostgreSQL via Knex
- **Rating flow**: `PUT /api/rating` → `userRatingRepository.updateOrCreate()` → `res.send()` → `setImmediate(recommendationService.processRating)`
- **List schema**: `listItem` table needs new `estimatedRating` (nullable float) column
- **Existing sort options**: `my-rating`, `recently-added`, `recently-watched`, `recently-aired`, `next-airing`, `release-date`, `runtime`, `title` — "recommended" to be added

### Ordering Formula
`score = (estimatedRating × W_est) + (externalRating × W_ext)` where weights are configurable (default: 60/40). Items with no external rating fall back to estimatedRating only.

## Constraints

- **Tech stack**: TypeScript/Node.js — matches existing codebase
- **Provider reuse**: Must use existing TMDB, IGDB, OpenLibrary provider implementations — no duplicate clients
- **Fork discipline**: Changes must be minimal and clearly documented to reduce merge conflict surface
- **No paid services**: All external APIs used must remain free (TMDB free tier, OpenLibrary public API, IGDB free tier)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct fork integration, not sidecar | No plugin mechanism exists; sidecar would add two-service complexity and the search-and-import dance with no meaningful isolation benefit | ✓ Good |
| Async via setImmediate, not webhooks | Direct call avoids network hop, credential duplication, and HMAC infrastructure; setImmediate preserves fire-and-forget semantics | ✓ Good |
| Reuse existing MetadataProvider implementations | TMDB, IGDB, OpenLibrary clients are already written and tested in the fork — no reason to duplicate them | ✓ Good |
| estimatedRating as dedicated float column | Dedicated column avoids JSON extraction in ORDER BY (Pitfall 8); backward-compatible via nullable Knex migration | ✓ Good |
| TMDB "similar" not "recommendations" | Similar is genre/metadata-based and returns more results; recommendations are TMDB-curated and sparser | — Pending |
| Update estimatedRating only if source is higher | Preserves the highest-confidence signal without regressing already-strong candidates | — Pending |
| Skip watched + rated items | Avoids polluting the watchlist with content the user already has opinions on | — Pending |
| TypeScript in-memory sort for "recommended" | SQLite vs PostgreSQL have different JSON extraction syntax; in-memory sort is dialect-safe at personal-tracker scale | — Pending |

---
*Last updated: 2026-03-06 after architecture pivot from sidecar to direct fork integration*
