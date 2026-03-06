# MediaTracker Project Status Assessment

**Research date:** 2026-03-06
**GitHub:** https://github.com/bonukai/MediaTracker

---

## Verdict: Effectively Stale

### Evidence

| Signal | Detail |
|---|---|
| Last commit | February 4, 2025 — CI/build fix, not a feature or bug fix |
| Last release | `0.2.11` on January 25, 2025 |
| Open issues | 140 open, including database errors and loading failures reported through late 2025 |
| Maintainer response | No visible maintainer responses to open issues |
| Archived | No, but no activity |

The project is not officially abandoned but the maintainer has gone quiet. Issues are accumulating with no responses or fixes. The last meaningful change was a build pipeline adjustment, not substantive development.

### Recent Issue Sample (as of research date)

- `[#684]` Compatibility issue with NPMplus and empty Accept-Encoding header (Feb 2026, no response)
- `[#652]` Add media manually (Jan 2026, no response)
- `[#696]` Allow PUBLIC_PATH via environment variable (Oct 2025, no response)
- `[#603]` MediaTracker not loading some shows (Sep 2025, no response)
- `[#682]` Database errors (Sep 2025, no response)

---

## Active Fork: MediaTrackerPlus

- **GitHub:** https://github.com/dnlwttnbrg/MediaTrackerPlus
- **Stars:** 6 | **Created:** November 2025 | **Last push:** February 25, 2026
- **Latest release:** `v0.1.0` (February 22, 2026)

### v0.1.0 Changes
- Added page to randomly select an item from every media type
- Added a statistics page
- Added warning dialog on logout
- Added support for npm-plus
- Save state of item views on page change
- Smaller improvements

### Assessment
Single-developer fork that just reached v0.1.0. The additions are minor UI improvements on top of the stale MediaTracker codebase. With 6 stars and 1 fork, there is no community to sustain it if the single maintainer loses interest. This represents meaningful risk for a production deployment.

---

## Recommended Alternative: Ryot

See `03-ryot-vs-mediatracker-plus.md` for the full comparison. Ryot is on v10.x, actively maintained with commits as recent as March 2026, and has 3,157 stars with regular feature releases.
