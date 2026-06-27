# ADR-0022 — Import-boundary + license lint gates

Status: **locked** · 2026-06-27 (D9 module-standards session; locked after 2 adversarial passes)

Three invariants from earlier ADRs were **review-gated only**. The docs review rated the AGPL one
HIGH (legal liability). This ADR converts them to **CI gates that fail the build**. Per the locked
operator decision (decisions board — source-of-truth #1), enforcement is **all three** layers
(ESLint + Bun standards-gate + dependency-cruiser) — belt-and-suspenders, because each layer alone
has a hole the others close. All run in CI (ADR-0016) + block merge.

## Why three layers (division of labor)

| Layer                                                                      | Catches                                                                                                                            | Blind to                                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **ESLint `no-restricted-imports`** (`tooling/eslint-config/boundaries.js`) | provider-SDK static `import`, fast + in-editor                                                                                     | dynamic `import()` / `require()`, transitive deps, unlinted published `.js` |
| **dependency-cruiser** (`.dependency-cruiser.cjs`)                         | the REAL module graph: dynamic + `require` + **transitive** provider-SDK reach; base→edition direction; cycles                     | a package's SPDX `license` (graph tools read it poorly)                     |
| **`@caisson/standards-gate`** (Bun)                                        | the **SPDX/license authority**: AGPL boundary over workspace **+ external** deps; edition↔edition; manifest↔package.json agreement | dynamic/transitive _imports_ (defers to dep-cruiser)                        |

A denylist of provider SDKs is unwinnable alone (new SDKs ship constantly — the review caught the
denylist already missing `@google/genai`); the graph-reachability layer is the real backstop.

## Gate 1 — AGPL import boundary (ADR-0010 enforcement)

The Bun gate FAILS if any **non-AGPL** package depends on an **AGPL-licensed** package — over
**both** workspace `@caisson/*` deps **and external npm deps** (it reads each resolved dep's SPDX
`license`; the workspace-only check missed an external AGPL lib — review HIGH). dependency-cruiser
backstops AGPL pulled via dynamic/transitive import. Rule: **only an AGPL package may consume an
AGPL package.** AGPL detection parses SPDX (handles `AGPL-3.0-*` + `Affero`); the manifest SPDX
enum (ADR-0020) keeps dual-license ambiguity out of the authored path.

## Gate 2 — provider-SDK import boundary (ADR-0011 enforcement)

Only `ai-config` + `ai-kit` may reach a provider SDK; everything else routes through `ai-config`.
ESLint catches the static import fast; dependency-cruiser catches dynamic + transitive reach. The
denylist (`PROVIDER_SDKS` in `boundaries.js`, mirrored in the cruiser regex) is kept current and
backed by graph reachability so a missed name still fails the graph rule.

## Gate 3 — down-only dependency boundary (ADR-0003 enforcement)

A `base`/`primitive` may not depend on an `edition`; an edition may not depend on another edition.
The Bun gate enforces this **today** (keyed on the four edition package names; refined to manifest
`kind` once modules carry manifests); dependency-cruiser independently forbids base→edition in the
graph.

## Gate 4 — manifest ↔ package.json agreement (ADR-0020)

The Bun gate loads each `manifest.ts` and asserts `id`/`version`/`license` match package.json — so
the catalog can never advertise a different license than the package ships (the AGPL gate keys on
package.json; the index publishes the manifest license; drift would split them).

## Rejected

- **Review-only enforcement** — the failure mode the review flagged HIGH; humans miss imports.
- **A single layer** — ESLint alone misses dynamic/transitive; the Bun graph-walk alone is slower
  in-editor; dep-cruiser alone can't judge SPDX. Each covers the others' hole.
- **`eslint-plugin-boundaries`** — config-heavy for what `no-restricted-imports` + dep-cruiser do.

(Earlier draft rejected dependency-cruiser; reversed — the operator locked the three-layer
mechanism and dep-cruiser is the only layer that closes the dynamic/transitive holes.)

## Binding

The AGPL gate (workspace + external), provider-SDK gate (static + graph), down-only gate, and
manifest-agreement gate **run in the CI `standards-gate` job and block merge**. The Bun gate runs
**twice** — pre-install (AGPL-workspace + down-only + declarations survive a broken install) and
post-install (where external-AGPL + manifest↔package.json agreement actually execute, since they
need `node_modules`). The bindings in **ADR-0010** (AGPL) and **ADR-0011** (provider-SDK) now
reference these CI gates, not review.

**Honest current state:** the gate logic + CI wiring exist and are verified locally (AGPL +
down-only fire on injected violations). What does NOT bite yet: (a) the whole `standards-gate` job
dies at `bun install` until **foundations** commits a lockfile + a package.json for every workspace
member (empty `services/*`) — so the post-install pass + eslint + dep-cruiser can't run in CI today;
(b) the checks are no-ops on the current tree because no package ships code or a `manifest.ts` yet —
they bite as P1+ packages land. This is a wiring/sequencing dependency, not a design gap.
