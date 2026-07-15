---
"@caisson/ai-kit": patch
---

Fold the last two non-catalog typescript pins back to `catalog:` (root devDependency at ^5.6.3 and
apps/ai-kit at ^5.7.3) — the root pin was silently hoisting tsc 5.9.3 over the 6.0.3 catalog,
making the bridge a mixed-version illusion. Also dates the bunfig minimumReleaseAgeExcludes for
the AI SDK v7 family (adopted 2026-07-10 by PR #234; remove after 2026-07-17) — exact names only,
scope globs don't work in bun 1.3.14.
