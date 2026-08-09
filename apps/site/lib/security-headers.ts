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

/**
 * The multi-zone demo service origin (ADR-0400), or `null` for the fail-safe state.
 *
 * UNSET IS THE FAIL-SAFE STATE, and it is deliberate: the `caisson-demos` Railway service is
 * created by the operator, not by this repo, so this app must build and serve exactly as it did
 * before the split whenever the variable is absent — no rewrite, no `/demos` route at all, and the
 * module pages fall back to their non-interactive state on their own (components/poke-embed.tsx).
 * That is what makes the split mergeable before the service exists, and what makes arming the
 * rewrite afterwards a one-variable act.
 *
 * A SET-BUT-INVALID value THROWS rather than falling back. Degrading silently to "no demos" on a
 * typo would be indistinguishable from the intended unset state — the operator would arm the
 * variable, see the fallback text, and have nothing pointing at the cause.
 *
 * http is accepted alongside https because Railway's private network (`*.railway.internal`) is
 * plain http by design and is the better target here: service-to-service traffic that never leaves
 * the project. What the scheme check is really for is refusing a non-network scheme.
 *
 * The returned value has any trailing slashes stripped, so composing it with a `/demos/...` path
 * can never produce a doubled separator.
 */
export function demosOriginUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `DEMOS_ORIGIN_URL is not a valid URL: ${JSON.stringify(value)} — expected e.g. http://caisson-demos.railway.internal:3040`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `DEMOS_ORIGIN_URL must be an http(s) URL, got ${parsed.protocol}`,
    );
  }
  return value.replace(/\/+$/, "");
}
