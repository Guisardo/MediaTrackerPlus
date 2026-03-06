# Architecture Patterns

**Domain:** Node.js/TypeScript recommendation sidecar with fork integration
**Researched:** 2026-03-06

---

## Recommended Architecture

Two processes, one direction of trust.

```
MediaTrackerPlus fork (port 7481)          upnext sidecar (port 7482)
┌────────────────────────────────┐         ┌─────────────────────────────────┐
│  RatingController.add()        │         │  POST /webhook/rating           │
│    └─ userRatingRepository     │  HTTP   │    └─ RatingEventHandler        │
│         .updateOrCreate()      │────────►│         └─ RecommendationEngine │
│    └─ WebhookEmitter.emit()    │         │              ├─ TmdbClient       │
│                                │         │              ├─ OpenLibraryClient│
│  ListRepository.items()        │◄────────│              └─ IgdbClient       │
│    └─ 'recommended' sort case  │  HTTP   │                                  │
│                                │  PUT /api/list/items (with estimated_rating│
│  DB: listItem.metadata (JSON)  │         │  in metadata field)              │
└────────────────────────────────┘         └─────────────────────────────────┘
```

Data always flows: fork emits event → sidecar processes → sidecar writes back via fork's REST API. The sidecar never touches the fork's database directly.

---

## Component Boundaries

### Fork Modifications (MediaTrackerPlus)

Minimal surface area. Three isolated changes, each in one file.

| Change | File | What | Why Isolated |
|--------|------|------|--------------|
| Webhook emission | `server/src/controllers/rating.ts` | After `userRatingRepository.updateOrCreate()` resolves, fire `WebhookEmitter.emit(event)` | Single async call added after existing await — no refactor required |
| listItem metadata column | `server/src/migrations/YYYYMMDDHHMMSS_listItemMetadata.ts` (new file) + `server/src/entity/list.ts` | Add `metadata?: string` column (JSON text); add field to `ListItem` type | Standard Knex migration; entity type change is additive only |
| Recommended sort | `server/src/repository/list.ts` + `server/src/entity/list.ts` | Add `'recommended'` to `ListSortBy` union; add sort case in `listRepository.items()` | `ListSortBy` is a string literal union — adding a value is non-breaking; sort is a single switch/if block in `items()` |

The `WebhookEmitter` is a new file inside the fork (`server/src/webhooks/webhookEmitter.ts`). It reads `UPNEXT_WEBHOOK_URL` and `UPNEXT_WEBHOOK_SECRET` from env (following `Config` class pattern), and fires `axios.post()` — identical to how Discord notifications are sent in `notifications/platforms/discord.ts`. It is called fire-and-forget with error logging; a failed webhook must not fail the rating response.

### Sidecar Service (upnext)

A standalone Express application. No shared database access. All state lives in MediaTrackerPlus.

| Component | File Path | Responsibility |
|-----------|-----------|---------------|
| `WebhookReceiver` | `src/controllers/webhookController.ts` | Validates HMAC signature, parses `RatingEvent`, enqueues or directly invokes handler |
| `RatingEventHandler` | `src/handlers/ratingEventHandler.ts` | Orchestrates the recommendation pipeline for one rating event |
| `RecommendationEngine` | `src/services/recommendationEngine.ts` | Routes to the correct provider based on `mediaType`; deduplicates results |
| `TmdbSimilarClient` | `src/clients/tmdbClient.ts` | Calls TMDB `/movie/{id}/similar` or `/tv/{id}/similar` |
| `OpenLibraryClient` | `src/clients/openLibraryClient.ts` | Calls OpenLibrary `/works/{id}` subjects for related items |
| `IgdbClient` | `src/clients/igdbClient.ts` | Calls IGDB `similar_games` field |
| `MediaTrackerApiClient` | `src/clients/mediaTrackerApiClient.ts` | Wraps MediaTrackerPlus REST API; handles auth token injection |
| `WatchlistWriter` | `src/services/watchlistWriter.ts` | Reads current watchlist, applies dedup + update-only-if-higher logic, writes via `MediaTrackerApiClient` |
| `Config` | `src/config.ts` | Reads env vars (`UPNEXT_PORT`, `UPNEXT_WEBHOOK_SECRET`, `MEDIATRACKER_URL`, `MEDIATRACKER_TOKEN`, `TMDB_API_KEY`, etc.) |

---

## Data Flow

```
1. User submits rating
   PUT /api/rating → RatingController.add()
   └─ userRatingRepository.updateOrCreate()     [fork DB write]
   └─ WebhookEmitter.emit({                     [fork, fire-and-forget]
        event: 'rating.created',
        userId, mediaItemId, mediaType,
        rating, tmdbId, igdbId, openLibraryId
      })

2. Webhook delivery
   POST http://localhost:7482/webhook/rating
   Headers: X-Upnext-Signature: hmac-sha256(secret, body)
   └─ WebhookReceiver.validate()                [sidecar]
   └─ RatingEventHandler.handle(event)          [sidecar, async]

3. Recommendation fetch
   RatingEventHandler
   └─ RecommendationEngine.getSimilar(event)
       ├─ TmdbSimilarClient.getSimilar(tmdbId, mediaType)   → [{tmdbId, title, ...}]
       ├─ OpenLibraryClient.getSimilar(openLibraryId)       → [{openLibraryId, title}]
       └─ IgdbClient.getSimilar(igdbId)                     → [{igdbId, title}]

4. Deduplication + scoring
   RecommendationEngine
   └─ Filter: remove items already in watchlist (from step 5 prefetch)
   └─ Filter: remove items already rated by user
   └─ Score: estimated_rating = source_rating * derivation_factor
   └─ Returns: [{mediaItemId, estimatedRating, externalRating}]

5. Watchlist write
   WatchlistWriter.write(recommendations)
   └─ GET /api/list/items?listId={watchlistId}     [read current watchlist]
   └─ For each recommendation:
       ├─ If not on watchlist:
       │   PUT /api/list/item (add item)
       │   PATCH /api/list/item (set metadata.estimated_rating)
       └─ If already on watchlist:
           Only PATCH metadata if new estimatedRating > current estimatedRating

6. Recommended sort (fork, at query time)
   GET /api/list/items?listId={watchlistId}
   └─ list.sortBy === 'recommended'
   └─ ORDER BY (metadata.estimated_rating * W_est) +
               (mediaItem.voteAverage * W_ext) DESC
```

---

## Patterns to Follow

### Pattern 1: Fire-and-forget Webhook Emission

**What:** The fork calls `WebhookEmitter.emit()` after the database write completes, without awaiting delivery success.
**When:** Any event that should not block the user-facing response.
**Why this way:** The rating `PUT /api/rating` endpoint returns `res.send()` with no body. A webhook failure must not change that behavior.

```typescript
// server/src/controllers/rating.ts (fork modification)
await userRatingRepository.updateOrCreate({ where, value: userRating });

// Fire and do not await — errors are logged, not propagated
WebhookEmitter.emit({
  event: 'rating.created',
  userId,
  mediaItemId,
  mediaType: mediaItem.mediaType,
  rating: rating ?? null,
  tmdbId: mediaItem.tmdbId ?? null,
  igdbId: mediaItem.igdbId ?? null,
  openLibraryId: mediaItem.openLibraryId ?? null,
}).catch((error) => logger.error('Webhook emission failed', { error }));

res.send();
```

### Pattern 2: HMAC Signature Verification

**What:** The fork signs the webhook body with a shared secret. The sidecar verifies before processing.
**When:** Any time an untrusted process sends events to the sidecar.
**Why this way:** Prevents arbitrary POST requests from triggering recommendation jobs. Simple, stateless, no token management.

```typescript
// src/controllers/webhookController.ts (sidecar)
const signature = req.headers['x-upnext-signature'];
const expected = `sha256=${createHmac('sha256', Config.WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex')}`;

if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  res.sendStatus(401);
  return;
}
```

### Pattern 3: Additive Knex Migration for listItem.metadata

**What:** Add a nullable TEXT column `metadata` to the `listItem` table via a new migration file.
**When:** Any time the fork schema needs extension.
**Why this way:** Knex migrations are the established pattern in this codebase (35 existing migrations). Adding a column does not require dropping foreign keys. JSON stored as TEXT is compatible with both SQLite and PostgreSQL (the two supported backends).

```typescript
// server/src/migrations/20260306000000_listItemMetadata.ts (fork)
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('listItem', (table) => {
    table.text('metadata').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('listItem', (table) => {
    table.dropColumn('metadata');
  });
}
```

The `ListItem` entity type gains `metadata?: string`. At read time, parse with `JSON.parse(item.metadata ?? 'null')`. At write time, `JSON.stringify({ estimated_rating: value })`.

### Pattern 4: Recommended Sort in listRepository.items()

**What:** Add `'recommended'` to the `ListSortBy` union and a branch in `listRepository.items()`.
**When:** The list's `sortBy` field equals `'recommended'`.
**Why this way:** The existing query in `list.ts` already joins `userRating` for the `my-rating` sort. The recommended sort extends the final `orderBy` call. The `metadata` column is available on `listItem` rows already fetched.

The sort cannot use a JOIN-time subquery because estimated_rating lives in a JSON column. Instead, do an application-level sort in TypeScript after fetching rows: sort the result array by `score = (parsed metadata.estimated_rating * W_est) + (mediaItem.voteAverage * W_ext)` descending, items with no score last.

This is the correct approach for v1 because: (a) watch lists are user-scoped and typically under 1000 items, so in-memory sort is fast enough, (b) SQLite JSON extraction syntax differs from PostgreSQL, so keeping it in TypeScript avoids a dialect branch.

### Pattern 5: Direct Async Processing (No Job Queue for v1)

**What:** The sidecar processes each webhook synchronously in the request handler, using async/await without a queue.
**When:** Event volume is low (one rating = one webhook), latency is not user-visible (fire-and-forget from fork), and failure recovery is acceptable via webhook retry from the fork.
**Why this way:** A job queue (BullMQ, pg-boss) adds a Redis or Postgres dependency that is not justified at v1 scale. Rating events are infrequent (user action, not automated). Processing time is bounded (3 external API calls in parallel, then 1 watchlist write). If external APIs are slow, the sidecar's POST handler can return 202 immediately after enqueuing in an in-process array — but this is not a queue, it is a simple async task tracker.

The fork emits the webhook synchronously before returning `res.send()` — actually fire-and-forget as described above. The sidecar returns `202 Accepted` immediately upon signature validation and kicks off processing in the background. No queue infrastructure needed.

```
Rating PUT ──► fork DB write ──► fire webhook (no await) ──► 200 OK to user
                                      │
                                      ▼
                              sidecar: 202 Accepted
                                      │
                                      ▼
                              async: fetch + write (2-10 seconds)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sidecar Directly Accessing the Fork's Database

**What:** Connecting upnext to MediaTrackerPlus's SQLite/PostgreSQL file to read or write data.
**Why bad:** Couples deployment — upnext must know the DB path, credentials, and schema version. Breaks the fork abstraction. SQLite has locking issues with multiple writers. Invalidates the "fork changes are minimal" constraint because the sidecar now depends on internal table structure.
**Instead:** All reads and writes go through MediaTrackerPlus's REST API. The `MediaTrackerApiClient` is the only data access layer in the sidecar.

### Anti-Pattern 2: Blocking the Rating Response on Webhook Delivery

**What:** Awaiting `WebhookEmitter.emit()` inside `RatingController.add()` before calling `res.send()`.
**Why bad:** If the sidecar is down or slow, every rating submission hangs. The user's action should complete instantly regardless of sidecar health.
**Instead:** Fire-and-forget with error logging (see Pattern 1).

### Anti-Pattern 3: Storing Estimated Rating in a New Table in the Sidecar

**What:** Having upnext maintain its own SQLite DB with a `recommendations` table mapping listItemId → estimated_rating.
**Why bad:** Creates a second source of truth. The fork's sort logic cannot read the sidecar's DB without a direct DB connection (see anti-pattern 1). Requires synchronization when list items are removed.
**Instead:** Estimated rating lives in `listItem.metadata` (fork schema). The fork's sort reads it directly. The sidecar writes it via REST API.

### Anti-Pattern 4: Modifying the Watchlist Sort at the SQL Layer Using JSON Extraction

**What:** Using `JSON_EXTRACT(listItem.metadata, '$.estimated_rating')` in the Knex ORDER BY clause.
**Why bad:** SQLite uses `JSON_EXTRACT()` syntax; PostgreSQL uses `->` and `->>` operators and requires a CAST. The existing `listRepository` has no dialect-branching pattern — adding one here would be the first such branch, creating a maintenance burden.
**Instead:** Application-level sort in TypeScript (see Pattern 4 above). Acceptable at watchlist scale.

### Anti-Pattern 5: Adding a Job Queue for v1

**What:** Introducing BullMQ or a similar queue to manage recommendation processing.
**Why bad:** Requires Redis as an additional infrastructure dependency. The event volume (one per user rating) does not justify queue overhead. Adds operational complexity for a personal/small-team tool.
**Instead:** In-process async processing with a 202 response. Revisit if concurrent rating events become frequent or if retry semantics become important.

---

## Build Order (What Must Exist Before What)

This is the dependency-constrained sequence. Items at the same number can be built in parallel.

```
1. Fork: listItem metadata migration + ListItem entity type update
   └─ Required by: everything that reads or writes estimated_rating

2. Fork: WebhookEmitter module (reads env, posts to configurable URL, no-op if unconfigured)
   └─ Required by: the modified RatingController

3. Fork: RatingController modification (add WebhookEmitter.emit() call)
   └─ Required by: end-to-end event flow

4. Sidecar: project scaffold (TypeScript, Express, tsconfig, build tooling)
   └─ Required by: all sidecar components

5. [Parallel with 4] Fork: 'recommended' added to ListSortBy union + sort logic in listRepository
   └─ Required by: the watchlist UI surfacing recommendations (but NOT by recommendation writing)
   └─ Note: can deploy and test estimated_rating storage before sort is complete

6. Sidecar: MediaTrackerApiClient (auth, watchlist read, list item add, metadata patch)
   └─ Required by: WatchlistWriter

7. Sidecar: TmdbSimilarClient, OpenLibraryClient, IgdbClient
   └─ Required by: RecommendationEngine

8. Sidecar: RecommendationEngine (routes to clients, deduplicates, scores)
   └─ Required by: RatingEventHandler

9. Sidecar: WatchlistWriter (dedup + update-if-higher logic)
   └─ Required by: RatingEventHandler

10. Sidecar: RatingEventHandler (orchestrates 7-9)
    └─ Required by: WebhookReceiver

11. Sidecar: WebhookController (HMAC validation + 202 dispatch)
    └─ The integration seam — tests written against this

12. Integration tests (sidecar + local MediaTrackerPlus instance)
    └─ Requires: everything above
```

Recommended phase mapping:
- Phase 1: Steps 1-3 (fork plumbing — schema + webhook emission)
- Phase 2: Steps 4, 6-9 (sidecar core — API client + recommendation pipeline)
- Phase 3: Steps 10-11 (sidecar receiver — glue it together)
- Phase 4: Step 5 (fork sort — surface recommendations in UI)
- Phase 5: Step 12 (integration tests)

---

## Scalability Considerations

This is a personal/small-team tool. Scale projections are provided for completeness, not as design drivers.

| Concern | At 10 ratings/day | At 1000 ratings/day | At 100K ratings/day |
|---------|------------------|--------------------|--------------------|
| Webhook processing | Direct async, no queue needed | Direct async still fine | BullMQ + Redis needed |
| External API rate limits | TMDB free: 50 req/sec. Never a concern at 10/day | Still fine | Rate limiting layer needed |
| In-memory sort | < 1000 items/watchlist, instant | Still fine | SQL-side sort needed |
| Sidecar restarts | Events lost; user rates again manually | Retry logic on fork side needed | Durable queue needed |

For v1, direct async processing is the correct choice. The architecture does not preclude adding a queue later — `RatingEventHandler.handle()` is the natural job boundary.

---

## Fork Modification Surface Area Summary

Four files changed in the fork. Zero new tables. Zero schema removals. Backward-compatible.

| File | Change Type | Lines Affected (estimate) |
|------|-------------|--------------------------|
| `server/src/controllers/rating.ts` | Add 4 lines after existing await | +4 |
| `server/src/entity/list.ts` | Add `'recommended'` to union; add `metadata` field to `ListItem` | +3 |
| `server/src/repository/list.ts` | Add sort branch in `items()` (TypeScript post-sort) | +15 |
| `server/src/migrations/20260306000000_listItemMetadata.ts` | New file — single `alterTable` | +20 |
| `server/src/webhooks/webhookEmitter.ts` | New file — `axios.post()` with HMAC | +40 |

No changes to generated routes (the webhook emitter is not an Express endpoint in the fork — it is an outgoing HTTP client). No changes to the frontend for v1.

---

## Sources

- Observed patterns: `server/src/notifications/platforms/discord.ts` — existing outgoing HTTP call pattern using `axios`
- Observed patterns: `server/src/repository/list.ts` — existing sort logic and query structure in `listRepository.items()`
- Observed patterns: `server/src/migrations/20220209005700_list.ts`, `20220427211100_list.ts` — Knex migration style and `alterTable` conventions
- Observed patterns: `server/src/entity/list.ts` — `ListSortBy` union type, `ListItem` type structure
- Observed patterns: `server/src/controllers/rating.ts` — the exact insertion point for webhook emission
- Observed patterns: `server/src/config.ts` — env-var-based configuration pattern (Config static class)
- Observed patterns: `server/src/server.ts` — Express app structure, route registration via `generatedRoutes`
- Confidence: HIGH for fork modification patterns (derived from direct code inspection)
- Confidence: HIGH for sidecar structure (standard Express/TypeScript patterns, no exotic dependencies)
- Confidence: MEDIUM for in-memory sort approach (correct given SQLite/PG dialect split, but no benchmark data for watchlist sizes > 5000)
