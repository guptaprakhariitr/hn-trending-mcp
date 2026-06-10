# hn-trending-mcp

> Hacker News firehose for AI agents. Front-page lists, full-text search across all HN content (via Algolia), recent Show HN launches.

**Endpoint:** `https://hn-trending-mcp.prakhar-cognizance.workers.dev/mcp`

## Tools

- `hn_top(kind?, limit?)` — current top / best / new / ask / show / job stories
- `hn_search(query, tags?, min_points?, days_ago?)` — full-text + filters
- `hn_show_recent(min_points?, days_ago?)` — Show HN launches above a threshold
- `hn_item(id)` — single story or comment
- `hn_user(handle)` — karma + account age + recent submissions

## Pricing

| Tier | Price | Calls/mo |
|---|---|---|
| Free | $0 | 200 |
| Solo | $9/mo | 3,000 |
| Team | $29/mo | 15,000 |
| Pro | $79/mo | 75,000 |
