# API Reference

Endpoint inventory, REST conventions, and patterns for MediaTrackerPlus `server/src/`.

## Base URL

All endpoints are prefixed with `/api/`. The app serves both the React SPA (`/`) and the API (`/api/`) from the same Express server.

## Authentication

Two mechanisms — both are transparently handled by middleware and result in `req.user` being populated:

| Mechanism | Header | When to Use |
|---|---|---|
| Session cookie | `Cookie: connect.sid=...` | Browser sessions |
| Bearer token | `Authorization: Bearer <token>` or `Access-Token: <token>` | API clients, Plex integration |

### Protected vs. public endpoints

Most endpoints require authentication. A few are public (registration, login, image proxy).

```typescript
// How the middleware works — in auth.ts
app.use(passport.authenticate('session', { session: true }));
app.use(AccessTokenMiddleware); // adds token-based auth fallback
```

## REST Conventions

### HTTP methods

| Method | Use for |
|---|---|
| `GET` | Read — never side effects |
| `POST` | Create new resource |
| `PUT` | Full replace of existing resource |
| `PATCH` | Partial update |
| `DELETE` | Remove resource |

### Status codes

| Code | When |
|---|---|
| `200` | Success with body |
| `201` | Resource created |
| `204` | Success, no body |
| `400` | Validation error (AJV schema violation) |
| `401` | Not authenticated |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `500` | Unexpected server error |

### Error response format

All errors return:
```json
{
  "errorMessage": "Descriptive error message",
  "MediaTrackerError": true
}
```

Use `RequestError` in controllers:
```typescript
import { RequestError } from '../requestError';

throw new RequestError(404, `Media item ${id} not found`);
throw new RequestError(403, `User ${userId} is not a member of group ${groupId}`);
```

## Endpoint Inventory

### Items (`/api/items`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/items` | List media items (paginated, filterable) |
| `GET` | `/api/item/:id` | Get single item with full details |
| `POST` | `/api/items` | Add a media item to the user's library |
| `PUT` | `/api/item/:id` | Update a media item |
| `DELETE` | `/api/item/:id` | Remove a media item |

**Filtering params for GET `/api/items`:**
- `mediaType`: `movie | tv | game | book | audiobook`
- `status`: `watchlist | in-progress | completed | dropped`
- `page`, `pageSize`: pagination
- `sortBy`, `sortOrder`: sorting
- `searchQuery`: text search

### Authentication (`/api/users`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users/register` | Create new account |
| `POST` | `/api/users/login` | Log in (sets session cookie) |
| `POST` | `/api/users/logout` | Log out (clears session) |
| `GET` | `/api/users/me` | Get current user profile |
| `PUT` | `/api/users/me` | Update profile |
| `PUT` | `/api/users/me/password` | Change password |

### Tracking (`/api/seen`, `/api/progress`, `/api/rating`, `/api/watchlist`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/seen` | Mark item/episode as seen |
| `DELETE` | `/api/seen/:id` | Mark item/episode as unseen |
| `GET` | `/api/seen/:mediaItemId` | Get seen dates for an item |
| `PUT` | `/api/progress` | Set progress (episode or book position) |
| `GET` | `/api/progress/:mediaItemId` | Get progress for an item |
| `PUT` | `/api/rating` | Set star rating (0–10) |
| `DELETE` | `/api/rating/:mediaItemId` | Remove rating |
| `POST` | `/api/watchlist` | Add to watchlist |
| `DELETE` | `/api/watchlist/:mediaItemId` | Remove from watchlist |

### Groups (`/api/group`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/group` | List user's groups |
| `POST` | `/api/group` | Create a group |
| `GET` | `/api/group/:id` | Get group details + members |
| `PUT` | `/api/group/:id` | Update group |
| `DELETE` | `/api/group/:id` | Delete group |
| `POST` | `/api/group/:id/members` | Add member |
| `DELETE` | `/api/group/:id/members/:userId` | Remove member |
| `GET` | `/api/group/:id/ratings` | Get group platform rating cache |

### Lists (`/api/lists`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/lists` | Get user's custom lists |
| `POST` | `/api/lists` | Create a list |
| `GET` | `/api/list/:id` | Get list with items |
| `PUT` | `/api/list/:id` | Update list metadata |
| `DELETE` | `/api/list/:id` | Delete list |
| `POST` | `/api/list/:id/items` | Add item to list |
| `DELETE` | `/api/list/:id/items/:itemId` | Remove item from list |

### Search (`/api/search`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/search` | Search across metadata providers |

Query params: `q` (search term), `mediaType`

### Calendar (`/api/calendar`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/calendar` | Get calendar events for date range |

Query params: `start`, `end` (ISO dates)

### Statistics (`/api/statistics`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/statistics` | Get aggregated user statistics |
| `GET` | `/api/statistics/genres` | Genre breakdown |

### Configuration (`/api/configuration`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/configuration` | Get app + user configuration |
| `PUT` | `/api/configuration` | Update configuration |

### Imports

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/import/goodreads` | Import Goodreads CSV |
| `POST` | `/api/import/trakt` | Import from Trakt.tv |

### Image Proxy (`/api/img`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/img` | Proxy and resize external images |

Query params: `url` (encoded), `w` (width)

### Tokens (`/api/token`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/token` | List API tokens |
| `POST` | `/api/token` | Create API token |
| `DELETE` | `/api/token/:id` | Revoke token |

## Adding a New Endpoint — Checklist

1. **Check this file** — does the endpoint already exist or partially exist?
2. **Define types** — create request/response TypeScript interfaces
3. **Write the repository method** — all SQL goes in `server/src/repository/`
4. **Write the controller method** — thin, delegates to repository
5. **Regenerate routes** — `npm run build:routes`
6. **Write tests** — at minimum: success, 404, 401

## Route Generation

Routes are auto-generated from TypeScript controller type annotations. After any controller change:

```bash
npm run build:routes
```

Verify the diff in `server/src/generated/routes/routes.ts` — new routes should appear with correct method, path, and validation schema.

## Knex Query Patterns

### Basic CRUD

```typescript
// SELECT one
const item = await knex<MediaItem>('mediaItem').where({ id }).first();

// SELECT many with filter
const items = await knex<MediaItem>('mediaItem')
  .where({ userId, mediaType })
  .orderBy('title', 'asc');

// INSERT and return
const [created] = await knex<MediaItem>('mediaItem').insert(data).returning('*');

// UPSERT
await knex<UserRating>('userRating')
  .insert(data)
  .onConflict(['userId', 'mediaItemId'])
  .merge();

// UPDATE
await knex<MediaItem>('mediaItem')
  .where({ id, userId })
  .update({ updatedAt: new Date().toISOString() });

// DELETE
await knex<MediaItem>('mediaItem').where({ id, userId }).delete();
```

### Pagination

```typescript
const pageSize = 24;
const offset = (page - 1) * pageSize;

const items = await knex<MediaItem>('mediaItem')
  .where({ userId })
  .limit(pageSize)
  .offset(offset);

const [{ count }] = await knex('mediaItem')
  .where({ userId })
  .count({ count: '*' });
```

### Joins

```typescript
const itemsWithRatings = await knex('mediaItem as m')
  .leftJoin('userRating as r', function() {
    this.on('r.mediaItemId', '=', 'm.id').andOn('r.userId', '=', knex.raw('?', [userId]));
  })
  .where('m.userId', userId)
  .select('m.*', 'r.value as userRating');
```

### SQLite + PostgreSQL compatibility

The app supports both databases. Avoid PostgreSQL-only syntax:

```typescript
// ✅ Works on both — use knex.fn.now() for timestamps
.insert({ createdAt: knex.fn.now() })

// ✅ Works on both — string ISO dates
.insert({ createdAt: new Date().toISOString() })

// ❌ PostgreSQL only
.insert({ createdAt: knex.raw('NOW()') })
.insert({ data: knex.raw('?::jsonb', [jsonString]) })
```

For bulk upserts with large datasets (>500 items), SQLite has a compound SELECT limit. See the existing bulk upsert pattern in `mediaItemRepository` — it batches in chunks of 500.
