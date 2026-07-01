# ADR-0134 — Cross-domain audit/validate harness (full build): surface manifest + reconciling ledger + `/validate` spine

Status: accepted · 2026-06-30 (harvest grill session, operator lock #3) · **document-only — no code
lands under this ADR** · extends ADR-0101 (deterministic design-quality gates, generalizes its
pattern beyond design) · internal engineering tooling, distinct from ADR-0135's buyer-facing
Compliance modules · sequenced inside the post-go-live harvest initiative (ADR-0133). Append-only;
supersede with a later ADR, never edit.

## Context

ADR-0101 (2026-06-29, design-system-harden track) wired six deterministic design-quality gates plus
a non-blocking advisory critic (`tooling/design-critic`, `findings.toml`) — scoped to the
design/UI surface only. The sibling `Wardfile` repo carries a more general version of the same
idea: a declared audit-surface manifest spanning **every** domain, one reconciling ledger instead of
N siloed reports, a workflow-scope guard, and a `/validate` command that escalates high-risk
findings to a cross-vendor adversarial review before the finding is trusted. The harvest grill
session locked building the **full** version of this pattern for Caisson, generalizing ADR-0101
rather than leaving it design-only.

## Decision

Build, post-go-live, inside the harvest initiative (ADR-0133):

1. **Audit surface manifest.** A declared inventory of every auditable domain in the monorepo —
   security, RLS/tenancy, licensing/SPDX (the ADR-0094/0097/0111 open↔commercial boundary), design/UI
   (ADR-0101, unchanged), the standards gate itself, evidence/compliance controls (ADR-0057) — each
   with its own checker(s). This generalizes `tooling/design-critic` beyond design without replacing
   it.
2. **Unified cross-domain reconciling ledger.** One append-only ledger (mirrors the registry
   `ledger.jsonl` idiom, ADR-0021) recording every finding across every domain, so a security finding
   and a design finding reconcile against the same source of truth instead of N independent reports
   with no shared history.
3. **Workflow-scope guard.** A new check verifying a given CI workflow/job touches only the domain(s)
   it is declared to be scoped to — catches scope creep (e.g. a design-gate job starting to touch RLS
   migration files).
4. **`/validate` multi-provider spine — high-risk findings only.** Routine lint-level findings are
   unaffected. A finding flagged high-risk escalates to **PAL `challenge` twice** (two independent
   adversarial passes); the finding survives only if **neither** pass refutes it (majority-kills);
   any tie, or either pass failing to render a verdict, **defaults to refuted** — a high-risk finding
   must actively survive scrutiny to block anything, not merely go unchallenged.

## Why

- **One-off checkers don't scale past design.** ADR-0101 solved design; every new domain (RLS,
  licensing, evidence) would otherwise reinvent its own checker with no shared ledger and no
  adversarial-verification discipline, duplicating effort and losing cross-domain correlation.
- **Fail-closed-by-default matches the repo's own tenancy/RLS philosophy** (ADR-0005) — applying the
  same "assume wrong until proven right" posture to high-risk audit findings (default-to-refuted) is
  consistent with how the rest of the platform already treats trust boundaries.
- **"FULL" was the explicit lock**, not a partial manifest-only build — the operator chose the
  complete pattern (manifest + ledger + scope-guard + adversarial `/validate` spine) over a
  cheaper subset.

## Scope note

This is **internal engineering tooling** — Caisson's own build/audit pipeline — not a sellable
buyer-facing module. Distinguish sharply from ADR-0135's two new commercial Compliance packages,
which ship _inside_ buyer products.

## Rejected

- **Keep N siloed one-off checkers (status quo)** — rejected; no reconciling ledger means findings
  drift and duplicate across domains with no shared history.
- **Build the manifest + ledger only, skip the `/validate` adversarial spine** — rejected; "FULL" was
  the explicit operator lock, not the cheaper partial build.
- **Make the harness blocking in `bun run check`** — rejected (implicit in the design); it stays
  non-blocking/advisory like ADR-0101's `findings.toml`, escalating only high-risk findings through
  the adversarial spine rather than gating every commit on it.

## Relations

Extends ADR-0101 (generalizes its critic + gate shape beyond design). Composes ADR-0016 (CI/CD
standards gate — the harness sits beside, not inside, the blocking gate, same non-blocking-advisory
posture as ADR-0101). Uses PAL `challenge` per the GridWork operator-level convention (cross-vendor
LLM work routes through PAL → OpenRouter) — cited for the mechanism this harness reuses, not as a
Caisson-specific dependency introduced by this ADR.

## Downstream

`docs/state/harvest-program.md` tracks this as one ranked item inside the post-go-live harvest wave,
alongside the package harvest (ADR-0133) and the two new Compliance modules (ADR-0135).

## Binding

The full cross-domain audit/validate harness — surface manifest, reconciling ledger, workflow-scope
guard, and the PAL-`challenge`-×2 majority-kills `/validate` spine for high-risk findings — is locked
for a post-go-live build, generalizing ADR-0101 rather than leaving it design-scoped. Building a
partial version, or making the harness a blocking gate, requires a superseding ADR.

Evidence: `harvest-doc-plan.md` operator lock #3; `knowledge/decisions/ADR-0101`; the Wardfile
cross-domain audit/validate harness pattern (session-transcript sourced, 3 analysis blocks —
product-code top-6 + harness pattern + principles).
