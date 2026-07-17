# Agent-runtime options expansion + adversarial round — 2026-07-16

- **Provenance:** ultracode fan-out (workflow `wf_06015678-9fa`: 3 sonnet expansion agents +
  gap-coverage mapper) + two Codex `gw dispatch` adversarial reviews (`code_review_deep` on the
  ADR-0349 lock, `threat_model` on the ADR-0350 locks) + two independent claim-verification
  agents (every load-bearing Codex claim checked against the repo/live docs).
- **Consumes:** `outputs/research/agent-runtime-audit-2026-07-15.md` (the operator-supplied
  Codex audit). **Feeds:** ADR-0351 (runtime PLAN-gate locks) + ADR-0352 (sandbox PLAN-gate
  locks) — both operator-locked 2026-07-16.
- **Purpose:** the clean expansion view of the audit's NON-locked recommendations (options
  2-4), so each future program scopes without re-recon.

## 1. Option 2 — Portable skills → Agent Skills spec

**Gap in one line:** the Agent Skills spec's unit is a DIRECTORY (SKILL.md frontmatter +
scripts/ + references/ + assets/, license/compatibility/metadata/allowed-tools); caisson's
`SkillArtifact` is a flat prose record (name/description/trigger/steps[]/dependencies) emitted
as one markdown file per harness — the gap is the whole directory model, not a field.

- **Exists today:** SkillArtifact schema (`agent-kernel/src/schema.ts:92-104`), defineSkill +
  strict validation, 3 shipped skills, 6-harness emitter with a fail-closed path-escape +
  secret-scan write gate (`emitter.ts:562-638`), byte-stable goldens, and the ADR-0264
  precedent that optional schema fields round-trip byte-identically.
- **Key gaps:** no directory packaging; no `allowedTools` on skills (AgentArtifact has
  `tools[]`, SkillArtifact has none — zero grep hits); steps[] is prose, never runnable;
  no references/assets/compatibility/license/metadata fields; no validator vs the spec;
  bundled-script write-path security is a NEW guard class; no registry distribution story.
- **Notable:** real Claude Code skills are already directories (`.claude/skills/<name>/SKILL.md`)
  — the current flat-file emit is an existing fidelity mismatch worth peeling off as a
  standalone fix regardless of the full program.
- **Slices:** (1) optional schema fields (allowedTools/scripts/references/assets/license/
  compatibility), (2) directory-aware emit target + goldens, (3) bundled-file write-gate
  extension (MUST precede any script-carrying skill reaching a buyer repo), (4) validator +
  fixtures, (5) distribution fork (registry model vs new — do not pre-bind).
- **Timing (locked context):** waits only for the runtime's tool-allowlist shape to exist ONCE
  (ADR-0349 slice-1/tool-exec contract drafted), so skills and the runtime don't invent two
  authority shapes. Tree-disjoint from both armed programs; a parallel wave candidate after
  that point.

## 2. Option 3 — Vertical automations (reference agents)

**Reality check:** three of the four named verticals already RUN as shipped services — intel
watchers, support-bot (Python, direct OpenRouter httpx — outside ai-meter entirely), site
Ask AI (own SpendSeam) — each with bespoke retry/escalation/cost logic: exactly the
duplication ADR-0349 cited. "Repo review" as a caisson-run sellable agent does not exist
(agent-dev's code-reviewer is buyer-side metadata, not a hosted service).

- **Hard dependency:** pure follow-on — starting before the runtime recreates the
  fragmentation the audit found. Minimum bar: runtime slices 1-3 (ideally +4/5) proven.
- **Slices once armed:** intel LLM-enrichment onto the metered loop → Ask AI onto the bounded
  loop/approval → support-bot bridge-or-port fork (Python↔TS seam, undecided) → the first NEW
  vertical (repo-review) as the "adding a vertical is now cheap" proof → sellable reference-
  agent packaging.
- **Open forks parked for that program:** support-bot port vs RPC seam; repo-review scope;
  migration order; buyer-runnable vs operator-run agents (changes the security surface
  materially); own bundle vs fold-into-existing.

## 3. Option 4 — MCP interop

**Today:** 12 plain request/response tools (3 base + 4 coach + 5 design-system), timing-safe
Bearer + entitlement-gated; ZERO resources, prompts, elicitation, tasks, progress. The coach's
`write_forge_config` fakes approval with a boolean arg — exactly the shape real elicitation
replaces once the runtime's approval events exist.

- **Slice A (independent, anytime, low risk):** resources + prompts — client support is mature
  (Claude Desktop/Cursor/Zed full). Candidates: registry index/module docs/design tokens as
  resources; coach flows as prompts. Optional; modest buyer value; needs its own go/no-go.
- **Slice B (rides the runtime — already SPEC scope item 6):** run start/status via MCP.
  Not a separate program.
- **Slice C (deferred):** elicitation wired to tool-proposal approval + async tasks wired to
  pause/resume — gated on proven client support AND the runtime existing. Spec-churn warning:
  MCP async tasks were redesigned wire-incompatibly (2025-11-25 experimental → SEP-2663
  extension, 2026-06-30); elicitation support is inconsistent even inside Anthropic's client
  family (CLI fixed 2026-04; Cowork still broken as of the same month). Building against the
  moving shape now risks a rebuild.

## 4. Audit gap-coverage map (the 9 "where the platform stops" bullets + 7 implementation steps vs the locked SPEC)

Covered explicitly: trajectory schema, runner instrumentation (as observation — see ADR-0351
rider 2), bounded v7 loop, jobs-port durability, trajectory evals, CLI+MCP exposure,
subagents-last, FSM-stays-governance. **Silently absent → now named PLAN non-goals
(ADR-0351 rider 4):** agent-dev live-runner composition; agent-runner SDK (non-CLI) backends;
MCP resources/prompts; migrating Ask-AI/support-bot/intel/AEO accounting onto the shared
trajectory+cost schema. Partial: "handoffs" evals (consistent with the no-multi-agent
non-goal).

## 5. Adversarial round — findings that survived verification

**Runtime (Codex code_review_deep; verification: 6 CONFIRMED / 1 PARTIAL / 1 REFUTED):**

| #   | Finding                                                                                                          | Verified                                                                                    | Disposition                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Package/entitlement home unresolved (SPEC "kernel-primitives only" vs ai-kit edition-kind)                       | PARTIAL — tension real but ONLY via ai-kit; tool-exec/ai-meter/jobs are primitive/base kind | **Locked AR-2** (ADR-0351): neutral primitive + ai-kit adapter                                            |
| 2   | ToolLoopAgent callbacks swallow errors; not authoritative for billing/persistence                                | CONFIRMED vs live docs (+ `onStepFinish` deprecated → `onStepEnd`); ai pinned 7.0.22        | **Rider 1**: pinned seam spike is task 1; fail-closed proof or narrow amendment                           |
| 3   | Instrumenting the runner ≠ metering closure (no usage in RunReport, CLI spawned outside ai-kit)                  | CONFIRMED                                                                                   | **Rider 2** + **AR-3 lock**: observation events, billingStatus unsupported, ccusage-style adapter package |
| 4   | Trajectory schema underspecified/oversized for slice 1 (replay semantics, payload classes, retention, evolution) | (design claim)                                                                              | **AR-4 lock**: metadata + encrypted refs, replay=projection, contract RFC + security review first         |
| 5   | Build-now needs a serial risk DAG + launch firewall                                                              | (design claim; launch-gate cites confirmed)                                                 | **Rider 3**: serial DAG, publish last, operator acts preempt                                              |
| —   | "Disjoint member maps"                                                                                           | REFUTED (share ai-config + kernel)                                                          | Correction recorded in ADR-0351                                                                           |

**Sandbox (Codex threat_model; verification: 8/8 CONFIRMED):** the `--demo` leg is ALREADY
BUILT (PR #143 `15c50bd6` — ADR-0350's build-order rider was stale); the default demo output
has no `start` script and demo mode can't select the Next overlay (the "running in <2 min"
criterion was unbackable as written); eval-store's count-then-insert cap is racy by its own
comment (banned for the F5 cap); email+IP alone is friction not a gate (Turnstile is the
shipped fail-closed pattern); registry-schema is shared (F6 wording corrected). All
dispositions locked in ADR-0352 (preview contract = files + shared prebuilt preview; F2 =
one page/independent deploys; F5 = run-count+concurrency on a PG-shared atomic counter).

**In-session skeptic note:** the first pair of opus skeptic agents returned junk structured
output ("test" stubs) and were discarded; one re-run produced the sandbox skeptic whose
findings converged with (and are folded into) the Codex threat_model rows above. The Codex
dispatches + the two verification agents are the adversarial layer of record.
