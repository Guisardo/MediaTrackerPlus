# Backend Developer Memory

- [Library query excludes rated-only items fix](project_rated_only_items_fix.md) — Items only rated (no watchlist/seen) were invisible in library queries; fixed in getItemsKnexSql and getFacetsKnex
- [platformRecommended sort bugs — catalog scope + rated-item exclusion](project_platform_recommended_bugs.md) — anyListItem gate removed (items not on any list were invisible); rated items now excluded from recommendations for the current user
