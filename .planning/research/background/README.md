# upnext Research

Research conducted March 2026 on self-hosted media recommendation systems for movies, series, books, and comics.

---

## Documents

| File | Topic |
|---|---|
| [01-open-source-media-recommendation-platforms.md](./01-open-source-media-recommendation-platforms.md) | Survey of 11 open-source recommendation/tracking projects with comparison matrix |
| [02-mediatracker-status.md](./02-mediatracker-status.md) | MediaTracker staleness analysis and MediaTrackerPlus fork assessment |
| [03-ryot-vs-mediatracker-plus.md](./03-ryot-vs-mediatracker-plus.md) | Head-to-head comparison: Ryot v10 vs MediaTrackerPlus v0.1.0 |
| [04-ryot-pro-pricing.md](./04-ryot-pro-pricing.md) | Ryot Pro pricing tiers, feature gating, and key verification mechanism |
| [05-free-multiplatform-stack.md](./05-free-multiplatform-stack.md) | Free stack research covering movies + books + comics with multi-user support |
| [06-trakt-recommendations-analysis.md](./06-trakt-recommendations-analysis.md) | Trakt API recommendation algorithm analysis, open-source status, promotional content |

---

## Key Conclusions

1. **No single free platform** covers movies + books + comics with free personal recommendations as of March 2026.
2. **Yamtrack** is the best free unified tracker (all media types, multi-user) but has no recommendation engine.
3. **Ryot** is the most complete solution but recommendations require a paid Pro key ($60 lifetime self-hosted).
4. **Jellyfin + jellyfin-plugin-localrecs** provides the best free, transparent, personal-rating-driven recommendations — limited to movies/TV only.
5. **Trakt recommendations** are proprietary, closed-source, and may not use personal star ratings as input at all.
6. **Book and comics recommendations** have no mature free open-source solution in this space yet.
