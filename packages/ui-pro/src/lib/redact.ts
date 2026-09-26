// Redaction for PayloadViewer + DiffViewer. The predicate moved to the open Apache base
// (@caisson-sh/kernel/redact) so the proof-bundle endpoint can redact server-side; ui-pro
// re-exports it verbatim, keeping this module's API (and every `../lib/redact` import) stable.
export {
  REDACTED,
  DEFAULT_REDACT_KEYS,
  isRedactedKey,
  redactValue,
} from "@caisson-sh/kernel/redact";
