---
phase: release-train-2026-09-publish
project: caisson
spec: outputs/specs/release-train-2026-09-publish/SPEC.md
created: 2026-09-15
status: accepted
---

# Plan — release-train-2026-09-publish

## R370/R371 — second repair cycle (S8_REPAIRS_2)

Operator ruling 2026-09-16T13:59:37Z authorizes three ordered commits on this lane:

1. CR-07: schema binds reviewed_sha to the final candidate's single parent; independently
   prove only the exact tag audit and checklist paths changed in the successor. Read
   the committed artifact, retain full CI on tag SHA, and test the real A→B Git lifecycle,
   product-byte rejection and wrong reviewed SHA. Append ADR-0425 and update ceilings.
2. CR-08: split strict commerce account/session resolution from the existing dashboard
   availability fallback. Put resolution inside the checkout failure boundary. Prove an
   organization membership failure calls neither entitlements nor Paddle. Append the
   next ADR superseding ADR-0424 only for this resolver behavior; leave dashboard intact.
3. WR-01: atomic rejection deletes without spawning; pending approvals expire after a
   defined finite lifetime. Test expiry, capacity reclamation, rejection and replay.
   Append the next ADR extending ADR-0423; preserve existing integrity checks.

Main thread owns each implementation. Each commit includes tests and named guard-removal
mutations, byte-identical restoration hashes and Bun 1.4.2 counts in RUN-NOTES. Then run
affected targeted tests and the full root gate once with Turbo concurrency 2. Fresh headroom,
sequential governed code_review and security_audit (deep/shared-read/repo-read), corrected
inline tool rules and parent-streamed logs follow. Clean verdicts permit packet steps 4–6
and S8_RELEASE_PR, then hold at green. Stops and no-merge/publish/deploy/branch-delete
boundaries remain unchanged. No new review verdict is implied by this authorization.

## R359 gate-retry disposition — 2026-09-16T03:30:26Z

The operator classified the first full-check exit 137 and cancellation exit 130 as
resource kills. Authorized sequence: ai-kit alone, then one full equivalent check
with Turbo concurrency 2; individually rerun any killed task, but never count a kill
as a pass or test failure. A true test failure stops verbatim. Both commands have now
exited 0, including every root-check tail gate; no individual kill recovery was needed.
Exact counts and commands are in RUN-NOTES. Resume the two sequential reviews below,
then packet steps 4–6 only on clean verdicts. This supersedes the original single-run
limit solely for the prescribed retry and does not authorize any later release act.

## R359 repair cycle — accepted designs, ordered atomic commits

S8_REPAIRS_AUTHORIZED (2026-09-16T02:37:11Z) authorizes the six returned designs without reopening forks. Main thread owns edits on this lane. Order and verification:

1. CR-06: strict R4 frontmatter gate bound to base/tag/final SHA, clean status, zero critical findings, reviewed scope and completed reviewer identities/timestamps. File-backed empty/failed/wrong-SHA/passing fixtures; mutate to the former existence-only decision, named negative test red, hash-identical restore and green.
2. CR-05: unconditional stable runtime-images-gate aggregate requiring matrix success; require it in readiness. Contract tests execute aggregate decisions; mutate the gate/membership, red, restore and green. R344 classification stays untouched.
3. CR-02: resolve and validate the endpoint before every embedding request; retain redirect:error. Resolver-seam private-destination test proves fetch is not called; remove resolved validation, red, restore and green.
4. CR-01: immutable digest-bound approval records, consumed once, canonical name/command/validated args/reason/policy version; current-spec revalidation and environment. Negative tests for argument/environment mutation, forgery and allowlist rotation. Append the next free ADR above 0422 and update index/CLAUDE ceiling in this commit. Mutate approval enforcement, red, restore and green.
5. CR-03: real session ownership lookup and server-created checkout with current entitlement filtering before Paddle. Four named regression cases; append one money-path ADR and update index/CLAUDE ceiling. Mutate ownership/checkout guards, red, restore and green.
6. CR-04: authenticated public success, anonymous Access denial and strictly validated raw Cloud Run origin denial. Resolve raw URLs through governed gcloud argv calls in the staging workflow; no live probes here. Unit tests and two independent boundary-removal mutations must fail, restore and pass.

Every atomic commit includes tests and RUN-NOTES with Bun 1.4.2 beside counts and restoration hashes. Then run all touched-package targeted tests and exactly one full bun run check (or equivalent); record counts. Fresh headroom precedes sequential governed code_review and security_audit on the six repair commits, exact R356 inline tool rules, parent-shell streamed logs. Clean verdicts permit packet steps 4–6 to the green release PR. A conforming-command BLOCKED line, a re-review/security BLOCKER or a red gate outside the repair's causal path stops. Expected mutation reds and causal repair failures are not unrelated-gate stops. Telemetry 500 remains non-blocking. No merge/tag/version dispatch/publish/deploy/branch deletion.

## Superseding review execution authority — R354/R356 retry 3

R354 authorizes the cumulative R4 review; R356's exact child Git rules and S8_REVIEW_RETRY_3 (2026-09-16T02:03:36Z) govern this continuation. The historical no-retry paragraphs below no longer hold these two dispatches. Main thread obtains fresh limits, then dispatches code_review/gw-code-reviewer followed by security_audit/gw-security-auditor, deep lane, asynchronous shared-read, repo-read. Review target: v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c (89 commits / 430 paths). Both complete inline briefs retain the six priority targets and evidence limitations.

Parent-shell redirection streams each dispatch to its handoff log. Do not capture evidence through Node REPL or interrupt a healthy review for a parent tool error. Preserve both logs and returned verdicts as documentation. Stop and quote any conforming-command BLOCKED line or review/security blocker; no implicit pass from exit 0. With clean verdicts, continue candidate checks and task 4 to the green PR only. Final version/tag/readiness evidence remains a later gate.

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

Depends on tasks 1–3 and resolved review/preflight disposition. Push only chore/release-train-2026-09; receipt history rides under R315. Use audited exec endpoint for forge acts. Open one release PR against main with exact verification and limitations. Record all seven required checks (including runtime-images-gate) and every additional active check on its actual head; report S8_RELEASE_PR and idle at green. Do not forge-merge, dispatch version-pr, tag, publish or deploy. On any failed check, floor denial or unexpected result, record S8_RELEASE_HELD and the operator packet.

Later commands and predictions are bound in OPERATOR-ACT-S8-RELEASE-PUBLISH.md. This plan does not turn future acts into present authority.
