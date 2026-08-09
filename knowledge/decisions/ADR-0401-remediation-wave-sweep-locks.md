# ADR-0401 — Remediation-wave sweep locks: copy truth, platform-reads canonical read-SQL, tooling/ namespace moves, mechanical cuts

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 ponytail-audit remediation picker)
- **Parent:** ADR-0270 (dissolved edition vocabulary) · ADR-0080/0082 (copy laws;
  artifacts-true-to-built floor) · ADR-0328 (wave convention) · the 2026-08-09 audit ledger
  (29 confirmed / 5 downgraded / 0 refuted, workflow run `wf_67a45080-ead`)
- **Supersedes:** nothing

## Context

The 2026-08-09 repo-wide audit's remaining confirmed findings fall into four clusters the
operator locked in one picker round: customer-facing copy that contradicts the catalog,
a deliberately duplicated money-adjacent SQL seam, seller-internal packages squatting in the
sold namespace, and a long tail of mechanical dead code / dependency / CI hygiene.

## Decision

1. **Bundle-lede copy truth.** Three surfaces sell dissolved metas no bundle contains and the
   registry no longer serves (`local-first/page.tsx:228` claims `@caisson/local-ai`,
   `ai-kit/page.tsx:197` claims `@caisson/ai-kit`, `lib/module-pages.ts:1297` claims
   `@caisson/agent-dev`). The ledes rewrite to name the real member packages — manifests are
   truth, per ADR-0082's artifacts-true-to-built floor. Re-adding the metas was rejected as
   contradicting ADR-0270.
2. **platform-reads becomes the canonical home of the shared read-SQL.** The audit's
   fold-into-service shape is inverted because `@caisson/platform-reads` is a sold catalog
   package and a sold package cannot runtime-depend on the private license service. Instead the
   shared expressions (`netCharged` and the duplicated read queries) live once in
   platform-reads, and `services/license` imports them (service→package dependencies are
   legal). The `columns-contract.test.ts` DDL-drift guard stays.
3. **`packages/audit-harness` and `packages/demo-registry` move to `tooling/`** — out of the
   sold `packages/*` namespace; the `NEVER_PUBLISHED` carve in the standards gate shrinks
   accordingly. `packages/brand` stays (it feeds product UI in site+admin).
4. **The mechanical cut list executes without further per-item forks** — the audit's confirmed
   dead code (admin `catalog/signature/`, `registry/scripts/backfill.ts`, the tsgo-agreement
   CLI mode, cli `defaultEngine`, `stageCandidateTest`, demo-registry's dead exports, the four
   demo-preview JSON artifacts plus their generator emission, `KmsSigner`,
   `pricebook/conversion.ts`), dependency hygiene (jobs `ioredis`, cli's five unused devDeps,
   the 23-package `@caisson/testing` drift, signing-primitive's compliance-core devDep →
   inline fixture), CI hygiene (shared setup composite action, regulatory-claim-watch shrink,
   stale runner comments, lighthouse concurrency group, advisory retention-days convention,
   pre-commit comment truth), and the duplication shrinks (shared reconcile helper, shared
   `proxyGet`, shared entitlement-gate read, shared `shortHash`/`eventName`, license-proxy
   scaffold, `writing`/`glossary` → `.tsx`, ui/ui-pro turbo.json removal, `.gitkeep`, stray
   root PNGs). Renames ride here too: local-store's `egress-guard.ts` →
   `embed-scrub-guard.ts`; ai-meter's `pricebook.ts` → `token-rates.ts` (kills the name
   collision with the commerce pricebook both files' comments acknowledge).

## Consequences

- Net effect on the order of −11,000 lines and ~29 dependency declarations across the wave's
  PRs (ADR-0397/0399 deletions included), with zero behavior change intended outside the
  documented renames and the copy fixes.
- Every cut cites the audit ledger's per-finding evidence; anything that resists
  implementation (a hidden live reference) is skipped and reported, never forced.

## Rejected

- Folding platform-reads into services/license — delists a sold package; inverted instead.
- Moving `packages/brand` to tooling/ — live product-UI consumer in two apps.
- Re-adding dissolved metas to bundle manifests to make the copy true — ADR-0270 says no.
