# C16 — share registry tarball-sidecar schema core

**Verdict:** HIGH-RISK FOLD  
**Size:** 79–90 gross overlapping lines; estimated 25–35 net  
**Risk:** high release-byte integrity

## Evidence

- Writer schema: `registry/scripts/ci-publish-step.ts:70-113`.
- Worker reader schema: `registry/worker/npm-routes.ts:26-71`.
- Both duplicate dependency map, packument metadata, dist fields, envelope, and inferred types.
- They are intentionally asymmetric: writer requires 64 lowercase hex for `lockHash`
  (`ci-publish-step.ts:96-103`), while Worker accepts/ignores any optional string
  (`npm-routes.ts:53-55`).
- Writer runs in `.github/workflows/version-pr.yml:77-88` and publish verification; Worker reads the
  bundled sidecar at `registry/worker/deploy-entry.ts:100-106`.

## Safe shape

Create a neutral private schema module under `registry/` containing only the common core. Layer the
writer-only provenance refinement in the writer. Do not import Worker code from scripts and do not
force one identical schema.

## Registry/revenue

No ledger/index/tarball content change is proposed, but this code guards actual release bytes and
buyer installs. Full writer/reader golden parity is mandatory.

## Refute attempt

One-schema unification was refuted by the deliberate lockHash asymmetry. The common-core fold
survived with a high-risk label.

**Buyer/site notice:** none if byte validation remains exact; severe if it does not.
