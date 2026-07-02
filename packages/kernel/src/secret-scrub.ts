// src/secret-scrub.ts — the shared credential-shape scrub predicate (ADR-0209, moved from
// `local-store/src/egress-guard.ts` where it was originally introduced for the T8 cloud-egress
// guard, ADR-0067). Lives in `kernel` — the lowest-license, zero-dep home both `local-store`
// (cloud-egress) and `guardrails` (the `guard.ts` cheap pre-screen) already depend on — so the
// predicate has exactly ONE implementation instead of a second/third re-derivation per consumer.
//
// Scrub contract (golden-pinned at `local-store/src/__golden__/scrub.json`, applied in this fixed
// order, each secret span collapsing to the constant sentinel `[REDACTED]` — no entropy is ever
// echoed):
//   A. PEM private-key block  → the whole armored block to the sentinel.
//   B. URL userinfo password  (`scheme://user:pass@host`) → `scheme://user:[REDACTED]@host`.
//   C. Secret-NAMED assignment(`<key><=|: ><value>`, key in the secret-name set) → drop the value.
//   D. Bare inline token shape (AWS / GitHub / OpenAI / JWT, no key=value context) → the sentinel.
// Non-secret text passes through unchanged (no false-positive redaction).
/** The single redaction sentinel every secret span collapses to (constant — never leaks entropy). */
const REDACTION = "[REDACTED]";

// A — any armored "... PRIVATE KEY ..." block (RSA/EC/OPENSSH/PGP) collapses whole.
const PEM_PRIVATE_KEY =
  /-----BEGIN [^\n-]*PRIVATE KEY-----[\s\S]*?-----END [^\n-]*PRIVATE KEY-----/g;

// B — URL userinfo: drop ONLY the password, keep the scheme, username, and host/port/path.
const URL_USERINFO_PASSWORD = /([a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:)[^/@\s]+(@)/gi;

// C — a `<key><sep><value>` assignment whose KEY names a secret; the whole value is dropped, the key
// and its exact separator (`=` or `: `) are preserved. `value` runs to end-of-line (single line).
const SECRET_ASSIGNMENT =
  /\b([A-Za-z][A-Za-z0-9_-]*)([ \t]*=[ \t]*|:[ \t]+)(\S[^\n]*)/g;
// Case-insensitive substring set of secret-bearing key names (ADR-0067 scrub contract).
const SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

// D — bare inline token shapes with no key=value context (the fallback once A–C have run).
const INLINE_TOKENS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access-key id
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // GitHub fine-grained PAT
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub classic token (ghp_/gho_/ghu_/ghs_/ghr_)
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, // OpenAI secret key
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // JWT (header.payload.signature)
];

/**
 * Scrub credential-bearing spans from `text` before it egresses (a cloud embedder call, a guarded
 * gateway request/response leg). Pure + deterministic (no clock/randomness/env) and idempotent —
 * re-scrubbing already-scrubbed text is a no-op. The exact input→output table is pinned by the
 * `scrub` golden (`local-store/src/__golden__/scrub.json`) so the contract cannot drift.
 */
export function scrubForEgress(text: string): string {
  let out = text.replace(PEM_PRIVATE_KEY, REDACTION);
  out = out.replace(URL_USERINFO_PASSWORD, `$1${REDACTION}$2`);
  out = out.replace(SECRET_ASSIGNMENT, (match, key: string, sep: string) =>
    SECRET_NAME.test(key) ? `${key}${sep}${REDACTION}` : match,
  );
  for (const re of INLINE_TOKENS) out = out.replace(re, REDACTION);
  return out;
}

/**
 * `true` when `text` carries a span the egress scrub would redact — a predicate a caller can use to
 * refuse or flag content before it ever reaches a backend (the `guard.ts` `"secret"` GuardCategory,
 * the `local-store` cloud-egress guard).
 */
export function looksLikeSecret(text: string): boolean {
  return scrubForEgress(text) !== text;
}
