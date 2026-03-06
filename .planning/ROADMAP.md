# Roadmap: upnext

## Overview

upnext is built entirely within the MediaTrackerPlus fork. All recommendation logic lives in `server/src/services/recommendations/`. The build sequence is: schema migration first (prerequisite for all writes), then the recommendation service and rating hook (core feature), then the sort surface, then integration tests and documentation. Existing TMDB, IGDB, and OpenLibrary provider implementations are reused directly — no new API clients needed.

## Repository

All work is in `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus`.

## Phases

**Phase Numbering:**
- Integer phases (1–4): Planned v1 milestone work
- Decimal phases (e.g., 1.1): Urgent insertions created via `/gsd:insert-phase`

- [ ] **Phase 1: Schema Migration** - Add `estimatedRating` column to `listItem`
- [ ] **Phase 2: Recommendation Service** - Core recommendation logic with rating hook
- [ ] **Phase 3: Sort Surface** - "recommended" watchlist sort option
- [ ] **Phase 4: Integration Tests and Documentation** - End-to-end test coverage and fork documentation

## Phase Details

### Phase 1: Schema Migration
**Goal**: The `listItem` table has a nullable `estimatedRating` float column; all existing data is unaffected
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02
**Success Criteria** (what must be TRUE):
  1. Running migrations on a database with existing `listItem` rows succeeds without errors or data loss
  2. New `listItem` rows can be created without specifying `estimatedRating` (nullable — no default required)
  3. `estimatedRating` can be read and written as a float via the existing Knex query layer
  4. The `ListItem` TypeScript type includes `estimatedRating?: number`
  5. The migration timestamp uses a far-future value (e.g., `20990101000000`) to avoid colliding with upstream MediaTrackerPlus migrations

**Plans**: TBD

Plans:
- [ ] 01-01: Knex migration adding nullable `estimatedRating` float to `listItem` and TypeScript type update in `entity/list.ts`

---

### Phase 2: Recommendation Service
**Goal**: After a rating is saved, similar items for all four media types are automatically added to the watchlist with `estimatedRating` set — without delaying the rating save response
**Depends on**: Phase 1
**Requirements**: HOOK-01, HOOK-02, TMDB-01, TMDB-02, TMDB-03, TMDB-04, TMDB-05, IGDB-01, IGDB-02, IGDB-03, OLIB-01, OLIB-02, WLIST-01, WLIST-02, WLIST-03, WLIST-04, WLIST-05
**Success Criteria** (what must be TRUE):
  1. Rating a movie in MediaTrackerPlus triggers TMDB similar lookup; the `/api/rating` response is returned before the lookup begins
  2. Rating a TV show triggers TMDB similar TV lookup; rating a game triggers the IGDB two-step similar_games query; rating a book triggers OpenLibrary subject-based search
  3. Similar items not yet in the `mediaItem` table are imported via existing provider lookup before watchlist add
  4. Items already watched or already rated by the user are skipped
  5. Items already on the watchlist have `estimatedRating` updated only if the source rating is higher; otherwise left unchanged
  6. TMDB results with `vote_count < 10` and IGDB results with `total_rating_count < 5` are filtered out
  7. IGDB OAuth token is checked and refreshed before every call if expired or within 24h of expiry
  8. TMDB 429 responses are handled by waiting for the `Retry-After` duration; zero-result responses are logged, not thrown
  9. Any error in recommendation processing is caught, logged with full context, and does not propagate to the rating save request handler

**Plans**: TBD

Plans:
- [ ] 02-01: `RecommendationService` skeleton and `WatchlistWriter` (dedup, update-only-if-higher, import-if-missing)
- [ ] 02-02: TMDB similar movies and TV integration (reuse existing TMDB provider; add 429 handling and vote_count filter)
- [ ] 02-03: IGDB similar games integration (two-step query, token refresh, total_rating_count filter)
- [ ] 02-04: OpenLibrary similar books integration (subject-based search, no external rating)
- [ ] 02-05: Rating hook wiring in `RatingController.add()` (`setImmediate` post-`res.send()`)

---

### Phase 3: Sort Surface
**Goal**: MediaTrackerPlus watchlist exposes a "recommended" sort option that orders items by weighted composite score, with unscored items last
**Depends on**: Phase 2
**Requirements**: SORT-01, SORT-02, SORT-03, SORT-04, SORT-05, SORT-06
**Success Criteria** (what must be TRUE):
  1. The `ListSortBy` union includes `'recommended'`
  2. Selecting "recommended" orders watchlist items descending by `(estimatedRating × 0.6) + (externalRating × 0.4)`
  3. Items with no `estimatedRating` appear at the bottom of the sort, not excluded
  4. Books (no external rating) are scored on `estimatedRating` alone rather than zeroed out
  5. The sort produces correct ordering on both SQLite and PostgreSQL backends (TypeScript in-memory, not SQL `ORDER BY`)
  6. Weights are configurable; changing the default does not require a schema or API change

**Plans**: TBD

Plans:
- [ ] 03-01: `ListSortBy` union extension and TypeScript in-memory `'recommended'` sort in `listRepository.items()`

---

### Phase 4: Integration Tests and Documentation
**Goal**: All four media types verified end-to-end, dedup and update-guard confirmed, every silent-failure path observable, and all fork changes documented
**Depends on**: Phase 3
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, DOC-01
**Success Criteria** (what must be TRUE):
  1. Integration tests for movie, TV show, game, and book each pass the happy-path: rating saved → similar items in watchlist with `estimatedRating` set, running against the local MediaTrackerPlus instance
  2. A test verifies deduplication: the same rating event processed twice does not create duplicate watchlist entries
  3. A test verifies update-only-if-higher: `estimatedRating` updates when the source rating is higher and is unchanged when lower
  4. Unit tests cover `RecommendationService` with mocked provider and repository dependencies; all provider error paths are covered
  5. Every silent-failure path identified in `research/PITFALLS.md` produces a structured log entry with sufficient context to diagnose without additional instrumentation
  6. `FORK_CHANGES.md` exists in the repository listing every added/modified file, the nature of each change, and merge-conflict surface warnings

**Plans**: TBD

Plans:
- [ ] 04-01: Integration tests for all four media types (happy path) against local MediaTrackerPlus
- [ ] 04-02: Dedup and update-only-if-higher integration tests
- [ ] 04-03: `RecommendationService` unit tests with mocked dependencies and error path coverage
- [ ] 04-04: Log coverage audit against PITFALLS.md silent-failure paths and `FORK_CHANGES.md`

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema Migration | 0/1 | Not started | - |
| 2. Recommendation Service | 0/5 | Not started | - |
| 3. Sort Surface | 0/1 | Not started | - |
| 4. Integration Tests and Documentation | 0/4 | Not started | - |

---

## Dependency Notes

- **Phase 1 before all others:** The `estimatedRating` column is a schema prerequisite for any write in Phases 2–3.
- **Phase 2 before Phase 3:** Real estimated ratings make sort validation meaningful.
- **Phase 2 before Phase 4:** Integration tests require the full pipeline.
- **Phase 3 can overlap Phase 4:** The sort implementation is independent once Phase 2 is done; tests for both can be written together.

## Implementation Notes

### Provider Reuse (Phase 2)
The existing `MetadataProvider<Name>` implementations in `server/src/metadata/provider/` are the API clients. `RecommendationService` calls them directly — it does not implement new HTTP clients. The IGDB two-step similar_games query requires adding `similar_games` and rating fields to the existing IGDB query body (currently absent from MediaTrackerPlus's `igdb.ts`).

### Import-If-Missing (Phase 2 — WatchlistWriter)
Similar items returned by TMDB/IGDB have TMDB/IGDB IDs but may not yet exist in the `mediaItem` table. Before calling `listItemRepository.addItem()`, `WatchlistWriter` must look up the item by external ID in `mediaItemRepository`. If not found, trigger a metadata fetch via the relevant provider to create the `mediaItem` row. This is a standard repository operation — not a REST API roundtrip.

### IGDB Score Normalization (Phase 2)
IGDB `total_rating` is 0–100. Divide by 10 before applying the composite score formula to align with TMDB `vote_average` (0–10) and `estimatedRating` (0–10 scale from MediaTrackerPlus rating flow).

### Migration Timestamp (Phase 1)
Use a far-future timestamp (e.g., `20990101000000`) for the `estimatedRating` migration to avoid collision with any future upstream MediaTrackerPlus migrations.

---

*Roadmap defined: 2026-03-06*
*Revised: 2026-03-06 — collapsed from 6-phase sidecar plan to 4-phase fork-only plan*
*Coverage: 30/30 v1 requirements mapped*
