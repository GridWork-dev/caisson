// Retriever client tests: the docs source -> /docs URL mapping, citation dedupe, and the
// fail-to-escalate behavior (non-2xx / unconfigured throws DocsUnavailableError so the route escalates
// rather than answering ungrounded).
import { afterEach, expect, test } from "bun:test";
import {
  DocsUnavailableError,
  type ScoredChunk,
  retrieveChunks,
  sourceToDocUrl,
  toCitations,
} from "./retrieve.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function chunk(source: string): ScoredChunk {
  return {
    id: "id-1",
    source,
    title: "T",
    section: "",
    kind: "docs",
    license: "Apache-2.0",
    text: "body",
    score: 1,
  };
}

test("sourceToDocUrl maps docs-content paths and returns null for non-docs sources", () => {
  expect(sourceToDocUrl("apps/site/content/docs/base/billing.mdx")).toBe(
    "/docs/base/billing",
  );
  expect(sourceToDocUrl("apps/site/content/docs/index.mdx")).toBe("/docs");
  expect(
    sourceToDocUrl("apps/site/content/docs/compliance/hipaa/index.mdx"),
  ).toBe("/docs/compliance/hipaa");
  expect(sourceToDocUrl("packages/billing/README.md")).toBeNull();
});

test("toCitations dedupes sources order-preserving and attaches URLs", () => {
  const cites = toCitations([
    chunk("apps/site/content/docs/base/billing.mdx"),
    chunk("apps/site/content/docs/base/billing.mdx"),
    chunk("packages/billing/README.md"),
  ]);
  expect(cites).toEqual([
    {
      source: "apps/site/content/docs/base/billing.mdx",
      url: "/docs/base/billing",
    },
    { source: "packages/billing/README.md", url: null },
  ]);
});

test("retrieveChunks throws when unconfigured (no ungrounded fallback)", async () => {
  await expect(
    retrieveChunks("q", { url: "", token: "", k: 6 }),
  ).rejects.toBeInstanceOf(DocsUnavailableError);
});

test("retrieveChunks returns validated chunks on 200", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ chunks: [chunk("a.md")] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
  const chunks = await retrieveChunks("q", {
    url: "https://docs.example/query",
    token: "tok",
    k: 6,
  });
  expect(chunks).toHaveLength(1);
  expect(chunks[0]?.source).toBe("a.md");
});

test("retrieveChunks throws DocsUnavailableError on a non-2xx response", async () => {
  globalThis.fetch = (async () =>
    new Response("nope", { status: 500 })) as unknown as typeof fetch;
  await expect(
    retrieveChunks("q", {
      url: "https://docs.example/query",
      token: "tok",
      k: 6,
    }),
  ).rejects.toBeInstanceOf(DocsUnavailableError);
});

test("retrieveChunks throws on a malformed body shape", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ wrong: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
  await expect(
    retrieveChunks("q", {
      url: "https://docs.example/query",
      token: "tok",
      k: 6,
    }),
  ).rejects.toBeInstanceOf(DocsUnavailableError);
});
