# Trakt.tv Recommendation API Analysis

**Research date:** 2026-03-06
**Sources:** Trakt API documentation (trakt.docs.apiary.io), founder forum posts, GitHub repository audit

---

## Summary

Trakt's recommendation engine is **proprietary and closed-source**. The algorithm type is undisclosed. Personal ratings may not feed into recommendations at all — only watch history and an explicit "favorites" list (capped at 50 items) are confirmed inputs. There is no evidence of promotional/sponsored content injection.

---

## Algorithm

### What Is Confirmed

The API documentation states:
> *"Trakt recommendations are built on top of your viewing activity and preferences. The more you watch, the better your recommendations will be. We also use other factors for the algorithm to further personalize what gets recommended."*

No further technical detail is given in official documentation.

**Confirmed inputs:**

| Input | Confirmation Source |
|---|---|
| Watch history | Explicitly stated in API group description |
| User favorites (up to 50 items) | API docs on `/users/{id}/favorites`: *"Apps should encourage users to add favorites so the algorithm keeps getting better"* |
| Hidden items (exclusions) | `DELETE /recommendations/movies/{id}` endpoint |
| Watchlist (optional exclusion) | `ignore_watchlisted` query parameter |
| Collection (optional exclusion) | `ignore_collected` query parameter |

**Not confirmed as inputs:**
- User star ratings (1-10) — plausible but not documented
- Friends/social graph activity — no evidence either way
- Recency/frequency weighting — not disclosed
- What "other factors" means

### Exclusion Mechanism Detail

Trakt founder Justin Nemeth disclosed in forum thread 14994 (2023):
> *"It actually runs recommendations through our search service, which is why it needs to send a list of items to exclude."*

This means exclusions are applied as a post-processing blocklist filter, not built into the core recommendation generation. Excluded items are generated first, then stripped.

### Is the Algorithm Open-Source?

**No.** The Trakt GitHub organization (`https://github.com/trakt`) has only these public repositories: `trakt-web`, `XCDYouTubeKit`, `trakt-android`, `trakt-api`, `trakt-apple`, `showly`, `discord-presence`, `emojionearea`, `typesense-rails`, `Trakt-for-Mediaportal`. None contain recommendation code.

No engineering blog post, technical writeup, conference paper, or data science article about Trakt's recommendation algorithm has ever been published.

---

## Content Similarity ("If You Like X")

This is a **separate system** from personalized recommendations. Founder confirmed in forum thread 9609 (March 2022):
> *"These aren't personalized. We use the related items from TMDB if they have them. If not, we do suggestions based on the genre and popularity."*

Trakt's content similarity feature is **not a Trakt algorithm** — it defers entirely to TMDB's related items data, with genre+popularity fallback. This is important: what looks like Trakt intelligence is actually TMDB data.

---

## Promotional / Sponsored Content

**No evidence of this anywhere.**

- The full Trakt API specification contains zero occurrences of "sponsor", "promoted", "paid", "partner" (in advertising context), "advertis", or "affiliate" related to recommendations.
- Trakt's VIP page states: *"We're directly funded by VIP memberships and never sell your data."*
- No forum threads, developer reports, or community investigations suggest paid placement in recommendations.
- No anomalous recommendation patterns reported by the developer community.

This is an absence of evidence, not conclusive proof. But no signal exists that sponsored content is injected.

---

## API Endpoint Reference

### `GET /recommendations/movies`

**Authentication:** OAuth required (user access token)

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ignore_collected` | boolean string | `false` | Exclude already collected movies |
| `ignore_watchlisted` | boolean string | `false` | Exclude watchlisted movies |
| `limit` | integer | `10` | Results per page (max 100) |

**Response fields per item:**
```json
{
  "title": "Blackfish",
  "year": 2013,
  "ids": {
    "trakt": 58,
    "slug": "blackfish-2013",
    "imdb": "tt2545118",
    "tmdb": 158999
  },
  "favorited_by": [
    {
      "user": { "username": "...", "vip": true },
      "notes": "This is a great documentary."
    }
  ]
}
```

The `favorited_by` array lists users who have the item in their favorites list. It is frequently empty.

### `DELETE /recommendations/movies/{id}`

Permanently hides a movie from future recommendations for the authenticated user. Accepts Trakt ID, Trakt slug, or IMDb ID.

### `GET /recommendations/shows` / `DELETE /recommendations/shows/{id}`

Identical structure for TV show recommendations.

---

## VIP vs Free User Differences

The founder confirmed the 50-item favorites cap is the same for VIP and standard users. No statement was made about qualitative differences in recommendation output between tiers. Whether VIP users receive different algorithm weighting or a larger candidate pool is unknown.

---

## Known Quality Issues

The founder acknowledged in June 2022 that recommendations were "launched too early." No technical update has been published since to indicate what improvements, if any, were made.

---

## Implications for the upnext Project

| Concern | Finding |
|---|---|
| Algorithm transparency | Fully opaque — cannot be audited or modified |
| Personal ratings as input | **Not confirmed** — star ratings may be ignored entirely |
| Favorites as input | Confirmed, capped at 50 items per user |
| Content similarity source | TMDB data, not Trakt's own algorithm |
| No open-source alternative that replicates it | True |
| Best free alternative with full transparency | `jellyfin-plugin-localrecs` (TF-IDF, local, open-source, favorites weighted 2.0x) |

### Critical gap for recommendation quality

If personal star ratings (1-10) are not a confirmed input to Trakt recommendations, the system may not reflect genuine preferences. `jellyfin-plugin-localrecs` explicitly uses Jellyfin ratings with documented weighting (favorites 2.0x, rewatches 1.5x, 365-day recency decay), making it more transparent and potentially more accurate for personal preference matching — though limited to movies/TV only.
