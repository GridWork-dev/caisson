# ADR-0187 — Support-impersonation kernel with dual audit trail (folds into compliance)

**Status:** accepted · locked 2026-07-01 (LIFT slice-1 picker, fork F3/F3b/F5) · filed 2026-07-01 at build
(editions-go-live session), per the board's "files at build" reservation. Implements the LIFT slice-1
sellable `outputs/specs/lift-phase/SPEC-support-impersonation.md`. Relates **ADR-0003** (no-depend-up),
**ADR-0052/0054** (audit chain + WORM anchor), **ADR-0057** (control model), **ADR-0058** (evidence
determinism), **ADR-0005** (fail-closed RLS). Append-only; supersede with a later ADR, never edit.
**Tags:** `security`, `auth`, `data-migration`.

## Context

Support staff acting on behalf of a tenant is a recurring enterprise requirement, and SOC2/HIPAA
auditors want a provable dual audit trail: who the acting operator was AND whose data they touched,
recorded on both sides. Caisson has the substrate (audit-chain, evidence collectors, `withTenant`)
but no first-class impersonation primitive that emits into it. The LIFT survey ranked this the one
net-new Compliance selling point (lift-sweep #2, gridworkdigital pattern — rebuild-clean, patterns
only). The F3 fork (package boundary + framework coverage) was operator-locked 2026-07-01; this ADR
records the lock and files at build per the reservation.

## Decision

**Fold the impersonation kernel into `@caisson/compliance`** (a separate `@caisson/impersonation`
package would depend "up" on compliance internals — audit-chain seams, collectors, `withTenant` —
violating ADR-0003). Ship **both SOC2 and HIPAA access-control collectors** at launch (F3b). SKU is
the **Compliance-edition fold** — no standalone per-module price (F5, consistent with ADR-0137
below-sum).

The kernel:

- `beginImpersonation({ operator, targetAccountId, reason, ttlMs })` → a time-bounded, reason-required
  session (Zod `.strict()` boundary; fail-closed on missing reason or unbounded TTL) persisted in a
  tenant-scoped `impersonation_session` table (compliance's first own migration, ADR-0070 assembly).
- **Dual audit trail:** every impersonated action (and session begin/end) appends TWO linked records
  to the target tenant's existing audit chain (`AuditChainStore`, ADR-0052) — the operator-identity
  record and the acting-as-tenant record, linked by session id. `verifyChain` covers both; never a
  plain log.
- **RLS is not bypassed:** impersonated data access runs through `withTenant(targetAccountId)` — the
  GUC boundary still fail-closed-gates everything (ADR-0005). Impersonation grants scope, never role.
- **Evidence:** an impersonation evidence collector (pure, `EvidenceCollector` shape) surfaces
  sessions + dual-trail integrity in the evidence pack, cited by both the SOC2 and HIPAA catalogs
  (deterministic, golden-pinned per ADR-0058).

Out of scope (slice-2 follow-ups): support-console UI, self-service consent flows, break-glass
approval workflows.

## Rejected

- **New `@caisson/impersonation` package** — depends "up" on compliance internals (ADR-0003
  violation) and adds manifest/publish/gate surface for a capability that only sells inside the
  Compliance edition.
- **SOC2-only at launch** — the dual trail is exactly what HIPAA's access-audit control wants; the
  incremental cost is one collector wiring (the collectors are framework-agnostic; frameworks cite
  them).
- **Standalone SKU** — inconsistent with the ADR-0137 edition-below-sum thesis for a capability whose
  buyer is by definition a Compliance-edition buyer.

## Consequences

- `packages/compliance` grows `src/impersonation/` + its first `src/migrations/` dir (the ADR-0070
  assembler picks it up via a CONTRIBUTING entry; layout MUST be `<pkg>/src/migrations/NNNN_*.sql`).
- The evidence-pack golden fixtures change (new collector) — regenerated via `BLESS=1 bun test`, diff
  reviewed.
- The dual-trail invariant is testable: one impersonated write must produce two chained,
  `verifyChain`-valid records; an impersonated context must fail to read outside the target tenant.
