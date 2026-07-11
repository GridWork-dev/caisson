---
"@caisson/site": patch
---

Make `lib/auth.test.ts` deterministic under any test-file load order. It now declares its own
`./auth-server.ts` mock so `getAuth()` returns null (the "sign-in runtime unavailable" state it
asserts), instead of relying on the real `getAuth()` reading unset env. Bun's `mock.module` is
process-wide and never torn down, so the sibling `auth-account.test.ts` (which mocks the same
module to a fixed signed-in session) leaked into this file whenever Bun loaded it first, and file
discovery order is not stable across machines. That surfaced as a `check`-job failure when the CI
runner changed. Test-only change; no product behavior is affected.
