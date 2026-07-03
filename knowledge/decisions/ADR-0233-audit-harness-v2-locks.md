# ADR-0233 — Audit-harness v2: derived+gated domain matrix, new buyer-facing lenses, fork locks

**Status:** accepted · 2026-07-03 (fourth picker round, second sitting). Amends **ADR-0134**
(cross-domain audit/validate harness, full build) and **ADR-0188** (audit-harness reconcile
scope + driver home). Locks the five forks of
`outputs/specs/audit-harness-v2/SPEC-audit-harness-v2.md` — the scoping SPEC that gates the
whole-repo audit RE-RUN (the re-run itself stays a separate act after this lock).
**Fork E is an operator OVERRIDE of the tabled recommendation.** Append-only; supersede with a
later ADR, never edit.
**Tags:** (none — harness/tooling; REVIEW-only at SHIP).

## Context

The v1 whole-repo audit (5 rounds, 51 findings, 50 fixed) grew its hand-typed `AUDIT_DOMAINS`
list 6→24 mid-run — the under-scan defect — and round 5 caught a critic name-collision silently
dropping findings. Since that run the repo gained the admin mutation surface, registry npm
delivery + deny-set, the live harness, the members-fold republish, agent-runner + the hardening
wave, and the PRIVATE `caisson-sh/caisson-oss` mirror. The operator's v2 requirements: complete
cleanly-split coverage, the oss mirror + all customer packages in scope, and two NEW dimensions —
customer-facing/sales-ready source quality (buyers read the code) and internal-vs-sold surface
separation.

## Decision

| Fork                        | Lock                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — domain granularity**  | **Per-dir, ~66 domains**, mechanically derived by `deriveDomains(root)` — one domain per `packages/*`, `apps/*`, `services/*`, registry unit, `tooling/*`, `infra/*`, workflows, generator templates, docs, oss-mirror; a coverage gate fails on any unclaimed or double-claimed tree unit.                         |
| **B — enforcement posture** | **Advisory run** (ADR-0134 kept); promoting the coverage gate + D3/D4 lenses into `standards-gate` is a SEPARATE follow-up only after v2 sets a clean baseline.                                                                                                                                                     |
| **C — findings ledger**     | **Fresh ledger**; archive the v1 ledger as `ledger-v1-2026-07-01.toml`; carry forward only the one open admin CF-Access finding. v2 ids are dimension-keyed and incomparable with v1 ids.                                                                                                                           |
| **D — oss-mirror target**   | **Both**: audit the 15 Apache source packages in-repo AND run the mirror exporter + audit its output diff (catches dangling `@caisson/`→`@caisson-sh/` internal refs the source view cannot see).                                                                                                                   |
| **E — D3 rubric home**      | **OVERRIDE of the extend-ADR-0080 rec: a STANDALONE rubric doc** — the shipped-source comment/copy rubric lives in its own `docs/` file referenced by the audit; ADR-0080 stays prose-only. Cost accepted: a second copy-law home; the rubric doc must cite ADR-0080 as its parent so the two never drift silently. |

The seven dimensions (D1 security-floor · D2 secret leakage · D3 customer-facing/sales-ready ·
D4 internal-vs-sold leak · D5 license-tier correctness · D6 docs-vs-code truthfulness · D7
hygiene/residue) and the mechanics fixes (dimension-keyed `stableId`, id-collision assert in
`reconcile()`, per-round coverage ledger, explicit DRY predicate, coverage-claim adversary) are
locked as specced.

## Consequences

- The harness build (the SPEC's 8 atomic tasks + the Fork-E rubric doc) proceeds; the audit
  RE-RUN is unblocked once the build lands and is itself workflow-orchestrated per doctrine
  lanes (sonnet/haiku fan-out, opus synthesis — never fable for fan-out).
- Mid-run domain growth becomes structurally impossible (derived + gated), and silent finding
  drops become loud failures.
