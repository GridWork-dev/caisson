# Retrieval battery v2 — verdict note (2026-07-10)

**Spec:** `outputs/specs/close-out-triage/SPEC-retrieval-quality-battery-v2.md` (ADR-0315; F1
locked: refund questions become answerable). **Runner:** committed at
`services/support-bot/tests/live/test_retrieval_battery_live.py` (25 questions through the real
`RagPipeline` → live docs `/query` → OpenRouter Sonnet, production parity: k=6, thresholds
0.85/0.55). Answers adversarially judged for groundedness by a 13-agent panel against the cited
sources. Kickoff M, `kickoff/m-oss-launch`.

## Headline

**The bot does not hallucinate, the fail-closed gate holds everywhere, and grounded answers are
overwhelmingly correct — but availability and ranking each cost real answers.** 13/25 resolved,
12/25 escalated. Of the 13 resolved: 11 grounded-correct, 1 grounded-partial (correctly hedged
MEDIUM at 0.62 — the calibration working), 1 materially incomplete at HIGH 0.92 (see below).
Zero fabricated facts. Zero framing leaks.

## k=5 golden probes (live /query, hybrid fusion)

| Golden                                    | Expected page             | Rank                    |
| ----------------------------------------- | ------------------------- | ----------------------- |
| how do I install a bundle                 | getting-started.mdx       | **MISS (not in top-5)** |
| WORM audit storage on S3                  | provenance/audit-worm.mdx | 3                       |
| does caisson require postgres             | getting-started.mdx       | 1                       |
| cancel my subscription                    | base/billing.mdx          | 1                       |
| what license is the base substrate under  | base/index.mdx            | 1                       |
| license key stopped working after renewal | license-verify/README.md  | 2                       |

## Escalation classification (12)

| Class                                                                                            | Count | Disposition                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Availability** — docs `/query` timed out at the bot's 20s budget ("Retrieval was unavailable") | 4     | **FIXED in-branch**: the per-query embed had no deadline; OpenRouter's internal retry/backoff (minutes under rate-limit) held `/query` open past every caller's budget. `services/docs/src/index-store.ts` now races the query embed against an 8s deadline and degrades to the FTS floor (`a9a55791`), same degrade the error path already had. Regression-tested. |
| **Model-judged insufficient** — coverage gaps                                                    | 4     | Named follow-ups (below): updates-window expiry + renewal mechanics; per-bundle getting-started steps (Local-first, Provenance install questions also died here/at the gate).                                                                                                                                                                                       |
| **Refund questions**                                                                             | 2     | Correct pre-page behavior. The refund-policy corpus page landed in-branch (`refunds.mdx`, hybrid rank 1) — answerable after the next docs deploy.                                                                                                                                                                                                                   |
| **Fail-closed confidence gate**                                                                  | 2     | Working as designed: "cancel my subscription" answered then self-assessed 0.00 → escalated; Local-first getting-started had a missing/unparseable trailer → escalated.                                                                                                                                                                                              |

## Groundedness verdicts (13 resolved, judged against cited sources)

- **11 grounded-correct** — including prices ($2,059/$149/$99), bundle compositions, WORM
  mechanics, Prisma bridge, BYO-S3 constraints. Every claim checked against the cited files.
- **1 grounded-partial** — "license key stopped working after renewal": two unsupported
  inferences (renewal re-issues a token; major-mismatch as a verifyLicense failure mode). The
  model self-assessed 0.62 → **MEDIUM hedge shown to the user. This is the calibration
  success story of the battery**: the weakest answer got the hedge.
- **1 hallucinated-by-omission at HIGH 0.92** — "What tools does the Caisson MCP server
  expose?": answered "three tools" but its own cited source lists seven (four gated behind the
  ai-kit entitlement). The three it named are accurately described; the count claim is
  materially wrong. Omission-class errors are invisible to a self-assessed-confidence gate.

## MEDIUM-band calibration readout

Only 2 answers landed MEDIUM (0.62, 0.82). The 0.62 was the genuinely-weakest answer (judged
grounded-partial); the 0.82 was judged grounded-correct (slightly conservative — acceptable).
HIGH band (0.85+): 10/11 grounded-correct, 1 incomplete at 0.92. Thresholds look right;
no tuning recommended on this sample. Re-read after the telemetry leg goes live (below).

## Ranking verdict

**NOT acceptable — one named fusion follow-up.** The install-question miss reproduces
everywhere: FTS floor passes at k=3 (CI golden), live hybrid buries getting-started.mdx below
five bundle-marketing pages at k=5 AND at the bot's k=6. The vector leg is the burier. Follow-up
(Linear): investigate RRF fusion weighting or per-source dedupe in the fused top-k —
`packages/local-store` seam, NOT tuned in this kickoff (spec discipline: named, not built).
The live-hybrid golden leg (`services/docs/live/retrieval-golden-hybrid.live.test.ts`) lands
with this miss as `test.todo`, so the follow-up has a red-turns-green target. Per the
Kickoff-M picker (2026-07-10): the hybrid golden leg gates at the **release-readiness script**
(W4), not PR CI.

## Telemetry leg (spec verify clause)

`support_answer` does not exist in the caisson-prod PostHog taxonomy yet — **expected**: the
analytics code merged 2026-07-10 but `caisson-support-bot`'s redeploy is operator-gated and
pending (tracker §1 alerting-floor row). The battery therefore recorded confidence values in its
report artifact (this doc + the JSON) instead. After the fleet redeploy, real `#ask-ai` traffic
arms the event; re-read calibration then.

## Follow-ups (named)

1. **Fusion ranking** (Linear): install-question miss — RRF weight/dedupe investigation in
   `packages/local-store`; target = the `test.todo` golden goes green.
2. **Docs coverage**: an updates-window + renewal mechanics docs page; per-bundle
   getting-started/install steps for Local-first + Provenance (the bundle index pages describe
   contents, not installation).
3. **Omission-class QA**: the MCP-tools answer argues for a citation-coverage heuristic
   (answer enumerates N of M documented items) — park until real traffic shows the class recurs.
4. **Battery cadence**: re-run after the fleet redeploy (query-embed deadline + refund page +
   telemetry live) — expect availability escalations → 0, refund questions → answered/cited,
   and PostHog carrying the confidence distribution.
