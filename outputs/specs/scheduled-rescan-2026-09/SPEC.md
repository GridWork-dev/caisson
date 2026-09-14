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

## R333 runtime OS patch amendment

R333 (EST-ASK-291) authorizes apt update/upgrade of the pinned base in every runtime stage, retaining the Bun cb3bbbb0 digest and existing Python digest. Patch all eight first-party Dockerfiles, including admin's migrate target and license's shared runtime/migrate base. One upgrade layer per runtime lineage; build-only Next stages remain unchanged. Re-scan to prove the three CRITICAL perl-base rows and all other fixable OS rows clear, recording unfixed rows. No ignore-unfixed-only fix, no waiting for upstream, no deployment. The exact scheduled scan policy is pending the explicit operator clarification; do not silently lock it.
