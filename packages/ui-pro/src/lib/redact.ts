/**
 * Redaction for PayloadViewer. A domain payload (a webhook body, an OSCAL doc, a stored credential
 * record) is routinely shown to operators, so secret-bearing fields must be masked BEFORE display or
 * copy. This masks any property whose key name matches a redaction set, anywhere in the tree — pure,
 * so both the on-screen tree and the copy-to-clipboard payload mask identically.
 */

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
