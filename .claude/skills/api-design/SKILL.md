---
name: api-design
description: Design, document, and review HTTP APIs (REST and GraphQL). Use when the user asks to design an API, define endpoints or schemas, write an OpenAPI spec, review an existing API for correctness or consistency, evaluate REST vs. GraphQL trade-offs, or plan API versioning and evolution strategy.
context: fork
agent: software-architect
---

# API Design — REST & GraphQL Contract-First Design

This skill guides Claude through designing APIs that are intuitive, consistent, evolvable, and safe. It supports REST/OpenAPI and GraphQL workflows.

## Quick Reference

| Goal | Reference |
|------|-----------|
| Design or review a REST API | [REST.md](REST.md) |
| Design or review a GraphQL schema | [GRAPHQL.md](GRAPHQL.md) |
| Gate an API before publishing | [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) |

## REST vs. GraphQL Decision

Answer these questions first:

| Question | Favours REST | Favours GraphQL |
|----------|-------------|-----------------|
| Clients are diverse (web, mobile, 3rd-party)? | No | Yes |
| Query patterns are unpredictable/complex? | No | Yes |
| Caching is critical (CDN, browser)? | Yes | No |
| API is public / developer-facing? | Yes | Either |
| Strong typing and introspection needed? | No | Yes |
| Team is already REST-fluent? | Yes | No |

When unsure, default to REST for public APIs and GraphQL for internal product APIs with multiple heterogeneous clients.

## API Design Workflow

### Step 1 — Define the Resource Model (REST) or Schema (GraphQL)

**REST**: Identify every entity the API exposes. For each:
- Canonical resource name (noun, plural: `/users`, `/media-items`)
- Key attributes and their types
- Relationships to other resources (links vs. embedded vs. separate endpoint)

**GraphQL**: Define the type system:
- Root types: `Query`, `Mutation`, `Subscription`
- Object types, scalar types, enums, input types
- Relationships via nested types vs. IDs

### Step 2 — Define Operations

Map every user action or system use case to one or more API operations.

**REST**: For each operation, specify:
- `METHOD /path` — follow conventions in [REST.md](REST.md)
- Request body schema (if applicable)
- Path and query parameters
- Response body schema for success
- Error response schemas (see error contract below)

**GraphQL**: For each operation:
- Query vs. Mutation vs. Subscription
- Arguments with types
- Return type (nullable vs. non-null reasoning)

### Step 3 — Define the Error Contract

Clients need predictable errors. Define a standard error envelope:

**REST (Problem Details — RFC 9457)**:
```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The 'email' field is not a valid email address.",
  "instance": "/api/users/register",
  "errors": [
    { "field": "email", "message": "Invalid format" }
  ]
}
```

**GraphQL**:
```graphql
type Error {
  code: ErrorCode!
  message: String!
  field: String
}

union UserResult = User | Error
```

Prefer union return types over relying solely on the `errors` array for predictable error handling.

### Step 4 — Design for Evolution

Every API will change. Bake in evolvability from day one:

- **REST**: plan versioning strategy upfront — URL versioning (`/v1/`) or header-based (`Accept: application/vnd.api+json;version=2`)
- **GraphQL**: use `@deprecated` directive and additive-only schema evolution; never remove fields, only deprecate
- Document the **compatibility promise**: what changes are breaking vs. non-breaking
- Add a `Deprecation` and `Sunset` header strategy for REST

### Step 5 — Document

Every public API must have:
- **OpenAPI 3.1 spec** (REST) or **SDL schema** (GraphQL)
- One working **example request/response** per operation
- **Authentication method** clearly documented
- **Rate limits** and **pagination** strategy documented

See [REST.md](REST.md) for OpenAPI spec skeleton and [GRAPHQL.md](GRAPHQL.md) for SDL conventions.

### Step 6 — Review

Run [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) before publishing or merging any API contract.

## Output Format

When designing an API, produce:

```markdown
## API Contract: <Name>

### Overview
One paragraph: what this API does and who consumes it.

### Authentication
Method, token type, header name.

### Base URL
`https://api.example.com/v1`

### Resources / Types
[Entity list with key attributes]

### Endpoints / Operations
For each:
- `METHOD /path` — one-line description
- Request: schema or params
- Response 2xx: schema
- Errors: status codes and meanings

### Error Contract
[Standard error envelope]

### Pagination
[Strategy: cursor / offset / keyset]

### Versioning & Evolution Policy
[How breaking changes are managed]

### Rate Limits
[If applicable]
```
