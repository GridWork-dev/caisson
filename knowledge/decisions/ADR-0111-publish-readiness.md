# ADR-0111 — publish-readiness (private→public flip · open-base→npm / commercial→GH split · changeset gate)

Status: accepted · 2026-06-30 · implements ADR-0069 (publish auth) · ADR-0092 (create-caisson npx) · ADR-0094 (open-core) · Phase P6 (I4)

ADR-0094 split the tree into an open Apache-2.0 Base and a commercial remainder, and W1 (ADR-0097)
landed the licenses + the standards-gate license authority. Every `packages/*` module was still
`private:true` at `0.0.0` — correct pre-publish, but the editions/base are now go-live. This ADR
locks the flip that makes the workspace actually publishable, inside the ADR-0094 envelope.
Append-only; supersede with a later ADR, never edit.

## Decisions

1. **Big-bang flip → public, `0.1.0`, tier-driven `publishConfig`.** Every publishable module (each
   `packages/*` whose `manifest.ts` carries a `tier`) drops `private:true`, moves to `version
0.1.0` (lockstep with the registry ledger, already at `0.1.0`), and gains a `publishConfig`. The
   split is driven off the **manifest `tier` field**, never a name list, so it stays correct as the
   package set grows; a package marking itself private-permanent (or carrying no tier) is skipped.

2. **Registry target — OPERATOR-LOCKED open/commercial split.** The 11 Apache-2.0 / `tier:oss` Base
   packages publish to **public npm** (`publishConfig.access "public"`,
   `registry "https://registry.npmjs.org/"`). The `tier:paid` commercial packages publish to
   **GitHub Packages restricted** (`access "restricted"`, `registry "https://npm.pkg.github.com"`)
   per ADR-0021/0069. This **reopens ADR-0021's single-host lock for the open Base** — ADR-0021
   pinned every module to GitHub Packages; the open-core acquisition premise (ADR-0094) requires the
   Base be `npm install`-able with no auth, so the open eleven now target public npm while the
   commercial remainder keeps the ADR-0021/0069 GH-restricted host. The commercial registry
   **service** (`registry/`, outside `packages/`) stays private — untouched by the flip.

3. **Version single-source-of-truth → `manifest.ts` derives from `package.json`.** Each `manifest.ts`
   now `import pkg from "./package.json"` and passes `version: pkg.version, license: pkg.license`
   instead of literals. The gate's `checkManifestAgreement` compares the two and now passes by
   construction — so a future `changeset version` bump (which edits `package.json` only) can never
   drift the manifest. `defineModule` itself is unchanged (no new fs/`node:fs` reach into
   `@caisson/registry-schema`, which the CF Worker bundles); the derive lives in each manifest, the
   one place the package.json is a sibling.

4. **`create-caisson` npx bin (ADR-0092).** `packages/cli` `bin` repoints `create-caisson →
./dist/cli.js`; a **post-tsc build hook** (`scripts/add-shebang.ts`, mirroring the
   `bundle-migrations.ts` pattern — idempotent, `import.meta.url`-resolved, fail-closed) prepends
   `#!/usr/bin/env node` to the compiled entry, which `tsc` does not emit. `files` ships `dist` +
   the two runtime asset trees the generator reads via `import.meta.url` (`templates`,
   `migrations-bundle`) and **never `src`**; a `.npmignore` is added so the gitignored
   `migrations-bundle` build artifact is not dropped from the tarball (npm/cli#4360 — `.gitignore`
   can otherwise override `files`).

5. **CLI runtime imports → `@caisson/registry-schema` (ADR-0097).** `cli/src/{cli,generate,meter}.ts`
   (+ tests + `manifest.ts`) repoint `@caisson/registry` → the open `@caisson/registry-schema`; every
   symbol the CLI used (`RegistryIndex`, `loadRegistryIndex(FromFile)`, `assertKnownModule/Version`,
   `ModuleManifest`, `defineModule`) lives in the schema. The commercial registry **service**
   dependency is dropped from the CLI entirely — the generator depends only on the open contract.

6. **Changeset presence gate (ADR-0021).** `.changeset/config.json` sets
   `updateInternalDependencies:"patch"` (changesets only accepts `'patch'`/`'minor'` — a boolean
   `false` is a config ValidationError; `'patch'` is the conservative floor, the value ADR-0021's
   "no spurious internal bumps" intent maps to in this changesets version); a single initial
   changeset bumps all publishable packages to
   `0.1.0`; CI's `standards-gate` job runs `changeset status --since=origin/main` (exits 1 on a
   changed package with no changeset), **skipped on `main`** (no base ref; `main` is the merge
   target, not a release-gated PR). The job's checkout gains `fetch-depth: 0` so `origin/main`
   resolves. The actual ledger append + npm publish stays in `publish-and-index` (main-only,
   `CAISSON_PUBLISH_DRY_RUN` default true — operator-gated).

7. **Backfill 7→full set.** The built+tested `registry/scripts/ci-publish-step.ts` (manifest-scan →
   ledger-append → index-rebuild) grew `registry/ledger.jsonl` + `index.json` from the 7 seed modules
   to the full publishable set (27). The index round-trips byte-identically through `build-index.ts`
   and carries no duplicate `id@version`. Nothing is published to npm — this is the committed ledger
   provenance, not a release.

## Deferred / known gaps

- **Pure-`node` ESM execution of the published bin → blocked by the repo-wide extensionless relative
  imports in compiled `dist` (bundler `moduleResolution`).** `node --check dist/cli.js` passes and the
  shebang/pack are correct, but `node dist/cli.js` cannot resolve `@caisson/*` workspace deps under
  strict node ESM. This is the pre-existing P5-deferred **publishability / ESM-extension** fork
  (repo-wide, not CLI-specific); the bin **wiring** is what publish-readiness owns and is complete.
- **Append-only ledger snapshot for `@caisson/cli@0.1.0`.** The CLI's `0.1.0` ledger entry predates
  this PR's `@caisson/registry → @caisson/registry-schema` repoint, so its frozen `dependencies`
  snapshot still lists `@caisson/registry`. Per append-only-by-version discipline (ADR-0006) a
  published version is never rewritten; the corrected graph lands on the next CLI version bump. No
  gate consumes that snapshot (the index allowlist keys on `id@version`).
- **`@caisson/kernel` keeps its `caisson-gate` bin** pointing at `./src/gate.ts` (no `files`
  restriction on the base packages, so `src` ships and the bin resolves) — left as-is; narrowing the
  base packages' published surface is out of I4 scope.
- **Pricing numbers** remain the open operator fork (ADR-0012 anchors; ADR-0082 display) — unchanged.

## Binding

The standards-gate stays the registry ingress + license/tier authority. Any new publishable package
lands its `publishConfig` driven off its manifest `tier` (oss→public npm, paid→GH restricted) and a
changeset in the same PR, or the gate blocks it.
