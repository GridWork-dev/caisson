# ADR-0408 — Lane C locks FULL oxc adoption: oxlint and oxfmt replace ESLint and Prettier

- **Date:** 2026-08-15
- **Status:** Accepted (operator lock at the session picker, 2026-08-15) — implementation is a
  dedicated wave AFTER the consolidation wave merges; this ADR is the lock, not the landing
- **Parent:** ADR-0022 (the layered boundary gate the lint layer serves) · ADR-0368 (the tsgo/TS-7
  cutover precedent for toolchain swaps) · the 2026-08-15 Lane C spike (measured in-session
  against the tree at `1964e9da`)

## Context

The Lane C spike answered all six unknowns by measurement: oxlint runs the repo's rule surface
142x faster (13.6s → 96ms) with zero real errors at rule parity; it fixes the `basePath`
silent-false-green class by construction (overrides anchor to the config file, proven with a
two-arm discriminator); the custom `caisson-slop` plugin and `eslint-plugin-storybook` both run
UNMODIFIED via `jsPlugins`; all five in-tree ESLint disable directives suppress correctly under
the ESLint-prefixed ids. The measured risks: `jsPlugins` is alpha, explicitly not semver, and
fails silently; oxfmt is pre-1.0 and would reformat 1,670 files. The session recommendation was a
split lane (oxlint now, oxfmt later); the operator picked full adoption.

## Decision

**Adopt both oxlint and oxfmt, together, in one dedicated wave.** Binding implementation
constraints carried from the spike and the estate lessons:

1. **A silent-failure canary is mandatory before the swap merges:** a known-bad fixture that MUST
   produce a `caisson-slop` finding (and one storybook finding) on every lint run — zero findings
   from the canary fails the gate loudly. This is the pinned mitigation for alpha `jsPlugins`.
2. oxlint config semantics differ: `plugins`/`overrides`/`ignorePatterns` REPLACE rather than
   merge — every config in the chain is authored against that rule.
3. The oxfmt reformat is one dedicated commit, never hand-resolved through a conflict: on any
   reflow conflict, reset, rebase, re-run `oxfmt`, re-commit.
4. The reformat commit patch-bumps effectively every package (changeset-gated), and open branches
   (#430 on HOLD) rebase across it.
5. Byte-exact protected files keep their protection: `// prettier-ignore` spans and the
   `.prettierignore` set were verified honored by the spike; the wave re-verifies on the real
   tree before commit.

## Consequences

- Lint wall-time effectively disappears from `check`; the `basePath` hand-pins in
  `boundaries.js`/`anti-slop.js` become unnecessary and are removed by construction.
- The repo takes a standing dependency on an alpha plugin-compat API with the canary as the
  tripwire; if `jsPlugins` breaks, the fallback is re-running ESLint for the two custom plugins
  only, not reverting the whole swap.
- Prettier and ESLint (and their config packages) leave the dependency graph at the end of the
  wave; the OSS mirror's exported lint surface moves with it in the same wave.
