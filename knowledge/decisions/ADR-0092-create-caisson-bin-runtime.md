# ADR-0092 — `create-caisson` bin → compiled `dist/cli.js` + Node shebang (npx reach)

Status: accepted · 2026-06-28 (operator lock, picker round — **operator override** of the
research recommendation, which favored keeping the Bun-source bin). Composes on ADR-0044 (Next/Bun
stack), ADR-0021 (publish pipeline), ADR-0090/0091 (cli build steps).

## Context

`@caisson/cli`'s `bin` points at the TypeScript source `./src/cli.ts`
(`packages/cli/package.json:15-17`), matching the `kernel` precedent (`./src/gate.ts`). A `.ts` bin runs
under `bunx create-caisson` but NOT `npx create-caisson` — Node cannot execute `.ts`. The compiled
`dist/cli.js` already emits from the tsc build (7.5K) but has no shebang, so even re-pointing the bin would
fail under npx without one. Caisson is a Bun-first product (root CLAUDE.md: "Bun runtime and PM — never
npm/yarn"), so every buyer is already a Bun user; research recommended keeping the Bun-source bin. The
operator chose the broader path: **also reach the npx audience** (the `create-*` initializer ecosystem is
overwhelmingly `npx`-invoked).

## Decision

**Point `bin` at `./dist/cli.js` and prepend `#!/usr/bin/env node`** to the emitted CLI entry, so
`create-caisson` runs under both `bunx create-caisson` (compiled JS) and `npx create-caisson`. A build step
(tsc emit + shebang injection) runs before publish; `dist/cli.js` becomes the shipped entry.

**Implementation is bundled into the P6 publishability flip, not landed now.** Rationale: `npx
create-caisson` reach only materializes once the package is **published** to npm, and publishability was
deferred to P6/commerce (the publishability fork, same picker round). Adding the shebang + bin re-point in
isolation today delivers nothing runnable (an unpublished package cannot be `npx`'d) while adding a
build-before-use step to a private package. So this ADR records the **decision**; the dist-emit + shebang +
`bin` re-point + the smoke check (`npx create-caisson` against the packed tarball) land together with the
private→public flip at P6.

## Rejected

- **Keep the Bun-source bin (`./src/cli.ts`, bunx-only)** — the research recommendation (matches the kernel
  precedent, no build step, Bun-first identity). Overridden: the operator wants npx reach for the
  initializer's discoverability, accepting the build-before-publish discipline.

## Binding

- The published `@caisson/cli` `bin` is `./dist/cli.js` carrying a `#!/usr/bin/env node` shebang; the
  package builds (tsc emit + shebang) before publish. Works under both `bunx` and `npx create-caisson`.
- Diverges from the `kernel` Bun-source bin convention for the published `create-caisson` initializer
  only; internal package bins are unaffected.
- Implementation lands with the P6 publishability flip (ADR-0021), verified by an `npx create-caisson`
  smoke test against the packed tarball.

Evidence: `packages/cli/package.json:15-17` (bin → `./src/cli.ts`); `packages/kernel/package.json:15-17`
(precedent); `dist/cli.js` exists, no shebang at line 1; publishability deferred to P6 (this picker round).
