// Span-attribute scrubbing (ADR-0117). A conservative key-based deny-list: secrets, `Authorization`,
// cookies, tokens, `*-key` material, and a small PII key set are dropped — not partially masked —
// before a span ever leaves the process. Key-based (not value-based) by design: it cannot tell apart
// a legitimate numeric ID from a sensitive one, but it never lets a header/attribute NAMED like a
// secret slip through, which is the failure mode that matters here.
//
// This is deliberately NOT a re-export of @caisson-sh/kernel's `redactEvent` (ADR-0075): that function
// redacts the `OpsEvent` envelope, a separate operational-telemetry event stream (ADR-0117); this one
// mutates a span's flat `attributes` record in place, which is the shape `SpanProcessor#onEnd` hands
// back. The two paths intentionally never share a write path.
import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
// The incubating entry-point on purpose: it re-exports the stable names AND carries the
// experimental ones (`gen_ai.*`, `session.id`, `mcp.session.id`) that instrumentation actually
// emits today. Its constants are not semver-stable, but only their string VALUES are read here, via
// `Object.entries` — a renamed or removed constant changes the allowlist, never the build.
import * as semconv from "@opentelemetry/semantic-conventions/incubating";

/**
 * The deny-list's term sources, as strings, so the union regex and its two arms below are all
 * DERIVED from one place: a term added or dropped here changes every consumer together, and no
 * hand-synchronised copy exists to drift. (An earlier revision kept three literal copies; a
 * one-term drift between them shipped green because the tests could only see the union.)
 */
const CREDENTIAL_TERMS =
  "secret|token|password|passwd|api[_-]?key|authoriz|bearer|credential|cookie|session|private[_-]?key|access[_-]?key|signing[_-]?key|encryption[_-]?key";
const PII_TERMS =
  "(?<![a-z])ssns?|ssns?(?![a-z])|social[_-]?security|e[_.-]?mail|date[_-]?of[_-]?birth|birth[_-]?date|(?<![a-z])dobs?(?![a-z])|(?<![a-z])mrns?(?![a-z])|medical[_-]?record|phone|first[_-]?name(?![a-z])|last[_-]?name(?![a-z])|full[_-]?name(?![a-z])|(?<![a-z])patient";

/**
 * Span attribute / header KEY deny-list. Matches loosely on purpose — a key that merely LOOKS
 * sensitive is redacted rather than risk a false negative. Extend this list, don't replace it.
 *
 * Anchoring, per term: the long words (`email`, `phone`, `password`, …) are unanchored — no common
 * attribute name contains them by accident, and unanchored is what catches fused/plural/numbered
 * forms (`homephone`, `emails`, `email2`). The SHORT tokens need guards because they hide inside
 * ordinary words: `dob` in `adobe`, `mrn` in `mrna`, `ssn` in `className`/`businessName`/
 * `processName`, `patient` in `outpatient`/`impatient`, `lastName` in `lastNameserver`. Those use
 * `(?<![a-z])` / `(?![a-z])` letter-lookarounds rather than `\b`, because `\b` treats `_` and a
 * case change as NON-boundaries (`user_dob`, `userDob`) while a lookaround sees the space that
 * {@link splitKeyWords} inserts. `ssn` is anchored on ONE side only so `userssn`/`SSNVALUE` still
 * hit while a mid-word `ssN` does not.
 *
 * Deliberately NOT included: `address`. The sibling deep scrubber (`@caisson-sh/kernel` `PHI_KEY`)
 * accepts `ipAddress` over-redaction as fail-safe for compliance-evidence egress; on a span it would
 * drop `net.peer.address` / `server.address` / `client.address` and blind tracing. Value-level
 * scrubbing is the right tool for an address, not a key match.
 *
 * @deprecated for direct `.test()` use — call {@link isSensitiveAttributeKey}, which normalizes the
 * key (NFKC + camelCase/snake_case word split) first. Tested raw, this regex misses `userEmail`,
 * `user_email`, and a fullwidth `ｅmail` (audit finding 19d1af0e70d0c2d7). Export kept for back-compat.
 */
export const SENSITIVE_ATTRIBUTE_KEY = new RegExp(
  `(?:${CREDENTIAL_TERMS}|${PII_TERMS})`,
  "i",
);

/**
 * The deny-list's two arms, derived from the same term sources as the union above. They stay
 * separate because {@link isSensitiveAttributeKey} treats them differently: the PII arm is
 * unconditional; the credential arm yields to an exact OTel semantic-convention name.
 */
const CREDENTIAL_KEY = new RegExp(`(?:${CREDENTIAL_TERMS})`, "i");
const PII_KEY = new RegExp(`(?:${PII_TERMS})`, "i");

/**
 * Every attribute NAME `@opentelemetry/semantic-conventions` exports (stable + incubating, ~890).
 * Read from the package, never hand-copied, so the set follows the pinned version. Exact-match
 * only: template attributes (`http.request.header.<key>`) are exported as functions, not strings,
 * so `http.request.header.authorization` is NOT a member and still redacts.
 */
const SEMCONV_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set(
  Object.entries(semconv as Record<string, unknown>)
    .filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("ATTR_") && typeof entry[1] === "string",
    )
    .map(([, name]) => name),
);

/**
 * Split camelCase/PascalCase runs and `_`/`-` separators into space-delimited words, so the
 * lookaround-guarded deny-list terms above see a real boundary. `userEmail` -> `user Email`,
 * `user_email` -> `user email`, `userDOBValue` -> `user DOB Value`. Deliberately does NOT lowercase
 * (the deny-list is already `/i`) and does NOT strip separators — stripping would re-fuse
 * `user_dob` into `userdob` and lose the boundary this exists to create.
 *
 * Both replaces are linear: single-character groups only. The acronym split MUST stay `([A-Z])`,
 * not `([A-Z]+)` — the greedy form backtracks quadratically on a long all-caps key (~850 ms at 32k
 * chars, attacker-controlled attribute names reach this from any instrumented request).
 */
function splitKeyWords(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]/g, " ");
}

/**
 * The real key predicate: NFKC-normalizes the key (a fullwidth `ｅmail` folds to `email`), then
 * tests the deny-list against BOTH the raw key and its word-split form. Testing both is monotone —
 * it can only ever redact MORE keys than the raw regex alone, never fewer — so it cannot regress an
 * already-redacted key. The raw arm keeps terms whose own optional separator already spans the case
 * change (`api[_-]?key` matches `apiKey` directly, but would NOT match the split form `api Key`);
 * the split arm adds the lookaround-guarded PII terms. Over-redaction is the fail-safe direction
 * here, per this module's stated philosophy.
 *
 * Semantic-convention exemption: the credential terms `token` / `session` /
 * `authoriz` / `password` / `secret` also sit inside 19 real OTel attribute names —
 * `gen_ai.usage.input_tokens`, `session.id`, `mcp.session.id`, `aspnetcore.authorization.policy`,
 * … — none of which carries a credential, so redacting them blanked LLM usage and session
 * correlation on every span. A key that is an EXACT member of {@link SEMCONV_ATTRIBUTE_NAMES}
 * skips the credential arm. It never skips the PII arm: `user.email` and `user.full_name` are
 * semconv names too, and they stay redacted. Anything not an exact member — `Session.Id`, a
 * `session.token` that merely looks conventional, the `http.request.header.authorization`
 * template — goes through both arms as before.
 *
 * Known residual (accepted, no clean regex answer): a 3-letter token fused lowercase in the MIDDLE
 * of a key (`userdob`, `recdob`), and homoglyph / invisible-character spellings (Cyrillic `е`,
 * soft hyphen, ZWJ) that NFKC does not fold — an attacker names attributes only on their own
 * requests, so that bypass exfiltrates their own data. Enumerated in
 * `outputs/audit/2026-08-25-false-close-19d1af0e.md`.
 */
export function isSensitiveAttributeKey(key: string): boolean {
  const normalized = key.normalize("NFKC");
  const split = splitKeyWords(normalized);
  if (PII_KEY.test(normalized) || PII_KEY.test(split)) return true;
  if (SEMCONV_ATTRIBUTE_NAMES.has(normalized)) return false;
  return CREDENTIAL_KEY.test(normalized) || CREDENTIAL_KEY.test(split);
}

/** A value-level backstop: a raw `Authorization: Bearer <token>` string under an unsuspicious key. */
const BEARER_VALUE = /^bearer\s+\S+/i;

/** In-line (non-anchored) form of the same backstop, for raw log-line bodies. */
const BEARER_INLINE = /bearer\s+\S+/gi;

/**
 * Scrub a raw log line before it leaves the process as an OTLP log record: the bearer-token
 * value backstop, applied in-line. Deliberately the same conservative philosophy as
 * `scrubAttributes` — these lines already reach the host's log drain verbatim; this is the
 * export-boundary backstop, not a PII filter.
 */
export function scrubLogLine(line: string): string {
  return line.replace(BEARER_INLINE, "Bearer [REDACTED]");
}

const REDACTED = "[REDACTED]";
const PATH_ID_PLACEHOLDER = ":id";

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The domain part is split at its first dot after the first character, so there is one way to match
// it. `@[^\s@/]+\.[^\s@/]+` accepts the same segments but retries at every dot on a near-miss.
const EMAIL_SEGMENT = /^[^\s@/]+@[^\s@/][^\s@/.]*\.[^\s@/]+$/;
const NUMERIC_SEGMENT = /^\d+$/;
/** Long opaque hex/base64-ish token — a bare id/secret, never a route template segment. */
const TOKEN_SEGMENT = /^[A-Za-z0-9+/_-]{16,}=*$/;

/**
 * True for a path segment that is a dynamic/sensitive value rather than part of a static route
 * template: a UUID, an email, a pure-numeric id, or a long hex/base64-ish token.
 */
function isSensitiveSegment(segment: string): boolean {
  if (segment === "") return false;
  if (UUID_SEGMENT.test(segment)) return true;
  if (EMAIL_SEGMENT.test(segment)) return true;
  if (NUMERIC_SEGMENT.test(segment)) return true;
  // Requires a digit so a long static English route word (e.g. "responsibilities") isn't mistaken
  // for an opaque token; a pure-letter token of 16+ chars would slip through — tighten with an
  // entropy check if that becomes an issue in practice.
  return TOKEN_SEGMENT.test(segment) && /\d/.test(segment);
}

/**
 * Redact a URL pathname's dynamic segments (UUIDs, emails, numeric ids, long hex/base64-ish
 * tokens) with `:id`, leaving static route segments untouched. Pure and side-effect-free — used
 * to keep a request span's name and `http.route` attribute low-cardinality and free of raw
 * client-controlled path data (PII, secrets, arbitrary values) when no route template is known
 * at the call site.
 */
export function scrubPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      isSensitiveSegment(segment) ? PATH_ID_PLACEHOLDER : segment,
    )
    .join("/");
}

/**
 * Redact `attributes` IN PLACE: any key matching {@link isSensitiveAttributeKey}, or any string value
 * shaped like a raw bearer token, is replaced with `"[REDACTED]"`. Mutating in place (rather than
 * returning a copy) is required by the `SpanProcessor#onEnd` seam below — `ReadableSpan.attributes`
 * is the live object the next processor in the chain reads.
 */
export function scrubAttributes(attributes: Record<string, unknown>): void {
  for (const key of Object.keys(attributes)) {
    if (isSensitiveAttributeKey(key)) {
      attributes[key] = REDACTED;
      continue;
    }
    const value = attributes[key];
    if (typeof value === "string" && BEARER_VALUE.test(value)) {
      attributes[key] = REDACTED;
    }
  }
}

/**
 * A `SpanProcessor` decorator: scrubs every span's attributes at `onEnd` — AFTER the span is
 * complete (so every attribute any instrumentation added is visible) but BEFORE it reaches the
 * wrapped processor (so a scrubbed span is the only thing ever batched/exported). `onStart` and
 * `forceFlush`/`shutdown` pass straight through.
 */
export class ScrubbingSpanProcessor implements SpanProcessor {
  readonly #next: SpanProcessor;

  constructor(next: SpanProcessor) {
    this.#next = next;
  }

  onStart(span: Span, parentContext: Context): void {
    this.#next.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    scrubAttributes(span.attributes);
    this.#next.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.#next.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.#next.shutdown();
  }
}
