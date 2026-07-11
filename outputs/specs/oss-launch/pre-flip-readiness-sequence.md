---
updated: 2026-07-11
status: live
owner: operator
---

# Pre-OSS-flip readiness sequence

**What this is.** The single sequenced list of everything that must be wired and green
**before** the OSS public flip (ADR-0318 W3 → Show HN). Ordered by dependency: a later
gate never opens until every gate above it is green. This is the operator's launch runbook
index — each row points at its owning ADR / Linear issue / spec; it does not restate them.

**Rule (ADR-0318).** Do **not** flip the mirror public or announce while the paid install
path is broken, backups are absent, or the release train has never made a clean ride. The
flip is the _last_ act, not a parallel one.

---

## Gate 0 — Fix the paid install path (BLOCKS EVERYTHING)

The W1 sandbox clean-room proved a licensed buyer install is broken **0/33**. Nothing
downstream matters until this is green — a public launch with a broken `bun add` is worse
than no launch.

1. **CAISSON-85 (P0)** — registry advertises versions with no tarballs. Backfill + upload
   tarballs (+ `registry/tarballs.json` rows) for every advertised version that 404s.
   `registry/scripts/ci-publish-step.ts` packs only _newly-published_ versions — needs a
   backfill mode or a manual pack + `aws s3 sync`.
2. **CAISSON-86 (P0)** — published module manifests pin exact member versions that no
   longer exist. Re-mint affected manifests with resolvable ranges (or make registry
   storage append-only so old versions stay retrievable forever), and add a registry-side
   invariant: every dependency version reachable from any advertised version must resolve.
3. **CAISSON-87 (P1)** — registry rate-limit answers a sustained 403 (no `Retry-After`); a
   normal concurrent `bun add` of a bundle can trip it. Mirror the proven `/query` 429 +
   `Retry-After` edge config for registry paths; size for an everything-bundle burst.

**Mechanism:** all three ride the **W4 gated release train** (ADR-0318, merged dormant;
arms via the `RELEASE_TRAIN_ARMED` repo variable) so tarball upload + manifest re-mint +
index republish land in ONE atomic ride. An index-only republish now widens the drift.

**Exit:** clean-env install matrix over the full catalog — every `latest` installs, both
licensed and anon-base. Re-run the W1 sandbox audit; zero P0/P1.

## Gate 1 — Durability + gates green

4. **Railway Postgres PITR / backups (CAISSON-52)** — enable point-in-time recovery on the
   platform DB before real buyers' money + entitlements depend on it. No launch on a DB
   with no restore path.
5. **All CI gates green on `main`** + the ADR-0314 four-layer security stack fully wired
   (SAST · supply-chain · DAST; the Layer-4 AI-pentest stays out of CI). `bun run sot` green.
6. **Fresh full re-audit** (ADR-0318 per-release requirement): `gw-code-reviewer` +
   `gw-security-auditor` over the release diff; money/license/registry seams especially.

## Gate 2 — Commerce readiness

7. **Paddle SANDBOX → production flip** — real checkout live. The pre-launch CF-Access gate
   is already scoped to commerce paths only (ADR-0303), so marketing/docs/api stay public
   for AI indexing while `/dashboard*` + `/cart*` gate until this flips.
8. **Affiliate real codes minted** (ADR-0320) via the `/business` mint card — 10% / 3000bps
   stamped per-row at mint. Sandbox mint + webhook stamp already proven.
9. **License issuer + entitlement resolver live-verified** end-to-end against the production
   registry (depends on Gate 0 — the issuer signs PURCHASED ids, never the index expansion).

## Gate 3 — Operator / platform items

10. **1Password parity finalized** (ADR-0317, op = primary secret SoT). Run the two-command
    flow (`op signin` → `railway-env-sync` → `vault-parity-check`) for any vars added since
    the last sweep (e.g. `POSTHOG_QUERY_KEY`, `GRAFANA_LOKI_DATASOURCE_UID`). Parity exit 0.
11. **GitHub apps / automations** — Renovate `--strict-digests` scanner flip after Renovate's
    first pin-wave merge (ADR-0315); confirm the app roster on `caisson-sh` (Renovate, Socket,
    Actions runners) is the intended set; any Linear automations wired.
12. **Mirror + npm publish pipelines** — `mirror-sync` is re-enabled + append-verified; the
    npm publish stays gated on a manual `confirm=publish` dispatch until the flip. The one-time
    W2 full-history backfill (if not already run) lands here, append-only, never backdated.

## Gate 4 — The flip (LAST)

13. **Mirror → public** — `caisson-sh/caisson-oss` private → public (only after Gates 0-3).
14. **npm publish** — the gated `confirm=publish` dispatch; every advertised version installs.
15. **Announce** — the pre-launch window → **Show HN** (ADR-0318 W3).

---

## Sequencing note

Gates 0-1 are hard blockers (broken install / no backups = no launch). Gate 2 can proceed
in parallel with Gate 1 once Gate 0 is green. Gate 3 items 10-11 can run any time (they
don't block downstream) — schedule when convenient. Gate 4 is strictly last and atomic per
the release-train ride. Live issue state: Linear (`CAISSON-85/86/87` Editions & Registry,
`CAISSON-52` PITR); program detail: `SPEC-oss-launch-program.md`, ADR-0318.
