# Ryot vs MediaTrackerPlus: Comparison

**Research date:** 2026-03-06

---

## Summary

Ryot is the clear choice. MediaTrackerPlus is a single-developer fork of a stale project that just reached v0.1.0. Ryot is on v10.x with active multi-developer maintenance and a real community.

---

## Side-by-Side Metrics

| Metric | MediaTrackerPlus | Ryot |
|---|---|---|
| GitHub | https://github.com/dnlwttnbrg/MediaTrackerPlus | https://github.com/IgnisDa/ryot |
| Stars | 6 | 3,157 |
| Forks | 1 | 107 |
| Latest version | v0.1.0 | v10.3.x |
| Last commit | Feb 25, 2026 | Mar 5, 2026 |
| Open issues | 0 (too new) | 30 (manageable) |
| Release cadence | 1 release ever | Multiple per month |
| Maintainers | 1 person | Active team |
| Origin | Fork of stale MediaTracker | Built from scratch |
| Language | TypeScript | Rust + TypeScript |
| License | MIT | GPL-3.0 |

---

## Ryot Recent Release Highlights

### v10.3.0 (February 2026)
- ~50% memory reduction on idle
- Additional integrations

### v10.2.0 (February 2026)
- Comic book tracking via Metron
- Music tracking via MusicBrainz
- Additional service integrations

### v10.1.0 (January 2026)
- Limit upcoming items by days
- Translation improvements

---

## MediaTracker Plus v0.1.0 Changes
- Random item selector page
- Statistics page
- Warning dialog on logout
- NPM-plus compatibility fix
- Minor UI state improvements

---

## Media Type Coverage

| Media Type | MediaTrackerPlus | Ryot |
|---|---|---|
| Movies | Yes | Yes |
| TV Shows | Yes | Yes |
| Books | Yes | Yes |
| Audiobooks | Yes | Yes |
| Video Games | Yes | Yes |
| Manga/Anime | No | Yes |
| Comics (Western) | No | Yes (via Metron, added v10.2.0) |
| Music | No | Yes (via MusicBrainz, added v10.2.0) |
| Podcasts | No | Yes |

---

## Risk Assessment

**MediaTrackerPlus risks:**
- Single point of failure: one maintainer
- Built on a deprecated codebase with 140 unresolved upstream issues
- No community to take over if maintainer stops
- The base bugs from MediaTracker are inherited

**Ryot risks:**
- Recommendations require paid Pro license key (see `04-ryot-pro-pricing.md`)
- Western comics support is very new (v10.2.0, February 2026)
- GPL-3.0 license has implications for derivative works

---

## Conclusion

Ryot is the production choice. MediaTrackerPlus is a reasonable short-term bridge only if MediaTracker's specific data model or UI was a hard requirement.
