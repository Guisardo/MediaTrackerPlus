# Architecture Patterns Reference

Canonical patterns used in MediaTrackerPlus. Match new designs to these before inventing a new approach.

---

## §1 User-Owned Data Pattern

For any entity that belongs to a single user. The majority of domain tables follow this shape.

**Entity type** (`server/src/entity/<name>.ts`):
```typescript
export type ExampleEntity = {
  readonly id: number;
  readonly userId: number;          // FK → user.id (CASCADE DELETE)
  readonly mediaItemId: number;     // FK → mediaItem.id (CASCADE DELETE) — if media-linked
  readonly value: string | null;
  readonly createdAt: string;       // ISO 8601
  readonly updatedAt: string;       // ISO 8601
};
```

**Migration schema**:
```typescript
table.increments('id').primary();
table.integer('userId').notNullable().references('id').inTable('user').onDelete('CASCADE');
table.integer('mediaItemId').notNullable().references('id').inTable('mediaItem').onDelete('CASCADE');
table.text('value').nullable();
table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
table.unique(['userId', 'mediaItemId']);     // if one-per-user-per-item
table.index(['userId']);                     // always index FK columns
table.index(['mediaItemId']);
```

**Repository skeleton**:
```typescript
class ExampleRepository {
  async findByUser(userId: number): Promise<ExampleEntity[]>
  async findOne(userId: number, mediaItemId: number): Promise<ExampleEntity | undefined>
  async upsert(data: Omit<ExampleEntity, 'id'>): Promise<ExampleEntity>
  async delete(userId: number, mediaItemId: number): Promise<void>
}
export const exampleRepository = new ExampleRepository();
```

---

## §2 Group-Shared Data Pattern

For data aggregated or shared across a `UserGroup`. Used by `groupPlatformRatingCache`.

**Key difference from user-owned**: the owning FK is `groupId` instead of `userId`. Data is computed from group members and cached, not directly user-edited.

**Entity type**:
```typescript
export type GroupCacheEntity = {
  readonly id: number;
  readonly groupId: number;         // FK → userGroup.id (CASCADE DELETE)
  readonly mediaItemId: number;     // FK → mediaItem.id (CASCADE DELETE)
  readonly cachedValue: number | null;
  readonly recalculatedAt: string;
};
```

**Migration schema**:
```typescript
table.increments('id').primary();
table.integer('groupId').notNullable().references('id').inTable('userGroup').onDelete('CASCADE');
table.integer('mediaItemId').notNullable().references('id').inTable('mediaItem').onDelete('CASCADE');
table.real('cachedValue').nullable();
table.timestamp('recalculatedAt').notNullable().defaultTo(knex.fn.now());
table.unique(['groupId', 'mediaItemId']);
table.index(['groupId']);
```

**Repository skeleton**:
```typescript
class GroupCacheRepository {
  async getForGroup(groupId: number): Promise<GroupCacheEntity[]>
  async upsert(data: Omit<GroupCacheEntity, 'id'>): Promise<void>
  async deleteForGroup(groupId: number): Promise<void>
  async recalculate(groupId: number): Promise<void>  // triggers recomputation from member ratings
}
```

---

## §3 Junction Table Pattern

For many-to-many relationships (e.g., user ↔ userGroup, list ↔ mediaItem).

**Migration schema**:
```typescript
// No surrogate PK — composite PK on both FKs
table.integer('userId').notNullable().references('id').inTable('user').onDelete('CASCADE');
table.integer('groupId').notNullable().references('id').inTable('userGroup').onDelete('CASCADE');
table.timestamp('joinedAt').notNullable().defaultTo(knex.fn.now());
table.primary(['userId', 'groupId']);   // composite PK prevents duplicates
table.index(['groupId']);               // index the non-leading FK for reverse lookups
```

**Repository skeleton**:
```typescript
class JunctionRepository {
  async add(userId: number, groupId: number): Promise<void>
  async remove(userId: number, groupId: number): Promise<void>
  async exists(userId: number, groupId: number): Promise<boolean>
  async getAllForGroup(groupId: number): Promise<number[]>   // returns userId[]
  async getAllForUser(userId: number): Promise<number[]>     // returns groupId[]
}
```

---

## §4 Soft Delete Pattern

For data that must be hidden from queries but preserved for audit or recovery. Use sparingly — prefer hard delete with CASCADE rules unless there is a concrete audit requirement.

**Entity type addition**:
```typescript
readonly deletedAt: string | null;   // null = active, ISO 8601 = soft-deleted
```

**Migration addition**:
```typescript
table.timestamp('deletedAt').nullable().defaultTo(null);
table.index(['deletedAt']);           // for filtering active records efficiently
```

**Repository convention**:
```typescript
// All queries that return "active" records must include this filter
.whereNull('deletedAt')

// Soft delete
async softDelete(id: number): Promise<void> {
  await knex('example').where({ id }).update({ deletedAt: new Date().toISOString() });
}
```

**Warning**: Soft delete adds complexity to every query. Unique constraints must include `deletedAt` or use partial indexes. Only adopt when the requirement is explicit.

---

## §5 Metadata Provider Pattern

For integrating an external data API (TMDB, IGDB, OpenLibrary, Audible).

**Interface** (`server/src/metadata/provider/metadataProvider.ts`):
```typescript
export interface MetadataProvider {
  readonly mediaType: MediaType;
  search(query: string): Promise<MediaItemMetadata[]>;
  getById(externalId: string): Promise<MediaItemMetadata | null>;  // null on 404
  getDetails(externalId: string): Promise<MediaItemMetadata | null>;
}
```

**Implementation rules**:
1. Return `null` when the external API returns 404 — never throw for missing resources.
2. Throw (and log with `logger.error`) for 5xx or network errors — let the controller handle the HTTP response.
3. Always normalise the external response to `MediaItemMetadata` before returning — never return raw API shapes.
4. Never store the raw API response in the database.
5. Implement retry logic only if the external API documents a retry-safe error code (429 with Retry-After header).

**Controller usage**:
```typescript
const metadata = await metadataProvider.getById(externalId);
if (!metadata) throw new RequestError(404, `Item ${externalId} not found on ${provider}`);
```

---

## §6 Middleware Injection Pattern

For cross-cutting concerns that must execute on every request or a defined subset (auth, logging, rate limiting, feature flags).

**Location**: `server/src/middlewares/`

**Structure**:
```typescript
// server/src/middlewares/exampleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export function exampleMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // cross-cutting logic
      next();
    } catch (err) {
      logger.error('Middleware error', { middleware: 'example', error: (err as Error).message });
      next(err);   // pass to Express error handler
    }
  };
}
```

**Registration** (`server/src/app.ts` or `server/src/index.ts`):
```typescript
app.use(exampleMiddleware());        // global
app.use('/api/protected', authMiddleware(), router);  // scoped
```

**Rules**:
- Middleware must call `next()` or `next(err)` — never swallow the request.
- Stateful middleware (e.g., rate limiter with in-memory state) must be instantiated once and reused — not re-created per request.
- Auth middleware must set `req.user` before calling `next()` on success.

---

## §7 Complex Query Pattern

For queries that join 3+ tables, aggregate, or are shared across multiple repository methods. Lives in `server/src/knex/queries/`.

```typescript
// server/src/knex/queries/userMediaSummary.ts
import { knex } from '../../dbconfig';

export async function getUserMediaSummary(userId: number) {
  return knex('mediaItem as m')
    .join('userRating as r', 'r.mediaItemId', 'm.id')
    .join('seen as s', function () {
      this.on('s.mediaItemId', 'm.id').andOn('s.userId', knex.raw('?', [userId]));
    })
    .where('r.userId', userId)
    .select(
      'm.id',
      'm.title',
      'm.mediaType',
      'r.rating',
      knex.raw('COUNT(s.id) as seenCount')
    )
    .groupBy('m.id', 'r.rating');
}
```

**Rules**:
- Named functions, not anonymous exports.
- Accept typed parameters — no `any` in arguments.
- Repositories call these functions and wrap results in their own return types.
- Tests in `server/__tests__/queries/` mirror the query file name.

---

## §8 Notification Pattern

For scheduling and dispatching notifications (`server/src/notifications/`).

**Core interface**: `createNotificationPlatform` factory returns a `NotificationPlatform` instance.

**Design rule**: Notifications are scheduled (stored in DB) and dispatched asynchronously. Controllers never send notifications directly — they call `notificationRepository.schedule(...)`, and a background worker processes the queue.

---

## Anti-Patterns to Flag

| Anti-pattern | Symptom | Correct pattern |
|---|---|---|
| SQL in controllers | `knex(...)` imported in `controllers/` | §1–§3 Repository pattern |
| HTTP in repositories | `fetch()` or `axios` in `repository/` | §5 MetadataProvider |
| God repository | Repository file >500 lines | Split by domain; move complex queries to §7 |
| Implicit soft delete | Missing `.whereNull('deletedAt')` in one query | §4 Soft delete, or hard delete instead |
| Raw SQL string | `knex.raw('SELECT * FROM ...')` with interpolated variables | Parameterised Knex raw: `knex.raw('WHERE id = ?', [id])` |
| Cross-layer singleton | Controller importing another controller | Shared logic belongs in a service or repository |
| Untested external call | MetadataProvider not mocked in tests | §5 rule 5: always mock external APIs in tests |
