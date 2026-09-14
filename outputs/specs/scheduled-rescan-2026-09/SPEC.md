---
phase: scheduled-rescan-2026-09
tags: [security, infra]
tier: STANDARD
---

# S8 task 2: patched runtime image rescans

R332 establishes daily source/image scanning. R333 requires OS upgrades while retaining the pinned bases. R335 locks the gate on BUILT runtime images and makes raw pinned-base reporting informational. R336 holds PR 482 and PR 483 for one cockpit merge wave after both are green. These rulings supersede the initial raw-base-only scope and the initial failed raw-base gate recorded in the lane receipts.

## Goal and acceptance

- Daily 06:37 UTC security-scan on main; existing source scan preserved. No scheduled publisher, registry credentials, image push, deployment or dispatch.
- Patch all eight first-party Dockerfiles in nine runtime/migration lineage RUN layers. Retain Bun cb3bbbb0 and Python a7fb1e63 base digests. Next build-only stages remain unchanged. Preserve USER, CMD, ENV and application behavior.
- Derive the build matrix from tracked Dockerfiles, excluding buyer templates: every final stage plus named migrate stages (ten targets today). Unsupported FROM, missing pin or empty census fails closed. Build linux/amd64 from the actual checkout with no cache reuse so apt update/upgrade executes every day.
- Scan those built local images with digest-verified pinned Trivy and fresh vulnerability intelligence. Gate fixable HIGH/CRITICAL findings in OS AND application packages. Preserve every severity, unfixed finding, image ID and source SHA in downloadable JSON reports; scanner errors or missing/malformed coverage fail closed.
- Raw public pinned bases continue anonymous remote scans and report all findings. Neither raw findings nor raw scan operational errors fail the job; errors are visible warnings plus an artifact, not a clean-scan claim.
- Prove the three named CRITICAL perl-base rows and other fixable OS rows clear in actual patched runtime scans. Record exact unfixed residuals. A fixable application row still fails; the OS patch does not excuse it.
- Test both policy halves with the same fixable row; mutate each half, observe the predicted failing test, restore and pass. Test scanner errors, missing coverage, credential isolation and runtime matrix coverage.

## Boundaries

These are rebuilt runtime images, not the already-deployed or privately published registry artifacts. Production build arguments, other architectures and downstream consumer images remain outside this evidence. No service starts and no migrations execute during builds/scans.

Peer code/security dispatches were refused admission and never ran; no retry and no independent review pass. Main-thread claims requiring independent scrutiny: complete runtime target extraction, anonymous/local scanner boundary, custom fixability policy, raw-error visibility and equivalence limits between rebuilt and deployed images.

Hold both PRs for the R336 cockpit wave. Task 3 resumes only on cockpit S8_PUBLISH_GREEN after the resulting main publisher passes all six scan steps. Preserve branches; no lane merge, publish or deployment.
