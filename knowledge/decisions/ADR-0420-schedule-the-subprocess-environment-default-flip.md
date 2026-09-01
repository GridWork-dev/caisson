# ADR-0420 — The subprocess environment stays inherit-by-default today; the flip is scheduled as a major

- **Date:** 2026-09-01
- **Status:** Accepted (operator picker in the caisson session pane, 2026-09-01 — ask `CAI-ASK-2d`, label verbatim below)
- **Scope:** `@caisson/agent-kernel` (`commandHandler` / `CommandHookSpec`) and `@caisson/tool-exec` (`CommandSpec` / the exec seam)
- **Parent:** ADR-0349 / ADR-0350 (agent-runtime + sandbox locks)
- **Tracks:** CAISSON-217 (subprocess environment inheritance)

## Context

Both packages spawn child processes through `execFile` with an argv array — no shell, no
interpolation, so there is no injection surface. Neither passed an `env`, which means Node's default
applies: **the child inherits the parent's entire environment.** For a library a buyer embeds in
their own service, that is every credential the host process holds, handed to whatever a hook or an
allowlisted tool runs.

The fix that ships alongside this decision is the seam, not the flip: `CommandHookSpec` and
`CommandSpec` grow an optional `env`, threaded to the spawn and used **verbatim** (never merged with
the ambient environment, so a caller that needs `PATH` passes `PATH`). Absent, behavior is exactly
what it was.

Making narrow the default is the safer end state and it is a breaking change. Every existing caller
that relies on inheritance — a hook that shells a tool needing `HOME`, a command that reads a
provider credential from the ambient environment — stops working at a version bump they did not read
as behavioral. These are published packages; the blast radius is other people's deployments.

## Decision

### Ruling 2d — "Schedule the flip as an ADR + major changesets next release cycle"

1. **Today:** the opt-in seam ships; the default stays inherit. The seam is a minor for both
   packages.
2. **Next release cycle:** the default flips to narrow, as a **major** version of
   `@caisson/agent-kernel` and `@caisson/tool-exec`, landed with major changesets and a migration
   note naming the exact symbol each caller passes to keep the old behavior.
3. Until then the inherit default is **pinned by a test**, not left implicit: `hooks.test.ts`
   asserts that a child spawned with no `env` DOES see a parent canary. The flip therefore cannot
   arrive by accident — it reds that test first, and the red is the reminder to write the major.

CAISSON-217 stays open against step 2 with a due date rather than being closed on the seam.

Two options were declined:

- **Keep inherit as the permanent default** and document it. Declined: it leaves the unsafe default
  in a library whose whole selling point is that the production-rigor decisions were already made.
- **Flip now.** Declined: it breaks embedders at a version bump they cannot read as breaking, and
  the seam already lets anyone who wants the narrow behavior have it today.

## Consequences

- Two published packages carry a known-unsafe default for one more release cycle, deliberately and
  in writing. The mitigation is the seam plus this dated schedule, not a claim that the default is
  fine.
- The pinning test is doing something unusual — asserting a behavior we intend to remove. Its
  comment says so, so a future reader deletes it as part of the flip rather than "fixing" it.
- The major bump is a release-train act with a migration note; it is not a sweep item to fold into
  an unrelated PR.
