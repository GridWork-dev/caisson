# SPEC — Support-impersonation kernel with dual audit trail

**Status: EXECUTED — ADR-0187, shipped PR #42 (editions-go-live session, 2026-07-01).** Superseded language below ("DRAFT"/"proposed") is historical — kept for the SPEC's own record.

- **Slice:** LIFT slice 1 (build-now, revenue-additive sellable).
- **Edition:** Compliance.
- **Source (rebuild-clean, patterns only):** lift-sweep rank #2, gridworkdigital. Firewall-clean.
- **Type:** NEW SELLABLE (Compliance evidence capability).
- **Tags:** `security` `auth` `data-migration`.

## Goal (WHAT + WHY)

Support-staff acting on behalf of a tenant ("impersonation" / support session) is a
recurring enterprise requirement, and SOC2/HIPAA auditors want a **provable dual audit
trail**: who the acting operator was AND whose data they touched, both recorded, on both
sides. Caisson's Compliance edition has the evidence packing + audit-chain substrate
(`packages/compliance/src/evidence/`, `audit-worm`) but no first-class impersonation
primitive that emits into it. This adds a sellable, audit-grade support-impersonation
capability that feeds SOC2 + HIPAA evidence collectors.

## Scope

**In:**

- An impersonation-session primitive: `beginImpersonation({operator, targetTenant, reason})`
  → scoped session token/context, `endImpersonation()`. Time-bounded, reason-required.
- **Dual audit trail:** every impersonated action writes two linked audit records — the
  operator-identity record and the acting-as-tenant record — into the existing
  `audit-chain` (SHA-256 chain, `verifyChain`). Never a plain log.
- Wiring through `withTenant` so RLS still fail-closed-gates data access under the
  impersonated tenant (no role bypass — the GUC boundary still applies).
- Evidence collectors: SOC2 + HIPAA collectors surface impersonation sessions +
  their dual-trail records in the evidence pack (deterministic, byte-stable — reuse
  `generate.ts`/`pack-format.ts`).

**Out (defer):** a support-console UI, self-service consent flows, break-glass approval
workflows (queue as slice-2 follow-ups).

## Forks (operator must lock — see SLICE-PLAN.md F3, F5)

- **F3** Package boundary: fold into `@caisson/compliance` (evidence subsystem) vs a new
  `@caisson/impersonation` package. **Rec:** fold into `@caisson/compliance` — it needs
  audit-chain + evidence collectors + `withTenant`, all already there; a separate package
  would depend "up" on compliance internals (ADR-0003 no-depend-up violation).
- **F3b** Framework coverage at launch: SOC2 only vs SOC2 + HIPAA. **Rec:** both (the
  dual-trail is exactly what HIPAA's access-audit control wants; incremental cost is one
  collector).
- **F5** SKU: Compliance-edition fold vs per-module. **Rec:** edition fold.

## Decoupling seams

Impersonation-session store → the compliance package's existing tenant-scoped tables;
audit emission → existing `audit-chain`; no gridworkdigital operator bindings carried.

## Tasks (for PLAN)

1. Session primitive + Zod `.strict()` boundary (reason required, TTL-bounded).
2. Dual-record audit emission into `audit-chain`; `verifyChain` covers both records.
3. `withTenant` integration test proving RLS still gates under impersonation.
4. SOC2 + HIPAA evidence collector entries (deterministic pack, golden fixture).
5. Register capability in `apps/compliance` demo; rebuild registry index.

## Verify (goal-backward)

- Dual-trail test: one impersonated write produces two chained, `verifyChain`-valid records.
- RLS test: impersonated context cannot read outside the target tenant (fail-closed).
- Golden evidence-pack fixture is byte-stable and includes impersonation records.
- `bun run check` green; security review (impersonation = auth boundary) passes.

## Effort: M. Value: HIGH (net-new Compliance selling point).
