// Cloudflare Access JWT verification (Strix vuln-0003; supersedes the CF-Access-edge-ALONE posture of
// ADR-0140). apps/admin renders cross-tenant business data (admin-read.ts: SET LOCAL ROLE admin, RLS
// `TO admin USING (true)`), and its only auth was the Cloudflare Access EDGE gate. The raw Railway grey
// origin (`*.up.railway.app`) is committed and reachable DIRECTLY, bypassing the edge — so the middleware
// (see ../middleware.ts) adds a fail-closed IN-APP check: every request must carry a valid
// `Cf-Access-Jwt-Assertion` signed by the admin Access application's JWKS, with the `aud` claim pinned to
// THIS app. The site + admin Access apps share one `@gridwork.dev` email policy, so a signature-only
// check would accept a site-issued JWT — the `aud` pin is load-bearing, not optional.
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AccessConfig {
  /** The Cloudflare Access team domain, e.g. `gridwork.cloudflareaccess.com` (the JWKS + issuer root). */
  readonly teamDomain: string;
  /** The admin Access application's AUD tag — pins the token to THIS app, not the shared site gate. */
  readonly aud: string;
}

/** Read the CF Access config from env, or null when unconfigured (both vars required). */
export function accessConfig(
  env: Record<string, string | undefined> = process.env,
): AccessConfig | null {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.CF_ACCESS_AUD?.trim();
  if (
    teamDomain === undefined ||
    teamDomain === "" ||
    aud === undefined ||
    aud === ""
  ) {
    return null;
  }
  return { teamDomain, aud };
}

const HEADER = "cf-access-jwt-assertion";
const COOKIE = "CF_Authorization";

/** Extract the Access JWT from the request — the header Cloudflare injects, then the CF_Authorization
 * cookie fallback. Returns null when neither is present. */
export function extractAccessToken(req: Request): string | null {
  const header = req.headers.get(HEADER)?.trim();
  if (header !== undefined && header !== "") return header;
  const cookie = req.headers.get("cookie");
  if (cookie !== null) {
    for (const part of cookie.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name === COOKIE) {
        const value = part.slice(eq + 1).trim();
        if (value !== "") return value;
      }
    }
  }
  return null;
}

// Per-team-domain cached JWKS. `createRemoteJWKSet` caches keys and refreshes on an unknown `kid`
// (with a cooldown), so this makes at most one network fetch per key-rotation, not one per request.
type KeyResolver = Parameters<typeof jwtVerify>[1];
const jwksByDomain = new Map<string, KeyResolver>();
function jwksFor(teamDomain: string): KeyResolver {
  let jwks = jwksByDomain.get(teamDomain);
  if (jwks === undefined) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    );
    jwksByDomain.set(teamDomain, jwks);
  }
  return jwks;
}

/** The verified Cloudflare Access identity — the `email` claim is the operator audit actor (ADR-0220). */
export interface AccessIdentity {
  readonly email: string;
}

/**
 * Verify a Cloudflare Access JWT against the team's JWKS, pinning issuer + audience and requiring RS256,
 * and RETURN the verified `email` claim (ADR-0220 — the audit actor; ADR-0204's verify was actor-blind).
 * `keyResolver` defaults to the cached remote JWKS; tests inject a local key. Throws on ANY failure —
 * bad signature, wrong `aud`/`iss`, expired, OR a missing/blank `email` claim — so the caller fails
 * closed to a 403 (an unattributable admin session must never reach a write). A JWKS fetch error
 * likewise throws (the request is denied, never allowed through on an unreachable JWKS).
 */
export async function verifyAccessJwt(
  token: string,
  cfg: AccessConfig,
  keyResolver: KeyResolver = jwksFor(cfg.teamDomain),
  options: Parameters<typeof jwtVerify>[2] = {},
): Promise<AccessIdentity> {
  // `options` is spread FIRST so the security-critical pins (issuer / audience / RS256) can never be
  // overridden by a caller — it only supplies extras like `currentDate` (used by tests for a
  // deterministic clock) or `clockTolerance`.
  const { payload } = await jwtVerify(token, keyResolver, {
    ...options,
    issuer: `https://${cfg.teamDomain}`,
    audience: cfg.aud,
    algorithms: ["RS256"],
  });
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (email === "") {
    // Fail closed: the CF-Access identity carries no email (misconfigured IdP claim mapping) — a
    // write with no attributable actor defeats the audit trail, so deny rather than log "unknown".
    throw new Error("CF Access token is missing the email identity claim");
  }
  return { email };
}
