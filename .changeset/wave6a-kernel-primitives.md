---
"@caisson/kernel": minor
---

Wave-6a kernel compliance/auth/fail-closed primitives (ADR-0229 rows 8, 10, 44, 54, 59). New exports:
`scrubDeep`/`PHI_KEY` (recursive PHI/secret object scrubber composing `scrubForEgress` — deep
key-name PHI + secret-name subtree drop, leaf credential-span redaction, cycle-guarded, pure,
idempotent, golden-pinned); `contentHash` (lowercase-hex SHA-256 over `canonicalize(value)` — the
single-frozen-claim integrity tag, distinct from the `hashChainLink` 2-tuple); `verifyAllowlisted`
(constant-time allowlist membership over `safeEqualVariable`, no early return, normalized,
fail-closed on an empty allowlist); `assertNotReadOnly`/`SystemMode` (fail-closed read-only-mode
mutation gate reusing `ConflictError`); `verifyBearer` (fail-closed constant-time `Authorization:
Bearer` check via `safeEqualFixed`, refusing a blank secret/header/scheme/token — never echoes the
token).
