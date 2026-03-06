# Requirements: upnext

**Defined:** 2026-03-06
**Revised:** 2026-03-06 — architecture pivot from sidecar to direct fork integration
**Core Value:** When a user rates something they loved, the next thing they should watch is already waiting for them — ranked, deduped, and ready.

---

## v1 Requirements

### Rating Hook (HOOK)

- [ ] **HOOK-01**: After a rating is saved, `RecommendationService.processRating()` is triggered asynchronously via `setImmediate` — the rating save HTTP response is sent before any recommendation processing begins
- [ ] **HOOK-02**: Recommendation processing errors are caught and logged; they never surface as unhandled rejections or affect the rating save result

### TMDB Recommendations (TMDB)

- [ ] **TMDB-01**: Service queries TMDB `GET /3/movie/{tmdbId}/similar` for movie ratings, reusing the existing TMDB provider implementation
- [ ] **TMDB-02**: Service queries TMDB `GET /3/tv/{tmdbId}/similar` for TV show ratings, reusing the existing TMDB provider implementation
- [ ] **TMDB-03**: TMDB results with `vote_count < 10` are filtered out before processing
- [ ] **TMDB-04**: Service handles TMDB 429 rate-limit responses by respecting the `Retry-After` header
- [ ] **TMDB-05**: Empty TMDB similar results are logged with the media item ID and title; processing continues gracefully

### IGDB Recommendations (IGDB)

- [ ] **IGDB-01**: Service retrieves similar games using a two-step IGDB query: fetch `similar_games` IDs from the source game, then batch-fetch details for those IDs; reuses existing IGDB provider infrastructure
- [ ] **IGDB-02**: IGDB results with `total_rating_count < 5` are filtered out before processing
- [ ] **IGDB-03**: IGDB OAuth (Twitch) token expiry is checked before every call; token is proactively refreshed if expired or within 24 hours of expiry

### OpenLibrary Recommendations (OLIB)

- [ ] **OLIB-01**: Service retrieves related books via subject-based search: fetch source work subjects, then search by the first non-empty subject; reuses existing OpenLibrary provider infrastructure
- [ ] **OLIB-02**: OpenLibrary results carry no external rating; their composite score falls back to `estimatedRating` only

### Watchlist Writing (WLIST)

- [ ] **WLIST-01**: Before adding a similar item to the watchlist, the service verifies the item exists in the `mediaItem` table via direct repository access; if not, it is imported via the existing metadata provider lookup
- [ ] **WLIST-02**: Items already marked as watched by the user are not added to the watchlist
- [ ] **WLIST-03**: Items already rated by the user are not added to the watchlist
- [ ] **WLIST-04**: If a similar item is already on the watchlist, its `estimatedRating` is updated only if the new source rating is higher than the current stored value
- [ ] **WLIST-05**: When a similar item is added to the watchlist, its `estimatedRating` is set to the rating value of the source item that triggered the recommendation flow

### Schema (SCHEMA)

- [ ] **SCHEMA-01**: The `listItem` table gains a nullable `estimatedRating` (float) column via a Knex migration
- [ ] **SCHEMA-02**: The schema change is fully backward-compatible: the column is nullable with no default; existing rows are unaffected

### Sort (SORT)

- [ ] **SORT-01**: MediaTrackerPlus exposes a `'recommended'` option in its watchlist sort interface (`ListSortBy` union)
- [ ] **SORT-02**: The `'recommended'` sort orders watchlist items by composite score: `(estimatedRating × W_est) + (externalRating × W_ext)`, descending
- [ ] **SORT-03**: Score weights `W_est` and `W_ext` are configurable (default: 0.6 / 0.4)
- [ ] **SORT-04**: Items with no `estimatedRating` are sorted last (not excluded)
- [ ] **SORT-05**: Items with no `externalRating` use `estimatedRating` alone for scoring (not zeroed out)
- [ ] **SORT-06**: The sort is implemented in TypeScript (in-memory after row fetch), not via SQL `ORDER BY`, to preserve SQLite/PostgreSQL compatibility

### Testing (TEST)

- [ ] **TEST-01**: Integration tests verify the end-to-end happy-path flow for each media type: rating saved → similar items appear in watchlist with `estimatedRating` set
- [ ] **TEST-02**: Integration tests verify deduplication: an item already on the watchlist is not re-added
- [ ] **TEST-03**: Integration tests verify the update-only-if-higher guard: `estimatedRating` is updated when the source rating is higher, and left unchanged when it is lower
- [ ] **TEST-04**: Integration tests run against the local MediaTrackerPlus instance
- [ ] **TEST-05**: Unit tests cover `RecommendationService` in isolation with mocked provider and repository dependencies

### Documentation (DOC)

- [ ] **DOC-01**: All new files and modified files are documented in `FORK_CHANGES.md`, listing each change and merge-conflict surface warnings for future upstream syncs

---

## v2 Requirements

### Reliability

- **REL-01**: Retry logic with exponential backoff for transient external API failures
- **REL-02**: Idempotency guard to prevent duplicate recommendation runs if triggered twice for the same rating event

### Recommendation Quality

- **QUAL-01**: Multi-page TMDB similar results (pages 1–2) for titles where page 1 results are heavily deduped
- **QUAL-02**: Language filter for TMDB results via `original_language` field
- **QUAL-03**: Genre+year fallback search for titles that return zero TMDB similar results

### Operations

- **OPS-01**: Manual trigger for recommendation refresh on a specific media item
- **OPS-02**: Configuration UI for recommendation weights (W_est / W_ext)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone sidecar service | No plugin mechanism exists; direct fork integration eliminates search-and-import complexity and two-service overhead |
| Outgoing webhooks | Replaced by direct `setImmediate` call in `RatingController`; no network hop needed |
| Recommendations triggered by watch history | Ratings only for v1 — ratings are higher-confidence intent signals |
| TMDB "recommendations" endpoint | Using "similar" only for consistent genre-based results |
| High-quality book recommendations | OpenLibrary has no similar API; subject-based search is a known quality gap |
| Dedicated recommendations UI page | No frontend changes beyond the new sort option |
| Manual/on-demand recommendation refresh | Event-driven only for v1 |
| Paid external APIs | All APIs must remain free |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Pending |
| SCHEMA-02 | Phase 1 | Pending |
| HOOK-01 | Phase 2 | Pending |
| HOOK-02 | Phase 2 | Pending |
| TMDB-01 | Phase 2 | Pending |
| TMDB-02 | Phase 2 | Pending |
| TMDB-03 | Phase 2 | Pending |
| TMDB-04 | Phase 2 | Pending |
| TMDB-05 | Phase 2 | Pending |
| IGDB-01 | Phase 2 | Pending |
| IGDB-02 | Phase 2 | Pending |
| IGDB-03 | Phase 2 | Pending |
| OLIB-01 | Phase 2 | Pending |
| OLIB-02 | Phase 2 | Pending |
| WLIST-01 | Phase 2 | Pending |
| WLIST-02 | Phase 2 | Pending |
| WLIST-03 | Phase 2 | Pending |
| WLIST-04 | Phase 2 | Pending |
| WLIST-05 | Phase 2 | Pending |
| SORT-01 | Phase 3 | Pending |
| SORT-02 | Phase 3 | Pending |
| SORT-03 | Phase 3 | Pending |
| SORT-04 | Phase 3 | Pending |
| SORT-05 | Phase 3 | Pending |
| SORT-06 | Phase 3 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| TEST-03 | Phase 4 | Pending |
| TEST-04 | Phase 4 | Pending |
| TEST-05 | Phase 4 | Pending |
| DOC-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---

*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after architecture pivot — removed WHOOK, RECV, CFG requirements (sidecar-specific); simplified WLIST-01 (direct repository access replaces search-and-import REST dance)*
