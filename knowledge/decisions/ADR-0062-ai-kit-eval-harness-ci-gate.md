# ADR-0062 — AI-Kit eval harness + regression-vs-baseline CI gate

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Defines how AI-Kit prompt/agent
quality is measured and gated in CI.)

The AI Production Kit ships prompts and agents whose quality drifts as models and prompt versions
change. A naive absolute pass/fail threshold either rots against model drift or never distinguishes
a regression from a perpetually-borderline case — yet quality still needs a merge gate that behaves
like the golden-file drift check already trusted by the standards gate.

## Decision

An **eval harness** with a **grader taxonomy** plus a **regression-vs-committed-baseline CI gate**,
wired as a distinct turbo task in the Caisson monorepo only.

- **Grader taxonomy** — two grader classes: **deterministic** (exact/regex/JSON-shape/schema, structural
  assertions, cheap and reproducible) and **model-graded** (an LLM judge for open-ended quality where
  no deterministic oracle exists). Each eval case declares its grader class.
- **Datasets bound to prompt versions (ADR-0061)** — eval datasets are stored alongside, and versioned
  against, the prompt version they exercise; a prompt-version bump carries its dataset, so a score is
  always attributable to a known prompt revision.
- **Gate = regression vs a committed baseline** — this PR's score is compared against a committed JSON
  baseline (BLESS-style: a `bless` path re-baselines intentionally, exactly like accepting golden-file
  drift). Merge is blocked when the PR scores **worse than baseline**; a borderline-but-stable score
  passes. Thresholds/baselines live in committed JSON/TOML next to the golden fixtures.
- **Distinct turbo `eval` task** — a separate task in the pipeline gating merge, reusing the golden-drift
  mental model and the existing standards-gate wiring rather than folding into the test task.
- **Scope = monorepo only** — the eval gate is a Caisson-monorepo concern. Whether a buyer's generated
  repo carries an eval harness is governed by the buyer-repo boundary (ADR-0072), **not** added as a
  7th required CI job in every generated repo.

## Rejected

- **Hard absolute pass/fail threshold** — brittle to model drift (a vendor model update silently moves
  every score), and it cannot tell _got-worse-this-PR_ from _always-borderline_. The committed baseline
  encodes "as good as last accepted" instead of a magic constant.
- **Mandatory 7th CI job in ADR-0016's locked 6, in every generated repo** — governance and boundary
  creep: it would force an eval harness on buyers who did not opt into AI-Kit and conflate the monorepo's
  quality gate with the generated-repo contract (ADR-0072 owns that line).

## Binding

AI-Kit quality is gated by a distinct turbo `eval` task that compares this PR's eval score against a
committed JSON baseline and fails on regression-vs-baseline (never an absolute threshold); re-baselining
is an explicit `bless` commit, mirroring golden-file drift acceptance. Eval datasets are version-bound to
their prompt version (ADR-0061). The gate runs in the Caisson monorepo only — it is never shipped as a
required job inside a buyer's generated repo, whose harness presence is the buyer-repo boundary's call.
Evidence: ADR-0013 (testing/golden-file regression — extended), ADR-0016 (the locked 6 CI jobs +
standards-gate wiring — extended), ADR-0061 (prompt versioning), ADR-0072 (buyer-repo boundary);
fully-commercial posture per ADR-0023 (with ADR-0050 making the local-ai edition commercial too);
the standards-gate / golden-fixture seam in `tooling/`; `outputs/research/wave1-forks.md`.
