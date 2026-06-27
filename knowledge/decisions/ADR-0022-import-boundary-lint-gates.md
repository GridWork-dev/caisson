# ADR-0022 — Import-boundary + license lint gates

Status: proposed · 2026-06-27 (D9 module-standards session) — recommended, pending operator lock

Three invariants from earlier ADRs were **review-gated only**. The docs review rated the AGPL one
HIGH (legal liability). This ADR converts them to **CI gates that fail the build** — humans miss
imports in a multi-package monorepo. All three run in the `tooling/` standards gate (ADR-0021),
in `bun run check`, and in CI (ADR-0016).

## Gate 1 — AGPL import boundary (ADR-0010 enforcement)

The `@stack/standards-gate` Bun script reads each workspace package's SPDX `license` +
its workspace dependency graph and **FAILS** if any **non-AGPL** package depends on (or imports
from) an **AGPL-licensed** package (`local-ai` + its app). Rule: **only an AGPL-licensed package
may consume an AGPL package.** Keyed on `package.json` `license` — an absent/undeclared license
is treated as non-AGPL (conservative: it then _cannot_ consume AGPL). This is what stops a
commercial buyer's product from being AGPL-contaminated.

## Gate 2 — provider-SDK import boundary (ADR-0011 enforcement)

An ESLint `no-restricted-imports` rule (in `tooling/eslint-config/boundaries.js`) forbids
provider-SDK imports — `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`,
`@aws-sdk/client-bedrock-runtime`, `@mistralai/mistralai`, `cohere-ai`, `ollama`, … — in **every
package except `ai-config` and `ai-kit`**. Everything else routes inference through `ai-config`
(no provider hardcoded anywhere, ADR-0011). The prohibited list lives in the boundaries config.

## Gate 3 — down-only dependency boundary (ADR-0003 enforcement)

The standards-gate script also asserts the **composition direction** from the manifests
(ADR-0020 `kind` + `dependencies`): a `base`/`primitive` module may not depend on an `edition`;
an edition may not depend on another edition. Editions compose base packages — never the reverse.

## Mechanism choice

- **Provider-SDK boundary → ESLint `no-restricted-imports`** — catches the source-level import;
  zero extra dependency beyond `typescript-eslint`; file-path-scoped overrides exempt
  `ai-config`/`ai-kit`.
- **AGPL + down-only boundary → a Bun `@stack/standards-gate` script** over the workspace
  dependency graph (keyed on `license` + manifest `kind`) — these are package-graph facts ESLint
  does not see well; a small script beats pulling in `dependency-cruiser`.

## Rejected

- **Review-only enforcement** — the failure mode the review flagged HIGH; humans miss imports.
- **`dependency-cruiser`** — heavier dep + config surface than two rules warrant.
- **`eslint-plugin-boundaries`** — config-heavy for what `no-restricted-imports` + one script do.

## Binding

The AGPL gate, the provider-SDK gate, and the down-only gate **run in CI and block merge**. The
bindings in **ADR-0010** (AGPL boundary) and **ADR-0011** (provider-SDK boundary) now reference
these CI gates, not code review.
