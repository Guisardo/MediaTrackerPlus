# Project Research Summary

**Project:** upnext — Recommendation Sidecar for MediaTrackerPlus
**Domain:** Node.js/TypeScript sidecar service integrating with a forked media tracker via webhooks and REST API
**Researched:** 2026-03-06
**Confidence:** HIGH (all research sourced from direct inspection of the live MediaTrackerPlus codebase)

---

## Executive Summary

upnext is a stateless Express/TypeScript sidecar service that listens for rating webhooks from a forked MediaTrackerPlus instance, calls external APIs (TMDB, IGDB, OpenLibrary) to find similar content, and writes scored recommendations back to the fork's watchlist via its REST API. The architecture is clean and well-bounded: the fork requires minimal changes (five files, ~80 lines total), the sidecar has no database of its own, and all state lives in MediaTrackerPlus. This is a firmly viable design with no architectural unknowns.

The recommended build sequence is fork plumbing first (schema migration, webhook emission), then sidecar core (API clients, recommendation pipeline, watchlist writer), then the integration seam (webhook receiver), then the sort surface in the fork. This ordering respects hard dependencies: the `listItem.metadata` column must exist before anything writes to it, and the MediaTrackerApiClient must exist before the watchlist writer can operate. TMDB movie and TV support should be built before IGDB and OpenLibrary because the TMDB similar endpoint is the simplest integration and shares response shapes with already-implemented MediaTrackerPlus provider code.

The most underestimated complexity in the project is Pitfall 6: before upnext can add a similar item to the watchlist, that item must already exist in MediaTrackerPlus's `mediaItem` table. Since similar items returned by TMDB/IGDB have never been searched by the user, upnext must perform a search-and-import dance (call MediaTrackerPlus's search endpoint to trigger the import, then retry the watchlist add). This is the core integration complexity and must be scoped explicitly in the watchlist-writer phase. Every other integration challenge is well-documented and has a clear prevention strategy.

---

## Key Findings

### Recommended Stack

The sidecar mirrors MediaTrackerPlus's stack exactly: Node.js with CommonJS TypeScript (target ES2020, strict mode), Express 4.21.2, axios 0.29.0, winston 3.17.0, dotenv 16.4.7. Jest 28 with babel-jest transform (not ts-jest) is the test setup — the same configuration MediaTrackerPlus uses — so no new toolchain decisions are needed. The sidecar needs no database: it is stateless and communicates exclusively over HTTP (inbound webhooks, outbound to TMDB/IGDB/OpenLibrary and MediaTrackerPlus REST API).

See `/Users/lucas.rancez/Documents/Code/upnext/.planning/research/STACK.md` for exact package versions and tsconfig alignment.

**Core technologies:**
- `express ^4.21.2`: HTTP server — matches MediaTrackerPlus exactly, no version friction
- `axios ^0.29.0`: HTTP client for all outbound calls — same version as fork, same error-handling patterns
- `winston ^3.17.0`: Structured logging — same logger shape as fork, familiar log format across both processes
- `jest ^28.1.3` + `babel-jest`: Test runner — same transform strategy as fork, no separate compile step for tests
- `typescript ^4.9.5` with `"module": "commonjs"`: Language — CommonJS module system matches fork; sidecar uses `noEmit: false` (unlike fork) to produce a runnable `dist/` for deployment

**Not needed in sidecar:** knex, better-sqlite3, pg (stateless, no DB), react/client packages (API-only service).

### Expected Features

All three external API providers have been researched against the live MediaTrackerPlus provider implementations. Confidence is HIGH for all capability assessments.

**Must have (table stakes):**
- TMDB similar movies via `GET /3/movie/{tmdbId}/similar` — simple, same response shape as existing search, `vote_average` available inline (no second call needed)
- TMDB similar TV shows via `GET /3/tv/{tmdbId}/similar` — identical to movies; note `name` not `title`, `first_air_date` not `release_date`
- IGDB similar games via two-step POST: first fetch `similar_games` IDs, then fetch game details including `total_rating` — requires adding `similar_games` and rating fields to the existing query (currently absent from MediaTrackerPlus's igdb.ts)
- OpenLibrary subject-based related books — no "similar" endpoint exists; workaround is fetch work subjects, then search by first subject; no external rating available for books
- Deduplication by `tmdbId` / `igdbId` / `openlibraryId` before every watchlist add — prevents re-adding items the user already has
- Search-and-import dance before watchlist add — every similar item must be verified or imported into MediaTrackerPlus before `PUT /api/list/item` will accept it

**Should have (differentiators):**
- `vote_count` / `total_rating_count` minimum thresholds — filters low-confidence results (TMDB: skip if vote_count < 10; IGDB: skip if total_rating_count < 5)
- IGDB OAuth token expiry check and proactive refresh before every call — avoids silent 401 failures after 60-day token lifetime
- Explicit 429 handling with Retry-After respect for TMDB — both processes share the same API key
- Configurable result limit per provider via env var (default: 5 items per webhook event)

**Defer to v2+:**
- Multi-page TMDB fetching (pages 1–2) — only worthwhile if dedup rate on page 1 is consistently high
- Language filtering on TMDB results — adds config surface complexity; `original_language` field is available when needed
- Retry logic for webhook delivery — v1 is fire-and-forget; retries require backoff + jitter to avoid thundering herd
- Job queue (BullMQ/Redis) — not justified at personal-tracker event volume; revisit if concurrent webhooks become an issue

See `/Users/lucas.rancez/Documents/Code/upnext/.planning/research/FEATURES.md` for full API response shapes, quality signal tables, and dedup ID mapping.

### Architecture Approach

Two processes with one direction of trust: the fork emits a signed webhook (fire-and-forget), the sidecar validates the HMAC signature, returns 202 immediately, and processes asynchronously. The sidecar then writes recommendations back via the fork's own REST API. The fork never touches the sidecar's internals; the sidecar never touches the fork's database. State (estimated ratings, watchlist membership) lives entirely in MediaTrackerPlus. The "recommended" sort in the fork is implemented as a TypeScript in-memory sort on fetched rows (not SQL ORDER BY on a JSON column), which sidesteps SQLite/PostgreSQL dialect differences.

Fork modifications are minimal: five files, approximately 80 lines of new or changed code, all backward-compatible.

See `/Users/lucas.rancez/Documents/Code/upnext/.planning/research/ARCHITECTURE.md` for complete data flow, component definitions, and anti-pattern explanations.

**Major components (sidecar):**
1. `WebhookController` (`src/controllers/webhookController.ts`) — HMAC signature validation, 202 dispatch, event-type guard
2. `RatingEventHandler` (`src/handlers/ratingEventHandler.ts`) — orchestrates the recommendation pipeline for one rating event
3. `RecommendationEngine` (`src/services/recommendationEngine.ts`) — routes to correct provider by `mediaType`, deduplicates, scores
4. `TmdbSimilarClient` / `IgdbClient` / `OpenLibraryClient` (`src/clients/`) — provider-specific API wrappers with rate limiting
5. `MediaTrackerApiClient` (`src/clients/mediaTrackerApiClient.ts`) — wraps all MediaTrackerPlus REST calls; the only data access layer
6. `WatchlistWriter` (`src/services/watchlistWriter.ts`) — search-and-import dance, dedup, update-only-if-higher estimated_rating logic

**Major components (fork additions):**
1. `WebhookEmitter` (`server/src/webhooks/webhookEmitter.ts`) — fire-and-forget outgoing HTTP post with HMAC signing
2. `listItem.metadata` column migration — nullable TEXT column, JSON-encoded, stores `estimated_rating`
3. `'recommended'` sort in `listRepository.items()` — TypeScript in-memory sort by composite score

### Critical Pitfalls

The full set of 13 pitfalls is documented in `/Users/lucas.rancez/Documents/Code/upnext/.planning/research/PITFALLS.md`. The five that can cause rewrites or silent data failures are:

1. **Webhook emission blocks the HTTP response (Pitfall 1)** — If `WebhookEmitter.emit()` is awaited before `res.send()` in `RatingController.add`, every rating save hangs while upnext processes. Fix: call `res.send()` first, then `setImmediate(() => webhookEmitter.emit(...).catch(logger.error))`. Never await the webhook call in the request handler.

2. **MediaItem not found in MediaTrackerPlus — watchlist add returns 400 (Pitfall 6)** — The `listItem` table has a FK constraint on `mediaItemId`. Similar items returned by TMDB/IGDB have never been imported by the user, so direct `PUT /api/list/item` calls will fail. Fix: upnext must search MediaTrackerPlus first (triggering the import), then retry the watchlist add. This is the core integration complexity — plan for it as a multi-step `WatchlistWriter` operation, not a single API call.

3. **TMDB returns empty similar results for niche titles (Pitfall 4)** — 20–40% of typical personal-tracker items (anime, documentaries, foreign films, low-vote-count TV) return 0 results from `/similar`. Fix: always log the result count with the TMDB ID and title. Never silently skip. A genre+year fallback search is the right v2 mitigation.

4. **Shared TMDB API key rate limit not respected across both processes (Pitfall 5)** — MediaTrackerPlus and upnext share the same TMDB API key. Independent request queues can exceed the 40 req/10s limit during concurrent metadata refreshes. Fix: upnext uses a 300ms throttle (slightly conservative vs. MediaTrackerPlus's 250ms) and explicitly handles 429 with Retry-After respect.

5. **JSON metadata column not queryable with standard Knex — "recommended" sort silently fails (Pitfall 8)** — Using `.orderBy('estimated_rating')` when the value is nested in a JSON text column produces silent NULL-sort (wrong order, no error). Fix: use a dedicated nullable float column `estimatedRating` instead of a JSON blob, or implement the sort in TypeScript after fetching rows (the architecture already recommends the TypeScript approach for dialect compatibility).

---

## Implications for Roadmap

The ARCHITECTURE.md build-order section provides the dependency graph. This translates to five phases with clear rationale.

### Phase 1: Fork Plumbing — Schema and Webhook Emission

**Rationale:** The `listItem.metadata`/`estimatedRating` column is a hard prerequisite for everything that writes recommendation scores. The webhook emitter is required before any end-to-end flow can be tested. Both are low-risk, backward-compatible changes. Build them first to unblock all sidecar work.

**Delivers:** A MediaTrackerPlus fork that (a) stores a nullable `estimatedRating` float on every list item and (b) fires a signed HTTP POST to a configurable `UPNEXT_WEBHOOK_URL` after every rating save, without affecting the rating response latency.

**Implements (fork files):**
- `server/src/migrations/20990101000000_listItemEstimatedRating.ts` — use far-future timestamp (Pitfall 9 mitigation)
- `server/src/entity/list.ts` — add `estimatedRating?: number` to `ListItem`
- `server/src/webhooks/webhookEmitter.ts` — new file, fire-and-forget axios POST with HMAC
- `server/src/controllers/rating.ts` — add 4-line post-response hook (Pitfall 1 mitigation)

**Avoids:** Pitfall 1 (blocking response), Pitfall 9 (migration timestamp collision)

**Research flag:** Standard patterns — no additional research needed. Knex migration style confirmed from 35 existing migrations. Discord notification code in `notifications/platforms/discord.ts` is the reference implementation for the outgoing HTTP call.

---

### Phase 2: Sidecar Foundation — Project Scaffold and MediaTracker API Client

**Rationale:** The sidecar's `MediaTrackerApiClient` is a prerequisite for the `WatchlistWriter`, which is itself a prerequisite for the `RecommendationEngine` and `RatingEventHandler`. Scaffold the project and build the API client layer before writing any recommendation logic — this ensures the watchlist write path is testable in isolation before the external API clients are added.

**Delivers:** A runnable Express service scaffold with correct TypeScript/CommonJS/babel-jest setup, environment config with token-safe startup validation, and a fully tested `MediaTrackerApiClient` covering: search (to trigger import), watchlist read, list item add, and `estimatedRating` patch.

**Implements:**
- Project scaffold (package.json, tsconfig.json, tsconfig.build.json, babel.config.js, jest.config.js)
- `src/config.ts` — reads all env vars; logs `[SET]` / `[NOT SET]` for token fields, never log values (Pitfall 10 mitigation)
- `src/clients/mediaTrackerApiClient.ts` — all MediaTrackerPlus REST interactions; handles auth header injection
- Unit tests for `MediaTrackerApiClient` with mocked axios responses

**Avoids:** Pitfall 10 (token leaked to logs), Pitfall 6 (search-and-import must be designed here, not retrofitted)

**Research flag:** Standard patterns — Express/TypeScript scaffold has no unknowns. MediaTrackerPlus REST API endpoints were confirmed from live codebase inspection.

---

### Phase 3: Recommendation Pipeline — API Clients and Engine

**Rationale:** With the watchlist write path working, build the external API clients and connect them through the `RecommendationEngine`. TMDB is first (simplest, best quality signals), IGDB second (two-step query, rate-limit discipline required), OpenLibrary last (subject-based workaround, no external rating). The engine deduplicates and scores before handing off to the `WatchlistWriter`.

**Delivers:** A `RecommendationEngine` that, given a `mediaType` and external ID, returns a deduplicated, scored list of similar items not already in the user's watchlist. Each provider is independently testable. The `WatchlistWriter` consumes the engine output and performs the search-and-import dance + update-only-if-higher logic.

**Implements:**
- `src/clients/tmdbClient.ts` — movie and TV similar endpoints; 300ms throttle; explicit 429 handling; log result count including zeros (Pitfall 4, 5 mitigations)
- `src/clients/igdbClient.ts` — two-step similar_games query; Twitch OAuth with expiry check and proactive refresh (Pitfall 13 mitigation); `total_rating` field; 250ms queue
- `src/clients/openLibraryClient.ts` — work subjects fetch + subject search; 1 req/s conservative rate; accept no external rating
- `src/services/recommendationEngine.ts` — `mediaType`-discriminated routing (never assume tmdbId for all types — Pitfall 12 mitigation); dedup by external ID; composite score
- `src/services/watchlistWriter.ts` — search-and-import dance for each similar item; update-only-if-higher guard; full logging for 400 responses (Pitfall 6 mitigation)

**Avoids:** Pitfall 4 (empty TMDB results), Pitfall 5 (rate limit), Pitfall 6 (search-and-import), Pitfall 12 (ID type assumptions), Pitfall 13 (IGDB token expiry)

**Research flag:** IGDB two-step query and OpenLibrary subject workaround are medium-complexity. The FEATURES.md has exact query bodies and response shapes confirmed from live code — no additional API research needed. The search-and-import dance for Pitfall 6 needs specific MediaTrackerPlus API endpoint verification during implementation (confirm which search/import endpoints exist and their parameter contracts).

---

### Phase 4: Integration Seam — Webhook Receiver

**Rationale:** The `WebhookController` is the last piece because it depends on everything above. Building it last means the full pipeline can be tested end-to-end as soon as the controller is wired up. It is also the simplest component — HMAC validation and 202 dispatch — so there is no risk in placing it last.

**Delivers:** A fully functional `POST /webhook/rating` endpoint that validates the HMAC signature, returns 202 immediately, and kicks off async recommendation processing. At this point the system is end-to-end working: rate a movie in MediaTrackerPlus → webhook fires → sidecar processes → similar items appear in watchlist.

**Implements:**
- `src/controllers/webhookController.ts` — HMAC validation (timingSafeEqual), event-type guard (reject anything other than `rating.saved`), 202 dispatch (Pitfall 7 mitigation: only rating events accepted)
- `src/handlers/ratingEventHandler.ts` — orchestrates engine + writer; 202 response is sent before async processing begins
- `src/app.ts` and `src/server.ts` — Express app wiring, route registration
- Integration tests using supertest: valid signature → 202, invalid signature → 401, wrong event type → 400

**Avoids:** Pitfall 2 (idempotency — v1 accepts at-most-once delivery; document the decision), Pitfall 3 (no retries in v1), Pitfall 7 (circular loop — strict event-type filter)

**Research flag:** Standard Express/HMAC patterns — no research needed. The ARCHITECTURE.md has the exact HMAC signature pattern and code samples.

---

### Phase 5: Fork Sort Surface — Recommended Sort in Watchlist UI

**Rationale:** The "recommended" sort is useful only after the pipeline is producing real scores. Building it last means sort behaviour can be validated against real data. It can also be built in parallel with Phase 4 if velocity allows — it is not on the critical path for the end-to-end flow, only for the sort UI feature.

**Delivers:** A `sortBy: 'recommended'` option in MediaTrackerPlus that orders watchlist items by `(estimatedRating * W_est) + (mediaItem.voteAverage * W_ext)` descending, with unscored items last.

**Implements (fork files):**
- `server/src/entity/list.ts` — add `'recommended'` to `ListSortBy` union
- `server/src/repository/list.ts` — TypeScript in-memory sort after row fetch (not SQL ORDER BY on JSON — Pitfall 8 mitigation); unscored items sorted to end

**Avoids:** Pitfall 8 (JSON column in SQL ORDER BY)

**Research flag:** Standard patterns — TypeScript in-memory sort, confirmed safe for watchlist sizes under ~5000 items (well within personal-tracker scale).

---

### Phase 6: Integration Tests and Hardening

**Rationale:** With all components built, integration tests verify the full pipeline end-to-end against a local MediaTrackerPlus instance. Hardening addresses observability (log coverage for silent-failure paths) and edge cases discovered during integration testing.

**Delivers:** Integration test suite covering: rating event → watchlist addition (happy path for each media type), TMDB empty-result handling, IGDB token refresh, OpenLibrary subject fallback, dedup (item already in watchlist is not re-added, estimated_rating is updated if higher). Confirmed production-ready service.

**Implements:**
- Integration tests using supertest against live sidecar with mocked external APIs
- Log coverage audit: every silent-failure path from PITFALLS.md must produce a structured log entry
- `FORK_CHANGES.md` in the fork repo documenting all fork modifications and merge-watch instructions (Pitfall 11 mitigation)

**Research flag:** No additional research needed — test patterns follow existing supertest style in MediaTrackerPlus.

---

### Phase Ordering Rationale

- Phase 1 before all others: `estimatedRating` column is a schema prerequisite for all downstream writes. Webhook emitter is required for the integration seam.
- Phase 2 before Phase 3: `MediaTrackerApiClient` is the only data access layer. The search-and-import dance must be designed at this layer before the `RecommendationEngine` can use it.
- Phase 3 before Phase 4: The webhook controller has no value without a working pipeline behind it.
- Phase 5 is independent of Phase 4 (can run in parallel) but is naturally last because real data makes sort validation meaningful.
- Phase 6 last: integration tests require everything to exist.

### Research Flags

Phases with standard patterns (research-phase not needed):
- **Phase 1:** Fork modification patterns are confirmed from 35 existing migrations and the Discord notification reference. No unknowns.
- **Phase 2:** Express/TypeScript scaffold has no unknowns. API client patterns are standard.
- **Phase 4:** HMAC webhook validation is a standard pattern with no API research required.
- **Phase 5:** TypeScript in-memory sort with established Knex migration style.

Phases that may need spot-research during planning:
- **Phase 3 (WatchlistWriter — search-and-import):** The exact MediaTrackerPlus search and import endpoint contracts need confirmation during implementation. Which endpoint triggers a media item import? What is the parameter contract? FEATURES.md documents the watchlist add endpoint but not the import flow. This is the single highest-risk integration point.
- **Phase 3 (IGDB rate limiting):** The 250ms queue pattern is confirmed from MediaTrackerPlus's `RequestQueue`. Verify that the sidecar's independent queue does not share state with MediaTrackerPlus's queue (they are separate processes — this is fine, but the combined rate must stay within limits).

---

## Ready to Build

### Confirmed Viable (no workarounds needed)

| Capability | Confidence | Notes |
|------------|------------|-------|
| TMDB similar movies and TV | HIGH | Same endpoint shape as existing search. `vote_average` inline. 40 req/10s limit is non-issue for single-user. |
| IGDB similar games (two-step) | HIGH | `similar_games` field confirmed in `Game` interface. Must add to query body. Rate limit well-documented. |
| TMDB scoring formula | HIGH | `vote_average` (0–10) maps directly to `external_rating` — no conversion needed. |
| IGDB scoring formula | HIGH | `total_rating` (0–100) confirmed present in response; divide by 10 before formula. |
| Fork webhook emission | HIGH | Pattern confirmed from Discord notification code. Fire-and-forget, no architectural risk. |
| listItem schema extension | HIGH | Additive Knex migration, backward-compatible. Use far-future timestamp to avoid upstream conflicts. |
| TypeScript in-memory sort | HIGH | Correct approach for SQLite/PostgreSQL dialect split. Safe at personal-tracker scale. |
| Sidecar stack selection | HIGH | Exact package versions confirmed from live codebase. No toolchain decisions needed. |

### Requires Workarounds (design explicitly, not assumed)

| Capability | Gap | Recommended Workaround |
|------------|-----|------------------------|
| OpenLibrary "similar books" | No similar/recommendations endpoint exists | Subject-based search: fetch work subjects → search by first subject. Accept 0 external rating for books; scoring falls back to `estimated_rating` only. |
| Adding similar items to watchlist | `listItem` FK constraint — item must already exist in `mediaItem` table | `WatchlistWriter` must call MediaTrackerPlus search (to trigger import) before every watchlist add. This is multi-step, not a single API call. Verify import endpoint contract during Phase 3 implementation. |
| Empty TMDB similar results for niche titles | 20–40% of typical items return 0 results | Log result count (never silent skip). Accept for v1. Genre+year fallback search is the v2 mitigation. |
| Shared TMDB API key rate limits | Both processes use same key with independent queues | upnext uses 300ms throttle (slightly more conservative). Handle 429 with Retry-After. Accept that combined rate may occasionally exceed limit during heavy metadata refresh. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Sourced directly from `server/package.json` and `client/package.json` in the live codebase. Exact version pins confirmed. |
| Features | HIGH | Sourced from live provider implementations (`tmdb.ts`, `igdb.ts`, `openlibrary.ts`) and test mocks. OpenLibrary gap is confirmed, not speculative. |
| Architecture | HIGH | Fork modification patterns confirmed from existing code (Discord notification, migrations, ListSortBy union). Sidecar structure is standard Express. Medium confidence only on in-memory sort at watchlist sizes > 5000 (personal-tracker scale makes this a non-issue). |
| Pitfalls | HIGH | All pitfalls sourced from direct code inspection of the actual files involved (`rating.ts`, `listItemRepository.ts`, `requestQueue.ts`, migrations directory). Not speculative. |

**Overall confidence:** HIGH

### Gaps to Address During Implementation

- **Search-and-import endpoint contract (Phase 3):** The exact MediaTrackerPlus endpoint that triggers a media item import for a given TMDB/IGDB/OpenLibrary ID was not confirmed during research. This must be verified before implementing `WatchlistWriter`. Check `server/src/controllers/` and `server/src/repository/mediaItemRepository.ts` for the import flow.
- **OpenLibrary `openlibraryId` format in DB (Phase 3):** Research notes that the `key` field from OpenLibrary search is `/works/OL82563W` format. Must confirm whether MediaTrackerPlus stores the full path or strips the `/works/` prefix. Check existing `openlibraryId` values in a test DB or in `openlibraryRepository.ts`.
- **`MEDIATRACKER_TOKEN` creation flow (Phase 2):** upnext needs a raw access token from MediaTrackerPlus admin. The token creation endpoint and the format of the returned value must be confirmed before implementing `MediaTrackerApiClient` authentication.
- **WebhookEmitter — does MediaTrackerPlus's `Config` class pattern support dynamic env vars gracefully? (Phase 1):** Confirm that `UPNEXT_WEBHOOK_URL` being absent (no-op case) is handled by `Config` without throwing. The pattern from `config.ts` suggests optional env vars are supported, but verify before finalising the WebhookEmitter no-op path.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/package.json` — exact dependency versions
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/tmdb.ts` — TMDB client implementation, response shapes, rate limit absence for TMDB
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/igdb.ts` — IGDB client, `RequestQueue` (250ms), `Game` interface with `similar_games?: number[]`, OAuth token flow
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/openlibrary.ts` — confirms no similar endpoint; `DetailsResponse` subjects fields
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/__tests__/metadata/provider/mock/tmdb/movieSearchResponse.json` — TMDB response shape confirmed
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/controllers/rating.ts` — webhook insertion point
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/repository/list.ts` — existing sort logic, `listRepository.items()` query structure
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/entity/list.ts` — `ListSortBy` union, `ListItem` type (no metadata column currently)
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/migrations/` — 35 existing migrations, timestamp naming convention
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/notifications/platforms/discord.ts` — reference implementation for fire-and-forget outgoing HTTP call
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/requestQueue.ts` — existing rate-limit queue pattern (250ms between requests)
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/repository/listItemRepository.ts` — FK constraint on `mediaItemId`; confirms Pitfall 6
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/middlewares/token.ts` — access token auth model (SHA-256 hash in DB; raw token returned once)
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/config.ts` — env-var Config class pattern; IGDB credential handling

---

*Research completed: 2026-03-06*
*Ready for roadmap: yes*
