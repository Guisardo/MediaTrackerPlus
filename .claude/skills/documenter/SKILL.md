---
name: documenter
description: Normalize, organize, and reindex project documentation. Use when the user asks to fix docs, clean up documentation, reorganize markdown files, update a README, rebuild a table of contents, check documentation consistency, audit doc structure, normalize markdown formatting, or reindex documentation. Also use when documentation is described as messy, outdated, inconsistent, or incomplete.
context: fork
agent: documenter
---

# Documenter — Documentation Normalization, Organization & Reindexing

This skill transforms scattered, inconsistent project documentation into a coherent, navigable documentation system. It operates in three phases that can be run independently or as a full pipeline.

## Quick Reference

| Goal | Sub-skill | Script |
|------|-----------|--------|
| Fix formatting, headings, code fences | [NORMALIZE.md](NORMALIZE.md) | `scripts/normalize_markdown.py` |
| Restructure file layout, naming, folders | [ORGANIZE.md](ORGANIZE.md) | `scripts/scan_docs.py` |
| Rebuild TOC, cross-refs, indexes | [REINDEX.md](REINDEX.md) | `scripts/build_index.py` |
| Validate internal links | [REINDEX.md](REINDEX.md) | `scripts/check_links.py` |
| Project-specific patterns | [CONVENTIONS.md](CONVENTIONS.md) | — |

## Three-Phase Pipeline

### Phase 1 — Discover

Run `scripts/scan_docs.py` to produce a catalog of every documentation file in the repository:

```bash
python .claude/skills/documenter/scripts/scan_docs.py
```

This outputs `docs-catalog.json` at the repo root and prints a human-readable summary. Review it before proceeding.

### Phase 2 — Normalize & Organize

Read [NORMALIZE.md](NORMALIZE.md) for the complete normalization ruleset, then apply it file by file.
Read [ORGANIZE.md](ORGANIZE.md) for file placement and folder structure rules.

Run the normalizer on a single file:

```bash
python .claude/skills/documenter/scripts/normalize_markdown.py README.md
```

Or on all discovered docs:

```bash
python .claude/skills/documenter/scripts/normalize_markdown.py --all
```

### Phase 3 — Reindex

Read [REINDEX.md](REINDEX.md) for how to rebuild the master index, per-directory indexes, and cross-reference tables.

```bash
python .claude/skills/documenter/scripts/build_index.py
python .claude/skills/documenter/scripts/check_links.py
```

## Decision Tree

```
User asks about docs
       │
       ├─ "fix formatting / normalize"   → Phase 2, NORMALIZE.md
       ├─ "reorganize / restructure"     → Phase 2, ORGANIZE.md
       ├─ "update TOC / index / links"   → Phase 3, REINDEX.md
       ├─ "audit all docs"               → Full pipeline, Phases 1-3
       └─ "project conventions"          → CONVENTIONS.md
```

## Working Principles

1. **Never destroy content** — normalization changes form, not substance. If ambiguous, preserve the original and flag for review.
2. **Smallest diff wins** — apply only the changes required to meet conventions. Do not rewrite prose unless asked.
3. **Check before edit** — always run `scan_docs.py` first so you have a full picture of what exists.
4. **Commit atomically** — normalize in one commit, reorganize in a second, reindex in a third.
5. **Log every change** — append a `## Changelog` entry to each modified file's bottom, or maintain `docs/CHANGELOG.md`.

## Project Context

This is the **MediaTrackerPlus** project — a self-hosted media tracker (TypeScript monorepo: `server/` + `client/`).

Key documentation files:
- `README.md` — primary user-facing doc (duplicated in `server/README.md`)
- `docker-reverse-proxy/README.md` — Nginx proxy setup
- `server/openapi.json` — machine-readable API spec (source of truth for API docs)
- `docs/` — webpack-generated HTML API reference (do not hand-edit)
- `.planning/` — project planning files (may be deleted; check git status first)

See [CONVENTIONS.md](CONVENTIONS.md) for project-specific formatting rules.
