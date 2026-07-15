---
"@caisson/cli": patch
---

Generated-project templates now declare their own type surface: explicit `types` in both template
tsconfigs (base: bun; next: bun + node) and an `@types/bun` devDependency. TS 6.0 exposed a latent
template bug — the shipped `golden.test.ts` imports `bun:test`, which only ever type-checked
because the monorepo's own hoisted @types leaked into the composition exit-gate; a buyer's fresh
install had no such luck. Golden filesets re-blessed accordingly.
