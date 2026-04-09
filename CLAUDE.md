# CLAUDE.md

## Workspaces

- `server/` — Express + TypeScript backend, Node 18+, Knex, SQLite/PostgreSQL
- `client/` — React 19 + Vite 6, Tailwind v4, shadcn/ui, Lingui
- `rest-api/` — auto-generated TS types, **never hand-edit**

## Commands

```bash
npm run dev              # server :7481 + client :7000
npm run build            # build all
npm run test             # server (SQLite :memory:)
npm run test:client
npm run check-types      # all workspaces
npm run lint
npm run format           # Prettier
npm run verify-generated-contracts
```

## API Generation (Critical)

After changing any file in `server/src/controllers/`:

```bash
cd server && npm run build:routes
cd .. && npm run verify-generated-contracts
```

Never edit `server/src/generated/` or `rest-api/generated/` — auto-overwritten.

## Database

- Default: SQLite at `server/data.db`
- Tests: `:memory:` SQLite
- Optional: PostgreSQL (`DATABASE_CLIENT=pg`, `DATABASE_URL`)
- Migrations: additive only — never edit `server/src/migrations/`, only add

## i18n

- 28 locales, Lingui v3 (server) / v5 (client)
- After string changes: `npm run lingui:extract` → `npm run lingui:compile`

## Code Style

- Prettier: `singleQuote: true`, `trailingComma: 'es5'`, `endOfLine: 'lf'`
- Server TS: strict mode
- Styling: Tailwind v4 only — no new styled-components or SCSS

## Git

- Branches: `feat/issue-N-description` or `fix/issue-N-description`
- Commits: conventional (`feat:`, `fix:`, `chore:`)
- All changes via PR to `main`
- Before commit: use `/test-and-commit` skill

## GitHub

Use GitHub API directly, not `gh` CLI. Use `/guisardo-github` skill for credentials.

## Active Migrations (don't reverse)

- Tailwind v3 → v4, styled-components/SCSS → Tailwind, Radix → shadcn/ui, Lingui v3 → v5

## Key Env Vars

| Var               | Default          | Purpose                            |
| ----------------- | ---------------- | ---------------------------------- |
| `PORT`            | `7481`           | Server port                        |
| `DATABASE_CLIENT` | `better-sqlite3` | Use `pg` for PostgreSQL            |
| `DATABASE_PATH`   | `server/data.db` | SQLite path                        |
| `TMDB_LANG`       | —                | TMDB language                      |
| `AUDIBLE_LANG`    | —                | Audible region (`us`, `gb`, `de`…) |
