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
- Scan those built local images with digest-verified pinned Trivy and fresh vulnerability intelligence. R344: gate only fixable HIGH/CRITICAL OS package findings. Application rows (including node-pkg, python-pkg and Go binaries) report only, in JSON residuals and the job summary, and never fail the job. Preserve every severity, unfixed finding, image ID and source SHA in downloadable JSON reports; scanner errors or missing/malformed coverage fail closed.
- Raw public pinned bases continue anonymous remote scans and report all findings. Neither raw findings nor raw scan operational errors fail the job; errors are visible warnings plus an artifact, not a clean-scan claim.
- Prove the three named CRITICAL perl-base rows and other fixable OS rows clear in actual patched runtime scans. Record exact unfixed residuals. Application findings remain known residuals, with installed/fixed versions visible; R344 explicitly excludes dependency repair from this PR.
- Test both policy halves with the same severity: an OS row fails the built-image gate; an application row only reports; mutate each half, observe the predicted failing test, restore and pass. Test scanner errors, missing coverage, credential isolation and runtime matrix coverage.

## Boundaries

These are rebuilt runtime images, not the already-deployed or privately published registry artifacts. Production build arguments, other architectures and downstream consumer images remain outside this evidence. No service starts and no migrations execute during builds/scans.

Peer code/security dispatches were refused admission and never ran; no retry and no independent review pass. Main-thread claims requiring independent scrutiny: complete runtime target extraction, anonymous/local scanner boundary, custom fixability policy, raw-error visibility and equivalence limits between rebuilt and deployed images.

Hold both PRs for the R336 cockpit wave. Task 3 resumes only on cockpit S8_PUBLISH_GREEN after the resulting main publisher passes all six scan steps. Preserve branches; no lane merge, publish or deployment.

## Historical lane R332 record (superseded by R333/R335/R344 above)

The following preserves the original lane narrative at 8754070c; it is historical evidence, not the operative scanner policy or current verification status.

---

phase: scheduled-rescan-2026-09
tags: [security, infra]
tier: STANDARD
---

# S8 task 2: scheduled source and base-image rescans

R332 (EST-ASK-290) locks daily scans of main source and the exact digest-pinned external bases declared by first-party Dockerfiles. Extend security-scan only; no scheduled publish, registry credentials, private published-image scan, deployment or merge. Task 3 still awaits cockpit S8_PUBLISH_GREEN. Work on the lane; if that signal remains absent when ready, prepare a separate rescan PR and report S8_RESCAN_PR. Preserve all branches.

## Acceptance

- Daily 06:37 UTC cron, mechanically enumerated across calendar boundaries; first eligible tick after landing, subject to GitHub scheduling delays.
- Existing deterministic source scan runs against the default-branch event SHA. Derive bases from tracked Dockerfiles, excluding buyer templates, deduplicate exact references and omit real prior-stage aliases/scratch. Missing digest, unsupported FROM syntax, empty external census or a scanner error fails visibly.
- Pinned Trivy scans public base images remotely at linux/amd64 with refreshed vulnerability intelligence, HIGH/CRITICAL enforcement and no ignore-unfixed relaxation. No registry login or credentials. Retain per-image SARIF and source-to-image census artifacts.
- Scope excludes app layers and dependencies added during builds, private published images, other image platforms and downstream consumer images.
- Test extraction, alias handling, malformed pins, anonymous scanner arguments, error propagation and cron selection. Peer dispatches remain refused/not run under standing no-retry ruling; no independent review pass.
