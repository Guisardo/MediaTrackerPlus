# GraphQL Schema Design Conventions

Standards for designing consistent, evolvable, and performant GraphQL APIs.

---

## Schema Design Principles

1. **Design for the client, not the data model** — shape types around UI needs, not database tables
2. **Nullable by default, non-null with intent** — only mark fields `!` (non-null) when the server guarantees they are always present
3. **Connections over lists** — use the Relay Cursor Connection spec for paginated lists
4. **Additive evolution only** — never remove or rename fields; deprecate them first
5. **Single source of truth** — every type should be owned by one bounded context

---

## Type System Conventions

### Naming

| Construct | Convention | Example |
|-----------|-----------|---------|
| Object types | `PascalCase` | `MediaItem`, `UserEntry` |
| Fields | `camelCase` | `posterUrl`, `createdAt` |
| Enums | `SCREAMING_SNAKE_CASE` values | `IN_PROGRESS`, `COMPLETED` |
| Input types | Suffix with `Input` | `CreateEntryInput`, `UpdateEntryInput` |
| Mutation payloads | Suffix with `Payload` | `CreateEntryPayload` |
| Connection types | Suffix with `Connection` | `MediaItemConnection` |
| Edge types | Suffix with `Edge` | `MediaItemEdge` |

### Scalar Types

Define custom scalars for domain-specific types rather than using raw `String`:

```graphql
scalar UUID
scalar DateTime   # ISO 8601 string
scalar Date       # ISO 8601 date string (no time)
scalar URL
scalar JSON
```

---

## Schema Structure

### Root Types

```graphql
type Query {
  # Fetch single resource by ID
  mediaItem(id: UUID!): MediaItem

  # Paginated collections — always use Connection spec
  myEntries(
    first: Int
    after: String
    last: Int
    before: String
    filter: EntryFilterInput
    orderBy: EntryOrderByInput
  ): UserEntryConnection!

  me: User!
}

type Mutation {
  # Mutations follow: verb + noun pattern, return a Payload type
  createEntry(input: CreateEntryInput!): CreateEntryPayload!
  updateEntry(id: UUID!, input: UpdateEntryInput!): UpdateEntryPayload!
  deleteEntry(id: UUID!): DeleteEntryPayload!
  addTagToEntry(entryId: UUID!, tagName: String!): AddTagPayload!
}

type Subscription {
  # Subscriptions follow: noun + event pattern
  entryUpdated(userId: UUID!): UserEntry!
}
```

### Relay Cursor Connection Pattern

Use for all paginated lists. This is the standard the GraphQL community converged on.

```graphql
type UserEntryConnection {
  edges: [UserEntryEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEntryEdge {
  cursor: String!
  node: UserEntry!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

---

## Mutation Design

### Input Types

Every mutation takes a single `Input` object (enables forward compatibility):

```graphql
input CreateEntryInput {
  mediaItemId: UUID!
  status: EntryStatus!
  rating: Int        # nullable — can be set later
  notes: String
  startedAt: DateTime
}

input UpdateEntryInput {
  # All fields optional — only provided fields are updated
  status: EntryStatus
  rating: Int
  notes: String
  startedAt: DateTime
  completedAt: DateTime
}
```

### Payload Types

Every mutation returns a `Payload` type — not the naked updated resource. This allows adding metadata (errors, affected resources, events) without a breaking change.

```graphql
type CreateEntryPayload {
  entry: UserEntry          # null on failure
  errors: [UserError!]!     # empty on success
}

type UserError {
  code: ErrorCode!
  message: String!
  field: String             # which input field caused the error
}

enum ErrorCode {
  VALIDATION_ERROR
  NOT_FOUND
  ALREADY_EXISTS
  UNAUTHORIZED
  RATE_LIMITED
}
```

**Why not just use the `errors` array in the GraphQL response?** Because GraphQL `errors` are for unexpected failures (server errors). Business logic failures (validation, not found) should be modelled as data — using union types or payload errors — so clients can handle them in typed code.

---

## Error Handling

### Union Result Types (Best for Explicit Error Branches)

```graphql
union CreateEntryResult = UserEntry | ValidationError | NotFoundError

type ValidationError {
  message: String!
  fieldErrors: [FieldError!]!
}

type FieldError {
  field: String!
  message: String!
}

type NotFoundError {
  message: String!
  resourceType: String!
  id: UUID!
}

type Mutation {
  createEntry(input: CreateEntryInput!): CreateEntryResult!
}
```

Client query:
```graphql
mutation CreateEntry($input: CreateEntryInput!) {
  createEntry(input: $input) {
    ... on UserEntry {
      id
      status
    }
    ... on ValidationError {
      message
      fieldErrors { field message }
    }
    ... on NotFoundError {
      message
    }
  }
}
```

---

## Performance Patterns

### N+1 Query Prevention (DataLoader)

Every resolver that loads related data must use a **DataLoader** (batching + caching):

```graphql
# This query triggers N+1 without DataLoader:
query {
  myEntries(first: 50) {
    edges {
      node {
        mediaItem {    # <- loaded once per entry without batching
          title
          posterUrl
        }
      }
    }
  }
}
```

Implement a `mediaItemLoader` that batches IDs and fetches in one SQL `WHERE id IN (...)`.

### Query Complexity Limits

Apply query complexity analysis to prevent expensive queries:

- Maximum depth: **10 levels**
- Maximum complexity score: **1000** (each field = 1, each list multiplied by estimated size)
- Reject queries exceeding limits with a `400` response and clear message

### Persisted Queries (for Production)

In production, prefer persisted queries (APQ) to:
- Reduce request payload size
- Enable query allowlisting (security)
- Improve CDN cacheability for GET-based queries

---

## Schema Evolution

### Adding Fields (Safe)

Adding new fields to existing types is always backward-compatible. New nullable fields are preferred. New non-null fields require a default value or a migration strategy.

### Deprecating Fields

Use `@deprecated` instead of removing fields:

```graphql
type MediaItem {
  id: UUID!
  title: String!
  # Deprecated: use posterUrl instead
  imageUrl: String @deprecated(reason: "Use posterUrl — renamed for consistency. Will be removed in schema v3.")
  posterUrl: String
}
```

### Deprecation Policy

1. Mark the field `@deprecated` with a reason and a removal timeline
2. Notify API consumers via changelog
3. Monitor field usage in production (log resolver hits for deprecated fields)
4. Remove only after usage drops to zero and the announced sunset date has passed

---

## SDL Documentation Conventions

Document every type, field, argument, and enum value with description strings:

```graphql
"""
Represents a single media item in the global catalogue.
This is the canonical record for a movie, TV show, book, or game,
shared across all users.
"""
type MediaItem {
  "Unique identifier (UUID v4)"
  id: UUID!

  "Display title of the media item"
  title: String!

  """
  The type of media. Determines which metadata fields are populated.
  Use this to conditionally render type-specific UI elements.
  """
  mediaType: MediaType!

  "URL of the primary poster/cover image. May be null for items without artwork."
  posterUrl: URL
}
```
