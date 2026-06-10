import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HnClient } from "../src/hn";
import { McpServer, ToolContext } from "../src/mcp-server";
import { buildTools } from "../src/tools";

class FakeKv {
  store = new Map<string, string>();
  async get(key: string, type?: "text" | "json"): Promise<any> {
    const v = this.store.get(key); if (v === undefined) return null;
    if (type === "json") return JSON.parse(v); return v;
  }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

const env = {
  CACHE: new FakeKv() as unknown as KVNamespace,
  USAGE: new FakeKv() as unknown as KVNamespace,
  HN_FIREBASE: "https://hacker-news.firebaseio.com/v0",
  HN_ALGOLIA: "https://hn.algolia.com/api/v1",
  UPGRADE_URL: "x",
};

beforeEach(() => {
  (env.CACHE as any).store = new Map();
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.endsWith("/topstories.json")) return new Response(JSON.stringify([101, 102, 103]), { status: 200 });
    if (u.endsWith("/showstories.json")) return new Response(JSON.stringify([201, 202]), { status: 200 });
    if (u.match(/\/item\/(\d+)\.json$/)) {
      const id = parseInt(u.match(/item\/(\d+)/)![1], 10);
      return new Response(JSON.stringify({ id, type: "story", title: `Story ${id}`, score: 100 + id, by: "alice", time: 1700000000, url: `https://example.com/${id}` }), { status: 200 });
    }
    if (u.includes("/user/alice.json")) return new Response(JSON.stringify({ id: "alice", karma: 12345, created: 1500000000 }), { status: 200 });
    if (u.includes("/search?")) {
      return new Response(JSON.stringify({ hits: [{ objectID: "888", title: "Show HN: my product", points: 120, author: "alice", _tags: ["show_hn", "story"] }] }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("HnClient.list", () => {
  it("fetches topstories ids + items", async () => {
    const c = new HnClient(env as any);
    const out = await c.list("top", 10);
    expect(out.length).toBe(3);
    expect(out[0].title).toBe("Story 101");
    expect(out[0].score).toBe(201);
  });
  it("kind=show maps to showstories", async () => {
    const c = new HnClient(env as any);
    const out = await c.list("show", 5);
    expect(out.length).toBe(2);
  });
});

describe("HnClient.search", () => {
  it("returns Algolia hits", async () => {
    const c = new HnClient(env as any);
    const out = await c.search({ query: "show hn ai" });
    expect(out.length).toBe(1);
    expect(out[0].objectID).toBe("888");
  });
});

describe("HnClient.recentShowHN", () => {
  it("hits search with tags=show_hn and a points filter", async () => {
    const c = new HnClient(env as any);
    const out = await c.recentShowHN({ min_points: 50, days_ago: 7, limit: 10 });
    expect(out.length).toBe(1);
    expect(out[0]._tags).toContain("show_hn");
  });
});

describe("HnClient.user", () => {
  it("returns user profile", async () => {
    const c = new HnClient(env as any);
    const u = await c.user("alice");
    expect(u?.karma).toBe(12345);
  });
});

describe("MCP protocol", () => {
  const server = new McpServer({ name: "hn-trending-mcp", version: "0.1.0" });
  for (const t of buildTools()) server.register(t);
  const ctx: ToolContext = { env: env as any, apiKey: null, tier: "free", callsRemaining: 200 };

  it("lists all 5 tools (none premium)", async () => {
    const r = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const names = (r!.result as any).tools.map((t: any) => t.name) as string[];
    expect(names).toHaveLength(5);
  });
  it("hn_top end-to-end", async () => {
    const r = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hn_top", arguments: { limit: 3 } } }, ctx);
    const out = JSON.parse((r!.result as any).content[0].text);
    expect(out.count).toBe(3);
  });
});
