# ADR-0262 — Interactive `create-caisson` first-run: gap-fill precedence, per-module toggles, equal-weight sample

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 1, dx-demos-compat session; research
brief verified by adversarial pass). Extends ADR-0093 (free-local CLI — untouched) and
ADR-0136 (Apache-2.0 CLI — MIT dep clean); respects ADR-0091 (migration bundling, fully
downstream of Selection). Append-only; supersede with a later ADR, never edit.
**Tags:** none (open-Base CLI; no money/auth surface).

## Decision

1. **Interactive mode behind `process.stdin.isTTY`, per-field gap-fill precedence.** Flags
   always win; only Selection fields absent from argv prompt. All-selection-flags-present or
   non-TTY stdin = a single early return with **zero prompt-library code executed** — the
   non-interactive path stays byte-identical to today. Regression-locked by a NEW
   `packages/cli/src/cli.test.ts` pinning the argv contract (parseArgs/runCli/help — untested
   today) plus a spy asserting the interactive module is never invoked on the flag path.
2. **Primary interactive shape: per-module toggles** (operator pick above the edition-preset
   rec) — a multiselect over the registry-index allowlist (module id + manifest description;
   version defaults to `entry.latest`). **No edition concept in the wizard**; `--edition`
   stays flag-only. The latent flag-path gap (edition does not auto-add member modules)
   remains as-is — presets may return under a later ADR.
3. **First question: licensed build vs free sample as equal-weight choices**, neither
   pre-selected. The `--sample` flag path is untouched; the wizard's sample branch reuses it.
4. **Prompt library: `@clack/prompts`** (MIT, 4 deps, maintained; create-svelte precedent).
   Every prompt handles `isCancel` → clean non-zero exit (never a Symbol into Zod). The CLI
   package documents the inherited `engines.node >= 20.12` floor.

Rejected: **full-override precedence** (any flag kills all prompts — worse UX for `--edition`
-only invocations); **edition presets via `expandEntitlements`** (operator pick; the resolver
reuse stays documented for a future preset flow); **sample as pre-selected default** (a GTM
funnel call the operator declined); **node:readline** (no validation/cancel/styling floor).

## Consequences

- The interactive layer produces the same raw `{projectName?, edition?, modules}` shape
  `parseArgs` produces and feeds the SAME `generate()`/Zod-strict/allowlist path — no second
  schema, no network (ADR-0093 posture intact).
- New runtime dep on the published bin → naming changeset for `@caisson/cli` in the same PR.
- `packages/cli/src/interactive.ts` (~150 LOC) + `cli.test.ts` close the pre-existing
  argv-contract test gap as part of this build.
