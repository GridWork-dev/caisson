# ADR-0327 — Codex-audit follow-on picks: scan gate, Environments, drift control, branch protection

- **Status:** locked (operator picker, 2026-07-11)
- **Context:** the four forks left open on the board after the 2026-07-11 Codex host/CI audit
  response (ADR-0325/0326 sitting). All four presented with evidence; operator took the
  recommended option on each.

## Decisions

1. **Security-scan deterministic layer → required check, sequenced after CAISSON-95.** The
   Semgrep-CE/Trivy/OSV/TruffleHog floor flips from advisory to a required CI check in the same
   PR as (or immediately after) the scanner-installer pinning — unpinned `curl | sh` installers
   are the flake source that would make a required gate red for non-code reasons. Semgrep Pro
   stays advisory either way. Rides Session A with CAISSON-95.
2. **GitHub Environments on prod-secret jobs → rider on CAISSON-94.** A `release` environment
   boundary around publish/release-train lands as part of the ADR-0325 release-train provenance
   rework, not as a standalone change; the train is dormant until that rework anyway.
3. **Inventory drift control → extend sot-check.** No generated-inventory feed, no new infra:
   each recurring stale-count class gets a per-doc parity check in `tooling/scripts/sot-check.ts`
   (the pattern already proven by checks #1/#7/#8). Manual sweeps remain the discovery layer;
   recurrence is the promotion trigger.
4. **Branch protection on the private repo → stays discipline-only.** No GitHub Team upgrade.
   Single-operator + session convention has held across 200+ PRs; the pick is revisited only on
   a real bypass incident or a launch-posture change. (`caisson-oss` gets native protection free
   when it flips public — that flip is ADR-0318 W3, unaffected here.)

## Consequences

The board's four open audit-response rows close; CAISSON-94/95 carry riders 1–2 into Session A;
sot-check remains the single drift-control surface. Nothing new is purchased.
