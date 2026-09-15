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
4. A release PR may be called green only with its exact head and all active check outcomes recorded; six required checks are check, standards-gate, registry-index, oscal-conformance, deterministic and support-bot.
5. Version consumption, final release SHA/tag and consumer propagation remain later separately authorized acts. No package-consumer upgrade is claimed from deployment or PR evidence.

## Context

The operator-approved sequence is OPERATOR-ACT-S8-RELEASE-PUBLISH.md under /home/gw/lab/briefs/estate-2026-09/handoff/. R350 authorized continuation after local reconciliation; R352/R353 corrected the local runtime and renewed steps 2–6. This SPEC records that existing authorized scope, not a new design fork. The historical task-1 SPEC/PLAN stays under release-train-2026-09. Pipeline locks and exact later-act commands stay in the operator packet.

Candidate at preparation: 05081a20091d3a7971609daab94008c8d352688e; reconciliation a5d9cfea5136a2fd8a18ea73b574b5968ff765aa includes main 7e11672c29d21b57a12cf1ad1d4758abbd12b66b. Cumulative range currently has 88 commits and 425 changed paths (+20,995 / -3,643); this preparation adds documentation only and must be included in final review scope. All implementation/configuration bytes on the reconciled lane match bound main; lane differences are historical audit/planning and two deployment receipt JSON files.

## Scope

- In scope: fresh absence proof, full-backlog version plan, release SPEC/PLAN, honest R4/checklist preparation, candidate checks and green release PR subject to review disposition.
- Out of scope now: forge merge, version-workflow dispatch, tag, publication, deployment, credential changes, branch deletion, admission retry and R344 application dependency repair.

## Tag rationale

Security and external-system apply because the release carries egress/auth fixes and feeds publishing/deployment systems; infra covers the reconciled image and deployment pipeline. This preparation changes documentation, not the product implementations. Risk tags preserve the real release review requirements.
