# ADR-0069 — Publish flow: GITHUB_TOKEN credential, incremental backfill, changesets

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Names the credential ADR-0021
left abstract and sequences the P5 registry backfill against editions that land mid-wave.)

ADR-0021 fixed publishing as **CI-only, short-lived, no local publish credential** but named the
credential only abstractly ("OIDC / short-lived token") and assumed a code-complete tree. Wave-1
lands the four editions incrementally, so the backfill cannot wait for the last edition to exist.

## Decision

- **Publish to GitHub Packages with the built-in `GITHUB_TOKEN` + `permissions: packages: write`.**
  This _is_ the ADR-0021 invariant made concrete: the token is workflow-scoped, minted per run, and
  expires with the job — **zero new stored secret**, no local credential. It matches the
  `@caisson:registry=npm.pkg.github.com` + `access: restricted` config baked into generated repos
  (ADR-0021), so the same auth path that publishes also gates installs by entitlement.
- **Release orchestration via changesets** (ADR-0001): a changeset-presence gate (`changeset status`
  blocks a PR with no changeset) plus the `updateInternalDependencies` cascade for the internal
  `@caisson/*` version bumps. No hand-edited version numbers.
- **Backfill is INCREMENTAL, not all-or-nothing.** The P5 backfill publishes **only what exists** —
  kernel + base + primitives + cli. Each edition publishes **as its code lands later in the wave**,
  through the same gate, with its own changeset.
- **`create-caisson --edition` degrades gracefully** when an edition is not yet in the registry
  allowlist/index — it reports the edition as not-yet-available rather than erroring, and resolves
  it once the publish lands.
- **The ledger-append script snapshots the manifest** and records `gateAttestation`
  (`"<ci-run-id>@<commit-sha>"`) + `publishedAt` as provenance (ADR-0021 — provenance, not the
  access control). Access control stays "only CI writes the index + only CI publishes."

## Rejected

- **Fine-grained PAT / `NODE_AUTH_TOKEN`** — a stored, long-lived credential held in a secret;
  directly contradicts ADR-0021's "short-lived, no local credential" invariant. `GITHUB_TOKEN`
  needs no stored secret at all.
- **npm trusted-publishing (OIDC)** — the cleanest model, but OIDC trusted publishing works **only
  against `registry.npmjs.org`**, not GitHub Packages (ADR-0021's operator-locked host). Not
  available on the chosen registry.
- **Blocking all backfill until every edition is code-complete** — serializes P5 behind the entire
  Wave-1 build, defeating the incremental-bootstrap intent. Publish what exists; let editions
  catch up.

## Binding

Every publish to GitHub Packages runs CI-only under the workflow `GITHUB_TOKEN` with
`packages: write` and **no other publish credential** — no PAT, no `NODE_AUTH_TOKEN`, no laptop
publish past the gate; releases are changesets-driven (presence gate + `updateInternalDependencies`);
the P5 backfill publishes only the substrate that exists (kernel + base + primitives + cli) and each
edition publishes as it lands, with `create-caisson --edition` degrading gracefully against the
not-yet-published set. This repo is fully-commercial (ADR-0023) — and per ADR-0050 the Local-first
AI edition is now commercial too, so there is no AGPL flank to special-case in the publish path; the
`LicenseRef-Caisson-Commercial` manifest gate (ADR-0020/0022) applies uniformly. Evidence:
ADR-0021 (CI-only publish, `gateAttestation` provenance, `npm.pkg.github.com` + `access: restricted`);
ADR-0001 (changesets); ADR-0023/0050 (fully-commercial, no AGPL flank); `outputs/research/wave1-forks.md`.
