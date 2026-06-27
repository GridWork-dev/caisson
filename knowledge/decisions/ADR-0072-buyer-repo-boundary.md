# ADR-0072 — Monorepo-vs-generated-repo boundary: what ships into the buyer's repo

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Draws the line between Caisson's
own monorepo machinery and the repo `create-caisson` emits to a buyer.)

Nearly every enforcement surface — the 6 CI jobs (ADR-0016), golden-file regression (ADR-0013), the
standards gate (ADR-0020), the eval CI gate (ADR-0062) — was authored for the Caisson **monorepo**,
but the product is a **generator** (ADR-0048) that emits a buyer repo. Which of those artifacts cross
into the generated repo, and under what license, was silently assumed by a dozen surface forks and
never decided.

## Decision

- **The generated buyer repo carries its OWN standalone working harness** — a testable, runnable
  repo out of the box, not bare code:
  - **A trimmed CI** — `build` · `lint` · `unit` + **`golden-file` for the included modules only**.
    A subset of ADR-0016's 6 jobs: integration-against-PGlite and the workspace `standards-gate`
    are monorepo-shaped and do **not** travel.
  - **The golden fixtures** for those included modules (ADR-0013) — so the regression suite the
    buyer inherits actually has its baselines and runs green from clone.
  - **An `AGENTS.md`** — the per-module integration contract authored under ADR-0020, the buyer's
    agent-facing entry point into the kit they bought.
  - **All commercial-licensed, buyer-owned** — `LicenseRef-Caisson-Commercial` (ADR-0023); with
    ADR-0050 making local-ai commercial too, a generated repo carries **no AGPL flank**, so the
    whole emitted tree is one commercial EULA the buyer owns and builds unlimited products on.
- **CAISSON-MONOREPO-INTERNAL ONLY** — never emitted into a buyer repo:
  - **The registry / publish flow** (ADR-0021) — the publish-and-index pipeline, the CI-only
    publish credential, the ledger.
  - **The standards-gate AUTHORING surface** (ADR-0020) — manifest authoring + the `bun run gate`
    workspace scanner that enforces Caisson's own publishability posture.
  - **The eval CI gate** (ADR-0062) — the prompt/agent regression-vs-baseline job, an authoring-side
    quality gate, not a buyer deliverable.
- **Resolves the silent boundary** assumed by the surface forks — P2 golden (which fixtures cross),
  P3/X-10 the eval-gate-as-7th-job, P5-1 the `templates/` catalog. The buyer gets a **working,
  testable repo**; Caisson's release/publishing machinery and authoring posture stay home.

## Rejected

- **Code-only generation** (buyer adds their own CI / tests) — strictly worse out-of-box: the buyer
  inherits a kit with no harness, must reconstruct build/lint/test by hand, and the golden baselines
  that protect the included modules never travel — so the regression net the product relies on is
  gone the moment code leaves the monorepo.
- **Full mirror, incl. the eval gate + standards-gate authoring** — heaviest, and it **leaks
  Caisson-internal tooling and posture** (the publish credential, the registry index, the authoring
  scanner, the eval baseline) into every buyer repo: added attack surface and IP exposure for zero
  buyer value, since none of that machinery runs against a single edition the buyer owns.

## Binding

The generator emits **exactly**: a trimmed CI (`build` · `lint` · `unit` + `golden-file` for the
included modules), those modules' golden fixtures, and an `AGENTS.md` — all under the commercial
EULA, buyer-owned. It **never** emits the registry/publish flow, the standards-gate authoring
scanner, or the eval CI gate; those three are monorepo-internal and any future generator template or
edition that tries to ship them into a buyer repo is a boundary violation. Evidence: ADR-0048
(generator engine + `templates/` seam the emit rides), ADR-0016 (the 6 monorepo CI jobs the buyer CI
is trimmed from), ADR-0013 (golden harness + fixtures), ADR-0020 (manifest + `AGENTS.md` authoring,
the standards gate), ADR-0021 (registry publish pipeline — internal), ADR-0062 (eval CI gate —
internal), ADR-0023 + ADR-0050 (commercial EULA on every emitted module, no AGPL flank); research
artifact `outputs/research/wave1-forks.md` forks X-6 (the unowned boundary), X-10 (eval as a 7th
required job), and P5-1 (what a bought repo actually contains).
