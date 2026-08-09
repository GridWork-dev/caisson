// This app's Content-Security-Policy, extracted from next.config.ts so a test can pin it.
//
// WHY THIS ONE STRING CARRIES MORE WEIGHT THAN ITS SIZE SUGGESTS: apps/site proxies this app at
// caisson.sh/demos/* (ADR-0400), and Next does NOT apply the proxying app's configured headers to
// an externally-rewritten response. So once the rewrite is armed, THIS policy is the only CSP
// standing between caisson.sh's origin and whatever this image serves — and same-origin means a
// document served here has script authority over caisson.sh, including the authenticated
// dashboard. A future loosening of `script-src` or `connect-src` here would be an origin-level
// change to the site, made from a file that does not look like it touches the site at all.
//
// Hence the test beside this file. apps/site's policy got the same treatment in the same PR
// (apps/site/lib/security-headers.ts); this is that discipline applied to the side that actually
// governs the framed document.

/**
 * The embed surface's CSP. Two directives are load-bearing and pinned by the test:
 *
 * - `frame-ancestors 'self'` — NOT 'none'. A same-origin iframe is still an iframe, and 'none'
 *   blocks the parent page too. 'self' is evaluated against the DOCUMENT's origin, so proxied
 *   through apps/site the ancestor must be caisson.sh, and hit directly on a Railway URL the
 *   ancestor must be that host. Nobody else can frame either one.
 * - `connect-src 'self'` — every poke prints "Runs entirely in your browser. Nothing leaves this
 *   page." This is that sentence enforced by the browser rather than asserted by the copy. (It
 *   bounds third-party exfiltration, not same-origin reach: under the rewrite 'self' IS
 *   caisson.sh. The site/demos line is a deploy boundary, not a security boundary.)
 *
 * `frame-src` is deliberately absent — it falls back to `default-src 'self'`, and this app frames
 * nothing. `'unsafe-inline'` on script-src covers Next's hydration bootstrap (no per-request nonce
 * under App Router) and the no-flash theme script in app/layout.tsx.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join("; ");
