---
"@caisson/cli": patch
"@caisson/ds-manifest": patch
---

Fix the public mirror's CI, which failed `bun test` on every sync since the registry-index
bundler test was added: `bundle-registry-index.test.ts` reads the repo-root `registry/index.json`
ledger, absent-by-design from the mirror, and is now excluded (same class as the existing
`entitlement-expansion.test.ts` exclusion). Also fixes two bugs the mirror's new lint/test gate
surfaced along the way: `generate.test.ts`'s edition-auto-expand describe block loaded the same
absent registry ledger at describe-definition time (now `describe.skipIf`-gated + lazy in
`beforeAll`, matching the `advisory-lock.integration.test.ts` precedent — zero behavior change in
the private repo, where the file is always present); and `ds-manifest`'s doctor tool
(`UI_IMPORT_RE` / `PKG_UI_DEP_RE`) hardcoded the `@caisson/ui` npm specifier, so the shipped
`@caisson-sh/ds-manifest` could never detect a hallucinated-component import against the public
`@caisson-sh/ui` package a real mirror buyer would install — both regexes now accept an optional
`-sh` scope (strict widening, no behavior change for real `@caisson/ui` commercial usage).

The mirror's exporter (`scripts/export-public-mirror.ts`, not itself a published package) also
gained: a lint + format-check CI leg; a root `eslint.config.js` + `.prettierignore` shipped into
the mirror; an export-time `prettier --write` pass so the npm scope rename's length change can
never desync the mirror from its own format-check; and a fix to `sanitizeSourceComments`'s naive
regex, which previously misread a `/* */`-lookalike sequence inside a string literal (a
comment-injection test fixture) as a real comment span and silently corrupted real code caught in
the false span — it is now string/template-literal-aware.
