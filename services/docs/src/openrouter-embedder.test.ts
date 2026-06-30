// openrouter-embedder.test.ts — the live transport is exercised through an INJECTED fetch double, so
// CI never makes a real OpenRouter call (the live path stays the one un-exercised seam, per ADR-0096).
// Covers: request shape, the egress scrub running BEFORE the body leaves, the dim assertion, the
// no-leak error contract, and the empty-key guard.
import { describe, expect, test } from "bun:test";
import {
  createOpenRouterEmbedder,
  OPENROUTER_EMBED_DIM,
  type EmbedFetch,
} from "./openrouter-embedder.ts";

function vec(dim = OPENROUTER_EMBED_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  v[0] = 1;
  return v;
}

interface Captured {
  url?: string;
  headers?: Record<string, string>;
  body?: {
    model?: string;
    input?: string;
    dimensions?: number;
    input_type?: string;
  };
}

/** A fetch double matching `fetchWithTimeout`'s shape; records the request, returns a canned Response. */
function fakeFetch(
  captured: Captured,
  payload: unknown,
  status = 200,
): EmbedFetch {
  const impl = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.url = String(url);
    captured.headers = (init?.headers ?? {}) as Record<string, string>;
    captured.body = init?.body ? JSON.parse(String(init.body)) : undefined;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return impl as unknown as EmbedFetch;
}

describe("OpenRouterEmbedder", () => {
  test("posts the OpenAI-compatible request and returns the vector", async () => {
    const captured: Captured = {};
    const embedder = createOpenRouterEmbedder({
      apiKey: "test-key",
      fetchImpl: fakeFetch(captured, {
        data: [{ embedding: vec(), index: 0, object: "embedding" }],
      }),
    });

    const out = await embedder.embed("hello world");

    expect(out).toHaveLength(OPENROUTER_EMBED_DIM);
    expect(out[0]).toBe(1);
    expect(captured.url).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(captured.headers?.authorization).toBe("Bearer test-key");
    expect(captured.body?.model).toBe("qwen/qwen3-embedding-8b");
    expect(captured.body?.dimensions).toBe(OPENROUTER_EMBED_DIM);
    expect(captured.body?.input).toBe("hello world");
  });

  test("scrubs a credential BEFORE the body egresses (guardEmbedder is structural)", async () => {
    const captured: Captured = {};
    const embedder = createOpenRouterEmbedder({
      apiKey: "test-key",
      fetchImpl: fakeFetch(captured, { data: [{ embedding: vec() }] }),
    });

    await embedder.embed("my token is sk-proj-ABCDEFGHIJKLMNOP01234 thanks");

    expect(captured.body?.input).toContain("[REDACTED]");
    expect(captured.body?.input).not.toContain("sk-proj-ABCDEFGHIJKLMNOP01234");
  });

  test("throws on a wrong-width vector (dim assertion, never corrupts the index)", async () => {
    const captured: Captured = {};
    const embedder = createOpenRouterEmbedder({
      apiKey: "test-key",
      fetchImpl: fakeFetch(captured, { data: [{ embedding: [1, 2, 3] }] }),
    });
    await expect(embedder.embed("x")).rejects.toThrow();
  });

  test("a non-2xx throws without leaking the response body", async () => {
    const captured: Captured = {};
    const embedder = createOpenRouterEmbedder({
      apiKey: "test-key",
      fetchImpl: fakeFetch(
        captured,
        { error: "super-secret-internal-detail" },
        500,
      ),
    });
    await expect(embedder.embed("x")).rejects.toThrow(/request failed/);
    await expect(embedder.embed("x")).rejects.not.toThrow(
      /super-secret-internal-detail/,
    );
  });

  test("an empty apiKey is rejected at construction (fail-closed)", () => {
    expect(() => createOpenRouterEmbedder({ apiKey: "" })).toThrow();
  });
});
