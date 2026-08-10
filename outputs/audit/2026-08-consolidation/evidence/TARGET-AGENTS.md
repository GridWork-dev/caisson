# Targeted evidence — agent package family

The literal `packages/agent-*` set contains four workspaces. Adding the catalog-only
`packages/agentic-dev` bundle explains the kickoff's semantic count of five.

| Package            | Implementation                                                                                                                                                               | Callers/tests                                                                                                                     | Registry, bundle, revenue                                                                          | Buyer story / last meaningful change                                                                 | Disposition                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `agent-dev`        | 1,245 non-test TS; unique emitter at `packages/agent-dev/src/emitter.ts:1-730`, old composition facade at `packages/agent-dev/src/index.ts:104-180`                          | Zero external workspace callers; 6 test files/35 test declarations; README enters docs corpus                                     | Module-delisted at `registry/ledger.jsonl:245`; absent from current bundle maps; no direct revenue | Multi-harness emitter; last feature `586916f`; retained state at `docs/state/package-catalog.md:117` | KEEP pending separate architecture decision |
| `agent-kernel`     | 1,305 non-test TS; exports at `packages/agent-kernel/src/index.ts:4-76`; `.` + `./browser`                                                                                   | Dependents `agent-dev` and demos; 9 test files/79 declarations; real demo `apps/demos/components/poke/agent-kernel-poke.tsx:6-22` | Latest `0.7.0`; $199 standalone; Agentic-Dev + Everything                                          | Typed governance/FSM/hooks; `f368318` added browser surface                                          | KEEP                                        |
| `agent-runner`     | 927 non-test TS; process/env/trajectory at `packages/agent-runner/src/agent-runner.ts`, `packages/agent-runner/src/engine-env.ts`, `packages/agent-runner/src/trajectory.ts` | Dependents `agent-dev` and demos; 4 test files/27 declarations; real demo `apps/demos/components/poke/agent-runner-poke.tsx:3-18` | Latest `0.3.0`; $49 standalone; Agentic-Dev + Everything                                           | Process isolation and transcript capture; `03ca530` browser surface                                  | KEEP                                        |
| `agent-trajectory` | 1,879 non-test TS + 99 SQL; `.`, `./browser`, `./usage` (`packages/agent-trajectory/package.json:11-26`)                                                                     | Runtime dependents ai-kit, ai-evals, runner, demos; 11 test files/94 declarations                                                 | Latest served `0.5.0`; $49 standalone; Agentic-Dev + Everything; usage subpath awaits next publish | Runtime events, replay, parked state, usage; `c10e3b64` usage fold                                   | KEEP                                        |
| `agentic-dev`      | 0 runtime LOC; 34-line manifest; intentionally no composition code (`packages/agentic-dev/manifest.ts:1-7`)                                                                  | Catalog tests at `packages/registry-schema/src/bundle-manifests.test.ts:123-140` and site pricing parity                          | Latest `0.2.4`; $329 bundle; member of Everything                                                  | Frozen entitlement aggregation; `73fb756` last pin update                                            | KEEP                                        |

## Pairwise overlap verdict

- Kernel vs runner: governance versus subprocess execution; no duplicate implementation.
- Runner vs trajectory: healthy producer-to-contract dependency; separate $49 SKUs.
- Kernel vs trajectory: legal act transitions versus model/tool/runtime event history and resume state.
- Bundle vs primitives: catalog entitlement object versus executable packages.
- `agent-dev` facade re-exports primitive packages, but its emitter is unique. A raw delete was
  refuted. Moving that emitter into `agent-kernel/emitter` would expand the standalone $199 SKU and
  is explicitly reserved for a separate architecture/product decision, so it is not in this picker.

## Buyer/site impact

Deleting kernel, runner, trajectory, or the bundle breaks current SKUs, grants, docs, and demos.
Deleting `agent-dev` removes a capability the site still advertises at
`apps/site/lib/module-pages.ts:1040-1047`, even though current bundle membership does not deliver the
delisted package. That delivery-truth mismatch remains a follow-up, not a reopened cut.

Registry detail was checked at `registry/ledger.jsonl:245` for the agent-dev module delist;
`registry/index.json:141-142,444-464` for agent-kernel; `registry/index.json:469-470,732-753` for
agent-runner; `registry/index.json:758-760,911-933` for agent-trajectory; and
`registry/index.json:938-940,1030-1057` for the agentic-dev bundle. Current membership truth is
`packages/agentic-dev/manifest.ts:18-30` and `packages/everything/manifest.ts:41-55`.
