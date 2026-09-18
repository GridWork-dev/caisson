---
title: Version PR generator pins implementation
date: 2026-09-17
status: approved
spec: outputs/specs/version-pr-generator-pins/SPEC.md
---

# R405 execution

One implementation commit and one PR from fresh origin/main 2ae0d7d6.

1. Add a bounded local template-pin synchronizer, tests, and a consume-job step
   invoking it followed by the existing focused BLESS command. Add the golden
   to the staging pathspec. Keep the candidate refresh job unchanged.
2. Strengthen the golden's existing comparison with workspace-derived pins:
   two mutually stale files must not give a false pass in the omission mutation.
3. In an isolated scratch copy, add a synthetic kernel changeset and run the
   actual consume/generation command blocks extracted from the workflow. Verify
   the two pin test files and focused golden comparison. Restore the three
   generated artifacts, disable the new workflow step, repeat the same consume
   from the same initial snapshot and require the three specified red results.
   Restore the step and replay it, requiring green. Never invoke packing/publish.
4. Run focused helper/workflow tests, full CLI suite, lint/typecheck/format and
   standards checks appropriate to the diff. Record exact counts and mutations.
5. VERIFY and SWEEP notes; repository review, security and adversarial review
   through governed dispatch admission; plain push and open PR. Stop on denial,
   unexpected output or a failed gate except the explicitly predicted mutation.

## Review routing

All review routes: shared-read isolation, repo-read permission profile,
asynchronous concurrency, evidence review-report. Use canonical gw dispatch
bindings: code_review / gw-code-reviewer / deep; security_audit /
gw-security-auditor / flagship; adversarial_review / canonical default role /
deep. The main thread owns all external side effects. A refusal is recorded,
not retried or bypassed.

## Predicted results

Baseline origin/main is 2ae0d7d665aaf4b9cd8a6e04f0244272f95eaf9a.
Local synthetic kernel patch consumes 0.10.0 to 0.10.1 (dependent bumps may
propagate according to the real Changesets plan). Enabled step yields green
pin and golden tests. Omission produces one failed pin guard, one failed sample
pin assertion, and one failed golden pin assertion. Restoring yields green.
No scratch versions or generated files enter the implementation commit.
