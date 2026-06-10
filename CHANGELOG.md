# Changelog

## [0.1.0] — 2026-06-10

### Added
- Five tools: `hn_top`, `hn_search`, `hn_show_recent`, `hn_item`, `hn_user`.
- Wraps two free HN APIs: Firebase (canonical, real-time) + Algolia (full-text search).
- 2-min cache on list endpoints, 10-min on search, 5-min on individual items.
- Concurrency-capped item fetches (25 in parallel) to be polite to HN.
