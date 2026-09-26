// Clerk session-verification driver (ADR-0287), beside the WorkOS SSO transport (workos.ts). Verifies
// a Clerk session token (JWT v2) against Clerk's JWKS via `@clerk/backend`'s `verifyToken`, then maps
// the verified claims onto the kernel's `SessionContext` shape (`@caisson-sh/auth`).
//
// IMPORTANT (verified against the INSTALLED package's own `dist/index.d.ts`, not the library's
// internal source or its docs page — the two disagree): the top-level `verifyToken` this package
// imports from `@clerk/backend` resolves to `Promise<JwtPayload>` directly, NOT the Result-style
// `{ data } | { errors }` union the SDK's internal `tokens/verify.ts` module and its own docs page
// describe. This entry point THROWS on an invalid/expired/malformed/bad-signature token or a JWKS
// transport failure — confirmed by the installed `.d.ts` return type, cross-checked against the
// published usage example's try/catch. Every failure is caught below and collapsed to one
// `AuthnError` — never leaking which branch failed, matching `@caisson-sh/auth/jwt.ts`'s own convention.
//
// Networkless preferred: pass `jwtKey` (the PEM public key from the Clerk Dashboard) to verify locally
// on every call; `secretKey` alone falls back to a live JWKS fetch against Clerk's Backend API per
// verification — that live fetch's `iss` validation and its own request timeout are BOTH SDK-owned
// (`@clerk/backend` internals), not re-implemented here; the networkless `jwtKey` path is preferred
// specifically because it removes that per-call network dependency entirely. Config is injected —
// this package never reads `CLERK_*` env itself.
//
// Claim mapping (Clerk session-token JWT v2, 2025-04-14 format — the `o` claim is nested, replacing
// v1's flat `org_id`/`org_role`): `sub` -> userId, `o.id` -> an active Organization's id, `o.rol` ->
// that Organization's Clerk-side role (e.g. "admin"/"member", without the `org:` prefix). This mapping
// is STATELESS — it does not consult Caisson's own `account_member` table. When no Organization is
// active (`o` absent, the common case pre-Organizations-adoption), the session maps onto the
// PERSONAL account convention `@caisson-sh/auth`'s `ensurePersonalAccount` already uses: `accountId ==
// userId`, role `"owner"`. A caller needing the DB-authoritative multi-account/seat resolution should
// route the verified `userId` through `resolveUserAccounts`/`selectActiveAccount` instead of trusting
// this claim-only mapping for authorization decisions — this driver only proves WHO, not which
// Caisson account/role the DB grants them.
import { verifyToken } from "@clerk/backend";
import { AuthnError, ConfigError } from "@caisson-sh/kernel";
import type { Role, SessionContext } from "@caisson-sh/auth";

export interface ClerkSessionConfig {
  /** PEM public key for NETWORKLESS verification (Clerk Dashboard: API keys -> Show JWT public key).
   *  Preferred over `secretKey` — avoids a live call to Clerk's Backend API on every verification. */
  jwtKey?: string;
  /** Clerk Secret Key. Enables verification via a live JWKS fetch when `jwtKey` is not supplied. */
  secretKey?: string;
  /** Allowlist of origins the token's `azp` claim must match — Clerk's own subdomain-cookie-leak
   *  guard. Optional at the type level (the SDK allows an unset check), but the caller — not this
   *  package — owns the deployment's origin list, so PRODUCTION deployments SHOULD set this; an
   *  unset `authorizedParties` accepts a valid token minted for any frontend on the Clerk instance. */
  authorizedParties?: string[];
  /** Kernel role assigned when no Clerk Organization is active on the session. Defaults to `"owner"`
   *  — matches `@caisson-sh/auth`'s personal-account convention. */
  personalAccountRole?: Role;
}

/** The verified identity + org signal this driver extracts from a Clerk session token. */
export interface ClerkSessionClaims {
  userId: string;
  sessionId: string;
  /** Present only when a Clerk Organization is active on this session (JWT v2 `o.id`). */
  organizationId?: string;
  /** That Organization's Clerk-side role (JWT v2 `o.rol`) — Clerk's own vocabulary, not the kernel's
   *  owner|seat `Role`. See `mapOrganizationRole` for the boundary mapping. */
  organizationRole?: string;
}

/** Clerk's default Organization roles map onto the kernel's two-value `Role`: Clerk's "admin" ->
 *  kernel "owner" (full management rights); any other role (e.g. "member") -> kernel "seat". */
function mapOrganizationRole(clerkRole: string): Role {
  return clerkRole === "admin" ? "owner" : "seat";
}

function assertConfigured(config: ClerkSessionConfig, fnName: string): void {
  if (
    (config.jwtKey === undefined || config.jwtKey.length === 0) &&
    (config.secretKey === undefined || config.secretKey.length === 0)
  ) {
    throw new ConfigError(`${fnName} requires \`jwtKey\` or \`secretKey\``);
  }
}

/**
 * Verify a Clerk session token against Clerk's JWKS and extract the claims this driver maps. Throws
 * `AuthnError` on a malformed/expired/invalid-signature token OR a JWKS transport failure — never
 * returns a partial/fabricated identity, and never leaks which branch failed (matching `jwt.ts`).
 */
export async function verifyClerkSessionClaims(
  token: string,
  config: ClerkSessionConfig,
): Promise<ClerkSessionClaims> {
  assertConfigured(config, "verifyClerkSessionClaims");

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, {
      ...(config.jwtKey !== undefined ? { jwtKey: config.jwtKey } : {}),
      ...(config.secretKey !== undefined
        ? { secretKey: config.secretKey }
        : {}),
      ...(config.authorizedParties !== undefined
        ? { authorizedParties: config.authorizedParties }
        : {}),
    });
  } catch {
    // Covers every failure mode this entry point signals by throwing: an invalid/expired/
    // bad-signature token, and a genuine transport failure (the JWKS fetch under `secretKey`).
    // Collapsed to one AuthnError — the caller never learns which branch failed.
    throw new AuthnError("Invalid Clerk session token");
  }
  // Read claims defensively rather than trusting the SDK's advertised `JwtPayload` shape — the
  // installed `@clerk/backend` resolves its `o` (Organization) claim's nested type as an
  // under-specified `{}` here (a version/module-resolution quirk of the SDK's own type packages),
  // and this is the same third-party-claims posture `@caisson-sh/auth/jwt.ts` already takes for its own
  // (self-issued) tokens: `typeof` checks at the boundary, never a trusted cast.
  const raw = payload as unknown as Record<string, unknown>;
  const { sub, sid, o } = raw;
  // Non-empty, not just present: an empty-string sub/sid is a malformed identity, not a valid
  // (if unusual) one — reject it the same way a missing field is rejected, rather than letting
  // "" become a real userId/sessionId downstream.
  if (
    typeof sub !== "string" ||
    sub.length === 0 ||
    typeof sid !== "string" ||
    sid.length === 0
  ) {
    throw new AuthnError("Invalid Clerk session token");
  }
  const org: Record<string, unknown> =
    typeof o === "object" && o !== null ? (o as Record<string, unknown>) : {};
  // An empty-string o.id is treated as "no Organization claim" (same as it being absent) rather
  // than surfaced as a real organizationId — an empty accountId must never reach the mapper below
  // (and, downstream, RLS).
  const organizationId =
    typeof org.id === "string" && org.id.length > 0 ? org.id : undefined;
  const organizationRole = typeof org.rol === "string" ? org.rol : undefined;
  return {
    userId: sub,
    sessionId: sid,
    ...(organizationId !== undefined ? { organizationId } : {}),
    ...(organizationRole !== undefined ? { organizationRole } : {}),
  };
}

/**
 * Pure claims -> kernel `SessionContext` mapper — the testable seam (mirrors `ses.ts`'s
 * `sesSmtpConfig`). `accountId` falls back to the Clerk `userId` when no Organization claim is
 * present, matching `@caisson-sh/auth`'s personal-account convention (`account_id == user_id`).
 *
 * Two DIFFERENT branches, two different missing-role postures — do not unify them:
 *  - Personal account (no `organizationId`): the caller genuinely owns their own account, so
 *    `personalAccountRole` (default `"owner"`) is correct there — there is no "member" to
 *    under-privilege.
 *  - Active Organization with NO role claim: this must fail to LEAST privilege (`"seat"`), never
 *    `personalAccountRole`. `personalAccountRole` defaults to `"owner"`, and an org account is a
 *    SHARED tenant — silently granting owner-level (full admin/RLS) rights to every member whose
 *    token happens to omit `o.rol` (e.g. an adopter's custom Clerk session-token JWT template that
 *    reshapes `o` without a role field) is a privilege-escalation bug, not a convenience default.
 *    Matches `mapOrganizationRole`'s own "anything not admin -> seat" posture, and
 *    `@caisson-sh/auth/jwt.ts`'s requirement that `role` be explicit for a shared account, never
 *    defaulted.
 */
export function clerkClaimsToSessionContext(
  claims: ClerkSessionClaims,
  personalAccountRole: Role = "owner",
): SessionContext {
  if (claims.organizationId === undefined) {
    return {
      userId: claims.userId,
      accountId: claims.userId,
      role: personalAccountRole,
    };
  }
  return {
    userId: claims.userId,
    accountId: claims.organizationId,
    role:
      claims.organizationRole !== undefined
        ? mapOrganizationRole(claims.organizationRole)
        : "seat",
  };
}

/** The composed driver: verify + map in one call — the seam callers depend on. */
export interface ClerkSessionVerifier {
  verifySession(token: string): Promise<SessionContext>;
}

/**
 * The Clerk `ClerkSessionVerifier` driver. Fails CLOSED at construction (`ConfigError`) when neither
 * `jwtKey` nor `secretKey` is supplied, matching `createWorkosSsoProvider`'s convention.
 */
export function createClerkSessionVerifier(
  config: ClerkSessionConfig,
): ClerkSessionVerifier {
  assertConfigured(config, "createClerkSessionVerifier");
  const personalAccountRole = config.personalAccountRole ?? "owner";
  return {
    async verifySession(token: string): Promise<SessionContext> {
      const claims = await verifyClerkSessionClaims(token, config);
      return clerkClaimsToSessionContext(claims, personalAccountRole);
    },
  };
}
