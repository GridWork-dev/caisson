# ADR-0150 — Stream B build: parallel independent build of four greenfield packages

Status: accepted · 2026-07-01 (Stage-2 Stream B, operator fork-lock) · executes the `document-only`
ADR-0134/0135 and the ADR-0133 §1 harvest intent · branch `stream/harvest-modules`, local build only
(no live deploy). Append-only; supersede with a later ADR, never edit.

## Context

The Stream B kickoff (`docs/state/stage2-kickoff-triage.md`) framed a **ship-order** fork (rec:
harness → alerting → retention). The operator rejected a serial order and asked the sharper question:
do the packages depend on each other? They do not. All four are **new package directories** with
**down-only** dependencies onto already-shipped base packages, and touch **no existing tree**:

| Pkg                         | Task | Deps (down-only)          | ADR implemented       |
| --------------------------- | ---- | ------------------------- | --------------------- |
| `@caisson/audit-harness`    | B1   | none (pure; node stdlib)  | ADR-0134              |
| `@caisson/alerting`         | B2   | `@caisson/{kernel,email}` | ADR-0135 (+ ADR-0151) |
| `@caisson/retention-runner` | B3   | `@caisson/{kernel,jobs}`  | ADR-0135 (+ ADR-0152) |
| `@caisson/tool-exec`        | B4   | `@caisson/kernel`         | ADR-0153              |

No package imports another; none is a build input to another. The only shared mutable state is
`bun.lock` (dependency resolution) and the registry `index.json` — both explicitly the integration
session's job per the kickoff, not this stream's.

## Decision

1. **Build all four in parallel**, not in a ship order. The ship-order fork is resolved to
   _parallel_ — there is no dependency edge to sequence on.
2. **No agent adds an external dependency.** The main thread pre-declares each package's deps (all
   `workspace:*` + the already-present `zod`) and runs a **single** `bun install` before the fan-out,
   so the parallel builders never mutate `bun.lock`. Any capability that would otherwise need a new
   SDK (S3 erasure target, pg audit sink, Slack/Telegram transport) ships as an **injected
   port + in-memory/capture driver** — the driver seam pattern already used by `jobs` (Trigger.dev)
   and `email` (Resend). Real remote drivers are documented seams, not in-stream deps.
3. **Model routing (operator direction):** each package is a bounded (<300 LOC), fully-specified unit
   built by a **Sonnet** agent; an **Opus** pass adversarially verifies (security floor + goal-backward
   vs the Stream B SPEC + the ADR-0135 genericness-not-WORM check) before commit. Doctrine lanes:
   bounded execution → Sonnet, verify/synthesis → Opus.
4. **Atomic conventional commits**, one package per commit. `bun run check` + `bun run gate` green.

## Why

- **Independence is real, not asserted** — the dependency table above has no intra-stream edge, so a
  serial order would only add wall-clock for no correctness gain.
- **Pre-install-once removes the only parallel-write hazard** (`bun.lock`), letting four writers touch
  strictly disjoint directories — no worktree isolation needed because there is no shared file to race.
- **Sonnet-builds / Opus-verifies** matches the model-routing lanes: the surfaces are pinned by
  ADR-0134/0135, so the build is bounded execution; the risk is in correctness/security, where Opus
  verification earns its cost.

## Rejected

- **Serial ship order (kickoff rec)** — rejected; no dependency edge to sequence on.
- **Worktree isolation per builder** — rejected; unnecessary once the single pre-install removes the
  `bun.lock` race and the four write to disjoint dirs.
- **Let builders add deps as needed** — rejected; a parallel `bun install` race corrupts the lockfile.
  Deps are pre-declared; new capability uses the port/seam pattern.

## Relations

Executes ADR-0134 (audit-harness), ADR-0135 (alerting + retention-runner) and the ADR-0133 §1 harvest
intent. Sibling build-locks: ADR-0151 (alerting transport), ADR-0152 (retention scheduling), ADR-0153
(tool-exec). Integration hand-off (lockfile re-resolve + registry `index.json` rebuild + board merge)
per the kickoff's cross-stream section — never in-stream.

## Binding

Stream B builds `audit-harness`, `alerting`, `retention-runner`, and `tool-exec` in parallel off
`stream/harvest-modules`, deps pre-declared + installed once, Sonnet-built / Opus-verified, one atomic
commit per package. Changing the package set or re-introducing a serial dependency requires a
superseding ADR.

Evidence: `docs/state/stage2-stream-b-spec.md`; `docs/state/stage2-kickoff-triage.md` §Stream B; the
2026-07-01 operator fork-lock (`AskUserQuestion`).
