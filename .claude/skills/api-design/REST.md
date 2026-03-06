# REST API Design Conventions

Standards for designing consistent, evolvable REST APIs that follow RFC and industry best practices.

---

## URL Design

### Resource Naming

| Rule | Good | Bad |
|------|------|-----|
| Use nouns, not verbs | `/media-items` | `/getMediaItems` |
| Use plural for collections | `/users` | `/user` |
| Use kebab-case | `/media-items` | `/mediaItems`, `/media_items` |
| Represent hierarchy with nesting (max 2 levels) | `/users/{id}/entries` | `/users/{id}/entries/{eid}/tags/{tid}` |
| Keep nesting shallow | `/entries/{id}/tags` | `/users/{uid}/entries/{eid}/tags` |

### Path Parameters vs. Query Parameters

**Path parameters** (`/users/{id}`): For resource identity — uniquely identifies a resource.

**Query parameters** (`/media-items?status=completed&sort=rating`): For filtering, sorting, pagination, field selection.

```
GET /media-items                         → list all
GET /media-items?status=in_progress      → filter
GET /media-items?sort=-rating&limit=20   → sort (- = descending) + paginate
GET /media-items/{id}                    → single resource
POST /media-items                        → create
PATCH /media-items/{id}                  → partial update
PUT /media-items/{id}                    → full replace
DELETE /media-items/{id}                 → delete
```

---

## HTTP Methods

| Method | Semantics | Idempotent | Safe |
|--------|-----------|-----------|------|
| `GET` | Read resource | Yes | Yes |
| `HEAD` | Read headers only | Yes | Yes |
| `POST` | Create resource or trigger action | No | No |
| `PUT` | Full replace of resource | Yes | No |
| `PATCH` | Partial update | No | No |
| `DELETE` | Remove resource | Yes | No |

**PATCH vs PUT**: Prefer `PATCH` for partial updates. Use `PUT` only when the client always sends the full representation.

**Non-CRUD actions**: Use a sub-resource noun, not a verb:
```
POST /entries/{id}/tags          → add tag
DELETE /entries/{id}/tags/{tid}  → remove tag
POST /exports                    → trigger export (returns 202 Accepted + job ID)
```

---

## HTTP Status Codes

### Success

| Code | Meaning | Use when |
|------|---------|---------|
| `200 OK` | Success with body | GET, PATCH, PUT responses |
| `201 Created` | Resource created | POST that creates a resource; include `Location` header |
| `202 Accepted` | Async job accepted | Long-running operations |
| `204 No Content` | Success, no body | DELETE, PATCH with no response body |

### Client Errors

| Code | Meaning | Use when |
|------|---------|---------|
| `400 Bad Request` | Malformed request | Syntax errors, type mismatches |
| `401 Unauthorized` | Not authenticated | Missing or invalid credentials |
| `403 Forbidden` | Not authorised | Authenticated but lacks permission |
| `404 Not Found` | Resource not found | ID does not exist |
| `409 Conflict` | State conflict | Duplicate creation, stale update |
| `410 Gone` | Permanently removed | Deleted resource (use over 404 when meaningful) |
| `422 Unprocessable Entity` | Validation failed | Valid syntax, invalid semantics/business rules |
| `429 Too Many Requests` | Rate limited | Include `Retry-After` header |

### Server Errors

| Code | Use when |
|------|---------|
| `500 Internal Server Error` | Unexpected failure |
| `502 Bad Gateway` | Upstream service error |
| `503 Service Unavailable` | Maintenance or overload; include `Retry-After` |

---

## Request & Response Design

### Request Body

- Always use `Content-Type: application/json`
- Property names: `camelCase`
- Dates: ISO 8601 (`2024-01-15T10:30:00Z`)
- Never require a client to send a field they cannot know (e.g., server-generated IDs)

### Response Envelope

**Single resource** — return the object directly:
```json
{
  "id": "uuid",
  "title": "Dune",
  "status": "completed",
  "rating": 9,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Collection** — wrap with pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6IjEyMyJ9",
    "hasNextPage": true,
    "totalCount": 247
  }
}
```

### Field Selection (Optional)

Support `?fields=id,title,status` to allow clients to request only needed fields.
Reduces over-fetching without requiring GraphQL.

---

## Pagination

### Cursor-Based (Preferred for Large or Frequently-Updated Collections)

```
GET /media-items?limit=20&cursor=eyJpZCI6IjEyMyJ9
```

- Cursor is an opaque base64-encoded pointer (e.g., encodes `{id: "123"}`)
- Stable across inserts/deletes; no page drift
- Cannot jump to arbitrary pages

### Offset-Based (Acceptable for Small, Static Collections)

```
GET /media-items?limit=20&offset=40
```

- Simpler to implement
- Page drift when items are inserted/deleted mid-pagination

### Default and Maximum Page Sizes

- Default page size: 20
- Maximum page size: 100 (enforce server-side; ignore larger values)
- Document limits in the API spec

---

## Sorting and Filtering

```
GET /media-items?sort=-rating,title   (sort by rating desc, then title asc)
GET /media-items?status=completed&mediaType=movie
GET /media-items?createdAfter=2024-01-01T00:00:00Z
```

Use a consistent sort syntax: prefix `-` for descending, no prefix for ascending.

---

## Versioning Strategy

Choose one strategy and apply it consistently:

| Strategy | Example | Notes |
|----------|---------|-------|
| **URL path** (recommended for public APIs) | `/v1/media-items` | Explicit, cacheable, easy to route |
| **Header** | `Accept: application/vnd.api+json;version=2` | Cleaner URLs, harder to test in browser |
| **Query param** | `/media-items?version=2` | Avoid; pollutes query string |

**Non-breaking changes** (safe to make without version bump):
- Adding new optional fields to responses
- Adding new optional request parameters
- Adding new endpoints
- Adding new enum values (with caution — clients must handle unknown values)

**Breaking changes** (require a new version):
- Removing or renaming fields
- Changing field types
- Changing HTTP method or status code semantics
- Changing authentication method
- Removing endpoints

---

## OpenAPI 3.1 Spec Skeleton

```yaml
openapi: 3.1.0
info:
  title: MediaTracker+ API
  version: 1.0.0
  description: |
    REST API for tracking movies, TV shows, books, and games.
  contact:
    email: api@mediatracker.example.com
  license:
    name: MIT

servers:
  - url: https://api.mediatracker.example.com/v1
    description: Production
  - url: http://localhost:3000/v1
    description: Local development

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri

    MediaItem:
      type: object
      required: [id, title, mediaType]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        mediaType:
          type: string
          enum: [movie, tv, book, game]
        posterUrl:
          type: string
          format: uri
          nullable: true
        releaseDate:
          type: string
          format: date
          nullable: true

paths:
  /media-items:
    get:
      summary: List media items in the user's library
      operationId: listMediaItems
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [planned, in_progress, completed, dropped]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Paginated list of media items
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/MediaItem'
                  pagination:
                    type: object
                    properties:
                      cursor:
                        type: string
                        nullable: true
                      hasNextPage:
                        type: boolean
        '401':
          description: Not authenticated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```
