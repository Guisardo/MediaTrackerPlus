# Free Multi-Platform Recommendation Stack Research

**Research date:** 2026-03-06
**Requirements:**
- Movies and TV series tracking + recommendations
- Books tracking + recommendations
- Comics/manga tracking + recommendations
- Multi-user/family support
- Personal ratings influence recommendations
- Completely free — no paywalled recommendation features

---

## Core Finding

**No single free, self-hosted platform covers all requirements today.**

Every platform either:
- Covers all media types but has **no recommendation engine** (Yamtrack)
- Has recommendations but **paywalls them** (Ryot Pro, Kavita+)
- Has free recommendations but **only covers movies/TV** (Jellyfin plugins)

---

## Evaluated Platforms

### Yamtrack
- **GitHub:** https://github.com/FuzzyGrim/Yamtrack
- **Stars:** 2,161 | **Last commit:** 2026-03-05 | **License:** AGPL-3.0
- **Media types:** Movies, TV, books, comics, manga, anime, video games, board games
- **Multi-user:** Yes — individual accounts with personalized tracking
- **Recommendations:** None built-in
- **Docker:** Yes (SQLite or PostgreSQL)
- **Verdict:** Widest media coverage of any free project. Best tracker foundation. Zero recommendation functionality.

### Ryot
- **GitHub:** https://github.com/IgnisDa/ryot
- **Stars:** 3,157 | **Last commit:** 2026-03-06 | **License:** GPL-3.0
- **Media types:** Movies, TV, manga, books, audiobooks, music, podcasts, video games, comics (v10.2+)
- **Multi-user:** Yes (OpenID Connect support)
- **Recommendations:** Exist but **locked behind paid Pro key**
- **Docker:** Yes
- **Verdict:** Most feature-rich tracker, but recommendations are not free. See `04-ryot-pro-pricing.md`.

### Kavita
- **GitHub:** https://github.com/Kareadita/Kavita
- **Stars:** 9,968 | **Last commit:** 2026-03-06 | **License:** GPL-3.0
- **Media types:** Comics/manga (CBR, CBZ, zip, rar), books (EPUB, PDF) — **no movies/TV**
- **Multi-user:** Yes (role-based, age restrictions, OIDC)
- **Recommendations:** Free tier has none. Kavita+ ($4/month) adds personalized recommendations via AniList/MAL integration.
- **Docker:** Yes
- **Verdict:** Excellent for comics + books. Fails on movies/TV and free recommendations.

### Komga
- **GitHub:** https://github.com/gotson/komga
- **Stars:** 5,978 | **Last commit:** 2026-03-06 | **License:** MIT
- **Media types:** Comics/manga/BDs/magazines, eBooks (EPUB) — **no movies/TV**
- **Multi-user:** Yes (per-library access control, age restrictions)
- **Recommendations:** None, none planned
- **Docker:** Yes
- **Verdict:** Best comic server. No movies, no recommendations.

### Jellyfin + Free Plugins
- **GitHub:** https://github.com/jellyfin/jellyfin
- **Stars:** 49,100+ | **License:** GPL-2.0
- **Media types:** Movies, TV, music — **no books or comics**
- **Recommendation plugins (both free):**
  - JellyNext (120 stars): Per-user Trakt-powered recommendations via virtual libraries
  - jellyfin-plugin-localrecs (28 stars): Fully local TF-IDF recommendations, no external accounts
- **Multi-user:** Yes, native
- **Verdict:** Best free recommendation system for movies/TV only. No book or comics coverage.

### Calibre-Web
- **GitHub:** https://github.com/janeczku/calibre-web
- **Stars:** 16,682 | **Last commit:** 2026-03-06 | **License:** GPL-3.0
- **Media types:** Books (all formats via Calibre database) — **no movies or comics**
- **Recommendations:** None built-in
- **Multi-user:** Yes
- **Docker:** Yes
- **Verdict:** Gold standard for book management. No recommendations.

### Stump
- **GitHub:** https://github.com/stumpapp/stump
- **Stars:** 1,957 | **Last commit:** 2026-03-06 | **License:** MIT
- **Media types:** Comics/manga (CBZ, CBR), eBooks (EPUB, PDF) — **no movies/TV**
- **Multi-user:** Yes (in development)
- **Recommendations:** None. Work-in-progress project.
- **Docker:** Yes (nightly images)
- **Verdict:** Promising Rust-based comic + ebook server. Explicitly marked WIP. No recommendations.

### MediaTracker
- **GitHub:** https://github.com/bonukai/MediaTracker
- **Stars:** 884 | **License:** MIT
- **Media types:** Movies, TV, video games, books, audiobooks — **no comics/manga**
- **Recommendations:** None
- **Multi-user:** Yes
- **Status:** Stale — see `02-mediatracker-status.md`

### Media Journal
- **GitHub:** https://github.com/mihail-pop/media-journal
- **Stars:** 113 | **Last commit:** 2026-02-28 | **License:** AGPL-3.0
- **Media types:** Movies, TV, games, books, anime, manga, music — **no Western comics**
- **Recommendations:** None (has a "Discover" section but no algorithmic suggestions)
- **Multi-user:** No — single-user only
- **Verdict:** Single-user, no comics, no recommendations.

### Rebolio *(watch project)*
- **GitHub:** https://github.com/clawdnight/rebolio
- **Stars:** 0 | **Last commit:** 2026-03-01 | **License:** MIT
- **Media types:** Movies/TV, books, music, games — comics on roadmap
- **Recommendations:** None currently; social recommendations planned
- **Multi-user:** Social following features partial
- **Status:** Pre-alpha, February 2026, 15 commits total
- **Vision:** Unified Letterboxd + Goodreads + Last.fm replacement with free recommendations
- **Verdict:** Right architecture vision, but not usable today. Worth monitoring.

### TEAL-Laravel
- **GitHub:** https://github.com/dotMavriQ/TEAL-Laravel
- **Stars:** 0 | **Last commit:** 2026-03-02
- **Media types:** Books, comics, movies, anime — explicitly all four
- **Recommendations:** None
- **Multi-user:** No — single-user by design
- **Verdict:** Only project explicitly listing all four media types including Western comics. Zero stars, no releases, single-user. Not viable.

---

## Coverage Matrix

| Platform | Movies/TV | Books | Comics | Multi-User | Free Recs | Docker |
|---|---|---|---|---|---|---|
| Yamtrack | Yes | Yes | Yes | Yes | None | Yes |
| Ryot | Yes | Yes | Yes (v10.2+) | Yes | Paywalled | Yes |
| Kavita | No | Yes | Yes | Yes | Paywalled | Yes |
| Komga | No | Partial | Yes | Yes | None | Yes |
| Jellyfin + plugins | Yes | No | No | Yes | **Yes (free)** | Yes |
| Calibre-Web | No | Yes | No | Yes | None | Yes |
| Stump | No | Yes | Yes | Yes (WIP) | None | Yes |
| MediaTracker | Yes | Yes | No | Yes | None | Yes |
| Rebolio | Yes | Yes | Roadmap | Partial | Planned | Yes |

---

## Recommended Free Stack

Given the constraint of fully free with all media types, no single tool exists. The best practical combination:

| Role | Tool | Notes |
|---|---|---|
| Unified tracker (all media) | **Yamtrack** | Movies, TV, books, comics, manga — all in one, multi-user, Docker |
| Movie/TV recommendations | **Jellyfin + JellyNext or localrecs** | Per-user, free — see `06-trakt-recommendations.md` for Trakt caveats |
| Comics/manga reader | **Komga** | Serves comic files, no recommendations |
| Books | **Calibre-Web** | No recommendations |

**Accepted gaps:** Book and comics recommendations have no free open-source solution in any mature form as of March 2026.

---

## Alternative: Pay $60 for Ryot Lifetime

Ryot self-hosted lifetime ($60 one-time) covers movies, TV, books, audiobooks, comics (v10.2+), and manga with personalized recommendations in a single platform. If paying is acceptable, this is the most complete single-tool solution available. See `04-ryot-pro-pricing.md`.
