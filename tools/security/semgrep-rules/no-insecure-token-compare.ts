// Fixture for no-insecure-token-compare. Excluded from real scans via .semgrepignore.
import crypto from "node:crypto";

export function bad(
  sessionToken: string,
  stored: string,
  signature: string,
  expected: string,
  apiKey: string,
): boolean {
  // ruleid: no-insecure-token-compare
  if (sessionToken === stored) return true;
  // ruleid: no-insecure-token-compare
  if (signature !== expected) return false;
  // ruleid: no-insecure-token-compare
  return apiKey == "a-hardcoded-value";
}

export function good(sessionToken: string, stored: string): boolean {
  const a = Buffer.from(sessionToken, "utf8");
  const b = Buffer.from(stored, "utf8");
  // ok: no-insecure-token-compare
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  // ok: no-insecure-token-compare
  if (sessionToken !== null && sessionToken !== undefined) return false;
  // ok: no-insecure-token-compare
  if (sessionToken.length === 0) return false;
  return false;
}
