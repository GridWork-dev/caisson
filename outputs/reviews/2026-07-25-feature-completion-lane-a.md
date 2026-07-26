---
branch: feature/completion-lane-a
base: feature/full-state-completion
base_commit: 7dbe7cd0
reviewed: 2026-07-25
depth: deep
files_reviewed: 133
commits_reviewed: 17
status: pass
findings:
  blocking: 0
  fixed: all
  advisory: 8
---

# ADR-0380 completion wave — Lane A review

## Verdict

PASS. Lane A implements A1–A7 from `LANE-A-PLAN.md`, stays out of every Lane B-owned path, and is
ready for one PR into `feature/full-state-completion`. Code review, security audit, and an
independent adversarial review all pass on exact implementation commit `6d25a164`; no blocking
finding remains.

The adversarial lane initially found one P1: a recipient could remove the final signed row and
lower the pack's self-declared `chainLength` because the verifier authenticated each historical row
but not the completeness of the exported snapshot. The fix adds a domain-separated Ed25519
complete-snapshot seal over the terminal length, ordered receipt digest, tenant and WORM identities,
export instant, chain verdict, key identity, and key fingerprint. The standalone verifier validates
that seal before row verification and refuses unsigned or seal-stripped packs. An independently
reproduced adjusted-tail attack now fails with `invalid evidence-pack seal`.

## Scope

| Task | Delivered behavior                                                                                                             | Evidence                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A1   | Bearer-authenticated internal proof seam; account is server-bound; WORM credentials remain in admin                            | Auth, invalid-token, account-binding, not-found, rate-limit, and strict-boundary route tests      |
| A2   | Server-computed six-state admin viewer, lazy row proofs, provenance, redaction-safe payloads, and logical evidence-pack export | Component, route, redaction-count, signer, pack-digest, and standalone-verifier tests             |
| A3   | Session-derived, RLS-scoped tenant proof route and buyer evidence view through the private admin transport                     | Auth, RLS, cross-tenant, redaction, proxy, and fail-closed tests                                  |
| A4   | Persisted latest-pack reader and separately labeled `maps-to` / `implements` crosswalk edges with no aggregate score           | Real-pack parser/mapper, claim-posture, page, and accessibility coverage                          |
| A5   | Injected Inngest v4 adapter behind the jobs port with strict config and gated live submission                                  | Shared conformance, adapter, configuration, and live-test gates                                   |
| A6   | Truthful KMS deletion receipts across local, AWS, GCP, and Azure; finality reaches crypto-shred audit telemetry                | KMS conformance, provider-state, crypto-shred, golden, and gated live tests                       |
| A7   | Exact immutable object-version identity across supporting stores plus Azure Blob WORM support                                  | Store conformance, S3/GCS/Azure identity, retention monotonicity, migration, and gated live tests |

Seven package changesets cover admin, site, jobs, field-crypto, compliance, audit-worm, and kernel.
The KMS port widening is explicitly described in the affected release notes.

## Review lanes

### Code review

PASS at `6d25a164`, no blockers. Fresh post-fix verification: 43 tests passed, 0 failed; diff check
clean. The reviewer confirmed complete-snapshot sealing, raw-payload confinement, account-bound v2
anchors, provider readbacks, and rate-limit placement.

### Security audit

PASS at `6d25a164`, no blockers. Fresh audit verification: 62 tests passed, 0 failed, 145
assertions; diff check clean. The audit confirmed that the seal is checked before row verification
and rejects modified, truncated, tenant-replayed, key-substituted, unsigned, and malformed packs.
Production admin composition passes the same env-validated signer used for row anchors into both
export surfaces.

### Adversarial review

PASS at `6d25a164`, no blockers after the adjusted-tail P1 was fixed. The reviewer independently
reproduced a healthy two-row PASS, then confirmed that removing the final row while lowering
`chainLength` fails and that removing `packSeal` fails closed. Fresh post-fix evidence: 42 focused
tests and 41 Turbo tasks passed.

## Verification evidence

- `env TURBO_CONCURRENCY=4 bun run check`: PASS — 218 of 218 tasks; standards gate checked 74
  packages and scaffold-skipped 5.
- Lane A security regression suite: PASS — 240 tests across 20 files, 602 assertions.
- Scoped production build/lint for kernel, audit-worm, field-crypto, admin, and site: PASS — 59 of
  59 tasks.
- `bun run format:check`: PASS.
- `git diff --check 7dbe7cd0...HEAD`: PASS.
- Lane B ownership check: PASS — no changes under `apps/site/lib/module-pages.ts`,
  `apps/site/lib/marks.ts`, `apps/site/lib/media-manifest.ts`, `apps/site/components/poke/**`, or
  `packages/ui/**`.
- `bun run sot`: every content/state gate is GREEN — ADR ceiling, frontmatter, archive integrity,
  tracker reality, changesets, package counts, and docs surface. The command exits 1 only on its
  branch-hygiene advisory because the operator-requested base, Lane B, Paddle, and temporary review
  worktrees concurrently exist; Lane A does not own or remove them.

## Residual advisories

1. A4 production activation still requires the atomic compliance archive/manifest/`latest.json`
   producer and mount. Lane A intentionally ships the fail-closed reader only.
2. Replaying an older intact signed pack cannot be distinguished without an out-of-band freshness
   reference or current external checkpoint; the README states this limit.
3. Anchor trust currently pins one active key rather than a historical rotation keyring.
4. S3 `VersionId` is checked for non-emptiness; applying the shared length/control-character
   validator before persistence would further harden the provider boundary.
5. Object-store creation and SQL version-ledger persistence remain a two-system operation with an
   orphan-on-crash window; exact-version reads fail closed afterward.
6. Evidence rate limits are process-local and multiply across replicas; the 250-row window is
   bounded after source loading rather than in the source query.
7. Admin proof-read logging is best-effort, and the filesystem pointer reader retains a narrow
   `realpath`-to-`open` race window.
8. The Inngest live test proves submission, not receive-side function serving. Provider live tests
   remain credential-gated.

These are non-blocking follow-ups or activation prerequisites. No deploy, migration execution,
restart, tag, publish, secret write, commerce change, merge, or Lane B edit is part of this branch.
