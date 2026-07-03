// src/scrub-deep.ts — the deep/recursive object scrubber (ADR-0229 row 8, SOC2/HIPAA
// compliance-evidence egress). `scrubForEgress` (./secret-scrub.ts) scrubs credential SPANS inside
// ONE string. Structured evidence — an error object, a telemetry record, a captured event —
// egresses as a nested object, and its PHI/PII risk is carried in KEY NAMES (`patient_email`,
// `firstName`) as much as in leaf values. `scrubDeep` composes the string scrubber over every leaf
// AND drops any subtree whose key names a PHI/PII field or a secret.
//
// Pure + zero-dep, kept here alongside the string scrubber — distinct from observability's flat,
// in-place, OTel-span-shaped `scrubAttributes` (which this does NOT churn, SPEC §Out). Lives in a
// sibling file (not appended to `secret-scrub.ts`) because the host's write-guard hard-blocks any
// filename containing "secret"; the golden the SPEC named (`__golden__/scrub-deep.json`) already
// matches this file's stem.
import { scrubForEgress } from "./secret-scrub.ts";

/** The single redaction sentinel a redacted subtree collapses to (mirrors secret-scrub's, constant). */
const REDACTION = "[REDACTED]";
/** A revisited node in a cyclic input collapses here so the recursion terminates (never hangs). */
const CIRCULAR = "[CIRCULAR]";

/**
 * Case-insensitive substring set of PHI/PII key names, tested against a SEPARATOR-STRIPPED,
 * lowercased key so snake_case and camelCase both hit (`date_of_birth` and `dateOfBirth` both
 * normalize to `dateofbirth`). Deliberately conservative — over-redaction (`ipAddress` caught by
 * `address`) is the fail-safe direction for a compliance-evidence egress scrub. Owned here as the
 * reusable set, unifying observability's `SENSITIVE_ATTRIBUTE_KEY` intent. `dob`/`mrn` are word-
 * anchored (against the normalized key) so they don't fire on incidental substrings.
 */
export const PHI_KEY =
  /email|ssn|socialsecurity|dateofbirth|birthdate|(?<![a-z])dob(?![a-z])|phone|firstname|lastname|fullname|address|(?<![a-z])mrn(?![a-z])|patient/i;

// ponytail: forced duplicate of secret-scrub's private SECRET_NAME set — that file is unreachable
// to edit (host write-guard hard-blocks the "secret"-in-filename) so it can't export the constant.
// Unify (export SECRET_NAME from secret-scrub, import here) once the guard is relaxed. Both copies
// are golden-pinned, so drift shows up as a failing fixture.
const SECRET_KEY_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

/** Strip `_`/`-`/whitespace and lowercase so snake_case, camelCase, and kebab keys normalize alike. */
function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

/** A key whose NAME alone means its whole subtree must drop (a PHI/PII field or a secret name). */
function isRedactedKey(key: string): boolean {
  const norm = normalizeKey(key);
  return PHI_KEY.test(norm) || SECRET_KEY_NAME.test(norm);
}

/**
 * Recursively redact a JSON-ish value for egress. A key whose NAME matches {@link PHI_KEY} or the
 * secret-name set drops its whole subtree to `"[REDACTED]"`; every surviving string leaf is run
 * through {@link scrubForEgress} (credential spans). Arrays keep order; a cycle collapses to
 * `"[CIRCULAR]"` (never hangs). Pure, deterministic, idempotent, and returns a NEW value — the input
 * is never mutated (unlike observability's in-place span pass).
 */
export function scrubDeep(value: unknown): unknown {
  return scrubNode(value, new WeakSet<object>());
}

function scrubNode(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return scrubForEgress(value);
  // number / boolean / null / undefined / bigint / symbol / function — nothing to redact by name.
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return CIRCULAR;
  seen.add(value);
  const out = Array.isArray(value)
    ? value.map((item) => scrubNode(item, seen))
    : Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          isRedactedKey(k) ? REDACTION : scrubNode(v, seen),
        ]),
      );
  // Release after the subtree finishes: a shared (non-cyclic) node reached by two sibling paths is
  // scrubbed each time, not falsely flagged CIRCULAR — only a true ancestor-cycle stays "seen".
  seen.delete(value);
  return out;
}
