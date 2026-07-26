---
status: shipped (PR #305)
locked_by: ADR-0371
tags: [product]
date: 2026-07-20
---

# SPEC — Access-review campaigns

**Goal.** Audit-prep buyers must show periodic access reviews — a reviewer attests, per user,
that access is still appropriate. Caisson's honest version: a WORM-logged attested decision
record over an imported membership snapshot — a composable module, never a portal.

**SKU posture (ADR-0371):** NEW catalog module on a **reserved id** (sold-unpublished pattern) —
not sellable, not displayed, until the follow-up pricing round arms it.

## Scope

1. `AccessReviewCampaign` data model: reviewer, reviewee list, decision (`approve`/`revoke`),
   timestamp — every decision WORM-logged through the existing `audit-worm` chain (no new
   anchoring primitive).
2. **Membership input: a typed `MembershipSnapshot` port** (EvidenceCollector-style shape
   discipline); CSV/JSON loaders ship as trivial adapters on the port.
3. A `jobs`-riding scheduling task opening a campaign on a cadence and closing on completion or
   deadline; tenant scoping composes `tenancy-rls`.
4. **v2 milestone (named, NOT built in v1): a GitHub org/team connector** implementing the
   `MembershipSnapshot` port. Google Workspace stays unplanned.

## Non-goals

- No live IdP/SaaS connectors in v1. No reviewer-facing hosted UI/portal — thin data model +
  task; rendering is a consuming app's job. No HR/personnel data beyond the decision record.

## Verification

- Round-trip: snapshot in → campaign opened → decisions recorded → WORM rows verify against the
  chain.
- Deadline test: campaign auto-closes at deadline with undecided reviewees flagged
  (`unresolved`, flag-never-guess), never auto-approved.
- Port test: the CSV adapter and a direct in-memory implementation produce identical campaign
  inputs.
