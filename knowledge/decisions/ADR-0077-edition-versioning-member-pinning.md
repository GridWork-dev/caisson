# ADR-0077 — Edition versioning: independent modules + edition manifest pins member set

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Defines what a versioned
"edition" means when it composes independently-published modules.)

An edition is a composition of independently-published modules (ADR-0003), but the registry
manifest only _names_ its members — `dependencies` carries no version pin
(`registry/schema/module-manifest.ts:71`) and the registry index tracks per-module versions with no
edition→member lock. So `install Compliance edition @1.4.0` has no deterministic member-version
target. This resolves whether members move in lockstep and how an edition release freezes its set.

## Decision

**Modules version INDEPENDENTLY; each edition RELEASE pins an exact member-module-version set** — a
lockfile-like `edition → {member-id: exact-version}` map carried in the edition manifest.

- Every `@caisson/*` module follows its **own semver / changeset cadence**; an edition never forces
  its members into a shared version. A one-line fix to one primitive bumps only that primitive.
- An **edition release is a pinned map**: `defineModule`'s edition manifest gains a `members` (or
  `pins`) field of `{ moduleId: exactVersion }` — distinct from `dependencies`, which keeps naming
  membership/topology (down-only per ADR-0003). The pin set is the lockfile; the dep list is the DAG.
- `install Compliance edition @1.4.0` resolves **deterministically** to that frozen member-version
  set — the same input always generates the same module versions.
- This gives the Option-C reproducible-generate promise a **deterministic target** (the generator
  reads the pinned set, not "latest") and the subscription **"framework updates" SKU (ADR-0012) a
  concrete update unit**: an edition version bump is exactly one diffable member-version delta.
- **Extends** ADR-0003 (editions are compositions, never forks) and ADR-0020 (manifest shape, which
  today carries no version pins) without reversing either. All editions are commercially-licensed
  SKUs (ADR-0023; ADR-0050 closed the AGPL flank so local-ai is commercial too) — the pinned set is
  also the unit the entitlement + framework-updates subscription bills against.

## Rejected

- **Lockstep (all member modules share one edition version)** — couples the release cadence of
  unrelated packages; a one-line change in any member bumps the whole edition and every sibling,
  and it breaks à-la-carte independent-module sale (ADR-0012). Versions become noise, not signal.
- **Naming deps without version pins (the current manifest shape)** — `dependencies` carries no
  version (`registry/schema/module-manifest.ts:71`), so `edition @1.4.0` floats against whatever the
  registry index publishes today. No reproducible-generate target; the framework-updates diff has
  nothing stable to diff against. This is the gap this ADR closes.

## Binding

An edition release MUST pin an exact, immutable `member-id → version` map in its manifest;
resolving `edition @X.Y.Z` MUST yield a deterministic member-module version set. Member modules
advance their versions independently, and an edition bump is a **new pinned map** — append-only,
never edited in place (ADR-0006), superseded by the next edition release. The `create-caisson`
generator and the framework-updates subscription consume that pinned map as their version unit; no
generate or update path may resolve members against "latest". Evidence: ADR-0003 (composable
editions, down-only, never forks); ADR-0020 (manifest authoring — the `dependencies` field this
extends with a version-pin map); ADR-0012 (framework-updates subscription SKU + à-la-carte module
sale); ADR-0006 (append-only locked artifacts); ADR-0023/0050 (every edition a commercial SKU);
`registry/schema/module-manifest.ts:63,71` (`editions` array + version-less `dependencies` today);
fork X-13 in `outputs/research/wave1-forks.md`.
