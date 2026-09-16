---
phase: release-train-2026-09-publish
project: caisson
created: 2026-09-15
status: accepted
tags: [security, external-system, infra]
tier: STANDARD
---

# Goal

Prepare an evidence-bound release PR that can move the pending Caisson fixes to package consumers through the existing governed version and publication pipeline.

## Acceptance Criteria

1. The temporary S8 diagnostic is absent from implementation, tests, changesets and freshly built limiter output, with unchanged original header selection and charging behavior.
2. The full pending backlog has exact effective versions, including dependent workspaces, and is distinct from registry publication eligibility.
3. The cumulative release scope since v2026.08.18 is identified; R4 review, candidate SOT and all checklist assertions have explicit evidence or remain visibly open.
4. A release PR may be called green only with its exact head and all active check outcomes recorded; seven required checks are check, standards-gate, registry-index, oscal-conformance, deterministic, support-bot and runtime-images-gate (R359 / CR-05).
5. Version consumption, final release SHA/tag and consumer propagation remain later separately authorized acts. No package-consumer upgrade is claimed from deployment or PR evidence.

## Context

S8_REPAIRS_2 (2026-09-16T13:59:37Z), R370/R371, continues the loop with three repairs:
R4 reviews the tag candidate's parent and independently limits the successor to exactly
the tag-specific audit/checklist path set; commerce fails closed on membership-resolution
errors while dashboard fallback remains; approvals gain atomic rejection and defined
expiry. Real Git lifecycle, production resolver binding and approval lifetime/capacity
regressions plus mutation proof are required. Three atomic commits and append-only ADR
extensions precede the bounded full gate and both sequential reviews.

R359 (S8_REPAIRS_AUTHORIZED, 2026-09-16T02:37:11Z) supersedes the six-blocker hold and locks the review's six repair designs. Acceptance now also requires six ordered atomic repair commits (CR-06, CR-05, CR-02, CR-01, CR-03, CR-04), two append-only ADRs for approval integrity and checkout ownership, per-guard mutation proof with hash-identical restoration on Bun 1.4.2, one full repository gate after targeted coverage, and clean governed code/security re-reviews. No live staging probes are authorized; staging boundary behavior is proven locally with injected unit/mutation tests. R344's OS-only policy remains unchanged.

Current authority: R354 authorizes governed cumulative code review and security audit for R4. R356 and S8_REVIEW_RETRY_3 (2026-09-16T02:03:36Z) authorize the corrected sequential dispatches with output streamed directly to disk. Their exact review range is v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c, 89 commits / 430 paths; later lane commits are administrative evidence. A conforming-command denial or review/security blocker stops this continuation. Parent tool errors do not interrupt a healthy review. Earlier no-retry language records the historical hold and is superseded for this act only. A review verdict is still required; authorization is not a pass.

The operator-approved sequence is OPERATOR-ACT-S8-RELEASE-PUBLISH.md under /home/gw/lab/briefs/estate-2026-09/handoff/. R350 authorized continuation after local reconciliation; R352/R353 corrected the local runtime and renewed steps 2–6. This SPEC records that existing authorized scope, not a new design fork. The historical task-1 SPEC/PLAN stays under release-train-2026-09. Pipeline locks and exact later-act commands stay in the operator packet.

Candidate at preparation: 05081a20091d3a7971609daab94008c8d352688e; reconciliation a5d9cfea5136a2fd8a18ea73b574b5968ff765aa includes main 7e11672c29d21b57a12cf1ad1d4758abbd12b66b. Cumulative range currently has 88 commits and 425 changed paths (+20,995 / -3,643); this preparation adds documentation only and must be included in final review scope. All implementation/configuration bytes on the reconciled lane match bound main; lane differences are historical audit/planning and two deployment receipt JSON files.

## Scope

- In scope: fresh absence proof, full-backlog version plan, release SPEC/PLAN, honest R4/checklist preparation, candidate checks and green release PR subject to review disposition.
- Out of scope now: forge merge, version-workflow dispatch, tag, publication, deployment, credential changes, branch deletion, retries beyond the current ruling and R344 application dependency repair.

## Tag rationale

Security and external-system apply because the release carries egress/auth fixes and feeds publishing/deployment systems; infra covers the reconciled image and deployment pipeline. This preparation changes documentation, not the product implementations. Risk tags preserve the real release review requirements.
