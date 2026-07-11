# Kickoff M — OSS launch program + retrieval battery + perf follow-ups

**Status: STAGED (operator split 2026-07-10, S1 size-balanced / S4 stage-now-build-next-sittings).**
Branch `kickoff/m-oss-launch` · worktree `~/lab/worktrees/caisson/m-oss-launch` · **merges
SECOND** (S3: the version cut is this track's final act and runs only after Kickoff N has merged
to main and been rebased in).

**Owns:** the ADR-0318 OSS launch program (`outputs/specs/oss-launch/SPEC-oss-launch-program.md`)
· retrieval quality battery v2 (`outputs/specs/close-out-triage/SPEC-retrieval-quality-battery-v2.md`)
· perf follow-ups (`outputs/specs/close-out-triage/SPEC-perf-followups.md`, CAISSON-81/82).
Absorbs Kickoff-L (archived at this staging; its AEO item already landed `e6a774b0`).

## Scope (ordered)

1. **Retrieval battery v2** — re-run on the fixed retrieval stack, k=5 live probes, live-hybrid
   golden variant, refund-policy corpus page (also feeds the support-bot confidence-gate
   calibration row in tracker §3).
2. **Perf follow-ups** — CAISSON-81 server-minted session-hint cookie (the reverted owned-fetch
   skip, done right), CAISSON-82 NFT trace residual.
3. **OSS W0 remainder** — directory-batch staging refresh (staged, never fired).
4. **OSS W1 sandbox validation** — clean-room full-catalog install (OSS from a fresh export +
   commercial via the registry path with a revocable test license), `create-caisson` run,
   verbatim docs/prose audit, leak + firewall + entitlement-token scan on the export. Report to
   `outputs/audit/oss-sandbox-audit-<date>.md`; **zero P0/P1 gates W2**.
5. **OSS W2 history cut-over** — milestone backfill (real exporter runs at real SHAs, dated at
   cut-over, NEVER backdated), then mirror-sync flips force-push → append-only; README
   first-screen mirror-explainer sentence; rewrite the superseded `mirror-sync.yml` snapshot
   header.
6. **OSS W4 release train** — GH-Release-publish trigger workflow, release-readiness script +
   per-release checklist template, retire the push-triggered publish/mirror paths into it.
7. **Version cut — LAST, after Kickoff N merges** — rebase on post-N main, `changeset version`
   consume (92+ pending), CHANGELOGs, registry index republish if a published version moved.

W3 (public flip + pre-launch window → Show HN) stays operator acts, not this kickoff.

## Tree boundary (vs Kickoff N — binding)

M owns: `scripts/`, `.github/workflows/{mirror-sync,publish}.yml` + the new release-train
workflow, `.changeset/` (at the cut only), `docs/gtm/directory-listings.md`, `services/docs`
retrieval + eval suites, `apps/site` perf surfaces (`next.config`, middleware/cookie mint,
docs corpus page). M must NOT touch: `apps/admin`, `packages/observability`,
`services/support-bot/*telemetry*`, `services/license`, `packages/billing`,
`.github/workflows/security-scan.yml`, Dockerfiles, or the `apps/site` JSON-LD helper — all
Kickoff-N ground.

## Binding rules

- Publish gates stay closed: repo private flag, `CAISSON_PUBLISH_DRY_RUN=true`, npm
  `confirm=publish` — nothing in this kickoff flips one; the train ships dormant like its
  predecessors.
- Never backdate a commit (ADR-0318 F3). Backfilled milestones pass HEAD-level gates.
- No ADR citations in changeset bodies (the changeset-prose gate) at the cut.
- Every dispatch sets `model` explicitly; fable only on the license/token seams.

## Exit criteria

Battery report + perf evidence on file · sandbox audit zero P0/P1 · mirror carries the
backfilled history and a post-cut-over sync APPENDS (proven) · release train merged dormant ·
version cut landed as the final commit · gates green · sot green.
