# Testing Guide

Patterns, utilities, and conventions for the MediaTrackerPlus `server/__tests__/` test suite.

## Setup

```bash
# Run all tests (in-memory SQLite)
DATABASE_PATH=:memory: npm test

# Run a specific test file
DATABASE_PATH=:memory: npm test -- --testPathPattern=controllers/items

# Run with coverage
DATABASE_PATH=:memory: npm test -- --coverage

# Watch mode during development
DATABASE_PATH=:memory: npm run watch:test
```

**Critical:** Always set `DATABASE_PATH=:memory:` when running tests. Without it, tests run against your local data file.

## Test File Structure

```
server/__tests__/
├── __utils__/
│   ├── data.ts          # Test data builders (createTestUser, createTestMediaItem, etc.)
│   └── request.ts       # Typed supertest request helper with auth support
├── __setup__/           # Jest setup files (global beforeAll/afterAll)
├── controllers/         # HTTP-layer tests — one file per controller
│   ├── items.test.ts
│   ├── users.test.ts
│   ├── groups.test.ts
│   └── ...
├── repository/          # Data-layer tests — one file per repository
│   ├── mediaItem/
│   │   └── getItems/    # Complex query variations
│   ├── seenRepository.test.ts
│   ├── platformRatingCache.test.ts
│   └── ...
├── migrations/          # Migration integrity tests
├── metadata/            # Metadata provider tests (mocked external APIs)
├── notifications/       # Notification system tests
└── recommendations/     # Group recommendation tests
```

## Writing Controller Tests

Controller tests cover the full HTTP stack: middleware → controller → repository → in-memory DB.

```typescript
// server/__tests__/controllers/example.test.ts
import { runMigrations, clearDatabase } from '../__utils__/db';
import { request } from '../__utils__/request';
import { createTestUser, createTestMediaItem } from '../__utils__/data';

describe('ExampleController', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await runMigrations();
  });

  describe('GET /api/example/:id', () => {
    test('returns 200 and item data for authenticated owner', async () => {
      const user = await createTestUser();
      const item = await createTestMediaItem({ userId: user.id, mediaType: 'movie' });

      const res = await request
        .get(`/api/example/${item.id}`)
        .auth(user);             // sets session cookie

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(item.id);
      expect(res.body.title).toBe(item.title);
    });

    test('returns 401 for unauthenticated request', async () => {
      const user = await createTestUser();
      const item = await createTestMediaItem({ userId: user.id });

      const res = await request.get(`/api/example/${item.id}`);
      expect(res.status).toBe(401);
    });

    test('returns 404 for non-existent item', async () => {
      const user = await createTestUser();

      const res = await request
        .get('/api/example/99999')
        .auth(user);

      expect(res.status).toBe(404);
    });

    test('returns 403 when accessing another user\'s item', async () => {
      const owner = await createTestUser({ username: 'owner' });
      const other = await createTestUser({ username: 'other' });
      const item = await createTestMediaItem({ userId: owner.id });

      const res = await request
        .get(`/api/example/${item.id}`)
        .auth(other);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/example', () => {
    test('creates item and returns 201', async () => {
      const user = await createTestUser();

      const res = await request
        .post('/api/example')
        .auth(user)
        .send({ title: 'Inception', mediaType: 'movie' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Inception');
      expect(res.body.userId).toBe(user.id);
    });

    test('returns 400 for invalid body (missing required field)', async () => {
      const user = await createTestUser();

      const res = await request
        .post('/api/example')
        .auth(user)
        .send({ mediaType: 'movie' });  // missing title

      expect(res.status).toBe(400);
      expect(res.body.MediaTrackerError).toBe(true);
    });
  });
});
```

## Test Data Builders

Located in `server/__tests__/__utils__/data.ts`. Always use builders — never insert raw SQL in tests:

```typescript
import {
  createTestUser,
  createTestMediaItem,
  createTestSeen,
  createTestRating,
  createTestUserGroup,
  createTestGroupMember,
} from '../__utils__/data';

// Create a user (defaults to username='testuser', password='password')
const user = await createTestUser();
const adminUser = await createTestUser({ username: 'admin', isAdmin: true });

// Create a media item owned by a user
const movie = await createTestMediaItem({
  userId: user.id,
  mediaType: 'movie',
  title: 'The Dark Knight',
});

// Create a TV show with seasons
const show = await createTestMediaItem({
  userId: user.id,
  mediaType: 'tv',
  title: 'Breaking Bad',
  numberOfSeasons: 5,
});

// Mark as seen
const seenEntry = await createTestSeen({ userId: user.id, mediaItemId: movie.id });

// Add a rating
const rating = await createTestRating({
  userId: user.id,
  mediaItemId: movie.id,
  value: 8,
});

// Create a group with members
const group = await createTestUserGroup({ ownerId: user.id, name: 'Movie Club' });
await createTestGroupMember({ groupId: group.id, userId: otherUser.id });
```

## Writing Repository Tests

Repository tests verify the SQL logic directly, without going through HTTP:

```typescript
// server/__tests__/repository/exampleRepository.test.ts
import { runMigrations, clearDatabase } from '../__utils__/db';
import { exampleRepository } from '../../src/repository/exampleRepository';
import { createTestUser, createTestMediaItem } from '../__utils__/data';

describe('exampleRepository', () => {
  beforeAll(runMigrations);
  afterAll(clearDatabase);
  beforeEach(async () => {
    await clearDatabase();
    await runMigrations();
  });

  test('findById returns correct entity', async () => {
    const user = await createTestUser();
    const item = await createTestMediaItem({ userId: user.id });
    const found = await createTestExample({ userId: user.id, mediaItemId: item.id });

    const result = await exampleRepository.findById(found.id);
    expect(result).not.toBeUndefined();
    expect(result!.id).toBe(found.id);
    expect(result!.userId).toBe(user.id);
  });

  test('findById returns undefined for non-existent ID', async () => {
    const result = await exampleRepository.findById(99999);
    expect(result).toBeUndefined();
  });

  test('upsert creates then updates on conflict', async () => {
    const user = await createTestUser();
    const item = await createTestMediaItem({ userId: user.id });

    // First upsert — creates
    await exampleRepository.upsert({ userId: user.id, mediaItemId: item.id, value: 'first' });
    // Second upsert — updates (same unique constraint)
    await exampleRepository.upsert({ userId: user.id, mediaItemId: item.id, value: 'second' });

    const result = await exampleRepository.findByUserAndItem(user.id, item.id);
    expect(result!.value).toBe('second');
  });
});
```

## Migration Tests

Verify that migrations run cleanly in both directions:

```typescript
// server/__tests__/migrations/your_migration.test.ts
import { runMigrations, rollbackLastMigration, clearDatabase } from '../__utils__/db';
import { knex } from '../../src/dbconfig';

describe('20260311143000_add_example_table migration', () => {
  afterEach(clearDatabase);

  test('up creates the example table', async () => {
    await runMigrations();
    const exists = await knex.schema.hasTable('example');
    expect(exists).toBe(true);
  });

  test('up creates correct columns', async () => {
    await runMigrations();
    const hasUserId = await knex.schema.hasColumn('example', 'userId');
    const hasValue = await knex.schema.hasColumn('example', 'value');
    expect(hasUserId).toBe(true);
    expect(hasValue).toBe(true);
  });

  test('down drops the example table', async () => {
    await runMigrations();
    await rollbackLastMigration();
    const exists = await knex.schema.hasTable('example');
    expect(exists).toBe(false);
  });
});
```

## Mocking Metadata Providers

Never call external APIs in tests. Mock the provider at the module level:

```typescript
// server/__tests__/metadata/tmdb.test.ts
import { TmdbProvider } from '../../src/metadata/provider/tmdb';

// Mock the HTTP client used by TMDB
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TmdbProvider', () => {
  test('search returns normalized results', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [{
          id: 550,
          title: 'Fight Club',
          release_date: '1999-10-15',
        }],
      },
    });

    const provider = new TmdbProvider();
    const results = await provider.search('Fight Club', 'movie');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Fight Club');
    expect(results[0].externalId).toBe('550');
  });

  test('returns empty array on 404', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    const provider = new TmdbProvider();
    const results = await provider.search('nonexistent', 'movie');

    expect(results).toEqual([]);
  });
});
```

## Authentication in Tests

The `request` helper provides an `.auth(user)` method that sets a valid session:

```typescript
// Bearer token auth (alternative)
const res = await request
  .get('/api/items')
  .set('Access-Token', user.apiToken);

// Session-based auth (most common in tests)
const res = await request
  .get('/api/items')
  .auth(user);  // sets the session cookie
```

## Bulk Upsert Testing (SQLite Limit)

SQLite limits compound SELECT to 500 items. Tests for bulk operations must verify both below and above that threshold:

```typescript
test('bulk upsert works for >500 items', async () => {
  const user = await createTestUser();
  const items = Array.from({ length: 600 }, (_, i) =>
    createTestMediaItemData({ userId: user.id, title: `Item ${i}` })
  );

  // Should not throw a "too many SQL variables" error
  await expect(mediaItemRepository.bulkUpsert(items)).resolves.not.toThrow();

  const count = await knex('mediaItem').where({ userId: user.id }).count({ c: '*' }).first();
  expect(Number(count!.c)).toBe(600);
});
```

## Coverage Requirements

Every new endpoint must have tests for:

| Scenario | Required |
|---|---|
| Success (happy path) | ✅ |
| Item not found (404) | ✅ |
| Unauthenticated request (401) | ✅ |
| Access to another user's resource (403) | ✅ if resource is user-scoped |
| Invalid input (400) | ✅ for POST/PUT/PATCH |
| Admin-only enforcement | ✅ if endpoint is admin-only |

Run coverage to check:
```bash
DATABASE_PATH=:memory: npm run test:coverage
```

Coverage is collected from `src/**/*.{js,ts}` (excluding `.d.ts` and i18n).
