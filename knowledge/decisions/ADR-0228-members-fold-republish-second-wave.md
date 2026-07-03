# ADR-0228 — Members-fold republish, second wave: full-tree repin + agent-runner fold realized

**Status:** accepted · 2026-07-02 (members-fold republish execution, operator picker MF-A/B/C,
`docs/state/decisions-and-forks.md:736-740`). Extends **ADR-0208 §5** (first ledger/index-only
republish — the reused mechanic), **ADR-0178** (edition members-fold, closed, untouched by this wave),
**ADR-0186 F5** (agent-runner edition-only SKU — this wave is what actually publishes its fold),
**ADR-0077** (frozen edition member pin map). Append-only; supersede with a later ADR, never edit.
**Tags:** `infra`, `external-system`, `billing`.

**Number reservation note (ADR-0088 convention):** the ceiling on `main` at execution time was
**ADR-0224**, but an in-flight docs branch (`picker-locks-third-round`) is filing **ADR-0225, 0226,
and 0227** concurrently. To avoid the multi-branch collision that renumbered two of the last three
waves at merge, this ADR was reserved as **0228** against that in-flight 0225–0227 set rather than
taking the nominally-next 0225. If the sibling branch lands with fewer than three numbers, the main
thread reconciles the ceiling after merge — this file's number does not move (append-only).

## Context

`registry/index.json`'s `@caisson/agent-dev@0.2.0` snapshot predated the `agent-runner` manifest edit
(ADR-0186 F5) — the published index and the deployed Worker did not yet reflect the fold a buyer was
already being sold. Independently, 24 changesets had accumulated unconsumed since the first
ADR-0208 republish, covering the Strix follow-on hardening (ADR-0204), the lift-harvest slice-2 wave
(ADR-0210-0217), the admin mutation surface (ADR-0220), Paddle per-line refund (ADR-0218), live seams
(ADR-0221), and two additional post-merge hardening buckets (`fix/money-path-hardening`,
`fix/proof-hygiene`, merged as PR #73 immediately before this run).

## Decision

Consumed all 24 pending changesets in one `changeset version` sweep (MF-A — no selective
consume exists). Hand-repinned **both** edition `members` maps — `packages/compliance/manifest.ts` and
`packages/agent-dev/manifest.ts` — to the versions the consume produced (MF-B; broader than the
originally-scoped agent-runner-only fold, because `updateInternalDependencies: "patch"` cascaded a
bump onto every member of both editions, not just the packages with a direct changeset). Appended
33 new `(id, version)` pairs to `registry/ledger.jsonl` (ledger grows 65 → 98 lines; the 2 private
packages among the 35 bumped `package.json` files are excluded by `isPrivatePackage()`) and rebuilt
`registry/index.json` deterministically via `registry/scripts/ci-publish-step.ts --dry-run false`.
Re-baselined the two bootstrap-era guard tests (`registry/scripts/full-tree-index.test.ts`,
`tooling/standards-gate/src/publish-config.test.ts`) that hardcoded the first wave's version map to
the real second-wave spread: 21 modules → `0.2.1`, 7 minor-bumped → `0.3.0`, 4 Stage-2 primitives →
`0.1.2`, `agent-runner` cascaded `0.1.0` → `0.1.1`.

`CAISSON_PUBLISH_DRY_RUN` stays `"true"` — no real npm/GitHub-Packages publish occurred
(ADR-0111/0069/0208 §5 posture unchanged).

## Consequences

- `registry/index.json` `@caisson/agent-dev@latest` now folds `@caisson/agent-runner@0.1.1` — an
  Agentic-Dev license entitles it at the Worker's entitlement filter, and a generated Agentic-Dev
  repo's `package.json` deps include it (`resolveEditionMembers`, `packages/cli/src/meter.ts`).
  `agent-runner` keeps no standalone SKU (ADR-0186 F5); no reprice. The full Agentic-Dev members map
  is now `agent-dev` `0.2.1` · `agent-kernel` `0.2.1` · `agent-runner` `0.1.1` · `ai-config` `0.2.1` ·
  `kernel` `0.3.0` · `local-store` `0.2.1` · `tool-exec` `0.1.2`.
- `@caisson/compliance@latest`'s members map is now `compliance` `0.2.1` · `audit-worm` `0.2.1` ·
  `field-crypto` `0.2.1` · `tenancy-rls` `0.3.0` · `kernel` `0.3.0` · `alerting` `0.1.2` ·
  `retention-runner` `0.1.2` — the Compliance fold (ADR-0178) is unchanged in composition, only in
  pinned versions.
- The registry Worker (`registry/worker/deploy.sh`) has NOT yet been redeployed as of this ADR — that
  is a separate, operator-gated DEPLOY act (see the runbook's Operator-gated section). Until it runs,
  the live edge still serves the pre-republish index.
- No drift-detection CI gate was added (out of scope, named as a follow-up in the deferred-respec SPEC
  Risks section) — this same manual-repin-before-append discipline will be needed again at the next
  edition-manifest edit that isn't immediately republished.
