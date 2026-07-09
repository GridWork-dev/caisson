# Deferred-respec SPEC drafts (2026-07-02)

Every deferred-by-decision item from the post-#51 full triage, researched and drafted into a
buildable SPEC — **except** the three.js studio-signature spike and Terraform remote state
(operator-excluded). Produced by a research → spec → adversarial critique → revision workflow
(43 agents; every cited path/ADR/upstream-API claim independently verified by the critic pass).

**Status as of 2026-07-09.** Per the one-operator rule, each spec tabled its forks with labeled
recommendations and waited for an operator lock; where a build would have contradicted an
existing lock, the spec named the ADR it would need to supersede. 10 of the original 11 specs
below were subsequently operator-locked via ADR and shipped — plus two specs that entered this
directory after this table was first written (`SPEC-registry-npm-delivery`,
`SPEC-live-harness-production-seams`) and also shipped. This session's doc sweep **moved all 12
shipped specs to** [`outputs/archive/specs/deferred-respec/`](../../archive/specs/deferred-respec/)
(same filenames). Only **two** specs remain live beside this README, both still correctly gated —
see the second table below. Locks land as ADRs in `knowledge/decisions/`, never in this directory.

## Shipped — archived

| Spec (now in `outputs/archive/specs/deferred-respec/`)                                                       | Locked via                                                                        | PR   |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---- |
| SPEC-paddle-partial-refund — per-line entitlement revoke + credit clawback                                   | ADR-0218                                                                          | #66  |
| SPEC-live-seam-kms-envelope + SPEC-local-ai-onnx-live-seam — cloud KMS envelope + ONNX live-test seams       | ADR-0221 (one lock, two specs)                                                    | #67  |
| SPEC-cloudflare-front-rate-limit — CF front rate-limit + WAF for the fleet                                   | ADR-0219                                                                          | #68  |
| SPEC-admin-mutation-surface — apps/admin mutations + audit trail (superseded ADR-0141 read-only posture)     | ADR-0220                                                                          | #69  |
| SPEC-members-fold-republish — realized the agent-runner fold into the registry snapshot                      | ADR-0228                                                                          | #80  |
| SPEC-oscal-rlink-hosting — signed evidence bundle, relative rlinks (superseded the ADR-0180 rlink won't-fix) | ADR-0231                                                                          | #91  |
| SPEC-seo-section-union-renderer — PageSections union renderer                                                | ADR-0232 (forks locked; renderer built with the glossary program, ADR-0235 / #99) | #86  |
| SPEC-wave6-harvest-disposition — enumerate + rank the parked sub-top-15 lift-sweep residual (document-only)  | ADR-0239 (terminal disposition)                                                   | #107 |
| SPEC-agent-dev-inspector — Agentic-Dev local inspector (read-only, localhost)                                | ADR-0243                                                                          | #128 |
| SPEC-registry-npm-delivery _(added post-2026-07-02, not in the original 11)_                                 | ADR-0223                                                                          | #83  |
| SPEC-live-harness-production-seams _(added post-2026-07-02, not in the original 11)_                         | ADR-0224                                                                          | #81  |

## Still live — gated

| Spec                                                                                                                                  | Gate condition                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [SPEC-auth-session-token-hashing](SPEC-auth-session-token-hashing.md) — session token hash-at-rest                                    | Future-trigger: build only when better-auth ships the seam or a compliance finding fires; supersedes ADR-0210 §3. No trigger has fired as of this sweep.       |
| [SPEC-abandoned-checkout-email](SPEC-abandoned-checkout-email.md) — server-side checkout-started capture + delayed single-send notice | Operator-locked "spec only, build later" (2026-07-06). No ADR filed for this doc (groundwork, not a decision lock) — waits on an explicit operator build call. |
