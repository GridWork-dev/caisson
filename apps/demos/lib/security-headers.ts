// This app's Content-Security-Policy. The static export has no server, so the header itself ships
// from the /demos/* block of apps/site/public/_headers; the test beside this file pins that block to
// this constant.
//
// WHY THIS ONE STRING CARRIES MORE WEIGHT THAN ITS SIZE SUGGESTS: this app is served at
// caisson.sh/demos/* (ADR-0400), same origin as the site, so a document served here has script
// authority over caisson.sh. A future loosening of `script-src` or `connect-src` here would be an
// origin-level change to the site, made from a file that does not look like it touches the site at
// all. Hence the test beside this file.

/**
 * The embed surface's CSP. Two directives are load-bearing and pinned by the test:
 *
 * - `frame-ancestors 'self'` — NOT 'none'. A same-origin iframe is still an iframe, and 'none'
 *   blocks the parent page too. 'self' is evaluated against the DOCUMENT's origin, so the ancestor
 *   must be caisson.sh. Nobody else can frame it.
 * - `connect-src 'self'` — every poke prints "Runs entirely in your browser. Nothing leaves this
 *   page." This is that sentence enforced by the browser rather than asserted by the copy. (It
 *   bounds third-party exfiltration, not same-origin reach: 'self' IS caisson.sh. The site/demos
 *   line is a build boundary, not a security boundary.)
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
