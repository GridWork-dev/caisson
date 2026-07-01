# ADR-0133 — AI/agent-infra harvest initiative: gridwork-core substrate + Wardfile base lifts, post-go-live

Status: accepted · 2026-06-30 (harvest grill session, operator locks #1-#2) · **document-only — no
code lands under this ADR** · spec-gated per the standing cadence rule ("no product code before the
spec/ADR it implements is locked," root `CLAUDE.md`) · sequenced strictly after the store-rework
locks (ADR-0129/0130/0131) and the Railway provisioning/DNS cutover · tracked execution order lives
in `docs/state/harvest-program.md`. Append-only; supersede with a later ADR, never edit.

## Context

Two sibling GridWork repos were scouted this session as harvest sources: `gridwork-core` (the
operator's own agent-tooling monorepo, 142-component inventory) and `Wardfile` (a prior product-code
base, 6 top lifts + an audit-harness pattern). Neither is a stranger repo — both are GridWork-owned
— but Caisson's standing discipline (the pro-private firewall on `media-pipeline`, root `CLAUDE.md`)
already establishes the principle this ADR extends to every harvested repo, not just
`media-pipeline`: **patterns and ideas transfer, implementation never does.** Caisson's license
surface, dependency graph, and productized shape must stay independent of any source repo's
internal seams.

## Decision

1. **Intent — this is a product investment, not an internal-only port.** The 11 target gridwork-core
   packages become **sellable substrate** for the two AI editions:
   - → **Agentic-Dev**: `agent-kernel`, `agent-dev`, `ai-config`, `ai-evals`, `guardrails`,
     `observability` (six, per the operator's literal split in the grill session).
   - → **AI Production Kit**: `ai-kit`, `ai-meter`, `local-ai`, `mcp-server`, `prompt-registry`
     (five — `prompt-registry` completes the count to the eleven named in the consolidated
     inventory; see the reconciliation note below).
2. **The 6 Wardfile product-code lifts harden the BASE substrate**, not a new edition: jobs/boss
   typed-queue → `jobs`; `artifact/store.s3` WORM → `audit-worm`'s `ArtifactStore`; units
   branded-money → `kernel`; `billing/webhooks` verify-before-parse → `billing`; field-crypto
   envelope+`key_version` → `field-crypto`; `withTenant` `SET LOCAL ROLE` → `tenancy-rls`. These are
   upgrades to existing shipped base packages, not new SKUs.
3. **Sequencing — all post-go-live.** The store-rework (ADR-0129/0130/0131) and the Railway
   provisioning/DNS cutover finish first. The harvest (11 packages + 6 Wardfile lifts + the audit
   harness, ADR-0134) is the **next** initiative, started only after the dashboard ships live. The
   Wardfile lifts are explicitly **not** folded into go-live — a deliberate choice against bundling
   hardening work into the current cutover.
4. **Spec-gate.** No code lands for any harvested package or lift before its own per-package SPEC is
   authored and locked. This is the standing cadence rule, restated here because a cross-repo
   harvest carries a real temptation to copy code directly across a shared-ownership boundary — that
   temptation is explicitly rejected (see Rejected, below).

## Reconciliation note (10 named vs. 11 total)

The operator's literal edition split in the grill session names 10 packages (6 + 4). The
consolidated inventory used for `docs/state/harvest-program.md` lists **11**, including
`prompt-registry`. This ADR resolves the gap by routing `prompt-registry` to AI Production Kit — it
parallels Caisson's own existing `prompt-registry` module (ADR-0061), already living in that
edition. One asymmetry is preserved as-locked and flagged, not resolved here: the operator's split
routes gridwork-core's `ai-evals` and `guardrails` to **Agentic-Dev**, even though Caisson's own
same-named modules (ADR-0062, ADR-0063) already live in **AI Production Kit**. Whether
gridwork-core's versions harden the existing AI-Kit modules or seed genuinely new Agentic-Dev
capability under the same names is a per-package SPEC-time question (Decision §4), not resolved by
this ADR.

## The 8 recurring decoupling seams

Every harvested package needs its **own** instance of these swaps before it is sellable — these are
not gridwork-core-specific, they recur across the inventory:

`postgres-events` → a `MeteringStore` port · OpenRouter-direct → a provider interface (AI-Kit's
existing gateway port, ADR-0059, is reused here, not reinvented) · exec-allowlist → injected config
· `hooks.py` → config-driven · 7-act lifecycle enums → parameterized · `gw` CLI → command shapes ·
`tg-bridge` → a `NotificationSink` · `~/.gridwork/env` → a credential resolver.

## Clean-lift shortlist (document-only reference, not a build order)

`ai-kit` fetch/OpenRouter/embeddings · `guardrails` secret-detect + timing-safe compare + security
headers + sandbox execution · the audited exec endpoint (a governed-tool-call primitive for
`agent-kernel` — converges with the gridworkdigital shell-allowlist lift, lift-sweep rank #10) ·
`local-ai`'s sqlite-vec store · MCP manifest + ledger · `ai-evals` exit-classifier + judge ·
`ai-meter` cost-math. Full ranked list: `docs/state/harvest-program.md`.

## Why

- **The 11-package substrate is the single biggest harvest source** in this session's three-way
  scout (gridwork-core inventory vs. Wardfile's 6 lifts vs. the 6-repo lift sweep) — it gets full
  weight in the tracking doc, not treated as one lift among many.
- **Post-go-live sequencing avoids scope-blocking the store rework.** Store-rework ships first
  because it is the revenue-unlocking work; harvest deepens two editions that are already
  buyable (per ADR-0130) but not yet fattened.
- **Base-not-edition for the Wardfile lifts** because they harden packages every edition already
  depends on (`jobs`, `kernel`, `billing`, `field-crypto`, `tenancy-rls`, `audit-worm`) — a new SKU
  would misrepresent them as edition-scoped when their value is platform-wide.

## Rejected

- **Fold the harvest into go-live** — rejected; the operator explicitly chose "all post-go-live"
  over folding hardening work into the current cutover.
- **Port gridwork-core code directly** — rejected; violates the pro-private-firewall-style
  discipline this ADR extends to every harvested repo, including GridWork's own sibling repos.
  Rebuild-clean only.
- **Treat the harvest as internal-only tooling** — rejected; the operator's lock explicitly frames
  this as a **product** investment (new sellable modules), not an internal port.

## Relations

Composes ADR-0065/0066 (`agent-kernel`/Agentic-Dev base — the harvest hardens, does not fork, these
existing packages), ADR-0059-0063 (AI-Kit gateway/metering/prompt-registry/eval/guardrails), ADR-0075
(observability `EventSink` port — gridwork-core's `observability` package is a candidate
pattern/driver source for this existing port, not a new port). Cross-references ADR-0134 (the audit
harness, a related but distinct internal-tooling lock inside the same harvest wave) and ADR-0135
(the two new Compliance modules sourced from the 6-repo lift sweep, the third harvest source).

## Downstream

`docs/state/harvest-program.md` is the ranked, consolidated execution-order tracking doc across all
three harvest sources (gridwork-core inventory, Wardfile lifts, the 6-repo lift sweep) — this ADR
locks the **why/what/sequencing**; that doc tracks the **when/order**.

## Binding

The 11 gridwork-core packages are locked as sellable substrate for Agentic-Dev + AI Production Kit,
sequenced strictly post-go-live; the 6 Wardfile lifts hardening the base are locked alongside them,
also post-go-live; every harvested package/lift requires its own SPEC before any code lands.
Changing the sequencing, the edition mapping, or the rebuild-clean discipline requires a superseding
ADR.

Evidence: `harvest-doc-plan.md` operator locks #1-#2; the gridwork-core 142-component inventory
(session-transcript sourced); the Wardfile lift-map (session-transcript sourced);
`docs/state/harvest-program.md`.
