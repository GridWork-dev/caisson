# ADR-0422 — Unify the Bun fleet and smoke-test the Next build images

- **Date:** 2026-09-14
- **Status:** Accepted — estate R308 / EST-ASK-265; execution continued under R323.
- **Scope:** Bun runtime, package-manager, CI and deployment-template pins; the demos and site Docker build stages.

## Context

The September 10–12, 2026 deployment outage blocked the Railway deployment chain at the demos build. This records a deployment-path outage; it does not establish that previously deployed public services were unavailable throughout that interval.

After [PR #475](https://github.com/caisson-sh/caisson/pull/475) moved Next from 16.2.12 to 16.3.3, Bun 1.3.14 crashed while finalizing page optimization, after TypeScript and page generation had completed. The predecessor packet records failed demos deployments `a0f12928`, `07116f6a` and `0b6161c2`, and the same crash in site after all 243 pages generated. Symbolication identified `napi_release_threadsafe_function`: the next-swc thread teardown use-after-free tracked in oven-sh/bun#37031 and fixed by oven-sh/bun#34067, shipped in Bun 1.4.0 with no 1.3.x backport.

[PR #478](https://github.com/caisson-sh/caisson/pull/478), merged as `a386502a`, temporarily moved only demos and site build stages to Bun 1.4.2. Their runtime stages and the remaining fleet stayed on 1.3.14. The packet records red/green Docker builds for both apps with only the build-stage Bun pin changed. The [deploy-railway run for that merge](https://github.com/caisson-sh/caisson/actions/runs/34675184008) completed successfully on September 12.

Ordinary CI did not exercise this failure path: `bun run` handed the local Next command to Node, while the Bun container executes the build under Bun. Cached Turbo results further reduced the build work exercised in CI.

## Decision

1. Retire the temporary split and pin the entire fleet to **Bun 1.4.2**, the newest stable 1.4.x release measured on September 14. Deployed Bun images and generator templates use the OCI index digest `sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61`. Generator goldens come from the generator.
2. Add a path-gated CI smoke job that builds the demos and site Dockerfiles through `--target build` from the repository root. Use the existing Linux runner selection. The 8 GB runner and a pre-build memory check protect the demos build; if that runner OOMs, lower the Dockerfile build concurrency and preserve the smoke leg.
3. Prove the smoke with a temporary 1.3.14 build-stage mutation on the S16 branch: CI must expose the known segfault, then pass after the scratch commit is dropped. Under R323, these are CI observations; the local exec Docker allowlist is not widened or bypassed.
4. Commit the three Next-generated next-env.d.ts updates and confirm a second gate run does not dirty the tree.

## Consequences and reopening condition

All serving runtimes now move with the package-manager and build pins. The [S16 measurement](../../outputs/research/2026-09-14-bun-fleet.md) records the exact census and the original EOF reproduction: Bun 1.4.2 matches Node 26.5.1 for unread server sockets, while 1.3.14 remains the outlier. No socket code change is part of this decision.

A **Bun regression in the Next build path** reopens the runtime/build-stage choice. Reproduce it in the affected Docker build stage against the last green pin before choosing a temporary split or another version. Preserve the CI build smoke so the next decision has direct build-path evidence.

This decision authorizes no merge or deployment from the S16 lane: it stops at a green PR for the cockpit's path-based merge hold.

## References

- Predecessor measured packet: `<home>/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S15-merge-478.md`.
- Governing brief: `<home>/lab/briefs/estate-2026-09/S16-bun-fleet.md` (R308); R323 continuation receipt under `handoff/S16-R323-EVIDENCE/R323.txt`.
- [S16 implementation PR — exact head branch](https://github.com/caisson-sh/caisson/pulls?q=is%3Apr+head%3Achore%2Fbun-1.4-fleet-2026-09). The branch selector identifies this PR before its number is allocated; the final numbered PR and red/green run receipts are recorded in the S16 operator handoff.
