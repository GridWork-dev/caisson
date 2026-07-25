// Deterministic client-side mirror of @caisson/guardrails (ADR-0063) for the "guardrails" poke
// (ADR-0378 lock 2, kimi flagship F4 "The boundary"). Every export below is a faithful, standalone
// port of the package's pure logic — nothing here fetches, persists, measures, or uses Date.now /
// Math.random in a rendered-output path.
//
// Why mirrored instead of imported: `pii.ts` imports `node:crypto` (`createHash`) and
// `@caisson/field-crypto` (itself node:crypto-backed) at module scope; `guard.ts` and `moderator.ts`
// import `@caisson/kernel`, whose barrel `index.ts` also re-exports `crypto.ts` / `audit-chain.ts` /
// `migration-assembly.ts` (node:crypto) and `gate.ts` / `ssrf.ts` (node:fs / node:dns/promises).
// Neither package exposes a subpath export around those files (see both `package.json` `exports`
// maps), so none of it resolves in a browser bundle. The one substitution WebCrypto forces: SHA-256
// via `crypto.subtle.digest` instead of node:crypto's synchronous `createHash` — `hashPii` is
// therefore async where the package's own `redactPii(text, "hash")` is sync. Everything else
// (detection, masking, tokenize-placeholder shape, the secret-shape gate, the guard order) is a
// line-for-line port. Parity is golden-pinned in `guardrails-logic.test.ts` against the real
// package (imported by relative path — apps/site does not declare `@caisson/guardrails` as a
// dependency) and against `packages/guardrails/src/__golden__/pii-redact.json`.

// ---- PII engine (packages/guardrails/src/pii.ts) -----------------------------------------------

export const PII_KINDS = ["email", "ssn", "credit_card", "phone"] as const;
export type PiiKind = (typeof PII_KINDS)[number];

/** The AAD-bound column identity the package's tokenizer seals under (pii.ts). Rendered, never run. */
export const PII_COLUMN_CONTEXT = "guardrails.pii";

export type RedactMode = "mask" | "hash";
export type PiiMode = RedactMode | "tokenize";

export interface PiiMatch {
  readonly kind: PiiKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

/** Luhn check over the digits of a candidate card number (13-19 digits). Verbatim: pii.ts. */
function luhnValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

interface Detector {
  readonly kind: PiiKind;
  readonly re: RegExp;
  readonly validate?: (value: string) => boolean;
}

// Verbatim: pii.ts `DETECTORS`. Order is informational only — overlaps resolve deterministically.
const DETECTORS: readonly Detector[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  },
  {
    kind: "credit_card",
    re: /\d(?:[ -]?\d){12,18}/g,
    validate: luhnValid,
  },
];

/**
 * Verbatim algorithm: pii.ts `detectPii`. Deterministic overlap resolution (earliest start wins,
 * ties by longest span, then by kind name) — the same input always produces the same spans.
 */
export function detectPii(text: string): PiiMatch[] {
  const all: PiiMatch[] = [];
  for (const det of DETECTORS) {
    for (const m of text.matchAll(det.re)) {
      if (m.index === undefined) continue;
      const value = m[0];
      if (det.validate !== undefined && !det.validate(value)) continue;
      all.push({
        kind: det.kind,
        value,
        start: m.index,
        end: m.index + value.length,
      });
    }
  }
  all.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - b.start - (a.end - a.start) ||
      a.kind.localeCompare(b.kind),
  );
  const resolved: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start >= lastEnd) {
      resolved.push(m);
      lastEnd = m.end;
    }
  }
  return resolved;
}

/** Verbatim: pii.ts `rewrite`. */
function rewrite(
  text: string,
  matches: readonly PiiMatch[],
  replace: (m: PiiMatch) => string,
): string {
  let out = "";
  let last = 0;
  for (const m of matches) {
    out += text.slice(last, m.start) + replace(m);
    last = m.end;
  }
  return out + text.slice(last);
}

/** `mask` mode — mirrors pii.ts `redactPii(text, "mask")`. Sync: no hashing involved. */
export function maskPii(
  text: string,
  matches: readonly PiiMatch[] = detectPii(text),
): string {
  return rewrite(text, matches, (m) => `[${m.kind.toUpperCase()}]`);
}

/** SHA-256 hex via WebCrypto — the browser-safe stand-in for pii.ts's node:crypto `sha256Hex`. */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * `hash` mode — mirrors pii.ts `redactPii(text, "hash")` (`[KIND:<12-hex>]`, stable per value).
 * Async only because WebCrypto's `digest` is promise-based; the package's own function is sync.
 */
export async function hashPii(
  text: string,
  matches: readonly PiiMatch[] = detectPii(text),
): Promise<string> {
  const digests = await Promise.all(matches.map((m) => sha256Hex(m.value)));
  let out = "";
  let last = 0;
  matches.forEach((m, i) => {
    out +=
      text.slice(last, m.start) +
      `[${m.kind.toUpperCase()}:${digests[i]!.slice(0, 12)}]`;
    last = m.end;
  });
  return out + text.slice(last);
}

export interface TokenPreview {
  readonly placeholder: string;
  readonly kind: PiiKind;
}

/**
 * `tokenize` mode preview — mirrors pii.ts `tokenizePii`'s placeholder generation
 * (`[[PII:<kind>:<index>]]`) exactly (golden-pinned against the real function in the test). It does
 * NOT run field-crypto `sealField` — that is real AES-256-GCM sealing, covered by this poke's F1
 * sibling (field-crypto). The `sealed` envelope the package attaches per token is left off rather
 * than faked, so nothing rendered here claims to be ciphertext it is not.
 */
export function tokenizePreview(
  text: string,
  matches: readonly PiiMatch[] = detectPii(text),
): { redacted: string; tokens: TokenPreview[] } {
  const tokens: TokenPreview[] = [];
  let i = 0;
  const redacted = rewrite(text, matches, (m) => {
    const placeholder = `[[PII:${m.kind}:${i}]]`;
    tokens.push({ placeholder, kind: m.kind });
    i += 1;
    return placeholder;
  });
  return { redacted, tokens };
}

// ---- Credential-shape gate (packages/kernel/src/secret-scrub.ts) -------------------------------
// guard.ts's moderate() runs this unconditionally (ADR-0215) before either leg reaches the
// moderator. secret-scrub.ts itself has zero imports, but reaching it means importing
// "@caisson/kernel", whose barrel also re-exports the node-only modules described above — so it is
// mirrored here rather than imported, for the same bundling reason as the PII engine.

const REDACTION = "[REDACTED]";
const PEM_PRIVATE_KEY =
  /-----BEGIN [^\n-]*PRIVATE KEY-----[\s\S]*?-----END [^\n-]*PRIVATE KEY-----/g;
const URL_USERINFO_PASSWORD = /([a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:)[^/@\s]+(@)/gi;
const SECRET_ASSIGNMENT =
  /\b([A-Za-z][A-Za-z0-9_-]*)([ \t]*=[ \t]*|:[ \t]+)(\S[^\n]*)/g;
const SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;
const INLINE_TOKENS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function scrubForEgress(text: string): string {
  let out = text.replace(PEM_PRIVATE_KEY, REDACTION);
  out = out.replace(URL_USERINFO_PASSWORD, `$1${REDACTION}$2`);
  out = out.replace(SECRET_ASSIGNMENT, (match, key: string, sep: string) =>
    SECRET_NAME.test(key) ? `${key}${sep}${REDACTION}` : match,
  );
  for (const re of INLINE_TOKENS) out = out.replace(re, REDACTION);
  return out;
}

/** Verbatim: kernel `secret-scrub.ts` `looksLikeSecret`. */
export function looksLikeSecret(text: string): boolean {
  return scrubForEgress(text) !== text;
}

// ---- The guard (packages/guardrails/src/guard.ts + moderator.ts) -------------------------------

/** Verbatim: moderator.ts `GuardCategory`. */
export type GuardCategory =
  "moderation" | "pii" | "injection" | "secret" | "custom";
/** Verbatim: guard.ts's stage parameter. */
export type GuardStage = "input" | "output";

/** Mirrors kernel `errors.ts` `GuardrailError` — 422, metadata-only `details`. */
export interface GuardrailErrorLike {
  readonly code: "guardrail_blocked";
  readonly httpStatus: 422;
  readonly message: string;
  readonly details: {
    readonly stage: GuardStage;
    readonly category: GuardCategory;
  };
}

function guardrailError(
  stage: GuardStage,
  category: GuardCategory,
): GuardrailErrorLike {
  return {
    code: "guardrail_blocked",
    httpStatus: 422,
    message: "Request blocked by a guardrail",
    details: { stage, category },
  };
}

/** The event name guard.ts's `emitBlock` fires on every block, over the kernel `EventSink`. */
export const GUARDRAIL_BLOCKED_EVENT = "guardrail.blocked";

/**
 * A sample `forge.config` policy `moderator.blocklist` (moderator.ts `ModeratorPolicy.blocklist`) —
 * illustrative phrases, not a shipped default. Labeled as a sample in the UI.
 */
export const SAMPLE_BLOCKLIST: readonly string[] = [
  "ignore (all|previous) instructions",
  "reveal (your|the) system prompt",
];

/** Mirrors moderator.ts `localModerator` — the zero-network `local` driver always flags "moderation". */
function localModerate(text: string, blocklist: readonly string[]): boolean {
  return blocklist.some((src) => new RegExp(src, "i").test(text));
}

export type GuardVerdict =
  | { readonly outcome: "pass" }
  | {
      readonly outcome: "blocked";
      readonly stage: GuardStage;
      readonly category: GuardCategory;
      readonly failClosed: boolean;
      readonly error: GuardrailErrorLike;
    };

/**
 * Mirrors guard.ts's `moderate()` order exactly: the unconditional secret gate runs first
 * (ADR-0215, no opt-out — always `failClosed: false`), then the configured moderator under a
 * deadline. An outage/timeout fails closed (`failClosed: true`) unless the policy sets `failOpen` —
 * this demo never does, matching the ADR-0063 default. `cheapDeny` (a caller-supplied policy field)
 * is out of scope for this poke. PII redaction (the `guardInput`-only step) is applied separately
 * by the caller after a `"pass"` on `stage === "input"` — `guardOutput` never touches PII.
 */
export function evaluateGuard(
  text: string,
  stage: GuardStage,
  opts: { readonly outageOn: boolean },
): GuardVerdict {
  if (looksLikeSecret(text)) {
    return {
      outcome: "blocked",
      stage,
      category: "secret",
      failClosed: false,
      error: guardrailError(stage, "secret"),
    };
  }
  if (opts.outageOn) {
    return {
      outcome: "blocked",
      stage,
      category: "moderation",
      failClosed: true,
      error: guardrailError(stage, "moderation"),
    };
  }
  if (localModerate(text, SAMPLE_BLOCKLIST)) {
    return {
      outcome: "blocked",
      stage,
      category: "moderation",
      failClosed: false,
      error: guardrailError(stage, "moderation"),
    };
  }
  return { outcome: "pass" };
}
