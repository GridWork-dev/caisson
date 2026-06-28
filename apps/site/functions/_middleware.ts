// Centralize the security-header policy for every Pages Function response (ADR-0046).
// Cloudflare does not apply public/_headers to Function responses, so this middleware mutates
// each response on the way out.
interface MiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// Pre-launch privacy: the public `*.pages.dev` origin (production + preview deployments) is NOT
// behind Cloudflare Access — a self-hosted Access app can only cover hostnames inside the zone, so
// `caisson-site.pages.dev` cannot be gated at the edge (CF error 12130). The canonical, Access-gated
// surface is the proxied apex; every pages.dev hit is bounced there so the only reachable copy of the
// site is the gated custom domain. A 302 (not 301) keeps this uncached so it lifts cleanly at go-live
// when the Access gate is removed (infra/terraform/access.tf).
const CANONICAL_HOST = "caisson.sh";

export const onRequest = async (
  context: MiddlewareContext,
): Promise<Response> => {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return Response.redirect(url.toString(), 302);
  }
  const res = await context.next();
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
