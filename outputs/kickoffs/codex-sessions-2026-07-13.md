# Codex session prompts — 2026-07-13

Two operator-armed Codex sessions (GPT-5.6-soul, ultra reasoning; Codex runs the full
gridwork parity surface — same permissions, gates, and doctrine as Claude Code). Filed from
the 2026-07-13 dep-wave close-out; main is clean at arming time.

---

## Session 1 — caisson: AI SDK migration SPEC + PLAN, plus the debt tail

**Repo:** `~/lab/caisson` (start from clean `main`).

### Full prompt

> **Primary goal — SPEC + PLAN only (do not execute the migration).** Produce the spec and
> plan for **CAISSON-106**: the ai-sdk v5→v7 lockstep migration plus its 7 provider-package
> majors. The full deferral runbook is in the Linear issue description — read it first.
> Spec-first cadence applies: SPEC → `outputs/specs/ai-sdk-v7-migration/`, PLAN →
> `outputs/plans/ai-sdk-v7-migration/`, tags declared in frontmatter (`ai`, `billing` — the
> gateway meters money), then STOP for operator lock. No migration product code before the
> lock. Seam facts to build on: `@caisson/ai-kit` is the single metered-inference gateway
> (ADR-0059 chokepoint — provider SDK calls are confined there by the standards gate);
> metering is estimate→reserve→reconcile against the append-only credit ledger (ADR-0060),
> so token-usage field shapes across the major bump are a money seam — the plan must include
> an eval/regression leg (`bun run eval`, ADR-0062 baseline gate) and golden coverage for
> usage accounting. Move CAISSON-106 to In Progress while working it.
>
> **Secondary goal — execute the two mechanical debt items directly** (no spec needed), one
> branch, one PR per the wave convention:
>
> 1. **eslint 10 debt:** fix the 13 pre-existing findings suppressed under
>    `no-useless-assignment` and `preserve-caught-error` in `tooling/eslint-config/index.js`
>    (ponytail-tagged suppressions), then re-enable both rules and delete the suppressions.
> 2. **@types/node 26 unblock:** fix `packages/mcp-server/src/http.ts` (~line 305) where
>    `IncomingMessage.signal` trips `exactOptionalPropertyTypes` once @types/node 26
>    coalesces via bun-types, then bump the workspace catalog `@types/node` to `^26` and
>    prove the whole workspace green (the catalog makes it repo-wide in one flip).
>
> **Rails:** gates green before the PR — `bun run check` + `bun run sot`; naming changesets
> for any changed `packages/*`; conventional commits (no heredocs, `+`, `@`, em-dashes, or
> second parens in subjects; pre-commit prettier runs --write); never `.strict()` a provider
> webhook envelope; subagent dispatches always carry an explicit `model` (never Fable for
> fan-out); ADR ceiling is 0329 — verify against main before filing any ADR; zod stays v4;
> `packages/cli/templates/**` is renovate-ignored and golden-pinned — do not touch without a
> `BLESS=1` re-record in the same commit. SPEC/PLAN docs ride the same PR. Review gate is
> the in-session SHIP audit lane (gw-code-reviewer + gw-security-auditor on the diff).

### One-paragraph prompt (the goal)

> In `~/lab/caisson` off clean main: author the SPEC and PLAN for CAISSON-106 — the ai-sdk
> v5→v7 lockstep migration with its 7 provider majors through the `@caisson/ai-kit` metered
> gateway (ADR-0059/0060; token-usage accounting is a money seam, so the plan carries an
> eval + golden regression leg) — spec-first, stopping at operator lock with no migration
> code; and in the same session execute the two mechanical debt items on one branch/one PR:
> fix the 13 findings behind the `no-useless-assignment` + `preserve-caught-error`
> suppressions in `tooling/eslint-config/index.js` and re-enable both rules, and unblock
> @types/node 26 by fixing the `exactOptionalPropertyTypes` trip in
> `packages/mcp-server/src/http.ts` then flipping the workspace catalog to `^26` — all gates
> (`bun run check`, `bun run sot`, changesets) green before the PR opens.

---

## Session 2 — gridwork-core: retire the caisson-amd64 runscaler (small, current session)

**Repo:** `~/lab/gridwork-core` (runs on the box, gw-ms-a2).

### Prompt

> Small ops task, complete it end-to-end this session: **retire the `caisson-amd64`
> self-hosted runner scale set on gw-ms-a2**. Context: caisson CI cut over to Blacksmith
> VM-per-job runners (caisson ADR-0326, 2026-07-11) and has since run multiple all-green
> merge waves (07-12 and 07-13, 30+ runs), which satisfies the "retired at verified
> cutover" condition; the operator has accepted Blacksmith overage billing (caisson PF2-1,
> 2026-07-13). Steps: (1) locate the runscaler's unit(s) and registration via
> `identity/daemons.md` and `system/state/`; (2) confirm zero caisson workflows still
> target the amd64 self-hosted labels (`grep` the caisson repo's `.github/workflows/` —
> the macOS leg `[self-hosted, gw-macos-arm64]` on the mac-mini STAYS, do not touch it);
> (3) stop + disable the runscaler service(s), deregister the amd64 runner(s) from the
> GridWork-dev org/repo (`gh api`), remove its config/work directories; (4) update
> `identity/daemons.md` and the `system/state/` records in the same commit — a dead
> registry row is a bug; (5) conventional commit to gridwork-core; (6) move Linear
> **CAISSON-97** to Done with a one-line closing comment naming the deregistration and the
> commit. Scope guard: only the caisson-amd64 runscaler — no other daemon, runner, or
> firewall change.
