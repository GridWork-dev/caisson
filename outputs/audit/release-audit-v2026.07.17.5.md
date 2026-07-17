# R4 release audit — v2026.07.17.5 (second ADR-0325 train ride)

**Verdict: PASS — no open P0/P1/P2. Ship.**
Date: 2026-07-17 · Session: CAISSON-125 prune + release-train sitting · Lane: in-session
SHIP audit (gw-code-reviewer opus + gw-security-auditor fable on the registry money seam,
findings adversarially verified per the repo's PR-review-gate convention).

## Scope

The last full-train release is v2026.07.12; the interim registry states shipped via the four
2026-07-17 publish-lane rides (v2026.07.17.1–.4), each recorded in `docs/deploy/STATE.md`,
and every feature PR since v2026.07.12 carried its own in-session SHIP audit (the standing
gate since Greptile's retirement). The cumulative-diff surface for this tag therefore
decomposes into (a) already-audited feature PRs (#242–#265 per their §4 tracker rows), and
(b) the fresh release packaging itself: **version PR #266, squashed to `8cd9ac5e`** — the
14-changeset consume (six bundles + cli + ds-manifest + mcp-server + registry + site/app
version bumps), 9 new ledger publish rows, index rebuild, 9 new tarball rows, bun.lock
refresh. Both halves of the audit lane reviewed (b) end to end this session; the substantive
diff underneath it (PR #265, the ADR-0359 version-level delist prune) received the full
two-auditor adversarially-verified treatment earlier the same session.

## The PR #265 audit (the substantive diff) — PASS after in-lane fixes

- **P1 caught and fixed pre-merge (catalog-freeze class):** `ci-publish-step.ts` derived its
  module-delisted id set from ALL delist rows; with 87 version-delists on the ledger it would
  have treated 47 live modules as delisted and silently skipped their next version cut from
  ledger/index/tarballs. Fixed across all four consumers with the `d.version === undefined`
  filter; the pre-existing real-ledger test (`skippedDelisted === 3`) pins the regression and
  ran green on the release SHA.
- Two P3s fixed (probe MISSING-line paste-in parse; fail-loud + refuse-to-write on
  unparseable prune input). Three findings adversarially REFUTED with reproduction evidence
  (backfill allowlist gate, test-coverage claim, applyPrune sidecar asymmetry — the latter
  already double-defended by the required `registry-index` coverage gate and the Worker's
  dist-less-version omission path).
- Independent post-apply verification: ledger diff pure append (+87, 0 removed, none for the
  6 module-delisted ids), packument 330 → 243 versions with every module retaining ≥ 1
  version and no latest touched, sidecar −93 exactly, deterministic rebuild, the pre-existing
  88-row no-sidecar gap untouched.

## Version PR #266 (the fresh packaging surface) — PASS

- **Ledger appends:** exactly 9 publish rows — everything@0.2.4, compliance@0.5.4,
  ai-production@0.2.2, local-first@0.2.2, provenance@0.2.2, agentic-dev@0.2.2, cli@0.6.3,
  mcp-server@0.5.1, ds-manifest@0.2.1. No delists, no rewrites, append-only holds.
- **The prune's customer-facing tail lands:** the six new bundle manifests carry the
  repointed member pins (spot-verified: everything@0.2.4 pins local-store 1.0.1, ui-pro
  0.3.0, self 0.2.3) — every pin resolves served + tarball-backed on the new index; the
  coverage gates (latest / version / member-pin, CAISSON-85/86) ran green on the release SHA
  in the required `registry-index` job, and release-readiness re-ran them green in the train.
- **skippedDelisted === 3 held live:** the consume's `ci-publish-step --mode version` run
  processed the post-prune ledger with the fixed filter — only the three true module-delisted
  metas skipped; all 9 intended publishes landed (the P1 fix's first production exercise).
- **CI on the release SHA:** all required checks green at `8cd9ac5e` (check ·
  standards-gate · registry-index · oscal-conformance · deterministic, plus quality and
  security-scan workflows). The `deploy-railway` run on the same push exited green as the
  designed inert no-op (`RAILWAY_TOKEN` unset per the immutable-deploy pre-arm posture).
- **Changeset hygiene:** 4 changesets drained; CHANGELOG prose buyer-readable, zero tracker
  ids (the shipped-prose gate ran green on the release SHA).

## Residuals carried (none blocking)

- The grandfathered dangling-member-pin backlog (114 entries, re-enumerated at the prune) is
  the enumerated immutable history of already-served bundle versions; the heal-only gate
  forces monotonic shrink. New cuts cannot add to it (pre-publish pin check).
- The 88-row pre-sidecar rowless backlog is unchanged and frozen (heal-only).
