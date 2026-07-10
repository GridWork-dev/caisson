---
phase: codex-production-browser-audit
project: caisson
created: 2026-07-10
status: complete
spec: outputs/specs/codex-production-browser-audit/SPEC.md
adr: knowledge/decisions/ADR-0320-codex-production-browser-audit.md
---

# Plan — Codex production browser audit lane

## Current-state map

- `apps/site/scripts/visual-harness.ts:1-25` defines the existing Playwright capture boundary and production/test-account contract.
- `apps/site/scripts/visual-harness.ts:464-465` reads buyer probe credentials; `:521-522` reads the CF Access service token. The new skill must never print or copy these values into model context.
- `apps/site/live/buyer-dashboard-flow.live.test.ts:1-18` remains the deterministic authenticated lifecycle proof.
- `tooling/design-critic/README.md:1-26` defines the advisory, non-blocking design ledger.
- `PRODUCT.md` and `DESIGN.md` are the product/design authorities consumed by Impeccable.
- Official Codex guidance places repo skills in `.agents/skills` and permits optional `scripts/`, `references/`, and `assets/` children.

## Task 1 — Create the feature branch and land the planning contract

**SPEC:** Goal, Context, Locked approach
**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=git-diff`

**Files:** add this SPEC/PLAN/ADR; modify `docs/state/decisions-and-forks.md`, `docs/adr-index.md`, and `CLAUDE.md`.

1. Create `feature/codex-production-browser-audit` from current `origin/main`; preserve these planning files before leaving detached HEAD.
2. Re-check open PR branches for an ADR-0320 collision and renumber under ADR-0088 if one appeared.
3. Run `bun run sot` and commit `docs(specs): lock Codex production browser audit lane`.

## Task 2 — Add the repo-specific Codex skill shell

**SPEC:** Acceptance Criteria 1-3; Execution surface; Model route; Research order
**Route:** `capability=code_write`, `role=active-orchestrator`, `lane=main`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=skill-discovery-check`

**Files:**

- Add `.agents/skills/caisson-production-browser-audit/SKILL.md`.
- Add `.agents/skills/caisson-production-browser-audit/agents/openai.yaml`.
- Add `.agents/skills/caisson-production-browser-audit/references/{method,openai-surface}.md`.

1. Trigger only for agent-driven Caisson production design/behavior audits.
2. Require preflight → Exa → Refero styles/screens/flows → reference lock → Impeccable/Caisson rubric → rings → replay → cleanup → report → picker.
3. Require GPT-5.6 for visual work; refuse visual verdicts from text-only Spark.
4. Use `@Browser` for Ring 1 and dedicated `@Chrome`/Computer Use profiles for Rings 2-3.
5. Verify discovery from a fresh Codex project session and commit `feat(audit): add Codex production browser skill shell`.

## Task 3 — Derive the three-ring surface and journey manifest

**SPEC:** Acceptance Criteria 3; Three rings
**Route:** `capability=code_write`, `role=typescript-pro`, `lane=sonnet`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=bun-tests`

**Files:** add `scripts/build-manifest.ts`, its test, and `references/journeys.md`; read the existing typed site registries and `apps/{site,admin}/**/page.tsx` trees.

1. Define strict `Ring`, `Surface`, `Journey`, `Actor`, `AuthMode`, `MutationContract`, and `EvidenceRequirement` types without `any`.
2. Derive public routes from typed registries/files, not the Playwright executor; derive buyer/admin routes from their page trees and overlay journey metadata.
3. Fail on duplicate URLs, unassigned routes, missing prerequisites, or a mutation without a compensator.
4. Emit `outputs/browser-audit/<run-id>/manifest.json` without credential values.
5. Test counts, stable sorting, duplicate detection, and mutation validation; commit `feat(audit): derive browser audit surface manifest`.

## Task 4 — Add credential-safe preflight and session boundaries

**SPEC:** Acceptance Criteria 4-6; Mutation and reversion contract
**Route:** `capability=code_write`, `role=security-specialist`, `lane=opus`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=secret-leak-tests`

**Files:** add `scripts/preflight.ts`, its test, and `references/safety.md`.

1. Check only the presence of `CAISSON_E2E_ACCOUNT_EMAIL`, `CAISSON_E2E_ACCOUNT_PASSWORD`, `CAISSON_E2E_CF_CLIENT_ID`, and `CAISSON_E2E_CF_CLIENT_SECRET`; emit booleans, never values or lengths.
2. Require a dedicated probe Chrome profile for Ring 2 and a separately authorized operator profile for Ring 3; never type chat-supplied secrets or save them in evidence.
3. Reject unknown identity, personal/shared profiles, stale admin sessions, or unresolved cleanup journals.
4. Encode the denylist: real purchase, irreversible cancel, account deletion, identity/email/password change, permission change, real-recipient messages, file upload, and non-fixture admin mutation.
5. Prove secret strings never appear in stdout, errors, JSON, or snapshots; commit `feat(audit): add browser audit safety preflight`.

## Task 5 — Enforce mutation/revert and evidence contracts

**SPEC:** Acceptance Criteria 4-7; Evidence and verdicts
**Route:** `capability=code_write`, `role=typescript-pro`, `lane=sonnet`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=red-green-tests`

**Files:** add `scripts/{journal,validate-run}.ts`, tests, and `references/evidence-schema.md`.

1. Use Zod `.strict()` for run metadata, evidence, findings, replay results, and journal transitions.
2. Permit only `planned → applied → observed → reverted → verified`; reject skips, double apply, and concurrent unresolved mutations.
3. Turn cleanup failure into a blocking P0 plus `mutation_lock: true`; only verified cleanup clears it.
4. Require before/action/after/revert evidence under the run directory and reject absolute/escaping paths.
5. Require clean-session replay for P0/P1 behavior findings and a cited reference/Caisson/Impeccable rule for design findings.
6. Write failing tests first, then implement; commit `feat(audit): enforce browser mutation and evidence contracts`.

## Task 6 — Author the design and behavioral doctrine

**SPEC:** Acceptance Criteria 2, 7-8; Behavioral and full-testing principles
**Route:** `capability=design_review`, `role=gw-frontend-designer`, `lane=gpt-high`, `concurrency=serial`, `isolation=shared-read`, `permission_profile=repo-read`, `evidence=reference-lock-and-rubric`

**Files:** add `references/{design-rubric,behavior-rubric,report-template,picker-template}.md`.

1. Require Refero styles first, then screens/flows, with a reference lock and decision ledger.
2. Encode Impeccable/Caisson hierarchy, type, accent-role, depth, motion, accessibility, responsive, copy, state, and anti-slop checks.
3. Encode user-goal, transition, recovery, negative-path, entitlement, auth, keyboard, reduced-motion, degraded-dependency, and cleanup checks.
4. Separate severity from confidence; require route/action/evidence citations.
5. Present genuine design forks as 2-4 options with one evidence-backed recommendation and explicit tradeoffs; never auto-lock.
6. Commit `docs(audit): codify browser design and behavior rubric`.

## Task 7 — Reconcile advisory reports and stage candidate tests

**SPEC:** Acceptance Criteria 9-10; Graduation into deterministic coverage
**Route:** `capability=code_write`, `role=typescript-pro`, `lane=sonnet`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=bun-tests`

**Files:** add `tooling/browser-audit/src/reconcile.ts`, tests/package metadata, `scripts/finalize.ts`, and narrow `.gitignore` entries for raw evidence.

1. Reconcile stable finding identities as new/unchanged/regressed/closed while always remaining advisory.
2. Produce `REPORT.md`, `findings.json`, `mutation-journal.json`, `forks.md`, and `candidate-tests/*.md`.
3. Require candidate scenarios to name the accepted finding, deterministic fixture, setup/action/assertion, stable selectors, cleanup, and destination suite.
4. Refuse direct writes into existing Playwright suites or workflow files.
5. Test reconciliation and the no-auto-promotion boundary; commit `feat(audit): reconcile Codex browser audit reports`.

## Task 8 — Evaluate, verify, sweep, and ship

**SPEC:** all criteria
**Route:** `capability=code_review`, `role=active-orchestrator`, `lane=main`, `concurrency=serial`, `isolation=current-worktree`, `permission_profile=workspace`, `evidence=7-act-artifacts`

1. Run new unit tests, `bun run check`, `bun run gate`, `bun run sot`, and `git diff --check`.
2. Run a Ring-1 quick audit and one Ring-2 reversible mutation smoke; prove the journal returns to `verified` with no residue.
3. Run AI evals for prompt injection, missing credentials, cleanup failure, false certainty, blocked routes, and attempted auto-promotion.
4. Run code review, security audit, and UI/UX review because the phase tags fire all three gates.
5. Goal-backward VERIFY every criterion, then SWEEP route registries, testing docs, security surfaces, and skill discovery.
6. Push the feature branch and open a draft PR. Do not deploy or run Ring-3 mutations during SHIP.

## Verification commands

```bash
for file in "$(pwd)"/.agents/skills/caisson-production-browser-audit/scripts/*.test.ts tooling/browser-audit/src/*.test.ts; do bun test "$file" || exit 1; done
bun run check
bun run gate
bun run sot
git diff --check
```

The absolute path is intentional: Bun ignores hidden `.agents` paths when they are passed as a directory filter. Expected: focused tests, check, gate, and diff-check exit 0; `sot` may report only unrelated active-worktree hygiene; the smoke run has no unresolved journal; no credential value appears in tracked/generated output; no existing Playwright/live-test file changes before a separately approved graduation task.
