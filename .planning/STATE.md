# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** When a user rates something they loved, the next thing they should watch is already waiting for them — ranked, deduped, and ready.
**Current focus:** Phase 1 — Fork Plumbing

## Current Position

Phase: 1 of 4 (Schema Migration)
Plan: 0 of 1 in current phase
Status: Ready to plan
Last activity: 2026-03-06 — Architecture pivot from sidecar to direct fork integration; planning docs updated

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pivot 2026-03-06]: Direct fork integration, not sidecar — no plugin mechanism exists in MediaTracker; direct integration eliminates search-and-import dance and two-service complexity
- [Pivot 2026-03-06]: setImmediate in RatingController instead of outgoing webhooks — same fire-and-forget semantics, no network hop or HMAC infrastructure
- [Init]: estimatedRating stored as dedicated nullable float column on listItem (not JSON blob) — required for in-memory sort and avoids Pitfall 8
- [Init]: TypeScript in-memory sort for "recommended" sort option — SQLite/PostgreSQL dialect compatibility
- [Init]: Reuse existing MetadataProvider implementations — TMDB, IGDB, OpenLibrary clients already written and tested

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: OpenLibrary `openlibraryId` format in DB not confirmed. Must verify whether MediaTrackerPlus stores `/works/OL82563W` or strips the `/works/` prefix before implementing subject-based lookup. Check existing `openlibraryId` values or `openlibraryRepository.ts`.
- [Phase 2]: Confirm how to trigger a mediaItem import via the existing provider layer when a TMDB/IGDB similar item is not yet in the DB. Check `mediaItemRepository.ts` and relevant provider fetch methods.

## Session Continuity

Last session: 2026-03-06
Stopped at: Roadmap creation complete; no plans written yet
Resume file: None
