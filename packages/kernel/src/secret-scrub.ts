// src/secret-scrub.ts — the shared credential-shape scrub predicate (ADR-0215, moved from
// `local-store/src/embed-scrub-guard.ts` where it was originally introduced for the T8 cloud-embed
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

// Every rule below scans a long run of ordinary characters once. A single pattern that can start at
// many positions inside one run, and reads to the end of the run from each, takes quadratic time on
// text as plain as a long base64 string. So each rule makes one attempt per run, and the patterns
// repeat single character classes only: a repeated group keeps state per repetition, which on a
// run of a few megabytes makes one engine give up without a match and another throw. The scrub test
// compares the result with the one-pattern forms on generated text.

// A — any armored "... PRIVATE KEY ..." block (RSA/EC/OPENSSH/PGP) collapses whole. The header and
// the footer are two patterns walked by `scrubPemBlocks`: one lazy `header[\s\S]*?footer` pattern
// rescans to the end of the text from every header that has no footer after it.
const PEM_HEADER = /-----BEGIN [^\n-]*PRIVATE KEY-----/g;
const PEM_FOOTER = /-----END [^\n-]*PRIVATE KEY-----/g;

function scrubPemBlocks(text: string): string {
  let out = "";
  let pos = 0;
  for (;;) {
    PEM_HEADER.lastIndex = pos;
    const header = PEM_HEADER.exec(text);
    if (header === null) break;
    PEM_FOOTER.lastIndex = header.index + header[0].length;
    const footer = PEM_FOOTER.exec(text);
    // No footer after this header means none after any later header either.
    if (footer === null) break;
    out += text.slice(pos, header.index) + REDACTION;
    pos = footer.index + footer[0].length;
  }
  return out + text.slice(pos);
}

// B — URL userinfo: drop ONLY the password, keep the scheme, username, and host/port/path. A scheme
// is the tail of a run of scheme characters, from any letter in it, so the run needs one letter;
// leading digits and punctuation are skipped.
const URL_USERINFO_PASSWORD =
  /(?<![a-z0-9+.-])([0-9+.-]*[a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:)[^/@\s]+(@)/gi;

// C — a `<key><sep><value>` assignment whose KEY names a secret; the whole value is dropped, the key
// and its exact separator (`=` or `: `) are preserved. `value` runs to end-of-line (single line).
// The key is the tail of a run of key characters, from the first letter at the run's start or after
// a dash, so every candidate key in one run ends at the same place and one attempt settles the run.
const KEY_RUN = /[A-Za-z0-9_-]+/g;
const KEY_START = /(?:^|-)[A-Za-z]/;
const ASSIGNMENT_TAIL = /([ \t]*=[ \t]*|:[ \t]+)\S[^\n]*/y;
// Case-insensitive substring set of secret-bearing key names (ADR-0067 scrub contract).
const SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

function scrubSecretAssignments(text: string): string {
  let out = "";
  let pos = 0;
  KEY_RUN.lastIndex = 0;
  for (let run = KEY_RUN.exec(text); run !== null; run = KEY_RUN.exec(text)) {
    const runEnd = run.index + run[0].length;
    ASSIGNMENT_TAIL.lastIndex = runEnd;
    const tail = ASSIGNMENT_TAIL.exec(text);
    if (tail === null) continue;
    const start = KEY_START.exec(run[0]);
    if (start === null) continue;
    const key = run[0].slice(start.index + start[0].length - 1);
    const end = runEnd + tail[0].length;
    if (SECRET_NAME.test(key)) {
      out += `${text.slice(pos, runEnd)}${tail[1] ?? ""}${REDACTION}`;
      pos = end;
    }
    // Secret-named or not, the assignment's value ran to the end of the line.
    KEY_RUN.lastIndex = end;
  }
  return out + text.slice(pos);
}

// D — bare inline token shapes with no key=value context (the fallback once A–C have run).
const INLINE_TOKENS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access-key id
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // GitHub fine-grained PAT
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub classic token (ghp_/gho_/ghu_/ghs_/ghr_)
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, // OpenAI secret key
];
// JWT (header.payload.signature), tried at each `eyJ` that follows a word boundary. Every `eyJ` in
// one run of token characters reads to the same end, so a failed attempt skips the rest of the run.
const JWT_AT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/y;
const TOKEN_RUN_REST = /[A-Za-z0-9_-]*/y;
const WORD_CHAR = /\w/;

function scrubJwts(text: string): string {
  let out = "";
  let pos = 0;
  let from = 0;
  for (;;) {
    const at = text.indexOf("eyJ", from);
    if (at === -1) break;
    from = at + 3;
    if (at > 0 && WORD_CHAR.test(text[at - 1] ?? "")) continue;
    JWT_AT.lastIndex = at;
    const token = JWT_AT.exec(text);
    if (token === null) {
      TOKEN_RUN_REST.lastIndex = from;
      TOKEN_RUN_REST.exec(text);
      from = TOKEN_RUN_REST.lastIndex;
      continue;
    }
    out += text.slice(pos, at) + REDACTION;
    pos = at + token[0].length;
    from = pos;
  }
  return out + text.slice(pos);
}

/**
 * Scrub credential-bearing spans from `text` before it egresses (a cloud embedder call, a guarded
 * gateway request/response leg). Pure + deterministic (no clock/randomness/env) and idempotent —
 * re-scrubbing already-scrubbed text is a no-op. The exact input→output table is pinned by the
 * `scrub` golden (`local-store/src/__golden__/scrub.json`) so the contract cannot drift.
 */
export function scrubForEgress(text: string): string {
  let out = scrubPemBlocks(text);
  out = out.replace(URL_USERINFO_PASSWORD, `$1${REDACTION}$2`);
  out = scrubSecretAssignments(out);
  for (const re of INLINE_TOKENS) out = out.replace(re, REDACTION);
  return scrubJwts(out);
}

/**
 * `true` when `text` carries a span the egress scrub would redact — a predicate a caller can use to
 * refuse or flag content before it ever reaches a backend (the `guard.ts` `"secret"` GuardCategory,
 * the `local-store` cloud-egress guard).
 */
export function looksLikeSecret(text: string): boolean {
  return scrubForEgress(text) !== text;
}
