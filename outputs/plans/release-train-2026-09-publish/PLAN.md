---
phase: release-train-2026-09-publish
project: caisson
spec: outputs/specs/release-train-2026-09-publish/SPEC.md
created: 2026-09-15
status: accepted
---

# Plan — release-train-2026-09-publish

This plan transcribes the already-authorized operator packet steps 2–6. Main thread owns context-bearing work and all external effects. The previous peer dispatch refusals stand: no new admission query, dispatch or alternate provider route. The skill's ordinary researcher dispatch is superseded by that operator constraint; repository and installed CLI sources were read directly.

## Task 1: Fresh removal proof and release inventory

Files: outputs/audit/release-train-2026-09-RUN-NOTES.md, outputs/audit/s8-release-version-plan.md; exact hash evidence in handoff/S8-R352-ABSENCE-EVIDENCE.json.

Run from the lane through snip proxy bash -c:

    bun --version
    bun test packages/rate-limit/src/token-bucket.test.ts services/license/src/issue-app.integration.test.ts apps/site/lib/ask-ai/handler.test.ts --timeout 60000
    ./node_modules/.bin/oxlint apps/site/lib/ask-ai/handler.ts apps/site/lib/ask-ai/handler.test.ts packages/rate-limit/src/token-bucket.ts packages/rate-limit/src/token-bucket.test.ts services/license/src/app.ts services/license/src/issue-app.integration.test.ts
    bun node_modules/@changesets/cli/bin.js status

From packages/rate-limit, run bun run build. Expected and measured: Bun 1.4.2, 64 pass / 0 fail / 168 assertions, build/lint/status exit 0; 35 changesets, 60 releases (57 patch, 3 minor). Compare three implementation files against e2116849 and six source/test files plus .changeset against 7e11672c: empty diffs measured. Check four frozen UUIDs and five diagnostic identifiers in the named source/tests/emitted files: no matches measured. No dependencies.

## Task 2: Prepare R4 and checklist material

Files: this SPEC/PLAN, outputs/audit/s8-release-review-preparation.md, outputs/audit/s8-release-checklist-preparation.md, both release receipts. Depends on task 1.

Use the exact cumulative range v2026.08.18..05081a20091d3a7971609daab94008c8d352688e, plus subsequent preparation commits. Identify security, money/license, infrastructure and release-integrity review targets. Record the missing independent review as NOT RUN; do not mint a tag-named audit artifact or completed checklist. Required future routes remain code_review/gw-code-reviewer and security_audit/gw-security-auditor, deep lane, asynchronous shared-read, repo-read, exact-base/head evidence; both are held by the no-retry ruling. No dispatch is part of this plan without a new disposition.

## Task 3: Verify preparation and preserve the gate boundary

Files: the above documents and outputs/audit/s8-sot-disposition.md if fresh evidence requires an appended observation. Depends on task 2.

Run bun run format:check, git -C /home/gw/lab/worktrees/caisson/release-train-2026-09 diff --check and bun run sot through snip. Before checking, format only owned documents. Expected format/whitespace exit 0. SOT is expected to report only the previously accepted frontmatter and branch-preservation drift; record actual documents/source dates. An added failure stops. Aggregate SOT nonzero is not release-readiness green, despite the lane disposition. No bulk date bumps or gate changes.

Commit the preparation and receipts normally with a message file. Read back HEAD and clean status. R4 and candidate SOT remain explicit open requirements; obtain a concrete operator disposition before proceeding through any gate they block.

## Task 4: Open the authorized release PR after prerequisites

Depends on tasks 1–3 and resolved review/preflight disposition. Push only chore/release-train-2026-09; receipt history rides under R315. Use audited exec endpoint for forge acts. Open one release PR against main with exact verification and limitations. Record all six required checks and every additional active check on its actual head; report S8_RELEASE_PR and idle at green. Do not forge-merge, dispatch version-pr, tag, publish or deploy. On any failed check, floor denial or unexpected result, record S8_RELEASE_HELD and the operator packet.

Later commands and predictions are bound in OPERATOR-ACT-S8-RELEASE-PUBLISH.md. This plan does not turn future acts into present authority.
