# Support-bot retrieval battery v2 — post-deploy rerun (2026-07-12)

**Mode:** report-only. **Runner:** committed 25-question battery through the real
`RagPipeline` → deployed docs `/query` → OpenRouter `anthropic/claude-sonnet-4.6`, with production
parity `k=6` and unchanged thresholds `HIGH=0.85` / `LOW=0.55`. **Raw report:**
[`retrieval-battery-v2-2026-07-12.json`](./retrieval-battery-v2-2026-07-12.json).

## Outcome

- Pipeline integrity: **PASS** — 25/25 completed, every resolved answer was cited and at least 0.55,
  every unresolved answer produced an escalation brief, and no system-framing fragment leaked.
- Resolution: **19/25** resolved; **6/25** safely escalated. This improves on the 2026-07-10 run's
  13 resolved / 12 escalated.
- Bands: **16 HIGH**, **3 MEDIUM**, **6 LOW/escalated**. HIGH mean confidence was 0.965; all three
  MEDIUM answers were 0.82.
- Grounding/correctness review: **17 grounded-correct**, **2 grounded but materially incomplete**,
  **6 safe escalations**, and **0 fabricated-fact answers**.
- Availability: **0 retrieval-unavailable/time-out outcomes**, down from four in the prior run.
- Latency: mean 6.52s, p95 10.10s, max 11.45s (all inside the runner's 20s request budget).

## Per-question evidence

`Cites` is the number of source citations returned in the raw report. Escalations intentionally
publish no answer/citation set.

|   # | Question                                              | Expected    | Result    | Confidence / band | Cites | Grounding verdict                                                                                                                  |
| --: | ----------------------------------------------------- | ----------- | --------- | ----------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
|   1 | how do I install a bundle                             | answerable  | resolved  | 0.98 HIGH         |     6 | Grounded-correct; command and six bundle ids match the cited bundle docs.                                                          |
|   2 | WORM audit storage on S3                              | answerable  | resolved  | 0.97 HIGH         |     6 | Grounded-correct; S3 Object Lock, append-only chain, dev double, and pricing are cited.                                            |
|   3 | does caisson require postgres                         | answerable  | resolved  | 0.97 HIGH         |     6 | Grounded-correct; requirement and Postgres RLS dependency are cited.                                                               |
|   4 | cancel my subscription                                | answerable  | escalated | 0.00 LOW          |     0 | Safe, but an answerability gap: the model answered then self-graded below 0.55.                                                    |
|   5 | what license is the base substrate under              | answerable  | resolved  | 0.99 HIGH         |     6 | Grounded-correct: Apache-2.0.                                                                                                      |
|   6 | license key stopped working after renewal             | answerable  | escalated | 0.35 LOW          |     0 | Safe, but an answerability gap: the model answered then self-graded below 0.55.                                                    |
|   7 | How do I install the Compliance bundle?               | answerable  | resolved  | 0.95 HIGH         |     6 | Grounded-correct; CLI command, entitlement note, and direct core-package option are cited.                                         |
|   8 | What's included in the AI-Production bundle?          | answerable  | resolved  | 0.98 HIGH         |     6 | Grounded-correct; all six documented member modules are present.                                                                   |
|   9 | How do I get started with the Local-first bundle?     | answerable  | resolved  | 0.98 HIGH         |     6 | Grounded-correct; install command and commercial entitlement posture are cited.                                                    |
|  10 | What does the Agentic-Dev bundle include?             | answerable  | resolved  | 0.95 HIGH         |     6 | Grounded-correct; agent-kernel, agent-runner, tool-exec, and local-store are present.                                              |
|  11 | How do I install the Provenance bundle?               | answerable  | resolved  | 0.99 HIGH         |     6 | Grounded-correct; the current bundle id and CLI flow are cited.                                                                    |
|  12 | Everything bundle vs individual modules               | either      | resolved  | 0.82 MEDIUM       |     6 | Grounded-correct and appropriately hedged; price, catalog breadth, dedupe, and renewal are cited.                                  |
|  13 | How do credits work and when do they expire?          | answerable  | resolved  | 0.97 HIGH         |     6 | Grounded-correct; integer ledger, FIFO use, 12-month expiry, sweep, and clawback are cited.                                        |
|  14 | Can one company license span multiple projects?       | either      | escalated | 0.00 LOW          |     0 | Safe escalation; no unsupported license-scope claim.                                                                               |
|  15 | What happens when my updates window expires?          | answerable  | resolved  | 0.99 HIGH         |     6 | Grounded-correct; perpetual access and the new-release boundary are cited.                                                         |
|  16 | How do I renew my license after the first year?       | answerable  | resolved  | 0.82 MEDIUM       |     6 | Grounded-correct and conservative; renewal rule and price table are cited.                                                         |
|  17 | Do I keep the code forever after a one-time purchase? | either      | resolved  | 0.99 HIGH         |     6 | Grounded-correct; perpetual license and updates-window behavior are cited.                                                         |
|  18 | How do I set up the Caisson MCP server?               | answerable  | resolved  | 0.88 HIGH         |     6 | Grounded-correct; install, stdio host, profile config, auth, and HTTP alternative are cited.                                       |
|  19 | What tools does the Caisson MCP server expose?        | either      | resolved  | 0.97 HIGH         |     6 | **Grounded-incomplete:** names the three base tools but omits the four `ai-kit` setup-coach tools listed by its cited MCP catalog. |
|  20 | What is the refund policy?                            | either      | resolved  | 0.82 MEDIUM       |     6 | **Grounded-incomplete:** cites the refund page but omits its core unconditional 14-day money-back guarantee.                       |
|  21 | Can I get a refund on a subscription?                 | either      | escalated | 0.40 LOW          |     0 | Safe escalation after a below-threshold self-assessment.                                                                           |
|  22 | I was charged twice for the same bundle               | escalate_ok | escalated | 0.00 LOW          |     0 | Correct escalation; confidence trailer was absent/unparseable and the gate failed closed.                                          |
|  23 | Can I bring my own S3 bucket for audit storage?       | answerable  | resolved  | 0.91 HIGH         |     6 | Grounded-correct; lock capability, modes, KMS, retention, and alternate backends are cited.                                        |
|  24 | Does Caisson work with Prisma?                        | answerable  | resolved  | 0.97 HIGH         |     6 | Grounded-correct; Prisma bridge, tenant transaction boundary, and row-count caveat are cited.                                      |
|  25 | Does Caisson support SSO with SAML?                   | either      | escalated | 0.00 LOW          |     0 | Safe escalation; no unsupported product-support claim.                                                                             |

## Calibration readout

The unchanged `0.85 / 0.55` thresholds remain **directionally calibrated; no threshold change is
recommended from this sample**.

- HIGH: 15/16 were grounded-correct. The miss was an omission at 0.97, the same error class seen in
  the prior battery. Moving the threshold would not reliably catch self-confident citation-coverage
  omissions.
- MEDIUM: 2/3 were fully correct and one was materially incomplete. The hedge band is landing on
  genuine ambiguity, but `n=3` is too small for tuning and all three scores clustered at 0.82.
- LOW/escalated: 4/6 were rubric-appropriate safe escalations (`either` or `escalate_ok`); two were
  over-conservative misses on questions marked answerable. The fail-closed floor is working, with a
  measurable availability cost.

## Deferred remediation

Stay with the current thresholds. The next work is content/prompt coverage, not env tuning:

1. Fix the two answerability gaps: cancellation mechanics and post-renewal license-key recovery.
2. Add a citation-coverage check for enumeration questions so a high-confidence answer cannot report
   only the three base MCP tools while omitting four entitlement-gated tools.
3. Make the refund answer rubric require the eligibility/window sentence (the unconditional 14-day
   guarantee), not just processing mechanics.
4. Re-read calibration after a larger real-traffic sample; this 25-question run is sufficient to keep
   the thresholds, not to optimize them.

No threshold, environment, deploy, or service state was changed during this run.
