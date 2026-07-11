# ADR-0321 — Kickoff-M close-out locks: entity restamp, standing test-license, golden-leg gating, registry-P0 ride-the-train

**Status:** accepted · 2026-07-10 (Kickoff-M OSS-launch execution + close-out, the sitting that
merged M via PR #204). **Tags:** `external-system`, `security`, `infra`. Records the four decisions
that surfaced during Kickoff-M execution against the ADR-0318 OSS-launch program so later sessions
do not re-litigate them.

## Context

Kickoff-M executed the ADR-0318 OSS-launch program (W0 battery v2 + perf follow-ups + directory
staging; W1 sandbox validation; W2 mirror history cut-over to the append-only model; W4 dormant
GH-Release train) and merged to `main` as PR #204. Four decisions were made in-flight — the entity
legal close-out landed the same day (Caisson Software LLC), the W1 sandbox gate required a standing
licensed identity, a live retrieval-golden leg needed a home that would not flake PR CI, and the W1
commercial-track clean-room surfaced two registry P0s (CAISSON-85/86) whose repair the operator
picker routed onto the W4 train rather than blocking the merge.

## Decision

1. **Entity restamp → Caisson Software LLC.** The `LICENSE` copyright holder across every package
   is restamped from the working-name holder to **Caisson Software LLC** (the GA single-member LLC
   organized 2026-07-06, EIN issued 2026-07-10). Executes the entity lock from this session's legal
   close-out. Member identity details stay OUT of the repo (binding — see the legal-review brief,
   `docs/gtm/legal-review-brief.md`). The Apache-2.0 `NOTICE`/`LICENSE` texts and the mirror
   `TRADEMARK.md` (ADR-0319) name the entity; nothing else about the license split (ADR-0094) changes.

2. **Standing "everything" test-license — perpetual, kept forever.** The W1 sandbox gate installs
   with a standing full-catalog test license (`licenseId 39604d2d-…`, perpetual, all entitlements)
   so the licensed clean-room can be re-run any time without minting a fresh license per run. It is
   documented in `outputs/audit/oss-sandbox-audit-2026-07-10.md`; it is a **test** identity, never a
   sold entitlement, and must never leak into published artifacts or the mirror. The offline
   perpetual-token compare stays timing-safe; the standing license does not widen any real grant.

3. **Live retrieval-golden hybrid leg gates at release-readiness, not PR CI.** The docs
   retrieval-quality golden pair runs as a **live** leg (real embeddings, network) — it is wired
   into the W4 release-readiness gate and the support-bot live pytest, NOT into the per-PR `check`
   gate, because a live-embedding call is non-deterministic and network-dependent and would flake
   PR CI. PR CI keeps the offline FTS-floor golden (deterministic). This preserves the "golden-file
   regression before any retrieval-logic change" rule while keeping PR CI hermetic.

4. **Registry P0 repair (CAISSON-85/86) rides the W4 release train.** The W1 commercial-track
   clean-room found the live registry advertises versions with no tarballs (CAISSON-85) and pins
   exact member versions that no longer exist (CAISSON-86) — the licensed install path is broken
   (0/33). Per the operator picker the repair is **not** a blocking pre-merge fix; it rides the W4
   gated release train (tarball upload + index republish together), because an index-only republish
   now would widen the known drift rather than close it. Recorded, not blocked. The two issues stay
   open, scheduled against the first train ride.

## Consequences

- **No in-branch version cut.** The ~132 accumulated changesets stay UNCONSUMED on the branch (and
  thus on `main` after merge). Per caisson's release flow (ADR-0069/0223), the version bump +
  npm/registry publish + append-only `registry/ledger.jsonl` write happen **atomically in the
  operator-gated CI publish run**, never in a merged feature branch. A `changeset version` run
  in-branch bumps every `package.json` past the ledger, which the `publish-readiness flip (ADR-0111)`
  gap guard correctly rejects (a published version with no ledger entry = a version with no tarball,
  the CAISSON-85 class). The earlier "version cut as M's final act" framing was a mechanics error and
  was reverted before merge; the changesets carry forward to the gated publish.
- The registry index/ledger is **not** touched by M; the CAISSON-85/86 tarball repair + index
  republish ride the W4 gated release train together (decision 4) so tarball + ledger + index land
  in one atomic publish rather than widening the known drift.
- `mirror-sync.yml` is re-enabled at the M merge wrap (it was disabled at the Actions level to keep
  the stale force-push version from running against the backfilled append-only history).
- The standing test-license is a security-relevant asset: it is referenced only from the audit doc
  and CI-local sandbox runs; it is on the same "never publish" footing as any secret.
