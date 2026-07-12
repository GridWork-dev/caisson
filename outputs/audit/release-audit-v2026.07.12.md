# R4 release audit — v2026.07.12 (first ADR-0325 train ride)

**Verdict: PASS — no P0/P1/P2. Ship.**
Date: 2026-07-12 · Session: wave-1 reconcile (ADR-0328) · Lane: in-session SHIP audit
(gw-code-reviewer + gw-security-auditor, both opus, findings adversarially verified per the
repo's PR-review-gate convention).

## Scope (first-ride note)

No prior release tag exists, so "cumulative diff since the last release tag" is the whole
history. Every feature PR on main carried its own in-session SHIP audit (the standing gate
since Greptile's retirement), and the repo has been through five whole-repo audit rounds plus
the audit-v2 remediation program. The fresh, never-SHIP-audited surface is therefore exactly
the release packaging itself: **version PR #222, squashed to `d4a32ecc`** (289 files — the
153-changeset consume, registry ledger/index/tarball rows, bun.lock refresh, and the
in-branch fixes: generated-CHANGELOG ticket-id strip, ledger gap-guard delisted-id exemption,
eu-ai-act template kernel pin), plus the train workflows at HEAD. Both auditors reviewed that
diff end to end.

## Code-review half (gw-code-reviewer, opus) — PASS

- **Four-way coherence, all 42 published packages (not a sample):** package.json version ==
  CHANGELOG leading entry == index.json `latest`/`versions[]` == a ledger publish row == a
  tarballs.json row. Zero disagreements; per-version index manifests byte-identical to their
  ledger rows; no duplicate `id@version` keys; every new row carries the gate attestation
  `29210126427@8c9a8300…`. The 24 private/unpublished bumps correctly have no registry rows.
- **index.json rebuild safety:** across all 66 changed package.json files the only changed
  lines are `version` — zero publishConfig/access/registry/private changes; zero tier or
  license-class flips; the delisted metas (`agent-dev`/`ai-kit`/`local-ai`) are absent as
  top-level modules and correctly dropped from `everything@0.2.3` members (deliberate, per
  the manifest comment; legacy-id entitlements are claim-side).
- **bun.lock:** 10-package spot-check — lock versions match the bumps.
- **Hand-fixes:** delisted exemption structurally cannot mask a non-delisted package's
  missing ledger row (exact per-name membership from ledger `op:"delist"` rows only); the
  eu-ai-act pin matches kernel 0.4.3; the intel judge-parse fix is fail-closed on every path.
- **Unexplained files: none.** All 289 files fall into the expected categories.

Notes (non-blocking): (A) the intel recorder fix itself landed on main pre-#222 — this PR
only consumes its changeset; (B) the ticket-id strip's real CHANGELOG surface was
apps/admin (5 refs) — outcome verified: zero internal ticket ids remain in any CHANGELOG;
(C) `everything@0.2.3` members drop of the three dissolved metas is intentional — buyers'
legacy ids resolve claim-side, on record here. Optional hardening: a comment near the gap
guard noting delisted ids are permanently outside its coverage (independently covered by
terminal delisting + the entitlement suite).

## Security half (gw-security-auditor, opus) — PASS, all five seams clean

1. **Publish-surface leak:** no package gained public access or an npm target in the diff;
   standing-state cross-check of all 49 modules' tier vs publishConfig — zero mismatches
   (every paid module restricted on GitHub Packages; every public one oss/Apache-2.0).
   Delisted metas not advertised anywhere in index.json.
2. **Secret material:** all key/token/credential-shaped hits in the diff are prose or
   manifest descriptions; no live values, no credentialed URLs, no authToken lines in
   bun.lock; tarballs.json rows are hash/size provenance only.
3. **Train-leg guards:** leg 3 double-gated (`RELEASE_TRAIN_ARMED` job gate +
   `RELEASE_NPM_MIRROR_ARMED` leg gate — repo variables, unreachable from the release event
   payload); leg 2's token is contents:write only and the export script excludes the
   commercial set and fails loudly on a commercial dependency — it cannot flip caisson-oss
   visibility; leg 4 inert without RAILWAY_TOKEN. Tag names are env-indirected everywhere
   (no shell-injection surface).
4. **publish.yml zero-mutation contract:** checkout at tag, hard ancestor-of-main check,
   byte-equality (shasum + SHA-512 integrity + size) of re-packed tarballs before any
   external write, dry-run default true at every layer, loud failure on missing R2 creds.
5. **Delist exemption adversarial check:** exactly 3 delist rows in the append-only ledger;
   a non-delisted package with a failed ledger append still fails the guard loudly.

Notes (non-blocking): `credits` reads paid/restricted in code while the ADR-0094 clause in
CLAUDE.md lists it in the open-Base set — doc-vs-code drift to reconcile in a follow-up ADR;
the exemption's safety rests on the same ledger-delist integrity the whole registry already
trusts (a bad delist 404s a module loudly rather than leaking anything).

## Follow-ups queued (none gate this tag)

- Reconcile the `credits` tier wording in the ADR-0094 clause (doc fix or superseding ADR).
- Optional coverage-boundary comment on the ledger gap guard.
