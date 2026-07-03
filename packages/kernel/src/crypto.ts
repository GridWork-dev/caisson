// Security primitives (ADR-0002 + the gridwork-core security floor). Constant-time comparison
// for secrets — never `===`/`==`/`Buffer.compare`. Asymmetric (Ed25519 license) verification is
// NOT here: it uses `crypto.verify`, a different discipline (ADR-0010/0015).
import { createHash, timingSafeEqual } from "node:crypto";

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
 * Constant-time membership test (ADR-0229 row 44) — the named wrapper the gridwork-core security
 * floor's variable-length-secret rule points at (admin-email allowlists, opaque-id allowlists). Is
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
