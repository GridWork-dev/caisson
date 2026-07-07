// Clerk session-verification driver (ADR-0287), beside the WorkOS SSO transport (workos.ts). Verifies
// a Clerk session token (JWT v2) against Clerk's JWKS via `@clerk/backend`'s `verifyToken`, then maps
// the verified claims onto the kernel's `SessionContext` shape (`@caisson/auth`).
//
// IMPORTANT (verified against the INSTALLED package's own `dist/index.d.ts`, not the library's
// internal source or its docs page — the two disagree): the top-level `verifyToken` this package
// imports from `@clerk/backend` resolves to `Promise<JwtPayload>` directly, NOT the Result-style
// `{ data } | { errors }` union the SDK's internal `tokens/verify.ts` module and its own docs page
// describe. This entry point THROWS on an invalid/expired/malformed/bad-signature token or a JWKS
// transport failure — confirmed by the installed `.d.ts` return type, cross-checked against the
// published usage example's try/catch. Every failure is caught below and collapsed to one
// `AuthnError` — never leaking which branch failed, matching `@caisson/auth/jwt.ts`'s own convention.
//
// Networkless preferred: pass `jwtKey` (the PEM public key from the Clerk Dashboard) to verify locally
// on every call; `secretKey` alone falls back to a live JWKS fetch against Clerk's Backend API per
// verification. Config is injected — this package never reads `CLERK_*` env itself.
//
// Claim mapping (Clerk session-token JWT v2, 2025-04-14 format — the `o` claim is nested, replacing
// v1's flat `org_id`/`org_role`): `sub` -> userId, `o.id` -> an active Organization's id, `o.rol` ->
// that Organization's Clerk-side role (e.g. "admin"/"member", without the `org:` prefix). This mapping
// is STATELESS — it does not consult Caisson's own `account_member` table. When no Organization is
// active (`o` absent, the common case pre-Organizations-adoption), the session maps onto the
// PERSONAL account convention `@caisson/auth`'s `ensurePersonalAccount` already uses: `accountId ==
// userId`, role `"owner"`. A caller needing the DB-authoritative multi-account/seat resolution should
// route the verified `userId` through `resolveUserAccounts`/`selectActiveAccount` instead of trusting
// this claim-only mapping for authorization decisions — this driver only proves WHO, not which
// Caisson account/role the DB grants them.
import { verifyToken } from "@clerk/backend";
import { AuthnError, ConfigError } from "@caisson/kernel";
import type { Role, SessionContext } from "@caisson/auth";

export interface ClerkSessionConfig {
  /** PEM public key for NETWORKLESS verification (Clerk Dashboard: API keys -> Show JWT public key).
   *  Preferred over `secretKey` — avoids a live call to Clerk's Backend API on every verification. */
  jwtKey?: string;
  /** Clerk Secret Key. Enables verification via a live JWKS fetch when `jwtKey` is not supplied. */
  secretKey?: string;
  /** Allowlist of origins the token's `azp` claim must match — Clerk's own subdomain-cookie-leak
   *  guard, recommended for every production verification. */
  authorizedParties?: string[];
  /** Kernel role assigned when no Clerk Organization is active on the session. Defaults to `"owner"`
   *  — matches `@caisson/auth`'s personal-account convention. */
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
  // and this is the same third-party-claims posture `@caisson/auth/jwt.ts` already takes for its own
  // (self-issued) tokens: `typeof` checks at the boundary, never a trusted cast.
  const raw = payload as unknown as Record<string, unknown>;
  const { sub, sid, o } = raw;
  if (typeof sub !== "string" || typeof sid !== "string") {
    throw new AuthnError("Invalid Clerk session token");
  }
  const org: Record<string, unknown> =
    typeof o === "object" && o !== null ? (o as Record<string, unknown>) : {};
  const organizationId = typeof org.id === "string" ? org.id : undefined;
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
 * present, matching `@caisson/auth`'s personal-account convention (`account_id == user_id`).
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
        : personalAccountRole,
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
