# Diagram Templates

Mermaid templates for common architectural views in MediaTrackerPlus. Paste and adapt.

---

## §1 C4 Container Diagram

Use for: placing a new feature in the overall system, onboarding, high-level design proposals.

```mermaid
C4Container
  title MediaTrackerPlus — Container Diagram

  Person(user, "User", "Self-hosted instance owner or group member")

  System_Boundary(mtp, "MediaTrackerPlus") {
    Container(spa, "React SPA", "React 18, TypeScript", "Media tracking UI — runs in browser")
    Container(api, "Express API", "Node.js, Express 4, TypeScript", "REST API, auth, business logic")
    ContainerDb(db, "Database", "SQLite / PostgreSQL via Knex", "Media items, ratings, groups, sessions")
    Container(worker, "Background Worker", "Node.js", "Notification scheduling, metadata refresh")
  }

  System_Ext(tmdb, "TMDB", "Movie and TV metadata")
  System_Ext(igdb, "IGDB", "Video game metadata")
  System_Ext(openlib, "OpenLibrary", "Book metadata")
  System_Ext(audible, "Audible", "Audiobook metadata")

  Rel(user, spa, "Uses", "HTTPS")
  Rel(spa, api, "REST API calls", "HTTP/JSON")
  Rel(api, db, "Reads / writes", "Knex (SQL)")
  Rel(worker, db, "Reads / writes", "Knex (SQL)")
  Rel(api, tmdb, "Metadata search/fetch", "HTTPS")
  Rel(api, igdb, "Metadata search/fetch", "HTTPS")
  Rel(api, openlib, "Metadata search/fetch", "HTTPS")
  Rel(api, audible, "Metadata search/fetch", "HTTPS")
```

---

## §2 Sequence Diagram

Use for: any feature that crosses more than one layer, explaining auth flows, debugging, API design reviews.

### Template — Authenticated API Request

```mermaid
sequenceDiagram
  autonumber
  actor Browser
  participant Middleware as Express Middlewares<br/>(auth, logging)
  participant Controller as Controller
  participant Repo as Repository
  participant DB as Database

  Browser->>Middleware: POST /api/example { body }
  Middleware->>Middleware: Validate session / Bearer token
  Middleware->>Controller: req.user set, next()
  Controller->>Controller: Validate input via AJV
  Controller->>Repo: exampleRepository.create(data)
  Repo->>DB: INSERT INTO example ...
  DB-->>Repo: { id: 42, ... }
  Repo-->>Controller: ExampleEntity
  Controller-->>Browser: 201 { id: 42, ... }
```

### Template — Metadata Fetch Flow

```mermaid
sequenceDiagram
  autonumber
  actor Browser
  participant Controller as SearchController
  participant Provider as MetadataProvider<br/>(TMDB / IGDB / ...)
  participant Repo as MediaItemRepository
  participant DB as Database

  Browser->>Controller: GET /api/search?q=inception&type=movie
  Controller->>Provider: provider.search("inception")
  Provider->>Provider: HTTP GET api.themoviedb.org/...
  Provider-->>Controller: MediaItemMetadata[]
  Controller->>Repo: mediaItemRepository.findByExternalIds(ids)
  Repo->>DB: SELECT ...
  DB-->>Repo: MediaItem[]
  Repo-->>Controller: MediaItem[]
  Controller-->>Browser: 200 [merged search results]
```

### Template — Group Rating Recalculation

```mermaid
sequenceDiagram
  autonumber
  participant Trigger as Rating Update Event
  participant Service as GroupRatingService
  participant UserRatingRepo as UserRatingRepository
  participant CacheRepo as GroupPlatformRatingCacheRepository
  participant DB as Database

  Trigger->>Service: recalculate(groupId, mediaItemId)
  Service->>UserRatingRepo: getForGroupMembers(groupId, mediaItemId)
  UserRatingRepo->>DB: SELECT userRating WHERE userId IN (group members)
  DB-->>UserRatingRepo: UserRating[]
  UserRatingRepo-->>Service: ratings[]
  Service->>Service: compute aggregate (mean / median / min)
  Service->>CacheRepo: upsert({ groupId, mediaItemId, cachedValue })
  CacheRepo->>DB: INSERT ... ON CONFLICT MERGE
  DB-->>CacheRepo: ok
  CacheRepo-->>Service: void
```

---

## §3 Entity-Relationship Diagram

Use for: new DB table design, schema reviews, onboarding onto an existing domain.

### Template — New User-Owned Domain

```mermaid
erDiagram
  user {
    int id PK
    string username
    string passwordHash
  }

  mediaItem {
    int id PK
    string title
    string mediaType
    string externalId
  }

  example {
    int id PK
    int userId FK
    int mediaItemId FK
    string value
    string createdAt
    string updatedAt
  }

  user ||--o{ example : "owns"
  mediaItem ||--o{ example : "referenced by"
```

### Template — Group-Shared Domain

```mermaid
erDiagram
  userGroup {
    int id PK
    string name
    int ownerId FK
  }

  userGroupMember {
    int userId FK
    int groupId FK
    string joinedAt
  }

  groupPlatformRatingCache {
    int id PK
    int groupId FK
    int mediaItemId FK
    float cachedValue
    string recalculatedAt
  }

  user ||--o{ userGroupMember : "belongs to"
  userGroup ||--o{ userGroupMember : "has"
  userGroup ||--o{ groupPlatformRatingCache : "owns"
  mediaItem ||--o{ groupPlatformRatingCache : "referenced by"
```

---

## §4 Flowchart — Decision / Middleware Logic

Use for: explaining auth flow, middleware chain, complex conditional logic in controllers or services.

### Template — Auth Middleware Flow

```mermaid
flowchart TD
  A[Incoming request] --> B{Has session cookie?}
  B -- Yes --> C[Passport deserialise user]
  C --> D{User found in DB?}
  D -- Yes --> E[Set req.user → next]
  D -- No --> F[Clear cookie → 401]
  B -- No --> G{Has Authorization header?}
  G -- Yes --> H[Validate Bearer token]
  H --> I{Token valid + not expired?}
  I -- Yes --> J[Set req.user → next]
  I -- No --> K[Return 401]
  G -- No --> L{Route requires auth?}
  L -- Yes --> M[Return 401]
  L -- No --> N[next — public route]
```

### Template — Notification Dispatch Flow

```mermaid
flowchart TD
  A[Worker tick] --> B[notificationRepository.getDue]
  B --> C{Any due notifications?}
  C -- No --> Z[Sleep until next tick]
  C -- Yes --> D[For each notification]
  D --> E{Platform enabled for user?}
  E -- No --> F[Mark skipped]
  E -- Yes --> G[createNotificationPlatform]
  G --> H[platform.send]
  H --> I{Send succeeded?}
  I -- Yes --> J[Mark sent]
  I -- No --> K{Retries exhausted?}
  K -- No --> L[Increment retry count]
  K -- Yes --> M[Mark failed + log error]
```

---

## §5 Module Dependency Graph

Use for: coupling analysis, planning a refactor that moves or splits a module.

```mermaid
graph TD
  subgraph controllers
    C1[items.ts]
    C2[rating.ts]
    C3[group.ts]
  end

  subgraph repositories
    R1[mediaItem.ts]
    R2[userRating.ts]
    R3[userGroup.ts]
    R4[groupPlatformRatingCache.ts]
  end

  subgraph queries
    Q1[userMediaSummary.ts]
  end

  subgraph metadata
    M1[tmdb.ts]
    M2[igdb.ts]
  end

  C1 --> R1
  C1 --> M1
  C1 --> M2
  C2 --> R2
  C2 --> R4
  C3 --> R3
  C3 --> R4
  R4 --> Q1

  style controllers fill:#dbeafe
  style repositories fill:#dcfce7
  style queries fill:#fef9c3
  style metadata fill:#fce7f3
```

---

## Diagram Output Format

When producing a diagram in a response, always:

1. State the diagram type and purpose in one sentence before the code block.
2. Use a `mermaid` fenced code block.
3. Add a **Legend** section below if the diagram uses non-obvious shapes or colours.
4. For sequence diagrams, use `autonumber` so steps can be referenced in prose.

```markdown
**Sequence diagram** — illustrates the data flow for creating a new user rating.

```mermaid
sequenceDiagram
  ...
```

**Legend**: Shaded boxes = external services (outside the Express process boundary).
```
