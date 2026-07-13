---
phase: ai-sdk-v7-migration
project: caisson
issue: CAISSON-106
reviewer: gw-code-reviewer
created: 2026-07-13
verdict: pass
---

# REVIEW — AI SDK v7 migration

## Verdict: PASS

Final narrow governed re-review (`019f5cec-4e88-7201-a19d-72e9f6b879ea`): **PASS**.

## Remediation ledger

| Finding                                                                           | Resolution                                                                                                                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stream reservations could depend on consumer iteration                            | Replaced the consumer-owned generator lifecycle with an eager gateway-owned pump and exact-once settlement.                                              |
| Resolver, wrapper, middleware, or pre-delta failures could retain a charge        | Moved setup behind refund settlement and added zero-usage regression coverage.                                                                           |
| Missing/malformed/unsafe usage could underbill or overflow integer ledger columns | Added primary and derived ledger validation, safe reservation preflight, bounded language fallback, and deterministic embedding fallback.                |
| System entries were either rejected or hoisted ahead of interleaved history       | Preserved the complete ordered history through AI SDK v7's supported `allowSystemInMessages` compatibility option, with generate and stream regressions. |
| Package guidance overstated common fallback behavior                              | Split completed-language and embedding fallback contracts in README and AGENTS guidance.                                                                 |

The full post-runtime review (`019f5ce3-b586-7223-913d-c92a3232a36b`) confirmed the implementation
blockers closed and identified only the final documentation drift above. The narrow re-review passed
after that correction. Reviewers were read-only and did not run tests; command evidence is recorded
in `VERIFY.md`.

An independent PAL re-review (`f0065827-4457-4741-8c3e-c9ff982d0116`) also returned PASS for billing,
exact-once settlement, fallback bounds, ordered system-message compatibility, embeddings, and BYOK.
