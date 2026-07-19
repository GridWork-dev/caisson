# ADR-0367 — Glossary expansion batch (7 terms) + release-tail posture locks

**Status:** accepted · 2026-07-19 (late-PM picker round, operator-locked). Extends ADR-0235
(a NEW Fork-A lock — the only path to added terms under its "never add without a new lock"
rule); corrects the stale "glossary is the next build lane" note carried by the ADR-0366
picker record; amends ADR-0326's credential-job runner carve at the arming boundary
(completing the ADR-0365 lock-1 move). Append-only; supersede with a later ADR, never edit.
**Tags:** (none — marketing/SEO surface + CI-comment posture; REVIEW-only at SHIP).

## Context

The ADR-0366 picker row recorded "glossary program is the next build lane," but the program
had already shipped IN FULL on 2026-07-03 (ADR-0235: renderer + hub + DefinedTerm JSON-LD +
all cluster batches; 36 terms live including the 4 AEO additions). Meanwhile the release-tail
residual row still described `deploy-railway` as a designed-inert hosted red, though it had
followed the other credential legs to Blacksmith the same day (ADR-0365 lock-1 provision).
The operator directed: execute the armed lane and the in-repo residue, and disposition the
internally-gated parked items.

## Decision

| Fork                      | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glossary lane**         | **Expand + audit.** (1) An adversarial content re-verify over the 36 live pages (the ADR-0235 Fork-B workflow shape: per-term skeptics, opus on the compliance cluster, independent refutation pass on every finding); confirmed findings fix in the same PR. (2) A NEW Fork-A lock (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Fork-A expansion lock** | **All 7 candidates ship** as the expansion batch, each mapping to a surface shipped since the original lock: `rfc-3161-timestamping` (compliance — TSA leg, ADR-0332/0346) · `transparency-log` (compliance — Rekor v1.1, ADR-0353) · `evidence-receipt` (compliance — per-row proof endpoint, ADR-0331/0344) · `compliance-crosswalk` (compliance — crosswalk rollup + dual-catalog OSCAL spine, ADR-0333/0363/0364) · `signed-audit-anchor` (security — ADR-0344) · `agent-trajectory` (ai-infra — ADR-0349/0360) · `token-hash-at-rest` (security — ADR-0366). Authored via the same Fork-B workflow (strict rider on compliance terms); the operator may still strike a row at content review. All other ADR-0235 locks (rollout, curated linking, footer-only nav) carry over unchanged. |
| **Pending changeset**     | **Accumulate.** The hash-at-rest changeset (plus this batch's site changeset) rides whenever the next train fires — no dedicated consume now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **tsgo cutover**          | **Investigate only; stays parked** on the weekly advisory lane (ADR-0340 unchanged). Root cause recorded: the sole kernel `.d.ts` diff (`observability.d.ts`) is pure member REORDERING inside inferred `z.enum` object-literal types — the 6.x and native-7 declaration printers order enum-map keys differently; semantically identical. Cure at cutover: explicit annotations / scoped isolatedDeclarations on the affected schema exports. Native leg measured 10.7x faster on the kernel check (117ms vs 1258ms).                                                                                                                                                                                                                                                                        |
| **deploy-railway runner** | **Stays on Blacksmith even once `RAILWAY_TOKEN` arms** — no flip back to hosted at cutover C2. VM-per-job isolation plus a Railway-scoped, revocable deploy credential is an acceptable posture; this closes the "reassess if the token is ever armed" note left by the ADR-0365 flip and amends the ADR-0326 "prod tokens never ride third-party runners" carve for this job.                                                                                                                                                                                                                                                                                                                                                                                                                |

## Consequences

- The glossary batch lands as one PR: 36-page audit fixes + the 7 new records + the test
  floor moving 36 → 43, REVIEW-only at SHIP per the ADR-0235 tag posture.
- New records link `related` only outward (new → existing/new same-cluster); existing
  records' verified copy is untouched except by confirmed audit findings.
- The release-tail residual row (b) is CLOSED; only the advisory lighthouse lane waits on
  the Aug 1 Actions-minutes reset.
- ADR ceiling moves to 0367.
