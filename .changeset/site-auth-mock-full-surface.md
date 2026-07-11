---
"@caisson/site": patch
---

Both test-side mocks of `lib/auth-server.ts` now spread the real module and override only
`getAuth`, instead of returning a partial export object. Bun's `mock.module` is process-wide and
never torn down, so a partial factory gutted `createAuth` and `SESSION_HINT_COOKIE_NAME` for every
later-loaded test file — `auth-server.test.ts`'s static import then failed with "Export named not
found" on runners whose file discovery order differs from local (the first main-branch `check`
failure after the runner migration). Test-only change; no product behavior is affected.
