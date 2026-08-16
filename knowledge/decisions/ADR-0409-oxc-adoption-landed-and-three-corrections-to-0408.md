# ADR-0409 — The oxc adoption landed: what shipped, and three corrections to ADR-0408

- **Date:** 2026-08-16
- **Status:** Accepted (implementation of the ADR-0408 lock)
- **Parent:** ADR-0408 (the lock) · ADR-0022 (the layered boundary gate) · ADR-0002 (the one
  standards gate) · ADR-0101 (the anti-slop rule this wave had to keep alive)

## Context

ADR-0408 locked FULL oxc adoption and deferred implementation to a dedicated wave. This is that
wave. Everything the lock's five constraints demanded was done; three of the lock's _factual_
claims did not survive contact with the real tree. ADRs are append-only, so the corrections land
here rather than as edits to 0408.

## What shipped

- **oxlint 1.78.0 replaces ESLint 10** at rule parity. One root `.oxlintrc.json` replaces
  `@caisson/eslint-config` plus **72** per-package `eslint.config.js` files. Repo-wide run:
  **15s → under 1s**, 0 errors, 2 warnings (see correction 3).
- **oxfmt 0.63.0 replaces Prettier 3** — one dedicated reformat commit, as constraint 3 required,
  never hand-resolved. It touched **74 files, not the ~1,670 the spike predicted** — see correction 4.
- `tooling/eslint-config` → **`tooling/lint-policy`** (`@caisson/lint-policy`). The package no
  longer holds config; it holds the `boundary-policy.cjs` data source and the `caisson-slop`
  plugin. A package named `eslint-config` in a repo with no ESLint is exactly the doc-drift this
  repo gates against.
- **The canary** (`tooling/scripts/lint-canary.ts`) asserts three enforcement lanes each still
  produce a finding: the provider-SDK boundary, the local jsPlugin, and the npm jsPlugin. It is a
  CI step of its own. It also **replaces** the deleted ESLint-driven `boundaries.test.ts`, so the
  ADR-0011/0022 Gate-2 negative test survives the swap.
- The **OSS mirror** moved with it (constraint from 0408's consequences): it ships
  `.oxlintrc.json` instead of `eslint.config.js`, its CI lints and formats through oxc, and the
  export reformats the tree with oxfmt.
- The **generator templates** moved too — see "Scope call" below.

## Corrections to ADR-0408

**1. Prettier and ESLint do NOT leave the dependency graph.** 0408's consequences say they do.
What actually left: both as _direct_ devDependencies (removed from the root and from all 69
workspaces), both config packages, and **every invocation** — no ESLint or Prettier binary runs in
any gate, hook, script, or workflow. What remains, and cannot be removed by this wave:

- `eslint@10` survives as a transitive **peer** of `@typescript-eslint/utils`, which is a
  dependency of `eslint-plugin-storybook` — the very plugin 0408 mandates we keep running through
  `jsPlugins`. Removing it means dropping the storybook rules.
- `prettier@3` survives as an **optional peer of `storybook` itself**, a `@caisson/ui` devDep.
  Nothing to do with formatting.

Neither is reachable from a gate. The honest claim is "no ESLint or Prettier _runs_ here", not
"they are gone". Separately, `oxfmt` vendors its own prettier build internally (`dist/prettier-*.js`)
for the Prettier-delegated languages, Markdown among them — so Markdown formatting still runs
through Prettier code, just not through a Prettier we depend on.

**2. The in-tree disable-directive count is 14, not 5.** 0408 (quoting the spike) says "all five
in-tree ESLint disable directives suppress correctly". There are 14, across 14 files, and all 14
suppress correctly under the ESLint-prefixed rule ids exactly as written. Verified by mutation
rather than by reading: stripping every directive takes the repo-wide finding count from 2 to 21,
and restoring them returns it to 2.

**3. Rule parity needed five explicit `off`s, and leaves two warnings that ESLint never emitted.**
oxlint's `jsx-a11y` plugin carries **36** rules where `eslint-plugin-jsx-a11y`'s _recommended_ set
— what the ESLint config ramped to `warn` on 2026-07-13 — carries **31**. The extra five
(`anchor-ambiguous-text`, `control-has-associated-label`, `lang`, `no-aria-hidden-on-focusable`,
`prefer-tag-over-role`) are set to `"off"` rather than omitted, because `categories.correctness`
would otherwise turn them on **at error severity** and widen a gate this wave promised to hold
flat. Turning them on is a separate decision, not a side effect of a toolchain swap.

Two warnings survive that ESLint did not emit, both `no-noninteractive-element-interactions` on
`packages/ui-pro/src/components/kanban-board.tsx`. This is a rule-implementation difference, not a
misconfiguration: eslint-plugin-jsx-a11y's default `handlers` list excludes drag events, oxlint's
implementation checks them, and the flagged elements are a drag-and-drop board with `onDragOver` /
`onDragStart` and no keyboard path. They are **kept**. Suppressing a true accessibility finding to
hit a parity number would be the wrong trade, and the a11y rule set is explicitly on a RAMP where
unfixed warnings are already tolerated.

**4. The reformat is 74 files, not ~1,670.** 0408 carried the spike's measurement that oxfmt
"would reformat 1,670 files", and constraint 3 (one dedicated commit, never hand-resolved) was
sized for that. The figure was almost entirely a **default-width artifact**: this repo never
carried a `.prettierrc`, so Prettier ran at its own default `printWidth: 80`, while oxfmt's
default is wider — so a bare `oxfmt .` rewrapped nearly every file in the tree.

Pinning Prettier's defaults in a new `.oxfmtrc.json` (`printWidth: 80` and the rest) drops the
reformat from **1,636 changed files to 74**. That is the correct scope for this wave: a toolchain
swap should change the tool, not the house style. Widening the print width is a real decision with
a real diff behind it, and it belongs to whoever wants it, in its own change. Constraint 3 is still
honored — the reformat is one commit — the risk it was guarding against is simply much smaller than
anyone expected.

## Findings the swap surfaced

**oxlint caught 10 real defects ESLint was blind to**, all the same shape:
`(xs[0]?.field as T).prop`. The optional chain short-circuits to `undefined` and the cast then
dereferences it unconditionally, so a missing element throws a confusing `TypeError` instead of a
clean assertion failure. ESLint's core `no-unsafe-optional-chaining` does not traverse through a
`TSAsExpression`, so all ten sat green. Fixed in this wave (`?.` → `!.`, which is what
`noUncheckedIndexedAccess` wanted the code to say).

## New operational facts

- **`ignorePatterns` applies to explicitly-named file paths**, and _accumulates_ down an `extends`
  chain (where `plugins` and `overrides` replace). A config cannot un-ignore what its parent
  ignored. That is why the canary has its own standalone config rather than extending the root:
  the fixtures it must lint are the fixtures the root must ignore. `boundary-policy.test.ts` pins
  the two configs against each other so the duplication cannot drift.
- **A gate that cannot fail is a defect**, so the canary is mutation-verified against four distinct
  failure modes: plugin exports no rules (loud — "Rule not found"), plugin package unresolvable
  (loud — "Cannot find module"), a rule silently disabled (caught, exit 1), and **the true silent
  mode** — plugin loads, rule registers, visitors return `{}` and report nothing (caught, exit 1).
  The last one is the case that motivated the constraint; it is the one a green lint run cannot see.
- **oxfmt honors `// prettier-ignore` and `.prettierignore` natively** (constraint 5, verified on a
  real probe: a `prettier-ignore`'d statement was left untouched while an unguarded sibling on the
  next line was reformatted). No ignore file or inline span had to change.
- **oxfmt's ignore discovery walks UP past the directory it is pointed at**, to the nearest
  repository boundary. The mirror exporter writes to `mirror-out/`, which this repo's own root
  `.gitignore` lists — so `oxfmt .` there matched zero files and exited 2, and would have failed in
  armed CI, not just locally. `--ignore-path` does not fix it (it replaces the current directory's
  ignore files, not the parent walk), and neither does naming a file explicitly, which contradicts
  the documented "files ignored by .gitignore can still be formatted if explicitly specified" —
  measured, an explicit file path is refused too. The fix is a temporary empty `.git` marker in the
  output directory, removed in a `finally`: it stops the walk, and it is what the real mirror clone
  provides anyway. Found by running the export end to end rather than trusting its unit tests.
- **oxlint's override globs anchor to the config file**, so the ESLint `basePath` hand-pins in the
  old `boundaries.js`/`anti-slop.js` are gone. Verified with a two-arm discriminator rather than
  assumed: a provider-SDK import probe in an exempt package (`ai-config`) reports 0 findings and
  the same probe in a base package (`auth`) reports 1 — identically from a per-package cwd and
  from the repo root. That is the silent-scope-loss class closed by construction.

## Scope call beyond ADR-0408

0408 governs this repo's toolchain and named the OSS mirror. It did not name the **generator
templates** (`packages/cli/templates/{base,eu-ai-act-sample}`), which ship an ESLint config and an
`eslint` devDep into every scaffolded app. Leaving them would have shipped a template whose
toolchain the house had just abandoned, and their config imported a package that no longer exists.
They now emit a minimal `.oxlintrc.json` and an `oxlint` devDep. This is a product-surface change
made under this wave; if the operator wants generated apps to stay on ESLint, that is a one-file
revert plus a superseding ADR.

## Consequences

- Lint wall-time is effectively gone from `check`. The per-package `oxlint src` turbo task is kept
  for cache granularity, but is now redundant with a sub-second root `oxlint .` — a future
  simplification, deliberately not taken in a toolchain-swap wave.
- The repo carries a standing dependency on an alpha plugin-compat API. The canary is the tripwire
  and is a required CI step; if `jsPlugins` breaks, the documented fallback stays 0408's — re-run
  ESLint for the two custom plugins only, not revert the swap.
- `eslint` and `prettier` remain installable artifacts in `node_modules` via the storybook peer
  chain. A future dependency audit that greps for them will find them; this ADR is the answer.
