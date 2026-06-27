import { afterAll, describe, expect, test } from "bun:test";
import { fetchWithTimeout } from "./fetch.ts";

// Loopback server (not external) — exercises the AbortController timeout path deterministically.
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/slow") {
      await Bun.sleep(200);
      return new Response("slow");
    }
    return new Response("fast");
  },
});
const base = `http://localhost:${server.port}`;

afterAll(() => {
  server.stop(true);
});

describe("fetchWithTimeout", () => {
  test("resolves a fast response within the budget", async () => {
    const res = await fetchWithTimeout(`${base}/fast`, {}, { timeoutMs: 1000 });
    expect(await res.text()).toBe("fast");
  });

  test("aborts when the budget is exceeded", async () => {
    await expect(
      fetchWithTimeout(`${base}/slow`, {}, { timeoutMs: 20 }),
    ).rejects.toThrow();
  });
});
