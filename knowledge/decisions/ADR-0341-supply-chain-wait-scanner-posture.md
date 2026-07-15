# ADR-0341 — Supply-chain posture: 7-day install wait + zizmor advisory ramp + Socket deferred

Status: accepted · 2026-07-13 (Kickoff T platform session, tasks 1–4)

## Decision

1. **`minimumReleaseAge = 604800` (7 days) in bunfig `[install]`** — no package version younger
   than a week installs, the window in which malicious releases are typically caught and yanked.
   **Companion pattern (learned in-wave):** deliberate inside-the-window adoptions get a DATED
   entry in `minimumReleaseAgeExcludes` with a removal date — the AI SDK v7 family (adopted by
   PR #234, published 2026-07-10) is the first, remove after 2026-07-17. The exclusion list
   accepts exact names only (the `@scope/*` glob form does NOT work in bun 1.3.14 — verified
   empirically). Renovate interaction stands as designed: a PR against a <7-day version fails
   install until it ages; that delay is the point.
2. **zizmor (workflow auditor) joins security-scan.yml as a third, ADVISORY job** — pinned
   1.26.1, sha256-verified release artifact (zizmor publishes no checksums file; the pinned
   digest is GitHub's asset digest independently confirmed by local download+hash — refresh the
   same way on bump). SARIF artifact, exits 0 by design. **Gate ramp:** triage the current
   finding set (local run: 26 findings — 24 medium, 2 high) into fixes or `zizmor.yml` ignores
   with rationale, then drop `--no-exit-codes` and add the job to the required-check convention
   in scripts/release-readiness.ts.
3. **No repo-level bunfig Socket scanner** — bun #31028 is OPEN (scanner + `--production`
   hard-fails install through bun 1.3.14). Railway ground truth: all five Dockerfiles run
   `bun install --frozen-lockfile` WITHOUT `--production`, so the stated exposure wouldn't bite
   today — but a deploy-path scanner adds a Socket-API network dependency to every build and the
   hazard is one Dockerfile optimization away. Re-evaluate when #31028 is fixed in a released
   bun; if adopted, PR-check job only, never the deploy path. Dev-machine global-bunfig Socket
   stays the gw-core kickoff's lane.
4. **Sentrik is competitor intel only, never CI-wired** — recon note (docs-derived checklist
   diff + the operator-run one-shot the permission classifier correctly blocked the agent from
   executing) at `outputs/research/sentrik-socket-supply-chain-recon.md`. One idea flagged worth
   absorbing later: checklist-shaped rendering of controls caisson already runs, a natural fit
   for the crosswalk rollup's derived binding table.
