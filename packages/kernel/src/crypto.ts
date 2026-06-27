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
