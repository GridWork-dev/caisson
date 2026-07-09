# MANIFEST — capability corpus → market research → library scaffold

Running ledger of everything **ingested** and **produced**. Updated each phase.

- **WORKDIR:** `/home/gw/lab/library-research`
- **Started:** 2026-06-27
- **Job:** Mine codebase → capability corpus → Exa market research → scoped doc-first plan + scaffold for a sellable template/framework library.
- **Gate discipline:** human-in-the-loop. STOP at Gates 1–4. No feature code before Gate 4.

## Resolved placeholders

| Placeholder               | Value                                                | How                                                             |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| `[MEDIA_PIPELINE_REMOTE]` | `https://github.com/GridWork-dev/media-pipeline.git` | derived (private GridWork-dev repo; parent of public `tessera`) |
| `[WORKDIR]`               | `/home/gw/lab/library-research`                      | default (real deliverables kept in lab)                         |
| `[NEW_LIBRARY_REPO_NAME]` | _deferred_                                           | decided at Phase 3 (picker) / used at Phase 6                   |

## Sources ingested (15)

**Workspace (`harvestable`):** dev-profile, FOUNDER-OS, gridwork-core, health-service,
prospector, tessera, Wardfile, Wardfile-il-dbui · paused/{glossread, gridwork,
gridworkdigital, telesis, throughframe, tm-watch}.

**Private remote (`pro-private`):** media-pipeline — cloned to `sources/media-pipeline`
(22MB). Parent repo to `tessera`. Contains `tessera-public/` submodule (open-core public
layer) + private layers (`workers/`, `terraform/`, `skills/`, `emails/`, `marketing/`,
internal `docs/`). **Entire repo tagged `pro-private`** except the public-sibling boundary;
harvest patterns/ideas only, never implementation, never as a sellable baseline.

Excluded per task: `worktrees/`, `.zed/`. `docs/` = reference only.

## Produced

| Phase | Artifact                                                                                              | Status                                |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 0     | `MANIFEST.md`, `decisions-log.md`                                                                     | done                                  |
| 0     | `sources/media-pipeline/` (clone)                                                                     | done                                  |
| 1     | `metrics.tsv` (objective LOC/test/ADR counts)                                                         | done                                  |
| 1     | `raw-extractions.json` (15 schema-locked extractions)                                                 | done                                  |
| 1     | `capability-corpus.md` (matrix + shortlist)                                                           | done (Gate 1 cleared w/ amendments)   |
| 2     | `demand-probe.ts` + `demand-data.json` + `demand-signals.md` (DataForSEO, reused prospector adapters) | done                                  |
| 2     | `deep-dives.json` (5 spine repos, rebuild-clean principles + credit units)                            | done                                  |
| 2     | `market-findings.json` (6 Exa angles: competitors/pricing/gaps/value-adds)                            | done                                  |
| 2     | `scores.json` (rubric-as-code ranking)                                                                | done                                  |
| 2     | `market-research.md` (ranked opportunities + product thesis + business model)                         | done (Gate 2 cleared)                 |
| 2     | `support-strategy.md` (post-purchase value-add + support stack research)                              | done                                  |
| 3     | Phase 3 picker (scope locks → `decisions-log.md` D13)                                                 | done                                  |
| 4     | `options.md` (3 monorepo architectures + recommendation + roadmap)                                    | done (Gate 3: **Option C** picked)    |
| 5     | `specs/{00-product-spec,01-architecture,02-core-loop-ux,03-design-framework}.md`                      | done                                  |
| 5     | `plan.md` (phased build plan P0–P7, exit criteria)                                                    | done                                  |
| 5     | `knowledge/decisions/ADR-0001..0012` (12 ADRs)                                                        | **done → GATE 4 (awaiting approval)** |
| 6     | scaffold of new library repo (working name "Forge")                                                   | pending (Gate 4)                      |

## Post-founding research imports (2026-06-29)

External decision-grade reports prepared by **Perplexity Computer** (June 27–28, 2026), imported
2026-06-29. Inputs, not decisions — locks stay operator-owned (`docs/state/decisions-and-forks.md`).

| Artifact                                                                      | What                                                                                                                                            | Status   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `gtm-customer-acquisition.md` (+ `gtm-customer-acquisition-report.pdf`)       | GTM & customer-acquisition plan: motion, beachhead, channels, funnel, CAC, pricing-page rec, launch, SWOT                                       | imported |
| `market-competitive-analysis.md` (+ `market-competitive-analysis-report.pdf`) | Market sizing (TAM/SAM/SOM), competitor matrices (boilerplate/compliance/AI/local-first), business model, ICP, threats, trends, recommendations | imported |
| `gtm-market-analysis-2026-06.md`                                              | **Cross-analysis** of both reports vs the current locked state: VALIDATES / GAP / CONFLICT / INSIGHT, fork register for the picker              | produced |
