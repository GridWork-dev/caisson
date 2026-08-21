// The two pieces of next.config.ts's security floor that carry real logic, extracted so they can
// be tested directly (importing next.config.ts into a test would drag the whole fumadocs MDX
// pipeline along for two pure functions).

/**
 * The one Content-Security-Policy, parameterized by its `frame-ancestors` value — the ONLY
 * directive that differs between this app's own pages (`'none'`: nothing may frame the site) and
 * the ADR-0400 `/demos` prefix (`'self'`: a module page frames its own embed). Built rather than
 * written twice so the two can never drift: the `/demos` header rule RESTATES the whole policy
 * (a later Next header rule replaces a key rather than merging into it), so a directive that
 * differed between the two would be an invisible relaxation.
 *
 * `frame-src` carries `'self'` for the same ADR-0400 reason from the other side: frame-src does
 * NOT fall back to default-src when it is present, so without that entry the site's own policy
 * would block the same-origin embed it is trying to render.
 */
export function contentSecurityPolicy(frameAncestors: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "img-src 'self' data: https://*.paddle.com",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline' https://*.paddle.com",
    "script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com https://challenges.cloudflare.com https://us-assets.i.posthog.com",
    "frame-src 'self' https://*.paddle.com https://challenges.cloudflare.com",
    "connect-src 'self' https://plausible.io https://*.paddle.com https://challenges.cloudflare.com https://us.i.posthog.com https://us-assets.i.posthog.com",
  ].join("; ");
}
