# ADR Examples

These concrete examples show well-written ADRs at different levels of complexity.

---

## Example 1 — Database Choice (MADR)

```markdown
# 0001. Use PostgreSQL as the primary database

Date: 2024-01-15
Status: Accepted
Deciders: Lucas, Sarah (backend lead), Tom (infra)
Consulted: Full engineering team
Informed: Product team

---

## Context and Problem Statement

MediaTracker+ needs a primary relational database. The application stores structured
user data, media library entries, ratings, tags, and progress tracking. We need to
choose between PostgreSQL, MySQL/MariaDB, and SQLite for the initial release.

## Decision Drivers

* Must support complex queries with joins across multiple entities
* Must support JSONB for flexible metadata storage (movie/book/game metadata varies widely)
* Must run self-hosted without a managed service cost for community users
* Team has strong PostgreSQL expertise; no prior MySQL production experience
* Must support full-text search without an external search service in v1

## Considered Options

* Option A — PostgreSQL
* Option B — MySQL 8 / MariaDB
* Option C — SQLite (with Litestream for replication)

## Decision Outcome

Chosen option: **PostgreSQL**, because it best satisfies the JSONB metadata requirement,
has native full-text search (eliminating an external dependency in v1), and aligns with
team expertise.

### Positive Consequences

* JSONB support eliminates a separate schema migration every time a new metadata field is
  added for a media type
* Full-text search available without Elasticsearch/Typesense in v1
* Strong TypeORM and Prisma support
* Active community; excellent observability tooling (pg_stat_statements, pgBadger)

### Negative Consequences

* MySQL is more widely understood in the self-hosting community; some users may prefer it
* PostgreSQL's default autovacuum configuration requires tuning under high write load

### Re-evaluation Trigger

Revisit if the self-hosting user base consistently requests MySQL support, or if
horizontal write scaling becomes a requirement (consider CockroachDB at that point).

---

## Pros and Cons of the Options

### Option A — PostgreSQL

* Good, because native JSONB with GIN indexes satisfies the metadata storage requirement
* Good, because tsvector/tsquery provides full-text search without external dependencies
* Good, because team has production PostgreSQL experience
* Bad, because slightly steeper self-host learning curve than MySQL for new contributors

### Option B — MySQL 8 / MariaDB

* Good, because widely understood in the self-hosting community
* Bad, because JSON support is less mature than PostgreSQL's JSONB (no GIN-equivalent index)
* Bad, because full-text search is weaker; would require external search earlier
* Neutral, because team would need to ramp up on MySQL operational practices

### Option C — SQLite with Litestream

* Good, because zero-infrastructure setup for simple self-hosting
* Good, because Litestream provides streaming replication to S3
* Bad, because write concurrency model is not suitable for a multi-user application
* Bad, because complex queries with many joins are slower at scale
* Bad, because limited JSONB support
```

---

## Example 2 — API Design Pattern (Y-Statement)

```markdown
# 0004. Use RFC 9457 Problem Details for API error responses

Date: 2024-03-01
Status: Accepted
Deciders: Lucas, Sarah

---

## Decision

In the context of **designing a consistent error response format for the REST API**,
facing **multiple clients (web app, mobile, third-party integrations) that need
predictable error parsing**,
we decided **to adopt RFC 9457 (Problem Details for HTTP APIs) as the standard error
envelope**,
to achieve **a machine-readable, standard-compliant, and extensible error format that
clients can parse without custom logic**,
accepting **the minor overhead of including `type` URIs that must be documented and
maintained**.

## Notes

All error responses will include:
- `type`: URI identifying the error class (must be documented in our API reference)
- `title`: Human-readable summary (stable, not per-instance)
- `status`: HTTP status code (mirrors the response status)
- `detail`: Human-readable explanation of this specific occurrence
- `instance`: URI of the specific request that caused the error (optional)

Custom extension fields (e.g., `errors` array for validation failures) are permitted
per the RFC.
```

---

## Example 3 — Superseding an Existing ADR

```markdown
# 0009. Replace custom session store with JWT-based stateless authentication

Date: 2024-09-10
Status: Accepted
Deciders: Lucas, Tom, Sarah
Supersedes: [ADR-0003](0003-use-redis-session-store.md)

---

## Context and Problem Statement

ADR-0003 established a Redis-backed session store for authentication. Since that
decision, we have added a mobile client and a public API. Stateful sessions require
all API clients to carry session cookies, which is awkward for mobile and impossible
for third-party API consumers. We need to evaluate moving to stateless JWT-based auth.

## Decision Drivers

* Mobile client cannot use cookies reliably across domains
* Third-party API integrations require token-based auth (OAuth 2.0 / Bearer tokens)
* Desire to reduce operational dependency on Redis for auth (Redis is still used for
  rate limiting and caching, but session storage adds criticality)
* Must maintain existing web session behaviour for existing users without forced re-login

## Considered Options

* Option A — JWT access + refresh tokens (stateless access, stateful refresh)
* Option B — Opaque bearer tokens stored in Redis (essentially the current model, renamed)
* Option C — OAuth 2.0 Authorization Server (e.g., Keycloak)

## Decision Outcome

Chosen option: **Option A — JWT access + refresh tokens**, because it enables stateless
clients (mobile, API) while the refresh token list in Redis provides session revocation
capability without requiring Redis on every API call.

### Positive Consequences

* Mobile and third-party clients can authenticate without cookies
* API server is no longer on the Redis critical path for every request
* Standard Bearer token format compatible with future OAuth 2.0 migration

### Negative Consequences

* JWT access tokens cannot be individually revoked before expiry (mitigated by short
  15-minute expiry window)
* Additional complexity: refresh token rotation logic must be implemented carefully to
  avoid race conditions
* Existing sessions must be migrated; a one-time forced re-login is required

### Re-evaluation Trigger

Revisit if we need fine-grained per-token revocation (e.g., "log out all devices"),
at which point Option C (OAuth 2.0 AS) becomes the right path.

---

## Links

* Supersedes [ADR-0003](0003-use-redis-session-store.md)
* Related: [ADR-0004](0004-rfc9457-error-responses.md) (error format for auth failures)
```
