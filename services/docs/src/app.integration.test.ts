import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import { FakeEmbedder } from "./embedder.ts";
import { DocsIndex } from "./index-store.ts";
import type { DocChunk } from "./types.ts";

const TOKEN = "test-docs-service-token-0123456789";
const CHUNKS: DocChunk[] = [
  {
    id: "billing-webhook",
    source: "apps/site/content/docs/base/billing.mdx",
    title: "Billing",
    section: "Webhooks",
    kind: "docs",
    license: "Apache-2.0",
    text: "Billing webhooks are verified against the raw request body with a timing-safe HMAC compare.",
  },
];

let index: DocsIndex;
let app: (req: Request) => Promise<Response>;

beforeAll(async () => {
  // Hybrid (FakeEmbedder) so the HTTP path exercises the vector leg — natural-language queries resolve.
  index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
  app = createApp({
    index,
    llmsTxt: "# Caisson\n\n> idx\n",
    llmsFull: "# Billing\n",
    token: TOKEN,
  });
});
afterAll(() => index.close());

const post = (body: string, auth?: string): Request =>
  new Request("http://docs.test/query", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth !== undefined ? { authorization: auth } : {}),
    },
    body,
  });

describe("createApp routing", () => {
  test("GET /health → 200 with security headers", async () => {
    const res = await app(new Request("http://docs.test/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  test("GET /llms.txt and /llms-full.txt → public text", async () => {
    const a = await app(new Request("http://docs.test/llms.txt"));
    expect(a.status).toBe(200);
    expect(await a.text()).toBe("# Caisson\n\n> idx\n");
    const b = await app(new Request("http://docs.test/llms-full.txt"));
    expect(b.status).toBe(200);
    expect(await b.text()).toBe("# Billing\n");
  });

  test("POST /query without a Bearer → 401", async () => {
    const res = await app(post(JSON.stringify({ query: "billing" })));
    expect(res.status).toBe(401);
  });

  test("POST /query with a wrong Bearer → 401", async () => {
    const res = await app(
      post(JSON.stringify({ query: "billing" }), "Bearer wrong-token"),
    );
    expect(res.status).toBe(401);
  });

  test("POST /query with the right Bearer → 200 + ranked chunks with citation", async () => {
    const res = await app(
      post(
        JSON.stringify({ query: "how does billing verify webhooks" }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chunks: { id: string; source: string }[];
    };
    expect(body.chunks[0]?.id).toBe("billing-webhook");
    expect(body.chunks[0]?.source).toBe(
      "apps/site/content/docs/base/billing.mdx",
    );
  });

  test("POST /query rejects an oversized query (Zod bound) → 400", async () => {
    const res = await app(
      post(JSON.stringify({ query: "x".repeat(2001) }), `Bearer ${TOKEN}`),
    );
    expect(res.status).toBe(400);
  });

  test("POST /query rejects an unknown field (strict) → 400", async () => {
    const res = await app(
      post(JSON.stringify({ query: "billing", evil: 1 }), `Bearer ${TOKEN}`),
    );
    expect(res.status).toBe(400);
  });

  test("POST /query rejects invalid JSON → 400", async () => {
    const res = await app(post("{not json", `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
  });

  test("unknown path → 404", async () => {
    const res = await app(new Request("http://docs.test/nope"));
    expect(res.status).toBe(404);
  });

  test("wrong method on /query → 405", async () => {
    const res = await app(
      new Request("http://docs.test/query", {
        method: "GET",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(405);
  });
});
