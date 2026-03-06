# Domain Pitfalls

**Domain:** Recommendation sidecar for a forked Express/TypeScript media tracker
**Researched:** 2026-03-06
**Confidence:** HIGH (derived from direct codebase inspection of MediaTrackerPlus source)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or complete loss of the feature.

---

### Pitfall 1: Webhook Fired Inside the HTTP Request Lifecycle (Blocking the Response)

**What goes wrong:**
The webhook emission point is `userRatingRepository.updateOrCreate()` inside `RatingController.add`. If the outgoing HTTP call to upnext is `await`-ed before `res.send()`, MediaTrackerPlus hangs the client's PUT request for as long as upnext takes to respond. If upnext is slow, the user's UI freezes. If upnext is down, the rating save appears to fail.

**Why it happens:**
The natural instinct when adding a side-effect after a DB write is to `await` it in the same function. The controller pattern in MediaTrackerPlus (`createExpressRoute`) has a single async handler — there is no middleware layer that runs post-response. The temptation is to add `await sendWebhook(...)` right after `updateOrCreate`.

**Consequences:**
- User-visible latency on every rating save
- Rating saves fail if upnext is unreachable (network timeout propagates to HTTP 500)
- Any unhandled rejection in the webhook path crashes the Express handler

**Prevention:**
Fire-and-forget with explicit error isolation. Use `setImmediate` or a micro-queue to defer the outgoing call until after `res.send()`:
```typescript
res.send(); // respond to client first
setImmediate(() => {
  webhookEmitter.emit('rating.saved', payload).catch((err) => {
    logger.error('Webhook emission failed', { err, payload });
  });
});
```
Never `await` the webhook call in the request handler. Wrap the emission in a try/catch that only logs — never re-throws.

**Warning signs:**
- Any code path where `webhookEmitter` or `fetch(upnextUrl)` appears before `res.send()` in rating.ts
- Integration tests that measure rating-save latency and see it spike when upnext is slow

**Phase to address:** Phase adding webhook emission to MediaTrackerPlus fork (outgoing webhook implementation).

---

### Pitfall 2: No Idempotency Key on Webhook Delivery — Duplicate Recommendations on Retry

**What goes wrong:**
If the webhook delivery to upnext fails mid-flight (upnext receives the request but responds with a 5xx before upnext fully processes it, or the connection drops), and MediaTrackerPlus retries, upnext processes the same rating event twice. This results in duplicate watchlist additions and double-firing of TMDB/IGDB API calls — burning rate-limit quota and potentially adding the same item to the watchlist twice (or updating estimated_rating twice with conflicting values).

**Why it happens:**
HTTP is not transactional. A fire-and-forget retry loop without a deduplication key has no way to know if the previous attempt succeeded. The `listItemRepository.addItem` does check for duplicates before inserting (it reads existing items in a transaction), but that check happens at a different level than the recommendation pipeline — race conditions between two concurrent webhook deliveries for the same rating event can still pass the duplicate check simultaneously before either insert commits.

**Consequences:**
- TMDB rate limit consumed twice for the same media item
- Watchlist state is correct (duplicate inserts are guarded), but the estimated_rating update logic runs twice — the second run may overwrite the first with stale data if the two runs race on reading the current value

**Prevention:**
- Include a deterministic idempotency key in every webhook payload: `sha256(userId + mediaItemId + ratingValue + timestamp_floor_to_minute)`. upnext caches processed keys in memory (or a small SQLite table) for a sliding 10-minute window and drops duplicate deliveries.
- Use at-most-once delivery (fire-and-forget, no retry) for v1 to eliminate the retry-storm problem entirely. Accept that rare missed webhooks are better than duplicate processing at this scale.

**Warning signs:**
- Webhook payload contains no unique event ID field
- upnext has no deduplication layer before calling TMDB
- Two identical watchlist entries for the same media item (should be blocked by DB constraint, but the estimated_rating update runs twice)

**Phase to address:** Phase designing the webhook payload schema and upnext receiver.

---

### Pitfall 3: Retry Storm When upnext Is Down

**What goes wrong:**
If MediaTrackerPlus implements retries with a naive loop (e.g., retry 3 times with 1-second delay), and upnext is down for a maintenance window or restart, every rating saved during that window fires 3 HTTP requests. With exponential backoff absent, this turns into a thundering herd when upnext comes back: all queued retries fire simultaneously, hitting TMDB's rate limit with a burst.

**Why it happens:**
Retry logic is added for reliability, but without backoff + jitter it amplifies failure. MediaTrackerPlus has no existing outgoing-HTTP retry infrastructure — whatever is added will be new code without battle-tested patterns.

**Consequences:**
- TMDB 429 responses during the burst, causing recommendations to fail for the catch-up batch
- upnext startup is slowed by processing a backlog of events simultaneously

**Prevention:**
For v1, use fire-and-forget with no retries. The recommendation pipeline is best-effort by design. A missed webhook on a rare failure is acceptable — the user can re-rate or wait for the next rating event. This is explicitly simpler than building a durable queue.

If retries are added later, require: exponential backoff (base 2s, max 60s), per-user jitter, and a dead-letter log (not re-delivery) after 3 failures.

**Warning signs:**
- Any retry loop in webhook emission code that lacks `await sleep(backoff)` with increasing intervals
- No maximum retry count or timeout

**Phase to address:** Phase adding webhook emission to MediaTrackerPlus fork.

---

### Pitfall 4: TMDB "Similar" Returns Empty for Many Media Items

**What goes wrong:**
TMDB's `/movie/{id}/similar` and `/tv/{id}/similar` endpoints return results based on metadata overlap (genres, keywords, production companies). For niche, foreign, or older titles, the similar list is often empty (0 results) or contains only 1–2 items. upnext silently adds nothing to the watchlist, and the user sees no change. This feels like the feature is broken.

**Why it happens:**
TMDB's similar algorithm is not documented but is metadata-driven. Low-popularity items with sparse metadata (no keywords tagged, single genre, no production company links) return empty arrays. This is especially common for: anime, documentaries, foreign films, TV series with < 500 votes.

**Consequences:**
- Silent no-op for a significant percentage of ratings (estimate: 20–40% of items in a typical personal tracker)
- No error is logged, so the developer doesn't know which items triggered the empty-result path

**Prevention:**
- Always log the TMDB item ID and result count: `logger.info('TMDB similar', { tmdbId, count: results.length })` — never silently skip.
- Implement a fallback: if `similar` returns 0 results, fall back to a TMDB search by genre + year range to find candidates manually. This is more work but produces non-empty results.
- For v1, accept the empty-result case but ensure it is observable (logged with the media item title and TMDB ID so the user can investigate).

**Warning signs:**
- upnext code path that calls TMDB similar and immediately `return`s on empty array without any log
- No metric or counter for "recommendations found: 0" events

**Phase to address:** Phase implementing TMDB similar query logic in upnext.

---

### Pitfall 5: TMDB Rate Limit (40 Requests / 10 Seconds) Not Respected Across All Callers

**What goes wrong:**
MediaTrackerPlus already has a `RequestQueue` class (`server/src/requestQueue.ts`) that serialises API calls with a configurable `timeBetweenRequests`. upnext is a separate process that makes its own TMDB calls using a separate HTTP client. Both processes share the same TMDB API key (`779734046efc1e6127485c54d3b29627` — the hardcoded key in tmdb.ts). Their request queues are independent — neither process knows about the other's calls.

**Why it happens:**
TMDB enforces a rate limit of approximately 40 requests per 10-second window per API key. When a rating event triggers upnext to query TMDB while MediaTrackerPlus is concurrently doing a metadata refresh, both processes fire requests against the same key simultaneously and the combined rate can exceed the limit.

**Consequences:**
- TMDB returns HTTP 429 with a `Retry-After` header
- MediaTrackerPlus metadata refresh silently fails or returns partial data
- upnext similar results are empty (if the 429 is swallowed) or upnext crashes (if it is not handled)

**Prevention:**
- upnext must implement its own per-key rate limiter matching MediaTrackerPlus's `RequestQueue` pattern: minimum 250ms between requests (4 req/s = 40 req/10s).
- Handle 429 responses explicitly in upnext: log the Retry-After value, wait the indicated duration, retry once. Do not blindly retry without respecting the header.
- Consider conservative throttling: use 300ms between requests (≈3.3 req/s) to leave headroom for MediaTrackerPlus concurrent calls.
- Log every 429 as a WARNING with the TMDB item ID and the Retry-After value.

**Warning signs:**
- upnext TMDB client uses `axios` with no interceptor for 429 handling
- No `timeBetweenRequests` throttle on outgoing TMDB calls from upnext
- Integration tests that fire multiple ratings rapidly and check TMDB call counts

**Phase to address:** Phase implementing external API clients in upnext (TMDB, IGDB, OpenLibrary).

---

### Pitfall 6: MediaItem Not Found in MediaTrackerPlus by External ID — Watchlist Add Fails Silently

**What goes wrong:**
upnext receives a rating webhook containing `mediaItemId` (the internal MediaTrackerPlus integer ID). upnext calls TMDB similar, gets back a list of TMDB IDs. To add a similar item to the watchlist, upnext must first ensure the item exists in MediaTrackerPlus's `mediaItem` table. If the item does not exist, `PUT /api/watchlist?mediaItemId=X` returns 400 (because `listItemRepository.addItem` validates the mediaItemId FK). upnext has no way to create a new mediaItem — that requires a full metadata import flow inside MediaTrackerPlus.

**Why it happens:**
MediaTrackerPlus's `listItem` table has a foreign key constraint on `mediaItemId`. upnext cannot insert a listItem for a TMDB ID that has never been imported into MediaTrackerPlus. The import flow (search → details → insert) is owned entirely by MediaTrackerPlus with no external API.

**Consequences:**
- All similar items that have never been searched/imported by the user return 400 on watchlist add
- This will be the majority of similar items for a new user (items they haven't searched yet)
- upnext silently adds nothing to the watchlist

**Prevention:**
- upnext must check whether the TMDB ID exists in MediaTrackerPlus before attempting watchlist add. Use `GET /api/search?q={title}` or `GET /api/item?tmdbId={id}` (verify endpoint availability) to find or trigger import.
- Alternatively, upnext calls the MediaTrackerPlus search endpoint with the title of each similar item — this triggers the import flow if not already present. Then retry the watchlist add.
- This is the most complex part of the integration: upnext must perform a search-and-import dance for each similar item. Plan for this as a multi-step operation, not a single API call.
- Log every 400 from watchlist add with the TMDB ID and title for debuggability.

**Warning signs:**
- upnext code that calls `PUT /api/watchlist` directly with a TMDB ID without first verifying the item exists in MediaTrackerPlus
- No search/import step in the recommendation pipeline

**Phase to address:** Phase implementing the watchlist population logic in upnext (this is the core integration complexity).

---

## Moderate Pitfalls

---

### Pitfall 7: Circular Call Loop — upnext Callback Triggers Another Rating Event

**What goes wrong:**
upnext calls `PUT /api/watchlist` on MediaTrackerPlus to add items. If MediaTrackerPlus ever emits a webhook for watchlist-add events (not just rating events), upnext would receive its own actions as new webhook events — a circular loop. In v1, only rating events trigger webhooks, so this is not an issue. But if the webhook scope is accidentally widened (e.g., to all `listItem` mutations), the loop activates.

**Why it happens:**
Sidecar-to-host callback patterns are prone to event amplification if the webhook trigger condition is broader than the developer intends. MediaTrackerPlus currently emits no outgoing webhooks at all — upnext is adding this capability. Scope creep in the webhook trigger (e.g., "let's also emit on watchlist changes") activates the loop.

**Consequences:**
- Infinite loop: upnext adds items → webhook fires → upnext processes → adds more items → repeat
- Exhausts TMDB rate limit immediately
- Fills watchlist with irrelevant items

**Prevention:**
- Strictly scope the webhook trigger to `PUT /api/rating` only. Document this constraint explicitly in the fork.
- upnext must have a circuit breaker: if it receives more than N webhook events per minute from the same userId, drop with a logged warning.
- In the upnext receiver, validate that the incoming payload has `event: 'rating.saved'` and reject anything else.

**Warning signs:**
- Webhook emission added to any controller other than `RatingController`
- upnext's watchlist-add calls appearing as new webhook events in logs

**Phase to address:** Phase designing the webhook trigger and upnext event receiver.

---

### Pitfall 8: Estimated Rating Stored as JSON in `metadata` Column — Not Queryable for Sort

**What goes wrong:**
The plan stores `estimated_rating` in a new JSON `metadata` column on the `listItem` table. MediaTrackerPlus's sort logic (in the list query) performs SQL ORDER BY on column values. SQLite supports `json_extract(metadata, '$.estimated_rating')` in ORDER BY, but Knex's query builder does not generate this automatically — you must use `knex.raw('json_extract(metadata, \'$.estimated_rating\')')`. If the sort implementation uses a standard `.orderBy('estimated_rating')`, it will silently sort by NULL (column does not exist at top level) and the "recommended" sort mode will appear to do nothing.

**Why it happens:**
Developers adding a new sort option naturally follow the existing pattern (`orderBy(column)`) without noticing that the new field is nested in JSON. The bug is silent — sort still runs, just produces wrong order.

**Consequences:**
- "Recommended" sort option appears to work but returns items in arbitrary order
- Difficult to debug because no error is thrown

**Prevention:**
- Use a dedicated integer/float column `estimatedRating` (nullable) on `listItem` instead of a JSON metadata blob. A proper column is queryable with standard Knex, indexed, and typed.
- If JSON is required for extensibility, write explicit integration tests that verify the sort order is correct: add two items with different estimated_ratings, sort by "recommended", assert the higher-rated item comes first.

**Warning signs:**
- Sort implementation uses `orderBy('metadata')` or `orderBy('estimated_rating')` without `knex.raw`
- No integration test that asserts sort order for the "recommended" sort

**Phase to address:** Phase adding the `estimatedRating` column migration and "recommended" sort to MediaTrackerPlus fork.

---

### Pitfall 9: Knex Migration Collision — Both upnext Fork Migrations and Upstream MediaTrackerPlus Migrations Exist

**What goes wrong:**
MediaTrackerPlus migrations are numbered by timestamp (`20230514000001_dropTableImage.ts`). upnext adds a new migration (e.g., `20260306000000_addEstimatedRating.ts`) to the fork. When pulling upstream changes, a new upstream migration with an overlapping or later timestamp will be interleaved correctly by Knex's timestamp ordering — but if upnext's migration runs before an upstream migration that modifies the same table (`listItem`), the combined migration history can leave the schema in an inconsistent state.

**Why it happens:**
Knex runs migrations in timestamp order. An upstream migration that alters `listItem` (e.g., adds a column, drops a column, changes a constraint) may conflict with upnext's migration that adds `estimatedRating` to the same table. The conflict is not detected at merge time — it surfaces at runtime when migration runs fail.

**Consequences:**
- Database schema is partially migrated — the app may start but exhibit data corruption
- Rollback requires manual SQL surgery

**Prevention:**
- Use far-future timestamps for all fork-added migrations: `20990101000000_addEstimatedRating.ts`. This ensures upnext migrations always run last regardless of upstream activity.
- Keep all fork migrations in a clearly marked section of the migrations directory with a comment: `// upnext fork — do not merge upstream`.
- Write migration tests: run all migrations on a fresh DB, then assert the schema matches expectations.

**Warning signs:**
- upnext migration timestamp is close to or earlier than recent upstream migration timestamps
- No test that runs the full migration stack from scratch

**Phase to address:** Phase adding the schema migration in MediaTrackerPlus fork.

---

### Pitfall 10: Access Token Stored in Plaintext in upnext Config — Leaked to Logs or Git

**What goes wrong:**
MediaTrackerPlus stores API access tokens as SHA-256 hashes in the DB (`token.ts` controller hashes before storing). The raw token is only returned once at creation. upnext must store this raw token in its config to authenticate callbacks. If upnext's config is stored in a `.env` file committed to the repo, or if upnext logs its full config on startup (a common debug pattern), the token is leaked.

**Why it happens:**
Early-stage projects often log configuration for debugging. The access token looks like a random string, not obviously sensitive, and gets included in config dumps.

**Consequences:**
- If the token leaks to git history, anyone with repo access can call the MediaTrackerPlus API as that user
- In a single-user local setup this is low-severity, but the pattern is bad and hard to undo from git history

**Prevention:**
- Never log the token value. Log only `token: [SET]` or `token: [NOT SET]`.
- Add `MEDIATRACKER_TOKEN` to `.gitignore` patterns and use an `.env.example` with placeholder values.
- Validate at startup that `MEDIATRACKER_TOKEN` is set and has expected length, but do not log its value.

**Warning signs:**
- `console.log(config)` or `logger.info('config', config)` anywhere in upnext startup code
- `.env` file committed to the repo

**Phase to address:** Phase implementing upnext configuration and startup.

---

### Pitfall 11: Fork Divergence — Upstream Adds Its Own Webhook System

**What goes wrong:**
MediaTrackerPlus is a fork of the active MediaTracker project. If upstream MediaTracker adds its own outgoing webhook system (or notification hooks), the fork will receive that code via merge. upnext's fork modifications to `RatingController` and the webhook emission point will conflict with the upstream implementation, requiring a manual merge that is easy to get wrong.

**Why it happens:**
MediaTracker already has a notification system (`sendNotifications.ts`, `notifications/`). Upstream may extend this to outgoing webhooks. The collision point is `RatingController.add` — both implementations want to add a side-effect after `updateOrCreate`.

**Consequences:**
- Merge conflict in `rating.ts` requires understanding both implementations
- Risk of introducing duplicate webhook calls (both the fork's implementation and upstream's)

**Prevention:**
- Minimise the diff surface in `RatingController`. Rather than inline webhook logic, inject a `postRatingSaveHook` that is configured at startup. This reduces the conflicting line count to one import and one call.
- Document the fork change in a `FORK_CHANGES.md` file: exactly what was changed, why, and what to watch for when merging upstream.
- Check upstream commit history for "webhook", "notification", "outgoing" before each upstream merge.

**Warning signs:**
- Upstream commits touching `notifications/`, `sendNotifications.ts`, or `RatingController` after the fork point
- The fork's `rating.ts` has more than 5 lines of diff from upstream

**Phase to address:** Phase maintaining the fork — ongoing across all phases.

---

## Minor Pitfalls

---

### Pitfall 12: OpenLibrary and IGDB Return Different ID Schemas — TMDB ID Assumptions Bleed Through

**What goes wrong:**
upnext's recommendation pipeline will be written first for TMDB (movies/TV) and then extended to OpenLibrary (books) and IGDB (games). If the pipeline assumes `tmdbId` as the universal identifier for a recommended item (e.g., when constructing the search query to check if the item exists in MediaTrackerPlus), the code will silently fail for book and game recommendations where the relevant ID is `openLibraryId` or `igdbId`.

**Prevention:**
Design the pipeline with a `mediaType`-discriminated union from the start. The payload passed to the "check if item exists in MediaTrackerPlus" step should carry `{ mediaType: 'movie', tmdbId: number }` | `{ mediaType: 'book', openLibraryId: string }` | `{ mediaType: 'game', igdbId: number }` — never a single `externalId` field.

**Warning signs:**
- Code that constructs a MediaTrackerPlus lookup URL using only `tmdbId` without checking `mediaType`

**Phase to address:** Phase extending upnext to OpenLibrary and IGDB.

---

### Pitfall 13: IGDB OAuth Token Expires — Silent Failure After 60 Days

**What goes wrong:**
IGDB uses Twitch OAuth for authentication. The client credentials flow returns a token with a 60-day expiry. If upnext fetches the token at startup and caches it without a refresh mechanism, all IGDB calls will return 401 after 60 days with no warning.

**Prevention:**
Store the IGDB token expiry timestamp alongside the token. Before each IGDB call, check if the token expires within the next 5 minutes and refresh proactively. Log token refresh events at INFO level.

**Warning signs:**
- IGDB token stored in a module-level variable with no expiry check
- IGDB calls that do not handle 401 by refreshing and retrying once

**Phase to address:** Phase implementing IGDB client in upnext.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Webhook emission in MediaTrackerPlus fork | Fire-and-forget not implemented — blocks HTTP response (Pitfall 1) | Use `setImmediate`, respond before emitting |
| Webhook payload schema design | No idempotency key (Pitfall 2) | Include deterministic event ID in payload |
| Retry logic for webhook delivery | Retry storm on upnext downtime (Pitfall 3) | v1: no retries, fire-and-forget only |
| TMDB similar query | Empty results for niche titles (Pitfall 4) | Log count=0, plan fallback |
| TMDB API client in upnext | Rate limit not respected across processes (Pitfall 5) | 300ms throttle, explicit 429 handling |
| Watchlist population step | MediaItem not found — 400 on add (Pitfall 6) | Search-and-import dance before watchlist add |
| "Recommended" sort implementation | JSON column not queryable with standard Knex (Pitfall 8) | Use dedicated float column, not JSON blob |
| Schema migration for estimatedRating | Migration timestamp conflict with upstream (Pitfall 9) | Use far-future timestamp (2099-*) |
| upnext startup config | Token leaked to logs or git (Pitfall 10) | Never log token value; .gitignore .env |
| Upstream merge discipline | Upstream adds competing webhook system (Pitfall 11) | Inject hook, document fork changes |
| IGDB integration | OAuth token expiry after 60 days (Pitfall 13) | Check expiry before every call |

---

## Sources

All findings are HIGH confidence, derived from direct inspection of:
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/controllers/rating.ts` — webhook hook point
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/repository/listItemRepository.ts` — watchlist add logic, FK constraints
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/requestQueue.ts` — existing rate-limit queue
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/tmdb.ts` — TMDB client implementation
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/lock.ts` — concurrency model
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/middlewares/token.ts` — access token auth model
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/entity/list.ts` — ListItem schema (no metadata column today)
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/migrations/` — migration naming convention
- `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/config.ts` — IGDB credential handling
