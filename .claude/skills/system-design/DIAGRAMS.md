# Architecture Diagrams — Mermaid Patterns

All diagrams in this skill use Mermaid syntax. Claude renders them in `mermaid` code fences.

---

## 1. System Context Diagram (C4 Level 1)

Shows the system and its relationships to users and external systems. No internal details.

```mermaid
C4Context
    title System Context: Media Tracker

    Person(user, "End User", "Tracks media consumption")
    Person(admin, "Admin", "Manages the platform")

    System(mediaTracker, "MediaTracker+", "Tracks movies, books, games, and TV shows")

    System_Ext(tmdb, "TMDB API", "Movie and TV metadata")
    System_Ext(igdb, "IGDB API", "Game metadata")
    System_Ext(email, "Email Service", "Notifications")

    Rel(user, mediaTracker, "Uses", "HTTPS")
    Rel(admin, mediaTracker, "Administers", "HTTPS")
    Rel(mediaTracker, tmdb, "Fetches metadata", "HTTPS/REST")
    Rel(mediaTracker, igdb, "Fetches metadata", "HTTPS/REST")
    Rel(mediaTracker, email, "Sends notifications", "SMTP")
```

**Use when**: introducing the system to stakeholders, scoping a design review.

---

## 2. Container Diagram (C4 Level 2)

Zooms into the system boundary to show containers (apps, services, databases).

```mermaid
C4Container
    title Container Diagram: MediaTracker+

    Person(user, "User")

    Container_Boundary(sys, "MediaTracker+") {
        Container(spa, "Web App", "React/TypeScript", "Single-page application")
        Container(api, "API Server", "Node.js/Express", "REST API and business logic")
        Container(worker, "Background Worker", "Node.js", "Scheduled jobs, metadata sync")
        ContainerDb(db, "Primary Database", "PostgreSQL", "All application data")
        ContainerDb(cache, "Cache", "Redis", "Session store, rate limiting")
        Container(queue, "Job Queue", "Bull/Redis", "Async task processing")
    }

    System_Ext(tmdb, "TMDB API")

    Rel(user, spa, "Uses", "HTTPS")
    Rel(spa, api, "Calls", "HTTPS/JSON")
    Rel(api, db, "Reads/Writes", "TCP/SQL")
    Rel(api, cache, "Reads/Writes", "TCP")
    Rel(api, queue, "Enqueues jobs", "TCP")
    Rel(worker, queue, "Dequeues jobs", "TCP")
    Rel(worker, tmdb, "Fetches", "HTTPS")
    Rel(worker, db, "Updates", "TCP/SQL")
```

**Use when**: designing or reviewing the overall deployment topology.

---

## 3. Component Diagram (C4 Level 3)

Internal structure of a single container. Shows major classes/modules.

```mermaid
C4Component
    title Component Diagram: API Server

    Container_Boundary(api, "API Server") {
        Component(router, "Router", "Express", "HTTP routing and middleware")
        Component(authMw, "Auth Middleware", "Passport.js", "JWT validation")
        Component(mediaCtrl, "Media Controller", "Module", "CRUD for media items")
        Component(recSvc, "Recommendation Service", "Module", "Scoring and ranking logic")
        Component(metaSvc, "Metadata Service", "Module", "External API orchestration")
        Component(repo, "Repository Layer", "TypeORM", "Database abstraction")
    }

    ContainerDb(db, "PostgreSQL")
    Container_Ext(queue, "Job Queue")

    Rel(router, authMw, "Applies")
    Rel(router, mediaCtrl, "Delegates")
    Rel(mediaCtrl, recSvc, "Calls")
    Rel(mediaCtrl, metaSvc, "Calls")
    Rel(mediaCtrl, repo, "Uses")
    Rel(metaSvc, queue, "Enqueues sync jobs")
    Rel(repo, db, "SQL")
```

**Use when**: reviewing a service's internal design or planning a refactor.

---

## 4. Sequence Diagram

Shows the time-ordered interactions for a specific user journey.

```mermaid
sequenceDiagram
    actor User
    participant SPA as Web App
    participant API as API Server
    participant DB as PostgreSQL
    participant TMDB as TMDB API

    User->>SPA: Search "Dune"
    SPA->>API: GET /media/search?q=Dune
    API->>DB: SELECT * FROM media_cache WHERE title ILIKE '%Dune%'
    DB-->>API: [] (cache miss)
    API->>TMDB: GET /search/movie?query=Dune
    TMDB-->>API: [{id: 438631, title: "Dune", ...}]
    API->>DB: INSERT INTO media_cache ...
    DB-->>API: OK
    API-->>SPA: 200 [{id, title, poster_url, ...}]
    SPA-->>User: Display results
```

**Use when**: designing async flows, documenting API contracts, tracing bugs.

---

## 5. Entity Relationship Diagram (ERD)

Shows the data model: entities, attributes, and relationships.

```mermaid
erDiagram
    USER {
        uuid id PK
        string email UK
        string password_hash
        timestamp created_at
        timestamp last_login_at
    }

    MEDIA_ITEM {
        uuid id PK
        string external_id UK
        enum media_type "movie|tv|book|game"
        string title
        string poster_url
        date release_date
        jsonb metadata
    }

    USER_MEDIA_ENTRY {
        uuid id PK
        uuid user_id FK
        uuid media_item_id FK
        enum status "planned|in_progress|completed|dropped"
        int rating "1-10, nullable"
        timestamp started_at
        timestamp completed_at
        text notes
    }

    TAG {
        uuid id PK
        uuid user_id FK
        string name
    }

    ENTRY_TAG {
        uuid entry_id FK
        uuid tag_id FK
    }

    USER ||--o{ USER_MEDIA_ENTRY : "tracks"
    MEDIA_ITEM ||--o{ USER_MEDIA_ENTRY : "tracked_via"
    USER_MEDIA_ENTRY ||--o{ ENTRY_TAG : "tagged_with"
    TAG ||--o{ ENTRY_TAG : "applied_to"
    USER ||--o{ TAG : "owns"
```

**Use when**: designing or reviewing the database schema.

---

## 6. Flowchart (Decision / Process Flow)

Shows a process with decisions and branching paths.

```mermaid
flowchart TD
    A([Start: User adds media item]) --> B{Already in media_items table?}
    B -- Yes --> C[Create user_media_entry with existing FK]
    B -- No --> D[Look up external ID via Metadata Service]
    D --> E{Found in external API?}
    E -- No --> F[Return 404 to user]
    E -- Yes --> G[Insert new media_item record]
    G --> H[Enqueue background sync job]
    H --> C
    C --> I[Return 201 Created to user]
    I --> Z([End])
    F --> Z
```

**Use when**: documenting complex business logic or decision trees.

---

## 7. State Diagram

Shows the lifecycle of an entity through its valid states.

```mermaid
stateDiagram-v2
    [*] --> Planned : User adds item
    Planned --> InProgress : User starts watching/reading
    Planned --> Dropped : User gives up
    InProgress --> Completed : User finishes
    InProgress --> Dropped : User gives up
    Completed --> InProgress : User re-watches/re-reads
    Dropped --> InProgress : User resumes
    Dropped --> [*] : User deletes entry
    Completed --> [*] : User deletes entry
```

**Use when**: designing finite state machines, API status fields, or workflow engines.

---

## Diagram Selection Guide

| Situation | Use |
|-----------|-----|
| Explaining the system to stakeholders | Context Diagram |
| Reviewing deployment topology | Container Diagram |
| Refactoring a service internally | Component Diagram |
| Designing an API flow | Sequence Diagram |
| Reviewing or designing the data model | ERD |
| Documenting a business process | Flowchart |
| Designing a status field or workflow | State Diagram |
