// Hacker News client.
// Two free APIs:
//   - Firebase: https://hacker-news.firebaseio.com/v0/  — canonical, real-time, no auth
//   - Algolia:  https://hn.algolia.com/api/v1/          — full-text search, no auth

import { KvCache, stableKey } from "./cache";

export interface HnEnv {
  CACHE: KVNamespace;
  HN_FIREBASE: string;       // https://hacker-news.firebaseio.com/v0
  HN_ALGOLIA: string;        // https://hn.algolia.com/api/v1
}

export interface HnItem {
  id: number;
  type?: "story" | "comment" | "job" | "poll";
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;       // comment count
  time?: number;              // unix
  text?: string;
  kids?: number[];
}

export interface HnSearchHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
  comment_text?: string;
  _tags?: string[];
}

export class HnClient {
  private cache: KvCache;
  constructor(private env: HnEnv) { this.cache = new KvCache(env.CACHE, "hn"); }

  // ── Trending lists ───────────────────────────────────────────────────────

  async list(kind: "top" | "best" | "new" | "ask" | "show" | "job", limit: number): Promise<HnItem[]> {
    const path = kind === "ask" ? "askstories" : kind === "show" ? "showstories" : kind === "job" ? "jobstories" : `${kind}stories`;
    const ids: number[] = await this.cache.memoize(`list:${kind}`, 60 * 2, async () => {
      const r = await fetch(`${this.env.HN_FIREBASE}/${path}.json`);
      if (!r.ok) throw new Error(`HN ${r.status}`);
      return r.json();
    });
    const head = ids.slice(0, Math.min(limit, 100));
    // Fetch items in parallel, but cap concurrency at 25 to be polite.
    const out: HnItem[] = [];
    for (let i = 0; i < head.length; i += 25) {
      const chunk = head.slice(i, i + 25);
      const items = await Promise.all(chunk.map((id) => this.item(id)));
      out.push(...items.filter(Boolean) as HnItem[]);
    }
    return out;
  }

  async item(id: number): Promise<HnItem | null> {
    return this.cache.memoize(`item:${id}`, 60 * 5, async () => {
      const r = await fetch(`${this.env.HN_FIREBASE}/item/${id}.json`);
      if (!r.ok) return null;
      return r.json();
    });
  }

  // ── Search (full-text via Algolia) ───────────────────────────────────────

  async search(opts: { query: string; tags?: string; min_points?: number; days_ago?: number; limit?: number }): Promise<HnSearchHit[]> {
    const params = new URLSearchParams({ query: opts.query, hitsPerPage: String(Math.min(opts.limit ?? 25, 100)) });
    if (opts.tags) params.set("tags", opts.tags);
    const filters: string[] = [];
    if (typeof opts.min_points === "number") filters.push(`points>=${opts.min_points}`);
    if (typeof opts.days_ago === "number") {
      const cutoff = Math.floor(Date.now() / 1000) - opts.days_ago * 86400;
      filters.push(`created_at_i>${cutoff}`);
    }
    if (filters.length) params.set("numericFilters", filters.join(","));
    const key = `search:${stableKey(opts)}`;
    return this.cache.memoize(key, 60 * 10, async () => {
      const r = await fetch(`${this.env.HN_ALGOLIA}/search?${params}`);
      if (!r.ok) throw new Error(`HN Algolia ${r.status}`);
      const j: any = await r.json();
      return j?.hits ?? [];
    });
  }

  /** "Show HN" launches with at least N points in the last K days — useful for product-launch tracking. */
  async recentShowHN(opts: { min_points?: number; days_ago?: number; limit?: number }): Promise<HnSearchHit[]> {
    return this.search({
      query: "",
      tags: "show_hn",
      min_points: opts.min_points ?? 50,
      days_ago: opts.days_ago ?? 7,
      limit: opts.limit ?? 25,
    });
  }

  async user(handle: string): Promise<{ id: string; created: number; karma: number; about?: string; submitted?: number[] } | null> {
    return this.cache.memoize(`user:${handle.toLowerCase()}`, 60 * 60, async () => {
      const r = await fetch(`${this.env.HN_FIREBASE}/user/${handle}.json`);
      if (!r.ok) return null;
      return r.json();
    });
  }
}
