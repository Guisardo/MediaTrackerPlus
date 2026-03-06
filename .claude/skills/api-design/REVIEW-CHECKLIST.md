# API Review Checklist

Run this checklist before publishing any API contract (new API, new version, or significant change).

---

## 1. Design Consistency

- [ ] Resource names are nouns, plural, kebab-case (REST) or PascalCase types (GraphQL)
- [ ] No verbs in REST URL paths (actions modelled as sub-resources or POST)
- [ ] HTTP methods used correctly (GET is safe and idempotent, DELETE is idempotent, etc.)
- [ ] Nesting depth ≤ 2 levels for REST paths
- [ ] Consistent field naming convention (camelCase) across all endpoints/types
- [ ] Dates are ISO 8601 strings; IDs are UUIDs (not sequential integers exposed externally)

---

## 2. HTTP Semantics (REST Only)

- [ ] Correct status codes used for each operation (201 for creation, 204 for empty success, 422 for validation errors)
- [ ] `Location` header included on 201 responses
- [ ] `Retry-After` header included on 429 and 503 responses
- [ ] GET endpoints are safe and idempotent (no side effects, same result for same input)
- [ ] PUT is used only for full-resource replacement (not partial updates)

---

## 3. Error Contract

- [ ] All error responses follow the standard error envelope (RFC 9457 for REST; Payload errors or union types for GraphQL)
- [ ] Validation errors identify which field(s) caused the problem
- [ ] Error `type` URIs (REST) are documented in the API reference
- [ ] No stack traces, internal paths, or database messages in error responses
- [ ] 4xx responses are clearly distinguished from 5xx (client error vs. server fault)

---

## 4. Authentication & Authorisation

- [ ] Authentication mechanism is documented (Bearer JWT, API key, session cookie)
- [ ] Every endpoint that operates on user data enforces ownership checks (user can only access their own data)
- [ ] Admin-only endpoints are protected and documented as such
- [ ] Authentication errors return 401; authorisation errors return 403 (not 404 as a security measure)
- [ ] Token/session lifetime and refresh strategy are documented

---

## 5. Pagination

- [ ] All collection endpoints are paginated (no unbounded list returns)
- [ ] Default and maximum page sizes are documented
- [ ] Pagination metadata is included in collection responses (next cursor or hasNextPage)

---

## 6. Input Validation

- [ ] Required vs. optional fields are explicitly documented
- [ ] Field value constraints are documented (min/max length, allowed values, formats)
- [ ] Unknown/extra fields in request bodies are ignored (not 400) or documented as errors

---

## 7. Evolvability

- [ ] Versioning strategy is applied and documented
- [ ] Non-breaking changes (new optional fields, new endpoints) are identified and distinguished from breaking changes
- [ ] Deprecated fields/endpoints are marked with deprecation notice and removal timeline
- [ ] No fields have been removed from an existing version without a version bump

---

## 8. Performance

- [ ] Collection endpoints support filtering to avoid full table scans
- [ ] No endpoint can return unbounded data (pagination enforced server-side)
- [ ] Expensive operations (exports, bulk actions) return 202 Accepted with a job ID rather than blocking
- [ ] GraphQL schema has query complexity/depth limits defined

---

## 9. Documentation

- [ ] Every endpoint/operation has a summary and a description
- [ ] Every parameter, field, and enum value is described
- [ ] At least one request/response example is provided per operation
- [ ] Rate limits are documented
- [ ] Authentication is documented with a working example

---

## 10. Security

- [ ] No sensitive data (passwords, secrets, internal IDs) in URL path or query parameters
- [ ] CORS policy is appropriate (not `*` for authenticated APIs)
- [ ] File upload endpoints validate content type, enforce size limits, and sanitise filenames
- [ ] No operation allows a user to trigger a server-side request to an arbitrary URL (SSRF)
- [ ] Batch/bulk endpoints have rate limits and item count caps

---

## Sign-Off

| Section | Pass | Issues |
|---------|------|--------|
| Design Consistency | | |
| HTTP Semantics | | |
| Error Contract | | |
| Auth & Authz | | |
| Pagination | | |
| Input Validation | | |
| Evolvability | | |
| Performance | | |
| Documentation | | |
| Security | | |

**Verdict**: APPROVED / APPROVED WITH CONDITIONS / BLOCKED
