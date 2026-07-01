# Post-go-live harvest program — ranked execution order

Status: **document-only — nothing here is executed.** Authored 2026-06-30 (harvest grill session).
Consolidates **three** harvest sources into one ranked program: the gridwork-core 142-component
inventory, the Wardfile lift map, and the 6-repo lift sweep (`caisson-lift-sweep-REPORT.md`). Locks:
`knowledge/decisions/ADR-0133` (gridwork-core substrate + Wardfile base lifts), `ADR-0134` (the
cross-domain audit/validate harness), `ADR-0135` (the two new Compliance modules). Sequencing:
strictly **post-go-live** — the store-rework (`ADR-0129`/`0130`/`0131`) and the Railway
provisioning/DNS cutover finish first (`docs/build-state.md`); this is the **next** initiative.
Every item below is **spec-gated**: no code lands for anything on this page before its own
per-package SPEC is authored and locked (root `CLAUDE.md` cadence). Live board:
`docs/state/decisions-and-forks.md`.

## Why one consolidated program, not three lists

The three source scouts ran independently and overlap in places (e.g. gridwork-core's `guardrails`
package vs. the lift-sweep's guardrails candidates target the same Caisson package from different
angles). Tracking them as one deduped, ranked list — instead of three parallel backlogs — is the
actual "document all this" deliverable this page exists to be.

---

## Source A — gridwork-core 142-component inventory (full weight: the biggest harvest)

This is the single largest harvest source in the program — it gets full weight, not treated as one
lift among many.

### The 11 target packages, mapped to editions (ADR-0133)

| Package           | Feeds edition                       | Note                                                                                                                                                                                                          |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-kernel`    | Agentic-Dev                         | Closest 1:1 lift target in the whole harvest — see the lift-sweep rank #4 (Source C) for the governed-agent-kernel reference implementation.                                                                  |
| `agent-dev`       | Agentic-Dev                         | Schema/lifecycle layer.                                                                                                                                                                                       |
| `ai-config`       | Agentic-Dev                         | Provider-agnostic config, already a Caisson base package (ADR-0011) — this hardens it.                                                                                                                        |
| `ai-evals`        | Agentic-Dev (per the operator lock) | **Flagged asymmetry:** Caisson's own `ai-evals` module (ADR-0062) already lives in AI Production Kit. Per-package SPEC resolves whether this hardens the existing module or seeds new Agentic-Dev capability. |
| `guardrails`      | Agentic-Dev (per the operator lock) | Same flagged asymmetry as `ai-evals` — Caisson's own `guardrails` (ADR-0063) is in AI Production Kit today.                                                                                                   |
| `observability`   | Agentic-Dev                         | Candidate driver/pattern source for the existing `EventSink` port (ADR-0075).                                                                                                                                 |
| `ai-kit`          | AI Production Kit                   | fetch/OpenRouter/embeddings — clean-lift shortlist item.                                                                                                                                                      |
| `ai-meter`        | AI Production Kit                   | Cost-math — clean-lift shortlist item.                                                                                                                                                                        |
| `prompt-registry` | AI Production Kit                   | Completes the 11-count; parallels Caisson's existing `prompt-registry` (ADR-0061).                                                                                                                            |
| `local-ai`        | AI Production Kit                   | sqlite-vec store — clean-lift shortlist item.                                                                                                                                                                 |
| `mcp-server`      | AI Production Kit                   | Manifest + ledger — clean-lift shortlist item.                                                                                                                                                                |

### Clean-lift shortlist (rebuild-clean, not ported)

- `ai-kit` fetch/OpenRouter/embeddings.
- `guardrails` secret-detect + timing-safe compare + security headers + sandbox execution.
- The audited exec endpoint — becomes a governed-tool-call primitive for `agent-kernel`; converges
  with the gridworkdigital shell-execution-allowlist lift (Source C, rank #10).
- `local-ai`'s sqlite-vec store.
- MCP manifest + ledger.
- `ai-evals` exit-classifier + judge.
- `ai-meter` cost-math.

### The 8 recurring decoupling seams

Every harvested package needs its own instance of these swaps — not gridwork-core-specific, they
recur across the inventory:

`postgres-events` → `MeteringStore` port · OpenRouter-direct → provider interface (reuses AI-Kit's
existing gateway port, ADR-0059) · exec-allowlist → injected config · `hooks.py` → config-driven ·
7-act lifecycle enums → parameterized · `gw` CLI → command shapes · `tg-bridge` → `NotificationSink`
· `~/.gridwork/env` → credential resolver.

### Skip boundary

Anything genuinely internal to gridwork-core's own operator-tooling role (session orchestration,
the `gw` CLI's own dispatch mechanics, telemetry specific to the GridWork operator's daemon
topology) does not harvest — only the 11 packages above, and only their generic substrate, not their
gridwork-core-specific wiring.

---

## Source B — Wardfile lifts

### Product-code top-6 (harden the BASE, per ADR-0133 — not a new edition)

| Lift                                   | Target base package            |
| -------------------------------------- | ------------------------------ |
| `jobs`/boss typed-queue                | `jobs`                         |
| `artifact`/`store.s3` WORM             | `audit-worm` (`ArtifactStore`) |
| Units branded-money                    | `kernel`                       |
| `billing`/webhooks verify-before-parse | `billing`                      |
| field-crypto envelope + `key_version`  | `field-crypto`                 |
| `withTenant` `SET LOCAL ROLE`          | `tenancy-rls`                  |

### Audit-harness pattern

Generalizes into the full cross-domain audit/validate harness — see **`ADR-0134`** for the locked
decision (surface manifest + reconciling ledger + workflow-scope guard + `/validate` PAL-`challenge`
×2 majority-kills spine). This is internal engineering tooling, not a sellable module.

---

## Source C — 6-repo lift sweep (`caisson-lift-sweep-REPORT.md`)

Six paused GridWork repos (telesis, gridwork, gridworkdigital, throughframe, glossread, tm-watch)
scouted with adversarial critic correction; 37 raw candidates flagged, 9 downgraded on second pass.
**Provenance discipline:** all six repos are cleared rebuild-clean — patterns and ideas transfer,
implementation never does (the same pro-private-firewall-style discipline ADR-0133 extends beyond
`media-pipeline` to every harvested repo).

### Top-15 highest-value lifts (ranked, per the report)

| Rank | Candidate                                                                               | Repo            | Caisson target                                   |
| ---- | --------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| 1    | Multi-channel alerting pipeline (dedup→cap+digest→quiet-hours→delivery→audit)           | gridworkdigital | `NEW-PKG:@caisson/alerting` (locked, `ADR-0135`) |
| 2    | Support-impersonation kernel w/ dual audit trail                                        | gridworkdigital | soc2/hipaa evidence                              |
| 3    | Data retention / right-to-erasure runner                                                | gridworkdigital | `NEW-PKG:retention-runner` (locked, `ADR-0135`)  |
| 4    | Governed agent-run kernel (hermes)                                                      | telesis         | `agent-kernel`                                   |
| 5    | Dependency-free golden-set eval — Wilson-CI gate + budget-isolated eval ledger          | telesis         | `ai-evals`                                       |
| 6    | Multi-provider webhook signature-verification toolkit                                   | gridworkdigital | Base webhooks                                    |
| 7    | RLS policy codegen + migration-equivalence harness                                      | telesis         | `@caisson/rls` (`tenancy-rls`)                   |
| 8    | Transaction-scoped tenancy GUC binding + role pre-flight guard                          | telesis         | `@caisson/rls` (`tenancy-rls`)                   |
| 9    | Dual hash/lookup-key session-token storage                                              | telesis         | `auth`                                           |
| 10   | Sandboxed shell execution allowlist w/ argument provenance                              | gridwork        | `agent-kernel`                                   |
| 11   | `eval_feed.consolidate_reflexivity_queue` — production-disagreement goldset accumulator | throughframe    | `ai-evals`                                       |
| 12   | Pre-call MinHash/LSH dedup-before-meter gate                                            | throughframe    | `ai-meter`                                       |
| 13   | Scareware/dark-pattern presentation guardrail (FTC 4Ps)                                 | tm-watch        | `guardrails`                                     |
| 14   | Idempotent polyglot job-queue seam (SKIP LOCKED claim-index + upsert-in-tx enqueue)     | glossread       | `jobs`                                           |
| 15   | Reflexivity guard: Fleiss-kappa ensemble agreement + counterfactual stability check     | throughframe    | `ai-evals`                                       |

### The 2 NEW-PKG candidates

`NEW-PKG:@caisson/alerting` (rank #1) and `NEW-PKG:retention-runner` (rank #3) — both locked as new
commercial Compliance modules in **`ADR-0135`**. Both are audit-_logging_ primitives (plain
Postgres rows in their source repos), explicitly **not** WORM/audit-chain upgrades — see ADR-0135's
"Genericness" section.

### Where Caisson is already ahead — do NOT downgrade

- **`ai-meter`** (`breaker.ts`/`meter.ts`) — persistent, RLS-scoped, fail-closed Postgres circuit
  breaker, reserve-before/reconcile-after — strictly ahead of every surveyed spend-tracking
  candidate (telesis's in-process `ExtractBudget`, throughframe's best-effort `emit_cost_event`).
- **`audit-chain.ts`** — canonicalize + SHA-256 chain + `verifyChain` against a trusted anchor —
  ahead of throughframe's flat unanchored provenance stamp.
- **`compliance/evidence/generate.ts` + `pack-format.ts`** — flag-never-guess assembly, deterministic
  byte-stable ZIPs — ahead of throughframe's bounded-truncated-reject-record approach.
- **audit-worm/audit-chain design generally** — every "X-as-WORM" candidate surfaced across the
  6-repo survey turned out to be ordinary audit-_logging_ dressed up as tamper-evidence (see
  ADR-0135's Genericness section for how this applies to the two NEW-PKG candidates specifically).
- **field-crypto** — no KMS-integration was found in any surveyed repo; Caisson should already be
  ahead once its own KMS wiring (`docs/state/adapter-expansion.md` §1B) lands.

---

## Ranked execution order (suggested — document-only, not scheduled)

Consolidated across all three sources, deduped where a target package appears in more than one
source. This is a **suggested** order, not a locked sequence — each wave still needs its own
per-package SPEC before code lands (ADR-0133 §4).

1. **Lift-sweep top-15 (Source C)** — highest-value-per-effort per the adversarially-corrected
   ranking; ranks #1 and #3 (the two NEW-PKG modules) are already locked as ADR-0135 and can start
   as soon as the harvest wave opens.
2. **gridwork-core clean-lift shortlist (Source A)** — `ai-kit` fetch/OpenRouter/embeddings,
   `guardrails` primitives, the exec-endpoint governed-tool-call pattern, `local-ai` sqlite-vec,
   MCP manifest+ledger, `ai-evals` exit-classifier+judge, `ai-meter` cost-math — these overlap
   several Source-C ranked items (e.g. rank #10's shell-allowlist converges with the exec-endpoint
   lift) and should land alongside wave 1, not after it.
3. **Wardfile base lifts (Source B, top-6)** — these harden packages every edition depends on;
   sequence after the higher-value edition-facing work in waves 1-2 lands, since they are
   maintenance-hardening rather than new sellable surface.
4. **The remaining 8 gridwork-core packages** (`agent-kernel`, `agent-dev`, `ai-config`,
   `mcp-server`, `observability`, `prompt-registry`, plus the flagged-asymmetry `ai-evals`/
   `guardrails` resolution) — the fuller package-level harvest beyond the clean-lift shortlist.
5. **The cross-domain audit/validate harness (`ADR-0134`)** — internal tooling; not customer-facing,
   lowest urgency of the four waves, can run in parallel with any of the above once its own SPEC is
   ready.
6. **Remaining lift-sweep candidates** (ranks outside the top-15, the "nice-to-haves / deepening
   existing packages" list, and the "skip/doc-note only" items) — lowest priority, revisit after
   waves 1-5 land.

## Binding

This page is the single ranked, deduped harvest tracking doc across all three sources. It does not
lock new decisions on its own — `ADR-0133`/`ADR-0134`/`ADR-0135` are the binding artifacts. Update
this page's ranking (not the ADRs) as waves complete or re-rank; a change to WHAT is harvested or
WHY requires a superseding ADR, not just an edit here.

Evidence: `harvest-doc-plan.md`; `pricing-and-store-rework-plan.md`; `caisson-lift-sweep-REPORT.md`;
`knowledge/decisions/ADR-0133`, `ADR-0134`, `ADR-0135`; `docs/state/adapter-expansion.md` (a
parallel, separately-tracked driver-expansion roadmap — not part of this harvest program).
