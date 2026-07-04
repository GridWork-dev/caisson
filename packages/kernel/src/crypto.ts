// Security primitives: constant-time comparison for secrets — never `===`/`==`/`Buffer.compare`.
// Asymmetric (Ed25519 license) verification is NOT here: it uses `crypto.verify`, a different
// discipline (ADR-0010/0015).
import { createHash, timingSafeEqual } from "node:crypto";
import { AuthnError } from "./errors.ts";

/**
 * Constant-time compare for **fixed-length** secrets (session tokens, HMAC outputs, keys of
 * known length). The length check is itself non-secret (a mismatched length means an obviously
 * malformed token); equal-length inputs are compared in constant time.
 */
export function safeEqualFixed(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Constant-time compare for **variable-length** user-supplied values (admin email allowlists,
 * opaque identifiers). Hash both sides to a fixed 32 bytes first — raw variable-length
 * `timingSafeEqual` throws on a length mismatch, leaking a boolean through caught-exception flow.
 * Normalize equivalently on both sides (e.g. trim/lowercase) BEFORE calling.
 */
export function safeEqualVariable(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

/**
 * Constant-time membership test for the variable-length-secret rule (admin-email allowlists,
 * opaque-id allowlists). Is
 * `candidate`, after `normalize`, equal to ANY entry in `allowed`? Every entry is compared with
 * {@link safeEqualVariable} and the results are OR-ed with **no early return on a match**, so the
 * timing does not leak which entry matched or whether one did. `normalize` defaults to
 * trim+lowercase (the email-allowlist case). An empty `allowed` returns `false` — fail closed.
 */
export function verifyAllowlisted(
  candidate: string,
  allowed: readonly string[],
  normalize: (s: string) => string = (s) => s.trim().toLowerCase(),
): boolean {
  const c = normalize(candidate);
  let matched = false;
  for (const entry of allowed) {
    // Intentionally scan every entry — `matched ||= …` short-circuits nothing (the compare always
    // runs); no `break`/early `return` that would make the timing depend on the matching index.
    if (safeEqualVariable(c, normalize(entry))) matched = true;
  }
  return matched;
}

/** The one Bearer scheme this repo accepts on an internal/cron trigger — a fixed, non-secret prefix. */
const BEARER_PREFIX = "Bearer ";

/**
 * Fail-closed bearer auth for an internal / cron HTTP trigger (ADR-0229 row 59). Pulls the token from
 * an `Authorization: Bearer <token>` header and constant-time-compares it (via {@link safeEqualFixed})
 * to `expected`. Throws {@link AuthnError} on ANY of: a blank `expected` (a service booted without its
 * cron secret must NEVER authorize — fail closed), a missing/empty header, a non-Bearer scheme, an
 * empty token, or a mismatch. The thrown message never echoes the token.
 *
 * The single shared gate every background-job HTTP trigger (retention/alerting cron, any future
 * `/internal/*` endpoint) should call, replacing hand-rolled header parsing. mcp-server keeps its own
 * request-scoped extractor (a different, per-tenant auth model) — out of scope here.
 *
 * ponytail: no `packages/*` HTTP trigger ships today (retention runs as a task, not a server), so this
 * stands ready with no live caller. Wire it at the first internal-trigger endpoint's boundary — do not
 * fabricate one.
 */
export function verifyBearer(
  authorizationHeader: string | null | undefined,
  expected: string,
): void {
  // Blank secret first: an unconfigured trigger secret must fail closed, never wave everything through.
  if (expected.length === 0) {
    throw new AuthnError("Internal trigger secret is not configured");
  }
  if (authorizationHeader === null || authorizationHeader === undefined) {
    throw new AuthnError("Missing Authorization header");
  }
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    throw new AuthnError("Authorization header must use the Bearer scheme");
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length);
  // Empty-token and mismatch collapse to ONE message so the response never distinguishes them.
  // `safeEqualFixed` itself length-checks then `timingSafeEqual`s — the fixed-length secret discipline.
  if (token.length === 0 || !safeEqualFixed(token, expected)) {
    throw new AuthnError("Invalid bearer token");
  }
}
