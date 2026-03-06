# Feature Landscape

**Domain:** Recommendation sidecar service — cross-media similar-item APIs (TMDB, IGDB, OpenLibrary)
**Researched:** 2026-03-06
**Confidence:** HIGH (sourced from live MediaTrackerPlus codebase at `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus`)

---

## API Capability Overview

This file documents exact API capabilities for the three external providers that upnext calls to
find similar content. All findings are derived from the working MediaTrackerPlus provider
implementations (`server/src/metadata/provider/tmdb.ts`, `igdb.ts`, `openlibrary.ts`) and their
corresponding test mocks — not documentation alone.

---

## TMDB Similar Movies

### Endpoint

```
GET https://api.themoviedb.org/3/movie/{tmdbId}/similar
```

### Authentication

API key via query parameter. MediaTrackerPlus uses a hardcoded key (`779734046efc1e6127485c54d3b29627`),
which is a public read-only TMDB v3 key. upnext must reuse the same key from `GlobalConfiguration`
or read it from the same config source to avoid divergence.

```typescript
params: {
  api_key: TMDB_API_KEY,
  language: GlobalConfiguration.configuration.tmdbLang,  // e.g. "en-US"
  page: 1,  // optional, defaults to 1
}
```

### Response Shape

The similar endpoint returns the same envelope as the movie search response
(`TMDbApi.MovieSearchResponse`) — confirmed by TMDB API design and search mock at
`server/__tests__/metadata/provider/mock/tmdb/movieSearchResponse.json`:

```typescript
{
  page: number,            // current page (1-based)
  total_pages: number,     // total number of pages available
  total_results: number,   // total result count across all pages
  results: Array<{
    id: number,            // TMDB movie ID — use as tmdbId
    title: string,
    original_title: string,
    overview: string,
    release_date: string,  // "YYYY-MM-DD"
    poster_path: string,   // e.g. "/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg" — prefix with image base URL
    backdrop_path: string,
    genre_ids: number[],   // genre IDs only, not names (unlike details endpoint)
    popularity: number,    // float, e.g. 254.486
    vote_average: number,  // float 0–10, e.g. 7.9
    vote_count: number,    // integer
    adult: boolean,
    original_language: string,
    video: boolean,
  }>
}
```

### Quality Signals Available

| Field | Range | Use for Scoring |
|-------|-------|-----------------|
| `vote_average` | 0.0–10.0 | **Primary** — maps directly to `tmdbRating` in MediaItemBase |
| `vote_count` | 0–n | **Filter threshold** — exclude items with vote_count < 10 to avoid noise |
| `popularity` | 0–n (unbounded) | **Secondary** — proxy for cultural relevance; not normalized |
| `release_date` | "YYYY-MM-DD" | **Recency filter** — optionally deprioritize very old results |

`vote_average` is the same field that TMDB's details endpoint returns and that MediaTrackerPlus
already stores as `tmdbRating`. The scoring formula (`score = estimated_rating * W_est + external_rating * W_ext`)
can use `vote_average` directly as `external_rating`.

### Pagination

- Page size: 20 items per page (fixed, not configurable)
- Maximum pages: TMDB enforces a hard cap at page 500
- Recommended strategy: Fetch page 1 only (20 items) — for similar-content use cases, quality
  degrades significantly beyond the first page. Total results for similar movies is typically
  20–60 results.

### Rate Limits

TMDB free tier: 40 requests per 10 seconds per IP. MediaTrackerPlus does not implement a
request queue for TMDB (unlike IGDB which has a 250ms queue). For recommendation use cases
(one webhook → one similar call → 20 results) this limit is not a practical concern.

### Item ID for Dedup

The `id` field in each result is the `tmdbId`. This matches the `ExternalIds.tmdbId` field
in MediaTrackerPlus and is what must be checked against the user's existing library to avoid
adding duplicates.

---

## TMDB Similar TV Shows

### Endpoint

```
GET https://api.themoviedb.org/3/tv/{tmdbId}/similar
```

### Authentication

Same API key and language parameters as movies:

```typescript
params: {
  api_key: TMDB_API_KEY,
  language: GlobalConfiguration.configuration.tmdbLang,
  page: 1,
}
```

### Response Shape

Returns the same envelope as the TV search response (`TMDbApi.TvSearchResponse`):

```typescript
{
  page: number,
  total_pages: number,
  total_results: number,
  results: Array<{
    id: number,            // TMDB TV show ID — use as tmdbId
    name: string,          // NOTE: "name" not "title" for TV shows
    original_name: string,
    overview: string,
    first_air_date: string,  // "YYYY-MM-DD"
    poster_path: string,
    backdrop_path: string,
    genre_ids: number[],
    origin_country: string[],
    original_language: string,
    popularity: number,
    vote_average: number,    // 0–10
    vote_count: number,
  }>
}
```

### Key Difference from Movies

TV results use `name` not `title`, and `first_air_date` not `release_date`. The `mapTvShow`
method in the existing provider already handles this mapping. upnext must apply the same
field mapping when processing similar TV results.

### Quality Signals Available

Same as movies: `vote_average` (primary), `vote_count` (filter threshold), `popularity` (secondary).

### Pagination

Same as movies: 20 items per page, fetch page 1 only in practice.

---

## TMDB: "Similar" vs "Recommendations" Distinction

Per PROJECT.md, upnext explicitly uses "similar" not "recommendations". The distinction matters:

| Endpoint | Algorithm | Result Count | Predictability |
|----------|-----------|--------------|----------------|
| `/movie/{id}/similar` | Genre/keyword metadata overlap | ~20–60 results | Consistent, genre-based |
| `/movie/{id}/recommendations` | TMDB-curated editorial | ~5–20 results | Sparse, varies by title |

"Similar" is the correct choice for upnext because it returns more results consistently and
is entirely data-driven (not editorially gated). Both endpoints share the same response shape.

---

## TMDB: Additional Fetch Required After Similar

The similar endpoint returns `genre_ids` (numeric IDs), not genre names. It does NOT return
`imdb_id`, `runtime`, `status`, `homepage`, or full genre names. If upnext needs these for
the stored `MediaItemForProvider`, a second call to the details endpoint is required:

```
GET https://api.themoviedb.org/3/movie/{tmdbId}
GET https://api.themoviedb.org/3/tv/{tmdbId}
```

**Recommendation:** Do NOT fetch full details for every similar result. Store only what the
similar endpoint provides (`tmdbId`, `title`/`name`, `vote_average`, `release_date`,
`poster_path`, `genre_ids`). Set `needsDetails: true` so MediaTrackerPlus's existing
metadata refresh mechanism fetches full details lazily on first user interaction — this is
the same pattern used by the existing `search()` implementation in `TMDbMovie`.

---

## IGDB Similar Games

### Endpoint

```
POST https://api.igdb.com/v4/games
```

IGDB uses a POST-based query language (not REST GET with path params). All queries use
the same games endpoint with a body that specifies fields and filters.

### Authentication

OAuth 2.0 via Twitch. Two steps:

**Step 1 — Token acquisition (POST, once per session):**
```
POST https://id.twitch.tv/oauth2/token
params: {
  client_id: GlobalConfiguration.configuration.igdbClientId,
  client_secret: GlobalConfiguration.configuration.igdbClientSecret,
  grant_type: "client_credentials"
}
```
Returns: `{ access_token: string, expires_in: number, token_type: string }`

**Step 2 — API calls:**
```
Headers: {
  Authorization: "Bearer {access_token}",
  Client-ID: "{igdbClientId}"
}
```

Token refresh: MediaTrackerPlus refreshes the token when the current token has expired
(`tokenAcquiredAt + expires_in * 1000 < now`). upnext must implement the same refresh
logic or reuse the IGDB class instance from MediaTrackerPlus.

### Query for Similar Games

The `similar_games` field exists on the `Game` interface in `igdb.ts` as `similar_games?: number[]`.
It contains an array of game IDs. However, the existing `game()` and `searchGames()` query bodies
do NOT include `similar_games` in their field list — it must be added explicitly.

**Two-step query required:**

**Step 1 — Fetch similar game IDs for a known game:**
```
POST https://api.igdb.com/v4/games
Body:
  fields similar_games;
  where id = {igdbId} & version_parent = null;
```
Returns: `[{ id: number, similar_games: number[] }]`

**Step 2 — Fetch details for each similar game ID:**
```
POST https://api.igdb.com/v4/games
Body:
  fields
    name,
    first_release_date,
    summary,
    cover.image_id,
    involved_companies.company.name,
    involved_companies.developer,
    platforms.name,
    genres.name,
    websites.url,
    rating,
    rating_count,
    aggregated_rating,
    aggregated_rating_count,
    total_rating,
    total_rating_count;
  where id = ({id1},{id2},...) & version_parent = null;
  limit 20;
```

### Response Shape (Similar Game Details)

```typescript
{
  id: number,                       // igdbId
  name: string,
  first_release_date?: number,      // Unix timestamp (seconds) — multiply by 1000 for Date
  summary?: string,
  cover?: { id: number, image_id: string },  // image URL via getPosterUrl()
  genres?: Array<{ id: number, name: string }>,
  involved_companies?: Array<{
    company: { id: number, name: string },
    developer: boolean,
  }>,
  platforms?: Array<{ id: number, name: string }>,
  websites?: Array<{ id: number, url: string }>,
  rating?: number,                  // IGDB user rating (0–100 scale)
  rating_count?: number,
  aggregated_rating?: number,       // critic/external site aggregate (0–100 scale)
  aggregated_rating_count?: number,
  total_rating?: number,            // weighted average of rating + aggregated_rating
  total_rating_count?: number,
}
```

### Quality Signals Available

| Field | Range | Notes |
|-------|-------|-------|
| `total_rating` | 0–100 | **Primary** — weighted avg of user + critic ratings; most reliable |
| `total_rating_count` | 0–n | Use as minimum threshold filter (e.g. >= 5) |
| `rating` | 0–100 | IGDB user rating only |
| `aggregated_rating` | 0–100 | External critic aggregate |

**Scale conversion for scoring:** IGDB ratings are 0–100; MediaItemBase `tmdbRating` is 0–10.
Divide IGDB rating by 10 before using in the scoring formula. The `external_rating` in
`score = estimated_rating * W_est + external_rating * W_ext` must use a consistent scale.

**Important:** `rating` and `total_rating` are optional fields — many games have no rating
data. Fall back to `estimated_rating` only when `total_rating` is absent.

### Rate Limits

IGDB (Twitch Developer) free tier: 4 requests per second. MediaTrackerPlus enforces
`timeBetweenRequests: 250` ms (250ms = 4 req/sec) via `RequestQueue`. upnext must respect
this limit. The two-step similar-games query costs 2 requests per rated game.

### Pagination

IGDB has no cursor-based pagination for the `similar_games` approach. `similar_games` returns
a flat array of IDs (typically 5–15 IDs). Limit the Step 2 query to `limit 20` to stay within
a single request.

### Item ID for Dedup

The `id` field in each result is the `igdbId`. Matches `ExternalIds.igdbId` in MediaTrackerPlus.

---

## OpenLibrary Related Books

### Honest Assessment: No "Similar Books" API Exists

OpenLibrary does NOT provide a "similar books" or "recommendations" endpoint. The API surface
consists of:

| Endpoint | Purpose | Similar-Items Capability |
|----------|---------|--------------------------|
| `GET /search.json?q=...` | Full-text search | No — keyword search only |
| `GET /works/{workId}.json` | Work details | No — returns `subjects[]` but no related works |
| `GET /authors/{authorId}.json` | Author details | No — returns work list for that author |
| `GET /subjects/{subject}.json` | Subject browse | Partial — returns works tagged with a subject |

The `DetailsResponse` in `openlibrary.ts` includes `subjects: string[]`, `subject_places: string[]`,
`subject_people: string[]`, and `subject_times: string[]`. These can be used as a workaround
to find similar books, but it requires a subject search rather than a direct "similar" call.

### Workaround Strategy: Subject-Based Search

**Step 1 — Fetch work details to get subjects:**
```
GET https://openlibrary.org/works/{openlibraryId}.json
```
Returns `subjects: string[]`, e.g. `["Wizards", "Fiction", "Magic"]`

**Step 2 — Search by first subject:**
```
GET https://openlibrary.org/search.json
params: {
  subject: subjects[0],  // most specific subject from the list
  fields: "key,title,first_publish_year,number_of_pages_median,cover_i,author_name",
  type: "work",
  limit: 20,
}
```

Or use the subjects endpoint directly:
```
GET https://openlibrary.org/subjects/{subject_slug}.json?limit=20
```

### Response Shape (Subject Search)

```typescript
{
  works: Array<{
    key: string,               // e.g. "/works/OL82563W" — use as openlibraryId
    title: string,
    authors: Array<{ name: string, key: string }>,
    cover_id?: number,         // image via https://covers.openlibrary.org/b/id/{cover_id}.jpg
    first_publish_year?: number,
  }>
}
```

### Quality Signals Available for Books

OpenLibrary has NO reliable numeric rating or quality signal. The following fields exist but
are poor quality signals:

| Field | Notes |
|-------|-------|
| `edition_count` | Proxy for popularity — widely printed books have more editions |
| `first_publish_year` | Not a quality signal |
| `number_of_pages_median` | Not a quality signal |

**Accepted limitation per PROJECT.md:** "Book and game recommendations with high quality
(limited free API coverage) — known gap, accept for v1."

**Recommendation for scoring:** When `external_rating` is unavailable (OpenLibrary books),
the scoring formula falls back to `estimated_rating` only. This is already documented in
PROJECT.md: "Items with no external rating fall back to estimated_rating only."

### Rate Limits

OpenLibrary: No official rate limit documented, but the API is a public academic resource.
Sustained bursts should be avoided. A conservative 1 request/second is appropriate.
MediaTrackerPlus makes no rate-limiting implementation for OpenLibrary currently.

### Authentication

None. OpenLibrary is a completely open API — no API key, no OAuth, no account required.

### Item ID for Dedup

`key` field from search (e.g. `/works/OL82563W`) matches `ExternalIds.openlibraryId` in
MediaTrackerPlus. Must strip leading `/works/` prefix if needed — check existing
`openlibraryId` format in the database.

---

## Table Stakes

Features upnext must support. Missing any of these means the product doesn't work.

| Feature | Why Required | Complexity | API Source |
|---------|--------------|------------|-----------|
| TMDB similar movies endpoint | Core requirement per PROJECT.md | Low | `GET /movie/{id}/similar` |
| TMDB similar TV shows endpoint | Core requirement per PROJECT.md | Low | `GET /tv/{id}/similar` |
| IGDB similar games (two-step fetch) | Core requirement per PROJECT.md | Medium | Two POST requests |
| OpenLibrary subject-based related books | Best available capability; no similar API exists | Medium | `GET /works/{id}.json` + subject search |
| `vote_average` as `external_rating` for TMDB items | Required for scoring formula | Low | Present in similar endpoint response |
| `total_rating / 10` as `external_rating` for IGDB items | Required for scoring; scale normalization needed | Low | Must request field explicitly |
| `needsDetails: true` pattern for similar results | Matches existing MediaTrackerPlus lazy-detail pattern | Low | Reuse existing provider convention |
| Dedup by `tmdbId` / `igdbId` / `openlibraryId` | Prevents adding items already in library | Low | Use ExternalIds fields |

---

## Differentiators

Features that add value beyond core similar-item fetching.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `vote_count` / `total_rating_count` minimum threshold | Filters out low-confidence results (unrated or barely-rated items) | Low | TMDB: skip if vote_count < 10; IGDB: skip if total_rating_count < 5 |
| Multi-page TMDB fetch (pages 1–2) | Doubles result pool from 20 to 40; higher chance of finding items not yet in library | Low | Only worthwhile if page 1 results are mostly already-watched |
| Configurable result limit per provider | Allows tuning how many similar items are added per rating event | Low | Default: 5 items per provider |
| Language filter for TMDB results | Skips non-original-language results if user doesn't want foreign films | Low | `original_language` field available in similar response |
| IGDB `aggregated_rating` preference over `rating` | Critic aggregates are more stable quality signals than user votes for games | Low | Use `aggregated_rating` when count > 3, else fall back to `total_rating` |

---

## Anti-Features

Features to explicitly avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| TMDB recommendations endpoint | Documented as out-of-scope in PROJECT.md; sparser results | Use similar endpoint only |
| Fetching full details for every similar result immediately | N+1 API calls per webhook; unnecessary for watchlist addition | Set `needsDetails: true`, let MediaTrackerPlus lazy-fetch on user view |
| OpenLibrary ratings from Goodreads/external | Goodreads API is closed; no free aggregate book rating exists | Accept no external rating for books; use estimated_rating only |
| Pagination beyond page 2 for TMDB similar | Quality degrades; adds latency for marginal gain | Fetch pages 1–2 at most |
| Implementing custom rate limiting independent of IGDB RequestQueue | Duplicates existing MediaTrackerPlus infrastructure | Reuse or reference the 250ms queue pattern from igdb.ts |
| Storing full TMDB/IGDB API response JSON in listItem metadata | Bloats the metadata field; leaks external schema into DB | Store only: `estimated_rating`, `source_item_id`, `source_provider` |

---

## Feature Dependencies

```
IGDB similar games requires:
  → Twitch OAuth token (Step 1: token refresh)
  → Two-step IGDB query (Step 2: fetch similar_games IDs, Step 3: fetch game details)

OpenLibrary related books requires:
  → Work details fetch (to get subjects[])
  → Subject search (to get candidate books)

TMDB scoring requires:
  → vote_average from similar endpoint (available immediately, no second call needed)

IGDB scoring requires:
  → total_rating field added to existing game query (NOT currently fetched by igdb.ts)
  → Scale normalization: divide by 10 before applying scoring formula

Dedup check requires:
  → MediaTrackerPlus list API call to check if tmdbId/igdbId/openlibraryId already exists
  → Must happen BEFORE adding item to watchlist
```

---

## MVP Recommendation

Prioritize in this order:

1. **TMDB similar movies and TV shows** — highest confidence, simplest integration, best quality
   signals (`vote_average` available in the similar response itself). Both endpoints share the
   same response shape as the existing search endpoint, so the mapping code is near-zero.

2. **IGDB similar games (two-step)** — requires adding `similar_games` and rating fields to
   the existing query, plus a second fetch for game details. Medium complexity but
   well-defined.

3. **OpenLibrary subject-based related books** — subject search is the only viable path.
   Accept the lack of external rating for books in v1 (scoring falls back to estimated_rating).
   Implement last because quality is lowest.

Defer:
- Multi-page TMDB fetching: defer to post-v1 if dedup rate is high
- Language filtering: defer to post-v1; adds config complexity
- Per-provider configurable result limits: implement as env var defaults, not user-facing config in v1

---

## API Reference Summary

| Provider | Endpoint | Auth | Result Count | Rating Field | Scale |
|----------|----------|------|--------------|--------------|-------|
| TMDB movies | `GET /3/movie/{id}/similar` | `api_key` param | 20/page | `vote_average` | 0–10 |
| TMDB TV | `GET /3/tv/{id}/similar` | `api_key` param | 20/page | `vote_average` | 0–10 |
| IGDB | `POST /v4/games` (two steps) | Bearer token (Twitch OAuth) | Up to 20 | `total_rating` | 0–100 (divide by 10) |
| OpenLibrary | `GET /works/{id}.json` + subject search | None | 20/page | None available | N/A |

---

## Sources

- MediaTrackerPlus live provider: `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/tmdb.ts` (HIGH confidence)
- MediaTrackerPlus live provider: `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/igdb.ts` (HIGH confidence)
- MediaTrackerPlus live provider: `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/server/src/metadata/provider/openlibrary.ts` (HIGH confidence)
- MediaTrackerPlus IGDB Game interface: `similar_games?: number[]` confirmed at line 185 of igdb.ts (HIGH confidence)
- TMDB response shape confirmed by mock at `server/__tests__/metadata/provider/mock/tmdb/movieSearchResponse.json` (HIGH confidence)
- PROJECT.md decisions table confirming "similar not recommendations" and OpenLibrary quality gap acceptance (HIGH confidence)
- IGDB rate limit (250ms queue): `RequestQueue` instantiation in igdb.ts line 146 (HIGH confidence)
- OpenLibrary "no similar API" conclusion: provider code has no similar/recommend endpoint; `DetailsResponse` only returns `subjects[]` (HIGH confidence)
