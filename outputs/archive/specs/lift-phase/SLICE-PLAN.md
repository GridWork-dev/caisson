# LIFT Phase — Two-Slice Plan

**Status: FORKS LOCKED (operator picker 2026-07-01) — spec-ready; ADRs 0186–0188 to be filed at lift-phase kickoff before code.**
F1/F2/F3/F5 locked to the recommendations below; F4 locked to the fail-loud `--domains` rec (it is the
must-fix for `reconcile()`'s silent domain false-close, so it is a correctness fix, not a preference).
Builds AFTER the edition-seam PR merges. Runs after the audit phase (F4/audit-harness gates it).
Spec-gated (ADR-0133 §4): no product code before its per-package SPEC/ADR is locked.
ADR ceiling 0185; next free 0186. Pro-private firewall respected (gridwork-core / Wardfile
/ tessera / lift-sweep repos only; never media-pipeline).

**Excluded (already built + folded, Stage-2 Stream B, ADR-0150–0153):** `@caisson/alerting`,
`@caisson/retention-runner`, `@caisson/tool-exec`, `@caisson/audit-harness` (scaffold only —
its _completion_ is slice 1). Also: `local-ai` (superseded by `@caisson/local-store` RRF),
`ai-meter` (Caisson `breaker.ts` strictly ahead), `agent-kernel` (already shipped in agent-dev).

---

## Slice 1 — build-now: new sellables + the audit driver

**Theme:** ship the two revenue-additive modules that _complete an edition story_ + fix
and wire the audit-harness so the parallel whole-repo audit phase can actually run.

1. **`@caisson/agent-runner`** (Agentic-Dev, NEW SELLABLE) — SPEC-agent-runner.md → ADR-0186
2. **Support-impersonation kernel + dual audit trail** (Compliance, NEW SELLABLE) — SPEC-support-impersonation.md → ADR-0187
3. **`@caisson/audit-harness` pipeline completion + audit driver** (internal) — SPEC-audit-harness-pipeline.md → ADR-0188

**Rationale:** agent-runner is the single highest-value net-new lift in the whole survey —
gridwork-core is otherwise mined out, and this one primitive turns Agentic-Dev from
"scaffolding" into a runnable, auditable, secret-leak-proof product. Support-impersonation
is the one net-new _Compliance_ selling point in the lift-sweep top-15 (dual audit trail =
SOC2/HIPAA access-control evidence). The audit-harness work carries a **must-fix
correctness bug** (`reconcile()` silently false-closes unaudited domains) and is the
gating dependency for the audit phase running in parallel — small effort, high unblock.
Everything here is either new revenue or unblocks a running phase; nothing speculative.

---

## Slice 2 — later wave: hardening tail + edge sellables

**Theme:** base hardening (Wardfile 6 + convergent lift-sweep ranks), ai-evals depth, and
the low-incremental-value gridwork-core clean-lifts — sequenced after slice 1, ordered by
security-criticality within the wave.

- **Security-critical hardening (pull to front of slice 2):** Wardfile B4 billing-webhook
  verify-before-parse (converges lift-sweep #6 multi-provider toolkit); Wardfile B2
  audit-worm S3 Object-Lock retention escalation (Compliance evidence-retention gate).
- **Base hardening (Wardfile + convergent lift-sweep):** B5 field-crypto self-describing
  envelope + key_version; B6 + lift-sweep #7/#8 tenancy-rls transaction-scoped GUC + role
  pre-flight + RLS codegen/migration-equivalence; B3 branded-money + rounding provenance
  (kernel/pricebook); B1 + lift-sweep #14 jobs idempotent enqueue + visibility ledger;
  lift-sweep #9 dual hash/lookup-key session-token (auth).
- **ai-evals depth (lift-sweep #5/#11/#15):** Wilson-CI budget-isolated goldset gate,
  reflexivity-queue accumulator, Fleiss-kappa ensemble-agreement guard.
- **Guardrails:** `egress-guard` `looksLikeSecret` free-text credential gate (S, gridwork-core
  fill-a-gap); lift-sweep #13 FTC-4Ps dark-pattern presentation guardrail.
- **Low-value clean-lifts / verify-and-close:** ai-config/prompt-registry/observability/
  ai-kit/mcp-server hardening (Caisson mostly ahead — verify-then-close, don't re-derive);
  gridwork-core remaining-8 full harvest; lift-sweep #12 MinHash/LSH dedup-before-meter.

**Rationale:** all hardening of surfaces that already ship and work (go-live deployed
2026-07-01), so none blocks revenue. Wardfile B4/B2 are the highest-priority _within_ this
wave (webhook-tamper + evidence-retention), and the operator's stated split places all
Wardfile base-hardening in slice 2 — honored, with B4/B2 flagged for front-of-wave. The
rest is depth + polish where Caisson is already competitive; verify-and-close beats
re-lifting.

---

## Forks — LOCKED (operator picker 2026-07-01)

All locked to the recommendation column. F1+F2+F5 = the agent-runner + pricing package; F3 =
support-impersonation into compliance; F4 = the audit-harness correctness fix.

| id     | question                                                    | LOCKED decision                                                                                                                                            |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | agent-runner package boundary + license                     | New commercial `@caisson/agent-runner`, Agentic-Dev member (separate from agent-dev to keep the emitter/kernel clean)                                      |
| **F2** | agent-runner provider config shape                          | Provider-agnostic `{binary, baseUrlEnv, authEnv, model}` (generalize off the z.ai/`claude`-CLI source)                                                     |
| **F3** | support-impersonation package boundary + framework coverage | Fold into `@caisson/compliance` (needs audit-chain/collectors/withTenant — a separate pkg would depend "up", ADR-0003); ship SOC2 **and** HIPAA collectors |
| **F4** | audit-harness reconcile-scope API + dispatcher home         | Explicit required `--domains` scope (fail-loud); dispatcher + Challenger driver **outside** the package in a skill (honor ADR-0134 / AGENTS.md boundary)   |
| **F5** | pricing/SKU for the two new sellables                       | Fold into their edition prices (Agentic-Dev / Compliance), no standalone per-module SKU (consistent with ADR-0137 edition-below-sum)                       |

Decisions locked 2026-07-01. ADRs 0186 (agent-runner, F1/F2/F5-agentic), 0187 (support-impersonation,
F3), 0188 (audit-harness pipeline, F4) get FILED in `knowledge/decisions/` at the lift-phase kickoff
(before any code — spec-gated), with the fork board updated in `docs/state/decisions-and-forks.md` then.
