# SPEC-stub drafts — compliance-gap module candidates (draft register)

**Status: DRAFT — operator-lock required before any PLAN.** Produced by the CAISSON-76
category-wide research round (companion briefing:
`outputs/research/auditkit-gap-category-sweep-2026-07-19.md`). Each stub is pre-SPEC: Goal /
Current state / Scope / Non-goals / Forks needing an operator lock. None are locked; none may be
executed without an operator SPEC-lock round per the decisions-and-forks convention.

---

## SPEC-STUB 1 — Compliance drift monitor

- **Tags (proposed):** `product` · **Status:** DRAFT, operator-lock required
- **Prior art:** trust-ledger (AWS-only continuous drift + webhook alert), TrustOS ("live
  posture"), Comp AI's "continuous" positioning. Studied, not adopted — no code lineage.
- **Extends:** `packages/compliance-core` (the `EvidenceCollector` interface), `packages/jobs`
  (scheduling — the shape `retention-runner`'s `defineRetentionTask` already proves),
  `packages/alerting` (`AlertChannel` port).

### Goal

Today `compliance-core` generates a deterministic evidence pack **on demand** — a point-in-time
snapshot. Every cross-validated competitor positions "continuous" as the actual buyer want, and
the HN readiness thread names the same pain ("everything reactive"). This spec adds a scheduled
re-run of the existing collectors, a deterministic diff against the last known-good snapshot, and
an alert on regression — the most cross-validated gap in the sweep, at near-zero new architecture.

### Current state (grounded)

| Layer               | What exists                                                                            | Path                                                 |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Collector interface | `EvidenceCollector` with `controlId`, flag-never-guess (`unresolved`/`flagged`/`pass`) | `packages/compliance-core/src/evidence/collector.ts` |
| Scheduling pattern  | `defineRetentionTask` → `TaskDefinition` on a `JobQueue`                               | `packages/retention-runner/README.md`, ADR-0152      |
| Alert delivery      | `AlertChannel` port — Email/Webhook(+HMAC)/Slack/Telegram                              | `packages/alerting/README.md`                        |
| Evidence anchoring  | WORM chain + external anchor exists for the _log_, not yet periodic _snapshots_        | `packages/audit-worm`                                |

**The delta is composition, not invention.**

### Scope (draft — for PLAN to sharpen)

1. A `runComplianceSnapshot()` task definition (same shape as `defineRetentionTask`) re-running
   registered collectors on a schedule, persisting the result set.
2. A deterministic diff: previous vs current snapshot, per-control status transition — pure
   function, golden-testable.
3. Regression routing through the existing `AlertChannel` port — no new transport.
4. **(PAL-flagged, resolve at SPEC time):** a baseline/"accepted deviation" mechanism so a known,
   operator-acknowledged gap doesn't re-alert every run — without it this is an alert-spam
   generator.
5. **(PAL-flagged):** snapshot signing/anchoring — decide whether v1 anchors every snapshot or
   only regressions.

### Non-goals (draft)

- No new collector types — schedules and diffs the collectors that exist.
- No infra/cloud scanning (see the briefing's explicit non-fit).
- No UI/dashboard in v1 — the diff + alert is the deliverable.

### Forks needing operator lock

- **A. Baseline semantics** — "accepted deviation" as a first-class typed state on the diff
  (PAL-recommended) vs an operator runbook convention.
- **B. Snapshot anchoring scope** — every snapshot vs regressions-only.
- **C. Default schedule** — daily vs weekly (buyer-configurable either way).

---

## SPEC-STUB 2 — Access-review campaigns

- **Tags (proposed):** `product` · **Status:** DRAFT, operator-lock required
- **Prior art:** AuditKit (Pro), Probo, TrustOS. Studied, not adopted.
- **Extends:** `packages/tenancy-rls`, `packages/jobs`, `packages/audit-worm`.
- **Carried forward from** the CAISSON-76 v1 round; now 3× cross-validated.

### Goal

Audit-prep buyers must show periodic access reviews — a reviewer attests, per user, that access
is still appropriate. Caisson's honest version: a **WORM-logged attested decision record** over an
_imported_ membership snapshot, not a live-integration hub — PAL flagged that distinction as the
line between a composable module and an accidental portal.

### Current state (grounded)

Tenant/user scope (`tenancy-rls`), the scheduled-task pattern (`retention-runner`), and the
append-only decision record (`audit-worm`) all exist. No membership connector exists — by design.

### Scope (draft)

1. An `AccessReviewCampaign` data model: reviewer, reviewee list, decision (`approve`/`revoke`),
   timestamp, WORM-logged.
2. A `jobs`-riding scheduling task opening a campaign on a cadence, closing on completion or
   deadline.
3. **v1 membership input is an imported snapshot** (buyer-supplied CSV/JSON), not a live
   connector; a small connector set (GitHub org/team, Google Workspace) is a plausible v2,
   explicitly deferred.
4. Decisions compose the existing `audit-worm` chain — no new anchoring primitive.

### Non-goals (draft)

- No live IdP/SaaS connectors in v1. No reviewer-facing hosted UI/portal — thin data model +
  task; rendering is a consuming app's job. No HR/personnel data beyond the decision record.

### Forks needing operator lock

- **A. Membership-import shape** — CSV upload vs a typed `MembershipSnapshot` port (more
  composable, matches the collector-port pattern).
- **B. v2 connector priority** — explicitly NOT v1; park until real demand names an IdP.
- **C. ICP-dependent priority vs SPEC-STUB 4** — SOC2-first buyers rank this higher; ISO-heavy
  buyers rank the SoA higher. Operator call.

---

## SPEC-STUB 3 — General risk register

- **Tags (proposed):** `product` · **Status:** DRAFT, operator-lock required
- **Prior art:** AuditKit (Pro), Probo (inherent/residual scoring). Studied, not adopted.
- **Extends:** `packages/compliance-core/src/evidence/collectors/ai-risk-register.ts` (the
  EU-AI-Act-scoped proof of pattern).
- **Carried forward from** CAISSON-76 v1; 2× cross-validated.

### Goal

Generalize the shipped EU-AI-Act-scoped risk register into a framework-agnostic register with
likelihood/impact scoring. **Binding guardrail (PAL):** every field is either computed from
evidence or a WORM-attested decision — a bare freeform CRUD table is the category's failure mode
and the antithesis of flag-never-guess.

### Scope (draft)

1. Generalized schema: `risk id, subject, likelihood, impact, residual (computed, never
freeform), treatment plan, owner, evidenceDigest` — same shape discipline as the crosswalk's
   `verification` object.
2. Residual score computed from likelihood × impact; operator override is a named, WORM-logged
   exception.
3. Framework-agnostic; crosswalkable into any shipped framework pack via the `crosswalk[]`
   pointer pattern.
4. Evidence-pack export: a risk-treatment-plan artifact (the render auditors ask for).

### Non-goals (draft)

- No probabilistic/ML-inferred inputs. No general risk-management SaaS features beyond existing
  `alerting`.

### Forks needing operator lock

- **A. Residual-score override mechanics** — WORM-logged exception vs plain audit row (the
  load-bearing differentiation decision).
- **B. Relationship to the EU-AI-Act collector** — refactor onto the new schema vs keep separate
  and feed the general register (append-only-friendlier).

---

## SPEC-STUB 4 — ISO 27001 Statement of Applicability (SoA) generator

- **Tags (proposed):** `product` · **Status:** DRAFT, operator-lock required
- **Prior art:** Probo ships one; ISO 27001 audits **formally require** an SoA.
- **Extends:** `packages/frameworks-pack` (the ISO 27001 crosswalk + rollup, PR#238/ADR-0333).
- **NEW this round** — visible only once Caisson's own ISO crosswalk shipped.

### Goal

An SoA documents, per ISO 27001 Annex A control: applicable?, why, implementation status. The
crosswalk rollup already computes per-control coverage — this is almost entirely a new render
target over existing data. The cheapest build-fit candidate in the round.

### Scope (draft)

1. A pure function: crosswalk rollup + verification status → SoA rows (`control, applicable,
justification, status, evidence pointer`).
2. Render targets: the evidence pack (additive section) and — per the PAL note — a shared render
   primitive with SPEC-STUB 5 (both need filtering/redaction/citation-rendering).
3. The crosswalk SPEC's legal gate carries forward unchanged: no "verified"/"compliant" claim
   language on the ISO surface until the ADR-0319 legal engagement clears.

### Non-goals (draft)

- No new ISO control-text ingestion (bare identifiers + own-authored paraphrase, per ADR-0333's
  licensing floor). No auditor-facing interactivity.

### Forks needing operator lock

- **A. Shared "artifact rendering" lane vs standalone package** (with SPEC-STUB 5) —
  PAL-recommended: shared lane; operator call on package granularity.
- **B. Render location** — evidence pack + OSCAL first vs dashboard first.

---

## SPEC-STUB 5 — Buyer-facing trust/status-page generator

- **Tags (proposed):** `product`, `ui` · **Status:** DRAFT, operator-lock required
- **Prior art:** AuditKit ("Trust center"), Probo ("Compliance Page"), TrustOS. Studied, not
  adopted.
- **Extends:** the evidence pack + crosswalk rollup (same data as SPEC-STUB 4).
- **Reframed from** the v1 round's weak "watch" verdict — 3 competitors now independently ship it.
- **Explicitly distinct from** Caisson's own `/trust` page (ADR-0348 — Caisson's operational
  status). This is a module a **buyer** uses to publish **their** compliance posture. Do not
  conflate in PLAN.

### Goal

Every hosted competitor sells a "trust center" as a login-gated portal. Caisson's honest
substitute is a **static-render library**: the buyer's evidence pack + rollup rendered to a page
they host themselves — keep the _artifact_, refuse the _portal_.

### Scope (draft)

1. A static-site/JSON generator consuming the evidence pack + rollup; output = a deployable
   static page the buyer hosts.
2. **Binding (PAL):** first-class **redaction controls** — an explicit public/private field
   allowlist, not an opt-out. A public render of internal evidence is a real information-hazard.
3. Copy obeys ADR-0080 (readiness/posture language, never "certified/compliant").

### Non-goals (draft)

- **No auth, no reviewer sign-off, no hosted comments/NDA-gating** — any of those makes it the
  wrong-class portal under a different name. The hardest guardrail in this stub.
- No hosting service — Caisson generates, the buyer deploys.

### Forks needing operator lock

- **A. Redaction model** — allowlist-based exposure (PAL-recommended) vs denylist (rejected —
  denylists silently leak later-added fields).
- **B. Shared rendering lane with SPEC-STUB 4** — resolved together with 4.A.
- **C. NDA-gated variant** — likely a permanent non-goal; rule explicitly rather than let it
  drift in during PLAN.

---

**Summary:** five SPEC-stub-ready candidates (drift monitor · access-review campaigns · general
risk register · ISO 27001 SoA generator · buyer trust-page generator), each with open forks
needing a lock before PLAN. Three items (SIEM drivers, policy-template pack, vendor/SBOM under
the evidence-ingestion reframe) remain valid un-advanced backlog. Cloud-posture collectors are
the strongest raw demand signal but recommended against as scoped — the doctrine-safe version
(ingest Prowler/Steampipe/Checkov/Trivy _output_ as evidence) is offered for a future round.
