# S8 R332 scheduled rescan verification

## Goal and scope

Add a daily scanner trigger for main source and literal Dockerfile base digests. R332 locks this scope. The scan deliberately excludes published private images, application build layers, downstream images and platforms other than linux/amd64. No registry credentials, registry login, publisher invocation or deployment is added. Existing source scanning remains present; base scanning still runs after a failed source scan when scanner installation succeeded. Overall failure remains failure.

## Census at the required source

Source: **6604844a3f17633e5221075af6d01966620eaaed**, independently fetched and read from git. Eight first-party Dockerfiles, fourteen FROM instructions, eleven external references, two unique pins:

- oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 — ten references across apps/admin, apps/demos, apps/site, deploy/Dockerfile.migrate, services/docs, services/intel and services/license.
- python:3.14-slim@sha256:a7fb1e634c4a578f9e0bd6327f11a3cde11b7a9395f48e24360c0988bcc5c2bc — services/support-bot/Dockerfile:5.

Full path/line census: /home/gw/lab/briefs/estate-2026-09/handoff/S8-R332-RESCAN-CENSUS.json. The runtime collector derives this list anew from tracked Dockerfiles; it does not retain a frozen two-image allowlist. It excludes buyer templates, validates literal SHA-256 references, understands actual prior-stage aliases and scratch, rejects unsupported FROM forms and empty external lists. Unrecognized future Dockerfile syntax is an explicit failure requiring maintenance.

## Verification evidence

Six Python unittest cases pass. They exercise external/base alias selection, malformed/unpinned/variable FROM rejection, deduplication, template exclusion, empty census rejection, exact digest and platform arguments, a five-name child environment without registry/cloud credentials, and failure propagation for scanner exits 1/23 and signal termination. Trivy is mocked in these offline tests: they prove invocation behavior, not a live clean CVE result.

Two predicted mutations were run and restored: removing the cron produced one workflow-contract failure; swallowing scanner nonzero status produced three failed subtests (1, 23, -9). Restored source passed all six cases. Ruff 0.15.21 passed on both Python files.

Cron was independently interpreted with croniter==6.0.0, via S8-R332-CRON-PROOF.py in the handoff directory. Expression **37 6 * * *** yielded 800 ticks from 2026-09-15T06:37:00Z through 2028-11-22T06:37:00Z, every interval 24 hours, including 2028-02-29. First eligible tick after landing is the next 06:37 UTC; September 15 only if merged before that tick. [GitHub schedule semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) bind scheduled runs to the default branch and allow delays/dropped runs. No actual scheduled invocation has occurred for this unmerged change.

Trivy flags follow its [image CLI reference](https://trivy.dev/docs/v0.57/references/configuration/cli/trivy_image/): remote image source, explicit platform, vuln scanner, HIGH/CRITICAL and exit-code 1. The existing workflow supplies pinned Trivy 0.72.0 with its verified artifact digest. Fresh per-run cache permits normal database updates; no skip-db-update or ignore-unfixed. Empty per-run HOME/config/ignore state and an allowlisted subprocess environment prevent inherited registry auth and scanner overrides. These are source/test findings; the real CI image scans remain required.

## Review, sweep and remaining proof

Peer code/security review dispatches were refused admission and never ran; standing no-retry applies. This work has one set of eyes, not an independent review pass. Reviewers' first targets would be FROM extraction completeness and unsupported grammar, credential isolation including Trivy's remote-client behavior, schedule/job reachability and failure propagation, and whether the documented platform/private-image exclusions adequately describe coverage.

No package versions or published APIs change. Scanner versions and publisher workflow remain unchanged. Task 3 awaits S8_PUBLISH_GREEN from the cockpit; prepare a separate rescan PR if still blocked. Actual required CI, real base scan results and eventual first scheduled run remain open; no consumer has moved off the pre-fix package line from this task.

## R333 runtime patch prepared; live verification pending

Eight first-party Dockerfiles now have nine apt update/upgrade/cleanup RUN instructions covering each runtime lineage, including admin migrate and license shared base inheritance. Bun/Python FROM digests are unchanged. Two new offline tests prove target coverage, pin preservation and upgrade-before-nonroot ordering. Deleting admin's migration upgrade caused the predicted target-coverage failure; original bytes restored. These source checks do not establish that apt repositories supply every fix or that a built image is clean.

OS-layer builds and live post-upgrade scans remain pending. Schedule-policy clarification was requested because raw pinned-base scans retain the fixable findings even after runtime images are patched. No ignore-unfixed-only change is made. This R333 amendment is not yet pushed, so PR 482 still carries the earlier red head until its full repair/proof is ready.
