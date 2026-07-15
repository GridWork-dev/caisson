// Pure, node-free redaction predicate. Moved from ui-pro's presentation layer into
// the open Apache base so the proof-bundle endpoint can redact SERVER-SIDE — masking secret-bearing
// fields BEFORE the payload crosses the wire (H3), never leaving the original for a client to read
// out of the network response, the copied receipt, or the exported pack. It imports no node builtin,
// so the browser PayloadViewer (which re-exports from here) and the offline standalone verifier can
// name the same redaction semantics. `apps/admin` deps @caisson/kernel but not @caisson/ui-pro, so
// the kernel home keeps the endpoint's redaction dependency-clean and aligns with the open-core split.

/** The masking sentinel shown/copied in place of a redacted value. */
export const REDACTED = "[redacted]";

/** A conservative default set of secret-bearing key names (compared case-insensitively). */
export const DEFAULT_REDACT_KEYS: ReadonlySet<string> = new Set([
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
]);

/** True when `key` should be redacted (case-insensitive match against `keys`). */
export function isRedactedKey(key: string, keys: ReadonlySet<string>): boolean {
  return keys.has(key.toLowerCase());
}

/**
 * Deep-clone `value`, replacing any object property whose key is in `keys` with {@link REDACTED}.
 * Non-redacted branches are cloned as-is. Arrays are walked element-wise (indices are never keys, so
 * an array element is only redacted when it is itself an object with a redacted property). Cycles are
 * not expected in serialized payloads and are not handled.
 */
export function redactValue(
  value: unknown,
  keys: ReadonlySet<string>,
): unknown {
  if (Array.isArray(value)) return value.map((v) => redactValue(v, keys));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isRedactedKey(k, keys) ? REDACTED : redactValue(v, keys);
    }
    return out;
  }
  return value;
}
