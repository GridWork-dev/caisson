# PLAN — clean-main wave (2026-08-02)

Operator locks (picker, 2026-08-02): full 21-mirror poke retirement; builders on opus (never
fable fan-out — fable only on money/crypto audit seams); deps = safe wave + 3 majors as separate
PRs; ONE release train after the wave (no interim deploy); hygiene sweep + accepted-findings
closeout ride along; announcement drafts NOT commissioned. Site test tsc fixes + typecheck gate
in scope (direct ask).

## DAG

```
Phase 1  BUILD (parallel, worktree-isolated, one branch each)      — 20 builders
Phase 2  push branches -> open PRs -> CI (parallel)                 — main thread
Phase 3  SHIP audit: gw-code-reviewer (opus) every PR;
         gw-security-auditor (fable) ONLY money quad + field-crypto — findings verified, fixed
Phase 4  serial squash-merges to main (reconcile by merging main in)
Phase 5  WAVE B: guardrails + local-inference (needs field-crypto/browser on main) -> PR -> audit -> merge
Phase 6  release train (version PR consumes all changesets -> tag -> legs 1/1b/2/3/4) -> parity probe
Phase 7  wrap docs PR (tracker, deploy STATE, this plan), memory, sot green
Sweep    (concurrent with Phase 1): prune stale remote refs, clear ~540MB gitignored residue
```

## Phase-1 builders

| #     | Branch                                                            | Scope                                                                         |
| ----- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1     | fix/poke-agent-trajectory                                         | ./browser carve (schema+replay); template shape                               |
| 2     | fix/poke-compliance-core                                          | ./browser pure collectors; oscal-spine/browser dep                            |
| 3     | fix/poke-local-privacy                                            | likely direct '.' import, walk first                                          |
| 4     | fix/poke-audit-worm                                               | compose kernel/audit-verify; likely no new entry                              |
| 5     | fix/poke-agent-kernel-local-sync                                  | walk agent-kernel '.' (JsonlSink risk); local-sync direct                     |
| 6     | fix/poke-agent-runner-tool-exec                                   | ./browser pure validation halves                                              |
| 7     | fix/poke-ai-evals-local-store                                     | ai-evals ./browser; local-store RRF-only carve                                |
| 8     | fix/poke-field-crypto-signing                                     | promote WebCrypto twins to official ./browser impls                           |
| 9     | fix/poke-retention-alerting                                       | retention likely direct; alerting ./browser minus channels.ts                 |
| 10    | fix/poke-org-controls                                             | ./browser isolating assertCanManageMembers                                    |
| 11–14 | fix/poke-{ai-meter,credits,billing-orchestration,prompt-registry} | money quad: pure half only, WebCrypto id seam, engines floor; one PR per SKU  |
| 15    | chore/deps-safe-wave                                              | all unstarred minors/patches + better-auth lockstep (site+admin)              |
| 16    | chore/deps-htmlparser2                                            | 8→12 major, site                                                              |
| 17    | chore/deps-web-vitals                                             | 5→6 major, site (beacon code)                                                 |
| 18    | chore/deps-types-culori                                           | 2→4 types-only, site+admin                                                    |
| 19    | fix/site-test-typecheck                                           | 15 test-only tsc errors + typecheck gate (site script, turbo task, check job) |
| 20    | docs/accepted-findings-closeout                                   | 5 accepted ledger findings fixed + status flips                               |

Wave B (after #8 merges): fix/poke-guardrails-local-inference.

## Binding constraints on builders

- ADR-0396 pattern is the law: static source-graph walk (@caisson/testing/module-graph), never a
  bundler exit code; browser-safety.test.ts with positive control; subset discipline one-way;
  sample data + presentation stay poke-local; PR #377 squash (74f07569) is the template diff.
- packages/* change ⇒ changeset (plain prose, no ADR cites); ./browser entry = minor; WebCrypto
  id-seam change named in prose + engines.node >= 20.12.0. Do NOT regenerate registry/index.json
  (the train's version PR does). No docs/state or deploy-log edits (Phase 7 owns those).
- Deps: typescript stays <7 (CAISSON-129 pin); release-age-starred deps untouched; better-auth
  bumps in lockstep across site+admin or not at all.
- Merge order: money quad last (after fable audits), deps PRs serialized (lockfile).
