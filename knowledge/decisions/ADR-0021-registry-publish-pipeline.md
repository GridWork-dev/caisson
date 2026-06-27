# ADR-0021 — Registry publish pipeline (the one ingress) + versioning

Status: proposed · 2026-06-27 (D9 module-standards session) — recommended, pending operator lock

ADR-0004 fixed the invariant ("a module enters the registry only through the `tooling/` standards
gate; generation meters a credit debit") and deferred the pipeline to D9. This ADR makes that
ingress executable: how a module is versioned, validated, and published, and how the registry
is the generator's allowlist.

## Registry shape: index ≠ source

`registry/` is the **catalog**, not a source mirror. It holds the **registry index** (a built,
versioned JSON: each module → its published versions → that version's manifest + publish
metadata) that the CLI, the buyer's agent, AND the docs all read (ADR-0004 one-source). Module
**source** ships as **independently published, versioned packages** (changesets-driven,
ADR-0001). `create-stack` composes a repo by pulling **published versions** named in the index —
it never reads working-tree source. The index schema is `registry/schema/registry-index.ts`.

## The publish flow — the ONLY registry ingress

```
changeset  →  version bump  →  STANDARDS GATE  →  publish  →  registry-index update
                                  │
                                  ├ boundary lint (ADR-0022: AGPL + provider-SDK + down-only)
                                  ├ manifest validation (ADR-0020 schema parse; package.json↔manifest agree)
                                  └ golden-file regression (harness = ADR-0013)
```

A publish that skips or fails the gate **writes nothing**. Made executable in CI (ADR-0016): the
index-update job runs **only after** a green standards-gate job and stamps each new version with
a **gate attestation** (the gate run's commit SHA / CI run id). A CI check rejects any
index entry whose `gateAttestation` does not correspond to a real green gate run — so a **manual
index edit is rejected**. This is "the standards gate enforces registry write" made real.

## Versioning (changesets policy)

- **Per-module semver, independent** (à-la-carte commerce, ADR-0003): any change to a module
  requires a changeset; the module bumps on its own line.
- **Editions** (compositions) bump when a composed dependency bumps — changesets
  `updateInternalDependencies: patch` propagates the dep bump into the edition's changelog.
- Changelogs are per-module (the buyer sees a module's own history).

## Golden-file at publish

The module's **golden fixture** (ADR-0020 `golden`) runs inside the gate via the ADR-0013 harness
— this track does **not** redefine the runner. A _module's_ fixture is: the serialized,
deterministic output the module produces for a fixed input (e.g. a generated file set, an
evidence-pack manifest, a composed config) committed under the module's `golden` dir. A golden
diff **blocks publish** until re-blessed via the ADR-0013 bless procedure.

## Generator input-validation (ADR-0004/0008 enforcement)

The **registry index IS the allowlist**. `create-stack` and the buyer MCP server validate every
caller-supplied module/edition id against the index (a Zod enum built from the live index —
`moduleAllowlist()` / `assertKnownModule()` in `registry/schema/`) **before any path
construction or subprocess**. No unvalidated string reaches a filesystem path or exec arg. (The
MCP write path is also credit-gated + per-account rate-limited per ADR-0008.)

## Backfill

P2–P4 packages become the **initial registry module set** by running each through this exact
publish flow — there is no special backfill path; the "backfill" is simply each module's first
gated publish. Tracked as a P5 plan sub-task.

## Rejected

- **Source blobs in `registry/`** — duplicates the packages, breaks reproducible install + per-module changelogs.
- **Unversioned index / manual index writes** — bypasses the gate; defeats reproducible generation.
- **Per-edition forked publish** — re-forks the base, breaks one-standard (ADR-0003).

## Binding

No registry-index write without a green standards-gate **attestation**; every generation
validates caller ids against the index allowlist **before** any path/subprocess; each module is
independently versioned via changesets.
