// Centralize the security-header policy for every Pages Function response (ADR-0046).
// Cloudflare does not apply public/_headers to Function responses, so this middleware mutates
// each response on the way out.
interface MiddlewareContext {
  next: () => Promise<Response>;
}

const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const onRequest = async (
  context: MiddlewareContext,
): Promise<Response> => {
  const res = await context.next();
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
