// Session-token hash-at-rest (ADR-0366, Path B — the better-auth adapter wrap). Pure crypto, NO
// better-auth import: this file is base-package code (`@caisson-sh/auth`, Apache-2.0) that any
// caller may import, while the provider-coupled wrap that knows better-auth's query shape stays
// confined to `apps/site/lib/session-adapter.ts` (ADR-0015's boundary).
//
// Design (the 2026-07-19 operator lock, ADR-0366 — simpler than the deferred SPEC's two-derived-
// value pattern): ONE derived value, an HMAC-SHA-256 lookup key, replaces the raw token in the
// EXISTING `session.token` column (already unique-indexed by better-auth) — no schema change, no
// second column. The DB does a plain indexed equality match on the lookup key; there is no
// application-level secret comparison anywhere in this design for `crypto.timingSafeEqual` to
// guard (it would only matter if some other path directly compared two raw token strings, which
// this design has none of).
import { createHmac } from "node:crypto";

/**
 * HMAC-SHA-256 of `rawToken` keyed by `hmacKey`, hex-encoded (64 lowercase hex characters).
 * Deterministic — same inputs always produce the same lookup key, so it doubles as an indexed
 * database lookup value. The key never touches the database: a Postgres dump alone cannot be
 * reversed back into a usable session cookie without `hmacKey`.
 */
export function deriveTokenLookupKey(
  rawToken: string,
  hmacKey: string,
): string {
  return createHmac("sha256", hmacKey).update(rawToken).digest("hex");
}
