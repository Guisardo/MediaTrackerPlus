# Architecture Decision Record Template

## Storage Convention

- Location: `docs/adr/`
- Filename: `NNNN-short-kebab-title.md` (sequential number, zero-padded to 4 digits)
- Status values: `Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-NNNN`
- Once `Accepted`, an ADR is **never edited** — create a new ADR to supersede it

---

## Template

```markdown
# ADR-NNNN: <Title>

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
**Deciders**: <names or roles — e.g. "backend developer, architect">
**Supersedes**: ADR-NNNN (if applicable)
**Superseded by**: ADR-NNNN (filled in when deprecated)

## Context

<1–4 sentences describing the situation that forces this decision. Include the forces at play: technical constraints, team constraints, timeline, existing architecture.>

## Decision Drivers

- <driver 1 — e.g. "must remain compatible with SQLite and PostgreSQL">
- <driver 2>
- <driver 3>

## Considered Options

1. **<Option A>** — <one-line description>
2. **<Option B>** — <one-line description>
3. **<Option C>** — <one-line description>

## Decision

Chosen option: **<Option X>**, because <concise justification referencing the decision drivers above>.

## Consequences

### Positive
- <positive outcome 1>
- <positive outcome 2>

### Negative
- <negative outcome / tradeoff 1>
- <negative outcome / tradeoff 2>

### Neutral
- <neutral consequence — things that change but are neither good nor bad>

## Compliance

<How do we verify this decision is being followed? e.g. "ESLint rule forbids direct Knex imports in controllers", "CI job runs architecture lint", "Code review checklist item">

## Notes

<Any additional context, links to relevant code, external resources, or follow-up tasks.>
```

---

## Filled Example

```markdown
# ADR-0003: Use Repository Pattern for All Database Access

**Date**: 2024-01-15
**Status**: Accepted
**Deciders**: backend developer, architect

## Context

Controllers were directly importing Knex and writing inline SQL. This made testing difficult (tests needed a real database), violated the single-responsibility principle, and made it impossible to swap the database driver without touching controller files.

## Decision Drivers

- Must support both SQLite (development/self-hosted) and PostgreSQL (production)
- Controllers should be testable without a database
- SQL should be easy to find, audit, and optimise

## Considered Options

1. **Repository pattern** — dedicated class per entity, all SQL inside it, exported as singleton
2. **Active Record pattern** — entity classes with built-in query methods
3. **Inline Knex in controllers** — no abstraction, direct queries in request handlers

## Decision

Chosen option: **Repository pattern**, because it isolates SQL from HTTP logic, enables easy mocking in tests, and is already familiar to the team via common Node.js conventions.

## Consequences

### Positive
- Controllers have zero SQL — testable with mocked repositories
- All queries for an entity are in one file — easy to audit and optimise
- Knex can be replaced by changing repository files only

### Negative
- More files to maintain (one per entity)
- Simple lookups require a round-trip through the repository even when the query is trivial

### Neutral
- Repository files become the canonical source for understanding the data model

## Compliance

Code review checklist: "No Knex import in any controller file." Future: add an import-boundary ESLint rule.
```

---

## ADR Index Template

When creating a new ADR, add it to `docs/adr/README.md`:

```markdown
# Architecture Decision Records

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](0001-use-knex-as-query-builder.md) | Use Knex as Query Builder | Accepted | 2023-06-01 |
| [0002](0002-sqlite-as-default-database.md) | SQLite as Default Database | Accepted | 2023-06-01 |
| [NNNN](NNNN-title.md) | <Title> | <Status> | <Date> |
```
