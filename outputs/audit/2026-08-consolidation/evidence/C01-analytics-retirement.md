# C01 — retire `@caisson/analytics`

**Verdict:** DECISION-GATED DELETE/DELIST  
**Size:** 318 product TS + 268 test TS = 586 LOC  
**Confidence:** high internal non-use; low external-use confidence

## Evidence

- Repository-wide import search found no production or test consumer outside the package.
- First-party site and license-service PostHog paths bypass it:
  `apps/site/lib/ask-ai/ai-capture.ts:1-10` and
  `services/license/src/posthog-capture.ts:94-146`.
- It remains a documented public provider API at `packages/analytics/src/index.ts:1-17` and was
  explicitly authorized by ADR-0287 (`knowledge/decisions/ADR-0287-catalog-wave1-drivers-and-template.md:16-27`).
- It is Apache-2.0 and part of the canonical Open Base surface
  (`docs/state/public-surface.md:25-40`).
- Registry state is live: latest `0.2.7` at `registry/index.json:2343-2364`, publish row at
  `registry/ledger.jsonl:826`, current tarball at `registry/tarballs.json:1296-1306`.
- It has no paid bundle membership or paid entitlement/grandfathering burden.

## Registry/revenue

The package is Apache-2.0, publicly published, current in the index, and present in retained
tarballs. It is not a paid SKU and is absent from paid bundle membership, so retirement needs an
append-only module delist but no paid snapshot/grandfathering migration. Runtime revenue exposure is
zero inside this repository; public-consumer exposure is unknown.

## Required retirement shape

1. External-usage/download check and operator ADR.
2. Append-only module delist; retain all publish and tarball provenance.
3. Remove it from Open Base/public compatibility, docs, and any generated surface.
4. Publish a deprecation notice before source removal if external use is non-zero.

## Refute attempt

The refuter confirmed internal zero use but rejected “dead private package” framing because the API
is public, current, and recently published. The candidate survives only as a deliberate public
product retirement, never as a mechanical deletion.

**Buyer/site notice:** current Caisson runtime would not notice; external OSS consumers might.
