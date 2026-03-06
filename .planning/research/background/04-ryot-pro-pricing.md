# Ryot Pro Pricing and Feature Gating

**Research date:** 2026-03-06
**Source:** https://ryot.io/#pricing (dynamically loaded, verified via browser)

---

## Key Finding

Recommendations are a Pro-only feature in Ryot, even for self-hosted deployments. A `SERVER_PRO_KEY` environment variable is required to unlock Pro features. The key is verified against Unkey's external API (cached for 1 hour, re-verified on restart).

---

## Self-Hosted Pricing

| Plan | Price | Recommendations Included |
|---|---|---|
| Community Edition | **Free** | No |
| Monthly | $2/month | Yes |
| Yearly | $20/year | Yes |
| **Lifetime** | **$60 one-time** | Yes |

## Cloud Pricing (for comparison)

| Plan | Price |
|---|---|
| Monthly | $3/month (7-day trial) |
| Yearly | $30/year (14-day trial) |
| Lifetime | $90 one-time |

Self-hosted Pro is cheaper than cloud in all tiers (~33% cheaper).

---

## Pro-Only Features (confirmed from ryot.io/features)

### Media Tracking
- Recommendations based on favorites and watch history
- Suggestions that cater to tastes based on watch history
- Add media to watchlist, favorite, or any custom collection (paywalled)
- Set time spent manually on seen entries
- Save commonly used filters as presets

### Social / Collaboration
- Share access links to data with friends and family
- Add collaborators to collections
- Add custom information to collections

### Integrations
- YouTube Music integration
- Jellyfin music collection integration

### Fitness
- Inline history and images of exercises while logging workouts
- Workout templates

---

## Technical Implementation

The Pro key verification process (from docs.ryot.io/concepts/pro-key):
1. Server reads `SERVER_PRO_KEY` environment variable on startup
2. Sends verification request to Unkey's API
3. Checks expiration date of the key
4. Caches verification result for 1 hour
5. Re-verifies on server restart

This means self-hosted instances require an active internet connection to verify the Pro key. A lapsed key will be detected within 1 hour of expiry.

---

## Strategic Options

### Option A — Pay the $60 lifetime self-hosted license
Single payment, all Pro features permanently unlocked. Most cost-effective path if recommendations are required.

### Option B — Use Ryot free as tracker only, pair with free recommendation tools
- Ryot (free) → ratings and tracking for all media types
- JellyNext or jellyfin-plugin-localrecs → free movie/TV recommendations
- Accept no book/comics recommendation engine

### Option C — Use a fully free alternative stack
See `05-free-multiplatform-stack.md` for the free stack analysis.
