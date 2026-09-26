// The site's Content-Security-Policy. The served header lives in public/_headers (a static export
// has no server to emit it); this constant is the readable source the /security page renders, and
// lib/security-headers.test.ts pins public/_headers to it so the two cannot drift. The /demos/*
// zone serves apps/demos' own, stricter policy (pinned from that side by
// apps/demos/lib/security-headers.test.ts).
//
// `frame-src 'self'` is load-bearing (ADR-0400): frame-src does NOT fall back to default-src when
// present, so without it the site would block the same-origin /demos embed its module pages
// render. `'unsafe-inline'` on script/style-src covers Next's inlined hydration bootstrap (no
// per-request nonce under the App Router). The one third-party pair is Cloudflare Web Analytics:
// the beacon script (static.cloudflareinsights.com) and the endpoint it reports to
// (cloudflareinsights.com), loaded by the manual snippet in app/layout.tsx.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "frame-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
].join("; ");
