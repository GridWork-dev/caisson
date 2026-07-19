# R4 release audit — v2026.07.19

Window: `v2026.07.18.3..54677780` — PR #285 (lockHash provenance + Blacksmith runner
sweep + ai-kit guard restatement), the deploy-railway Blacksmith flip, repack changesets,
docs/state updates, and version PR #286 (12-package mechanical consume, first
lockHash-stamped rows). Prior window fully audited at v2026.07.18.3.

Lane: gw-security-auditor (fable), combined pass, 2026-07-19.

## Verdict: PASS — no majors.

- **lockHash mechanism:** provenance excluded from the publish byte-equality compare
  (destructure verified); no false-negative path — a matching-hash row still re-packs and
  byte-compares, and verifyForPublish has no lock short-circuit at all; schemas sound on
  both writer and Worker reader; currentLockHash fails open to the pre-ADR shape only
  when the lockfile is absent (test fixtures).
- **Consume output:** ledger append-only (12 added, 0 deleted); 12 sidecar rows carry one
  identical 64-hex lockHash equal to sha256 of the committed bun.lock; index/sidecar
  consistent 12/12.
- **Runner sweep:** runs-on flips only — no permissions/secret-scoping change, no new
  interpolation surface.
- **ai-kit guard:** NaN-fail-closed form semantically identical for real numbers.

## Non-blocking

- Three stale "STAYS GitHub-hosted" comments above the flipped runs-on lines
  (version-pr.yml x2, r2-parity-probe.yml) — sweep rides the next docs pass.
