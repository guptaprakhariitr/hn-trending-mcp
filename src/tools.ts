import { Tool } from "./mcp-server";
import { HnClient, HnEnv } from "./hn";

export function buildTools(): Tool[] {
  return [
    {
      name: "hn_top",
      description:
        "Current Hacker News front-page stories. `kind` can be 'top' (default), 'best', 'new', 'ask' (Ask HN), 'show' (Show HN), or 'job'. Returns up to 100 items.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["top", "best", "new", "ask", "show", "job"], default: "top" },
          limit: { type: "integer", default: 30, minimum: 1, maximum: 100 },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const c = new HnClient(ctx.env as unknown as HnEnv);
        const items = await c.list((args.kind ?? "top") as any, args.limit ?? 30);
        return { count: items.length, items };
      },
    },

    {
      name: "hn_search",
      description:
        "Full-text search across all HN stories + comments (via Algolia). Filter by `tags` ('story', 'comment', 'show_hn', 'ask_hn'), `min_points`, and `days_ago`.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          tags: { type: "string", description: "Comma-separated. Common: 'story', 'show_hn', 'ask_hn'." },
          min_points: { type: "integer" },
          days_ago: { type: "integer" },
          limit: { type: "integer", default: 25, minimum: 1, maximum: 100 },
        },
        required: ["query"],
      },
      handler: async (args, ctx) => {
        const c = new HnClient(ctx.env as unknown as HnEnv);
        const hits = await c.search({
          query: args.query, tags: args.tags, min_points: args.min_points,
          days_ago: args.days_ago, limit: args.limit ?? 25,
        });
        return { count: hits.length, hits };
      },
    },

    {
      name: "hn_show_recent",
      description:
        "Recent Show HN launches with at least N points in the last K days. Useful for tracking new product launches in the indie/AI ecosystem.",
      inputSchema: {
        type: "object",
        properties: {
          min_points: { type: "integer", default: 50, minimum: 1 },
          days_ago: { type: "integer", default: 7, minimum: 1, maximum: 90 },
          limit: { type: "integer", default: 25, minimum: 1, maximum: 100 },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const c = new HnClient(ctx.env as unknown as HnEnv);
        const hits = await c.recentShowHN({ min_points: args.min_points, days_ago: args.days_ago, limit: args.limit });
        return { count: hits.length, hits };
      },
    },

    {
      name: "hn_item",
      description: "Fetch a single HN item by id (story or comment).",
      inputSchema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
      handler: async (args, ctx) => {
        const c = new HnClient(ctx.env as unknown as HnEnv);
        const out = await c.item(args.id);
        return out ?? { error: "Not found" };
      },
    },

    {
      name: "hn_user",
      description: "HN user profile: karma, account age, recent submissions.",
      inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
      handler: async (args, ctx) => {
        const c = new HnClient(ctx.env as unknown as HnEnv);
        const u = await c.user(args.handle);
        return u ?? { error: "Not found" };
      },
    },
  ];
}
