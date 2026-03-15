---
name: frontend-developer
description: Frontend UI specialist for MediaTrackerPlus. Use when building or modifying React components, pages, layouts, styles, or i18n in the client/ directory. Also use when working on: poster grids, mobile navigation, dark mode, Tailwind migration, shadcn/ui migration, styled-components removal, facet filters, rating stars, progress tracking, calendar view, or any screen-level UI work.
context: fork
agent: frontend-developer
---

# Frontend Developer

Implements, refactors, and migrates UI for the MediaTrackerPlus `client/` directory. Operates mobile-first with Tailwind CSS as the single source of styling truth.

## Quick Reference

| Task | Reference |
|---|---|
| Component patterns, props, composition | [COMPONENTS.md](COMPONENTS.md) |
| Styling rules, Tailwind v3→v4 migration guide | [STYLING.md](STYLING.md) |
| shadcn/ui component inventory | [COMPONENTS.md](COMPONENTS.md) |
| i18n macros and RTL | Agent system prompt |
| API hooks and React Query | Agent system prompt |
| Test setup | Agent system prompt |

## Decision Tree

```
User asks about UI/frontend
          │
          ├─ New component or page       → Read COMPONENTS.md → check src/components/ui/ first
          │
          ├─ Styling change              → Read STYLING.md → use Tailwind, no new styled-components
          │
          ├─ styled-components removal   → Read STYLING.md → migration section
          │
          ├─ SCSS removal               → Read STYLING.md → SCSS-to-Tailwind mapping
          │
          ├─ shadcn/ui adoption         → Read COMPONENTS.md → shadcn/ui mapping table
          │
          ├─ i18n / translation         → Wrap in <Trans> or t`` macro
          │
          ├─ Mobile layout issue        → Check base (375px) styles, not just sm:/md: overrides
          │
          ├─ Dark mode issue            → Verify every colour class has a dark: counterpart
          │
          └─ Test failure               → Check provider wrappers, mock React Query
```

## Project Media Types

The app tracks five media types — every component that handles content needs to support all five:

| Media Type | Route | Key Fields |
|---|---|---|
| `movie` | `/movies` | title, poster, releaseDate, runtime |
| `tv` | `/tv` | title, poster, seasons, episodes |
| `game` | `/games` | title, cover, releaseDate, platform |
| `book` | `/books` | title, cover, author, pages |
| `audiobook` | `/audiobooks` | title, cover, author, narrator, duration |

## Key Pages (31 total)

| Page | Path | Purpose |
|---|---|---|
| `GridPage` | `/movies`, `/tv`, etc. | Paginated poster grid with facets |
| `DetailsPage` | `/details/:id` | Full media item details |
| `SeasonsPage` | `/seasons/:id` | TV season list |
| `EpisodePage` | `/episode/:id` | Episode details + progress |
| `UpcomingPage` | `/upcoming` | Items with upcoming release |
| `WatchlistPage` | `/watchlist` | User's watchlist |
| `CalendarPage` | `/calendar` | FullCalendar release calendar |
| `StatisticsPage` | `/statistics` | Viewing statistics charts |
| `GroupsPage` | `/groups` | User group management |
| `SettingsPage` | `/settings` | App configuration |
| `ImportPage` | `/import` | Trakt/Goodreads import |

## Current Styling State

The codebase has four overlapping styling systems. Consolidation to Tailwind-only is in progress:

| System | Status | Action |
|---|---|---|
| Tailwind CSS v3 | Active — primary | Keep, migrate to v4 |
| styled-components v5 | Active — GridItem.tsx and others | Remove on contact |
| SCSS/SASS (main.scss) | Active — grid mixins, base | Remove on contact |
| Plain CSS (dark.css, etc.) | Active — theme overrides | Consolidate into Tailwind |

See [STYLING.md](STYLING.md) for the complete migration guide.
