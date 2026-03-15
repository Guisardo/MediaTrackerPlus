---
name: software-architect
description: System design and architecture for MediaTrackerPlus. Use when designing a new feature end-to-end, creating an ADR, generating system or sequence diagrams, reviewing module boundaries, evaluating a technology choice, planning a cross-cutting concern, or auditing layering violations. Triggers: ADR, architecture review, system design, sequence diagram, tech evaluation, cross-cutting concern, module coupling, schema design for a new domain.
context: fork
agent: software-architect
---

# Software Architect

Designs, documents, and reviews the architecture of MediaTrackerPlus across the full stack: `client/` (React), `server/` (Express + Knex), and the database (SQLite/PostgreSQL).

## Quick Reference

| Task | Reference |
|---|---|
| ADR format and storage conventions | [ADR-TEMPLATE.md](ADR-TEMPLATE.md) |
| Common schema and code patterns | [PATTERNS.md](PATTERNS.md) |
| Mermaid diagram templates | [DIAGRAMS.md](DIAGRAMS.md) |
| Layer rules and invariants | Agent system prompt |
| Stack + technology inventory | Agent system prompt |

## Decision Tree

```
User asks for architectural work
          │
          ├─ New feature design              → Read affected files → Data model → API contract
          │                                    → Sequence diagram → Implementation notes
          │
          ├─ ADR required                    → Read ADR-TEMPLATE.md → Write to docs/adr/
          │
          ├─ Architecture review             → Check 7 invariants → Tag VIOLATION/RISK/OBSERVATION
          │
          ├─ Database schema design          → Read PATTERNS.md → Entity type → Migration outline
          │                                    → Repository interface
          │
          ├─ Diagram request                 → Read DIAGRAMS.md → Choose diagram type → Mermaid output
          │
          ├─ Technology evaluation           → Define criteria → Decision matrix → ADR
          │
          ├─ Cross-cutting concern           → Identify all layers affected → Define abstraction
          │                                    → Specify interface → Migration strategy
          │
          ├─ Layering / coupling violation   → Identify source → Map to rule → Recommend fix
          │
          └─ N+1 / performance concern       → Trace query path → Identify missing eager load
                                               → Propose index or batch strategy
```

## Architecture Map

```
client/src/
  pages/ → components/ → hooks/ → api/ (generated — do not edit)

server/src/
  middlewares/ (auth, logging, errors)
      │
  controllers/ (HTTP in/out, AJV validation, 22 files)
      │
  repository/ (all SQL via Knex, 18 files)
  knex/queries/ (complex multi-join queries)
      │
  entity/ (TypeScript types for DB rows)
  migrations/ (45+ timestamped files — immutable)
  metadata/provider/ (TMDB, IGDB, OpenLibrary, Audible)
  notifications/ (scheduling + dispatch)
  generated/routes/ (auto-generated — run npm run build:routes)
```

## Seven Architectural Invariants

1. **Strict layering** — controllers → repositories → database. No skipping or reversing.
2. **Schema via migrations only** — every DB change is a timestamped Knex migration file.
3. **Repository-per-entity** — one repository file per table; cross-table queries in `knex/queries/`.
4. **API-first client boundary** — the OpenAPI spec is the contract; client uses only the generated API client.
5. **No raw SQL strings** — Knex query builder only.
6. **Auth at middleware boundary** — `req.user` is guaranteed by middleware; controllers do not re-implement auth.
7. **Metadata providers are isolated** — external HTTP calls behind the `MetadataProvider` interface only.

## ADR Storage Convention

```
docs/adr/
  0001-use-knex-as-query-builder.md
  0002-sqlite-as-default-database.md
  NNNN-<short-kebab-title>.md      ← next sequential number
```

Read [ADR-TEMPLATE.md](ADR-TEMPLATE.md) before writing any ADR.

## Common Pattern Quick-Picks

| Need | Pattern | See |
|---|---|---|
| New DB table | User-owned data pattern | PATTERNS.md §1 |
| Shared across user group | Group-shared data pattern | PATTERNS.md §2 |
| Many-to-many relationship | Junction table pattern | PATTERNS.md §3 |
| Soft delete | Soft delete pattern | PATTERNS.md §4 |
| External API integration | MetadataProvider pattern | PATTERNS.md §5 |
| Cross-layer concern | Middleware injection pattern | PATTERNS.md §6 |

## Diagram Type Guide

| Scenario | Diagram type | See |
|---|---|---|
| Feature placement in stack | C4 Container diagram | DIAGRAMS.md §1 |
| Multi-layer data flow | Sequence diagram | DIAGRAMS.md §2 |
| New DB schema | ER diagram | DIAGRAMS.md §3 |
| Decision / branching logic | Flowchart | DIAGRAMS.md §4 |
| Module dependencies | Graph diagram | DIAGRAMS.md §5 |
