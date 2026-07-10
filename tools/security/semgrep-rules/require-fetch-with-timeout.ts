// Fixture for require-fetch-with-timeout. Excluded from real scans via .semgrepignore.
declare function fetchWithTimeout(
  u: string,
  i: object,
  o: object,
): Promise<Response>;

export async function bad(url: string): Promise<void> {
  // ruleid: require-fetch-with-timeout
  await fetch(url);
  // ruleid: require-fetch-with-timeout
  await fetch("https://api.example.com", { method: "POST" });
}

export async function good(url: string): Promise<void> {
  // ok: require-fetch-with-timeout
  await fetchWithTimeout(url, {}, { timeoutMs: 5000 });
}

// A Cloudflare Worker / Bun.serve entrypoint — `fetch` here is a METHOD DEFINITION, not
// an outbound call, and must NOT be flagged.
export default {
  // ok: require-fetch-with-timeout
  async fetch(request: Request, env: unknown): Promise<Response> {
    return new Response("ok");
  },
};
