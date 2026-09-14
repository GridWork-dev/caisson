# R324 publish gate plan

1. Main-thread read-only comparison of actual job metadata and complete logs; retain distinction between Sep 10 Docker build failure and Sep 14 runner shutdown during gates.
2. Prepare draft pipeline PR with a credential-free PR-only job executing exact bash deploy/gates.sh, cockpit runner expression, repository version pins and cold dependencies. Sample only host memory counters. No product change in baseline; no remote cache restoration. Predict baseline gates cancelled/failure reproducing existing source. Record step conclusion and memory evidence before edits.
3. After that predicted red, cap Turbo using TURBO_CONCURRENCY=50%, matching required CI and keeping all gate commands. Add focused gate-contract test that fails if cap removed or checks skipped; rerun same job expecting gates success. No retries for unpredicted result.
4. Complete self-review, required checks, mutation evidence and pipeline-only receipt; hold PR green for cockpit Manual merge. Review admission refusals are preserved, no retry or implicit peer-review pass. No external publication or deploy.

Parallel lane responsibility: scanner scheduling on chore/release-train-2026-09, separate from this worktree. No delegated writer or shared edits.
