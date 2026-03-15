---
name: backend-developer
description: Backend API specialist for MediaTrackerPlus. Use when creating or modifying Express controllers, Knex repositories, database migrations, authentication, metadata providers, notifications, user groups, recommendations, or any server-side logic in server/src/. Also use when: adding an API endpoint, writing a migration, adding a repository method, integrating a metadata provider, debugging a query, or writing backend tests.
context: fork
agent: backend-developer
---

# Backend Developer

Implements, modifies, and tests server-side code for MediaTrackerPlus `server/`. Follows a strict three-layer architecture: controllers → repositories → database (Knex).

## Quick Reference

| Task | Reference |
|---|---|
| Endpoint inventory + REST conventions | [API.md](API.md) |
| Test patterns, utilities, migration testing | [TESTING.md](TESTING.md) |
| Controller patterns | Agent system prompt |
| Repository patterns | Agent system prompt |
| Migration conventions | Agent system prompt |
| Auth patterns | Agent system prompt |

## Decision Tree

```
User asks about backend
          │
          ├─ New API endpoint             → Read API.md → create controller method + repository
          │
          ├─ Database schema change       → Create migration (never edit existing) → update entity type
          │
          ├─ New repository method        → Add to existing repo file → follow Knex patterns
          │
          ├─ Authentication / sessions    → See auth.ts patterns → use RequestError for 401/403
          │
          ├─ Metadata provider change     → Implement MetadataProvider interface → return null on 404
          │
          ├─ Query performance issue      → Check for missing indexes → check N+1 patterns
          │
          ├─ Notification logic           → server/src/notifications/ → createNotificationPlatform
          │
          ├─ User groups / group ratings  → repository/userGroup.ts, groupPlatformRatingCache.ts
          │
          ├─ Test failure                 → Read TESTING.md → check in-memory DB setup
          │
          └─ Route not generating         → Run npm run build:routes → check decorator syntax
```

## Architecture Map

```
client/ HTTP request
        │
        ▼
server/src/middlewares/          — auth, logging, error handling
        │
        ▼
server/src/controllers/          — 22 controller files (HTTP in/out only)
        │
        ▼
server/src/repository/           — 18 repository files (all SQL lives here)
   + server/src/knex/queries/    — complex multi-join queries
        │
        ▼
server/src/metadata/provider/    — TMDB, IGDB, OpenLibrary, Audible
        │
Database (SQLite or PostgreSQL via Knex)
        │
server/src/migrations/           — 45+ timestamped migration files
```

## Controller Inventory (22 files)

| File | Routes | Purpose |
|---|---|---|
| `items.ts` | `/api/items` | Media item CRUD, search, pagination |
| `item.ts` | `/api/item/:id` | Single item details |
| `search.ts` | `/api/search` | Search across metadata providers |
| `users.ts` | `/api/users` | Auth, registration, profile |
| `watchlist.ts` | `/api/watchlist` | Watchlist add/remove |
| `rating.ts` | `/api/rating` | User star ratings |
| `progress.ts` | `/api/progress` | Episode/book progress |
| `seen.ts` | `/api/seen` | Mark items as seen/unseen |
| `calendar.ts` | `/api/calendar` | Release calendar data |
| `group.ts` | `/api/group` | User group management |
| `statistics.ts` | `/api/statistics` | Aggregated user stats |
| `configuration.ts` | `/api/configuration` | App and user settings |
| `lists.ts` | `/api/lists` | Custom list CRUD |
| `listController.ts` | `/api/list/:id/items` | Items within a list |
| `token.ts` | `/api/token` | API token management |
| `plexController.ts` | `/api/plex` | Plex integration webhook |
| `img.ts` | `/api/img` | Image proxy + resizing |
| `logs.ts` | `/api/logs` | Admin: application logs |
| `import/goodreads.ts` | `/api/import/goodreads` | Goodreads CSV import |
| `import/traktTv.ts` | `/api/import/trakt` | Trakt.tv import |

## Repository Inventory (18 files)

| File | Entity | Key Operations |
|---|---|---|
| `mediaItem.ts` | MediaItem | findAll, findById, upsert, delete, search |
| `user.ts` | User | findByUsername, create, updatePassword |
| `seen.ts` | SeenEntry | markSeen, markUnseen, getSeenDates |
| `progress.ts` | Progress | setProgress, getProgress |
| `userRating.ts` | UserRating | setRating, getRating, getBulkRatings |
| `watchlist.ts` | WatchlistEntry | add, remove, getByUser |
| `userList.ts` | UserList | CRUD + items |
| `userListItem.ts` | UserListItem | add, remove, reorder |
| `userGroup.ts` | UserGroup | create, addMember, getMembers |
| `groupPlatformRatingCache.ts` | GroupPlatformRatingCache | upsert, getForGroup |
| `notification.ts` | Notification | schedule, markSent |
| `session.ts` | Session | Passport session CRUD |
| `token.ts` | AccessToken | create, validate, revoke |
| `tvSeason.ts` | TvSeason | upsert, getByShow |
| `tvEpisode.ts` | TvEpisode | upsert, getBySeasonId |
| `image.ts` | Image | store, getUrl |
| `calendar.ts` | — | Complex query for calendar events |
| `statistics.ts` | — | Complex aggregation queries |

## Current Branch Context

This is branch `ralph/user-groups-platform-recommendations`. Recent work includes:
- Group ratings recalculation
- Group platform rating cache
- Sort tier separator
- `userRating` signal updates

When working on group-related features, check `groupPlatformRatingCache.ts` and `userGroup.ts` for the current state.
