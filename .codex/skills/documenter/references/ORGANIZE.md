# Organization Reference

Organization defines where documentation lives, what it is named, and how pieces relate to each other. Apply after normalization (NORMALIZE.md).

---

## Target Documentation Structure

```
MediaTrackerPlus/
├── README.md                        ← Project entry point (user-facing)
├── CONTRIBUTING.md                  ← Contributor guide
├── CHANGELOG.md                     ← Version history
├── docs/
│   ├── INDEX.md                     ← Master documentation index
│   ├── api/
│   │   ├── README.md                ← API overview + link to OpenAPI spec
│   │   └── openapi.json             ← (symlink or copy from server/)
│   ├── deployment/
│   │   ├── README.md                ← Deployment overview
│   │   ├── docker.md                ← Docker Compose setup
│   │   ├── docker-reverse-proxy.md  ← Nginx reverse proxy
│   │   └── source.md                ← Build from source
│   ├── configuration/
│   │   ├── README.md                ← Configuration overview
│   │   ├── environment-variables.md ← All env vars (extracted from README)
│   │   └── metadata-providers.md    ← External API integrations
│   ├── integrations/
│   │   ├── README.md                ← Integration overview
│   │   ├── notifications.md         ← Notification platforms
│   │   └── import-export.md         ← Data import/export
│   └── development/
│       ├── README.md                ← Developer guide
│       ├── architecture.md          ← System architecture
│       └── testing.md               ← Testing guide
└── server/
    └── README.md                    ← (should mirror or redirect to root README)
```

---

## Placement Rules

### Rule O1 — Single Source of Truth

Each piece of information lives in **exactly one place**. Duplication is permitted only as a redirect or a generated artifact.

- `server/README.md` is a **duplicate** of root `README.md` → remove content from `server/README.md` and replace with a redirect notice pointing to root.
- `docs/` HTML files are **generated** by webpack → do not hand-edit; update the source markdown instead.

### Rule O2 — README at Every Level

Every directory that contains documentation must have a `README.md`. It must:
- Start with a one-sentence description of the directory's purpose
- List all files in the directory with one-line descriptions
- Link to the parent `README.md` or `docs/INDEX.md`

### Rule O3 — File Naming

| Convention | Rule |
|------------|------|
| Case | **kebab-case** (all lowercase, hyphens) |
| Extensions | `.md` for Markdown, `.json` for data |
| Spaces | Never — use hyphens |
| Version suffixes | Only for archives: `README-v0.1.md` |

Examples:
```
environment-variables.md  ✓
EnvironmentVariables.md   ✗
environment_variables.md  ✗
```

### Rule O4 — Scope Determines Location

| Scope | Location |
|-------|----------|
| Project overview, badges, quick-start | `README.md` (root) |
| Deployment instructions | `docs/deployment/` |
| API reference | `docs/api/` |
| Configuration details | `docs/configuration/` |
| Third-party integrations | `docs/integrations/` |
| Developer internals | `docs/development/` |
| Planning/roadmap (internal) | `.planning/` (not committed unless intentional) |

### Rule O5 — Large READMEs

If `README.md` exceeds **400 lines**, extract sections into dedicated files under `docs/` and replace the section in `README.md` with a summary paragraph and a link.

Extraction candidates in this project:
- Environment Variables table → `docs/configuration/environment-variables.md`
- Metadata Providers table → `docs/configuration/metadata-providers.md`
- Notification Platforms section → `docs/integrations/notifications.md`
- Import/Export section → `docs/integrations/import-export.md`

### Rule O6 — Planning Files

`.planning/` is for internal planning artifacts. These files:
- Should NOT be committed to `main` in a final state
- If they must be committed, add a note in `docs/development/README.md` pointing to them
- Are never linked from user-facing docs

---

## Reorganization Workflow

1. Run `scan_docs.py` → review `docs-catalog.json`
2. Identify misplaced files (use Rule O4)
3. Create missing `README.md` files (Rule O2)
4. Move files with `git mv` to preserve history
5. Update all internal links in moved files (Rule O1)
6. Run `check_links.py` to verify nothing is broken
7. Rebuild the index with `build_index.py`

---

## Anti-Patterns to Fix

| Anti-pattern | Fix |
|--------------|-----|
| Duplicate README (root + server/) | Remove content from `server/README.md`, add redirect |
| Doc content inside source code comments | Extract to `docs/development/` |
| Inline env var docs inside `config.ts` | Move to `docs/configuration/environment-variables.md` |
| Markdown files in root with single-use content | Move to appropriate `docs/` subdirectory |
| `docs/` files edited by hand | Source-control the generator, not the output |
