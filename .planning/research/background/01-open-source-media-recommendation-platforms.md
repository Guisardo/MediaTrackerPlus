# Open-Source Media Recommendation Platforms

**Research date:** 2026-03-06
**Goal:** Find self-hostable open-source systems that recommend movies/series based on external platform ratings (IMDb, RT, TMDB) combined with personal ratings.

---

## Key Finding

No single open-source project currently fully solves all four requirements (personal ratings + external ratings + recommendations + family multi-user) in a polished, production-ready way. The practical path is combining two or three tools.

---

## Evaluated Projects

### 1. Nextt
- **GitHub:** https://github.com/WhiskeyCoder/Nextt
- **Stars:** 103 | **Last commit:** August 2025 | **Language:** TypeScript/React
- **Description:** Self-hosted Plex/Jellyfin-powered recommendation dashboard. Reads existing star ratings from Plex/Jellyfin and surfaces TMDB-enriched recommendations with embedded IMDb/RT data.
- **Key features:** Rating-based and watch-history-based recommendation modes, advanced filtering by genre/country/language/TMDB rating, one-click Overseerr/Jellyseerr integration.
- **External ratings:** TMDB metadata (includes IMDb/RT scores on detail cards)
- **Multi-user/family:** Single-user currently; multi-user on roadmap
- **Verdict:** Closest single-project match. Main gap is multi-user support.

### 2. JellyNext
- **GitHub:** https://github.com/luall0/jellynext
- **Stars:** 120 | **Last commit:** February 2026 | **Language:** C# (.NET 9)
- **Description:** Jellyfin plugin creating per-user virtual recommendation libraries via Trakt.tv. Each family member links their own Trakt account via OAuth 2.0.
- **Key features:** Virtual libraries ("Trakt Movie Recommendations", "Trakt Show Recommendations"), per-user personalization, Radarr/Sonarr/Jellyseerr integration.
- **External ratings:** Trakt community-driven ratings aggregated from multiple sources.
- **Multi-user/family:** Explicitly designed for household sharing.
- **Requirements:** Jellyfin 10.11.0+, .NET 9.0
- **Verdict:** Best option for Jellyfin users wanting per-family-member recommendations.

### 3. jellyfin-plugin-localrecs
- **GitHub:** https://github.com/rdpharr/jellyfin-plugin-localrecs
- **Stars:** 28 | **Last commit:** February 2026 | **Language:** C# (.NET 9)
- **Description:** Privacy-first Jellyfin plugin performing all recommendation computation locally via TF-IDF embeddings with cosine similarity. No data leaves the server.
- **Key features:** Per-user virtual libraries, weighting system (favorites 2.0x, rewatches 1.5x, 365-day recency decay), optional temporal similarity, genre/actor/director/decade matching.
- **External ratings:** Uses existing Jellyfin metadata sourced from TMDB/AniDB during library scans.
- **Multi-user/family:** Full per-user personalization within Jellyfin.
- **Verdict:** Best for privacy-conscious households wanting on-device recommendation logic.

### 4. Recommendarr
- **GitHub:** https://github.com/Teagan42/recommendarr
- **Stars:** Low (forks: 18) | **Last commit:** March 2025 | **Language:** Vue.js/JavaScript
- **Description:** AI-driven web app generating personalized suggestions by analyzing Sonarr/Radarr library data with optional Plex/Jellyfin watch history overlay.
- **Key features:** Sonarr/Radarr API integration, supports OpenAI, Ollama, LM Studio for inference, Docker-deployable.
- **External ratings:** No direct TMDB/IMDb/RT integration; relies on AI inference from library metadata.
- **Multi-user/family:** Single-user design.
- **Verdict:** Good for *arr stack users, but single-user and no external rating integration.

### 5. MediaTracker
- **GitHub:** https://github.com/bonukai/MediaTracker
- **Stars:** 883 | **Last commit:** January 2025 | **Language:** TypeScript (99%)
- **Description:** Self-hosted tracker for movies, TV shows, video games, books, and audiobooks with personal ratings, watchlists, calendar view, and REST API.
- **Key features:** TMDB integration, Trakt import, multi-user support, episode tracking, notifications.
- **External ratings:** TMDB metadata; Trakt import brings community ratings.
- **Multi-user/family:** Explicitly supports multiple users.
- **Status:** Stale as of 2026 — see `02-mediatracker-status.md`.
- **Verdict:** Best general-purpose tracker foundation, but no recommendation engine and development stalled.

### 6. Flox
- **GitHub:** https://github.com/devfake/flox
- **Stars:** 1,300 | **Last commit:** December 2019 | **Language:** PHP (Laravel) + Vue.js
- **Description:** Self-hosted movie and TV tracker with personal ratings, watchlists, Plex webhook sync.
- **Status:** Largely inactive since 2019. Not recommended for new deployments.

### 7. Kometa (formerly Plex Meta Manager)
- **GitHub:** https://github.com/Kometa-Team/Kometa
- **Stars:** 3,200 | **Last commit:** Active (2026) | **Language:** Python
- **Description:** Automation tool for Plex that creates and manages collections, overlays, and metadata from external sources.
- **Key features:** Collections from IMDb top lists, TMDB ratings, Trakt trending, MDBList. Rating overlays (IMDb/RT/TMDB badges on posters). YAML-configurable.
- **External ratings:** IMDb, TMDB, Trakt, MDBList, Letterboxd, Metacritic.
- **Multi-user:** Library-wide (all users see same collections).
- **Verdict:** Not a recommendation engine per se, but the most mature tool for surfacing external ratings inside Plex as smart collections.

### 8. Jellyfin-MonWUI-Plugin
- **GitHub:** https://github.com/G-grbz/Jellyfin-MonWUI-Plugin
- **Stars:** 68 | **Last commit:** February 2026 | **Language:** C# + JavaScript
- **Description:** Netflix-style Jellyfin UI enhancement with per-profile sliders, hover trailers, smart suggestions, profile chooser.
- **Multi-user/family:** Explicit per-profile design.
- **Verdict:** UI enhancement only, not a recommendation algorithm. Good complement to JellyNext or localrecs.

### 9. Suasor
- **GitHub:** https://github.com/unfaiyted/suasor
- **Stars:** ~1 | **Last commit:** April 2025 | **Language:** Go (backend) + SvelteKit (frontend)
- **Description:** AI recommendation engine for Emby, Jellyfin, Plex, Navidrome using Claude/OpenAI/Ollama.
- **Status:** Pre-release, very early stage. Not production-ready.

### 10. Gorse
- **GitHub:** https://github.com/gorse-io/gorse
- **Stars:** 9,400 | **Last commit:** February 2026 | **Language:** Go
- **Description:** General-purpose AI-powered recommender system. Supports collaborative filtering, content-based, user/item similarity, LLM ranker.
- **Key features:** RESTful API for inserting user feedback, GUI dashboard, distributed architecture, multiple storage backends.
- **Multi-user:** Yes, designed for multi-user workloads.
- **Verdict:** Most powerful engine in this list, but requires significant integration work to pipe in movie/book/comic data. Not movie-specific out of the box.

### 11. MovieMatch
- **GitHub:** https://github.com/LukeChannings/moviematch
- **Stars:** 507 | **Language:** TypeScript
- **Description:** Group movie selection tool — multiple users swipe through Plex library simultaneously, surfacing matches when multiple people select the same title.
- **Multi-user:** Core design, built entirely for group selection.
- **Verdict:** Narrow but practical for "what should we watch tonight" family decisions.

---

## Summary Comparison

| Project | Personal Ratings | External Ratings | Recommendations | Multi-User | Self-Hostable | Activity |
|---|---|---|---|---|---|---|
| Nextt | Yes (from Plex/Jellyfin) | TMDB/IMDb/RT via TMDB | Yes | Roadmap | Yes (Docker) | Active 2025 |
| JellyNext | Via Trakt | Trakt community | Yes (Trakt-powered) | Yes (per-user) | Yes (Jellyfin plugin) | Active 2026 |
| jellyfin-plugin-localrecs | Via Jellyfin | Uses existing metadata | Yes (local TF-IDF) | Yes (per-user) | Yes (Jellyfin plugin) | Active 2026 |
| Recommendarr | Via Plex/Jellyfin history | No | Yes (AI/LLM) | No | Yes (Docker) | 2025 |
| MediaTracker | Yes (native) | TMDB metadata | No (tracker only) | Yes | Yes (Docker) | Stale 2025 |
| Flox | Yes (3-point) | TMDB metadata | Minimal | Limited | Yes (Docker) | Inactive 2019 |
| Kometa | No | IMDb, TMDB, RT, Trakt, Metacritic | Via smart collections | Library-wide | Yes (Docker) | Active 2026 |
| Gorse | Via API input | Bring your own | Yes (collab filtering) | Yes | Yes (Docker) | Active 2026 |
| MovieMatch | Swipe-based | No | Group matching only | Yes (core) | Yes (Docker) | Stable |

---

## Recommended Stack

**For Jellyfin users:**
JellyNext + jellyfin-plugin-localrecs → per-family-member recommendation libraries with minimal setup, fully free.

**For Plex users:**
Kometa (external-rating collections) + Nextt (personal-rating recommendations), accepting Nextt's single-user limitation.

**For a proper multi-user tracker foundation:**
MediaTracker (if active) or Ryot — see `03-ryot-vs-mediatracker-plus.md`.
