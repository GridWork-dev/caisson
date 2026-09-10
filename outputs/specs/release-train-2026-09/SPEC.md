---
phase: release-train-2026-09
tags: [security, observability]
tier: STANDARD
---

# S8 task 1: direct application observation

Authority is the S8 brief and the operator's successive corrections, most recently the SOT disposition and instruction to resume direct bucket-key measurement. This records that authorized task; it does not lock a new product behavior or presume a defect.

## Goal

Observe the exact runtime map key used by the license limiter and the actual IP passed to Ask AI's Turnstile dependency through the production Cloudflare/Railway path. Compare two independently measured client egress identities, including forged-header arms, against predictions written before each application probe. Correct per-client behavior closes task 1 as NO DEFECT. Any unpredicted result stops the lane.

## Temporary diagnostic scope

Use the prepared diagnostic patch: an optional callback on the shared limiter's `check` receives the same local key variable passed to `#charge`; no keying or charging behavior changes. License `/issue` and Ask AI collect only four fixed probe markers, once per process/app instance, for ten minutes after initialization. Output is marker plus key/IP on the existing stderr sink. Sink exceptions must preserve response and rate-limit behavior. No bodies, tokens, cookies, secrets or environment values are logged.

Markers correlate observations; they are not authentication. Another caller could consume a known marker, so missing, duplicate or miscorrelated evidence cannot establish success. Replicas/restarts can each emit the finite marker set; observations must bind deployment and instance. Normal traffic is silent. The diagnostic must be removed before package publication; no bug-fix changeset or header-precedence change is justified by present evidence.

## Acceptance and authority

- Existing limiter/auth/challenge behavior remains covered; focused integration checks prove exact key observation, one-shot scope, expiry, normal-traffic silence and sink-error isolation.
- Code/security review and the required CI checks precede a green diagnostic PR.
- R203 requires per-PR approval before merge. Deploy dispatches remain operator acts, with exact reviewed/merged refs in the eventual deployment packet.
- Only actual deployed application observations satisfy the goal. Local fixtures and proxy source-IP logs do not.
- Branches remain preserved. SOT findings have only the dispositions in `outputs/audit/s8-sot-disposition.md`; no blanket gate waiver exists.
