# ADR-0328 — The three-parallel-session close-out program: train timing, research budget, company-docs home, no-fable lane posture

- **Status:** locked (operator picker, 2026-07-12)
- **Context:** the Session A close-out merged clean (PRs 211–217, ADR-0327 riders executed) and
  the build queue emptied. The operator locked the next program at the 2026-07-12 picker round.

## Decisions

1. **Three sessions run IN PARALLEL, each in its own worktree, each producing exactly ONE PR,
   pushed to its branch and NOT merged.** A dedicated **fourth session** runs after all three
   complete: it merges the three branches serially, then runs the full reconciliation — doc
   sweep, gate/test pass, harness runs. Each session is main-thread Fable with ultracode,
   drives research → investigate → ask-forks (AskUserQuestion pickers mid-session, including
   design forks) → full execution with parallel workflows on scoped models → all gates →
   VERIFY → SWEEP → SHIP (PR opened, branch pushed), and ends with a full status report for
   session 4.
   - **Session P (build wave):** Tier-3/DX backlog (CAISSON-88/84/83, + a CAISSON-82
     verify — Linear-Done but the fix is absent in code; CAISSON-57 was verified
     already-shipped at arm-up and closed) + the registry P0 root causes (CAISSON-85/86) +
     release-readiness prep + docs/hygiene.
   - **Session Q (operator close-out):** every operator-owed item — infra stack, web accounts,
     GitHub apps/config, prod provider surfaces, env hygiene/parity, performance/cost
     optimization + status, legal/finance docs intake, probe accounts, the $130 research
     launch (decision 4). (The intel cassette recording moved to session 4 at the arm-up
     review — no recorder exists pre-wave; R builds it, the operator records post-merge at
     the pinned path `services/intel/__cassettes__/<watcher>.json`, and session 4 asserts
     the intel eval executes non-skipped.)
   - **Session R (eval/test hardening):** the Python-surface eval port (CAISSON-100) + the
     judged intel RECORDER and replay harness (CAISSON-101) + automated-testing/gate
     hardening.
2. **First ADR-0325 release-train ride: pre-launch, decoupled from the OSS W3 go-live**
   (amends the ADR-0318/0321 timing that had the first ride waiting on the W4 launch window).
   The ride fires from merged main after session 4 — `RELEASE_TRAIN_ARMED` set, version PR cut
   (consuming all pending changesets, ~147+), tag, publish to the self-hosted registry —
   which is the locked fix path for CAISSON-85/86 (advertised versions get real tarballs,
   manifests re-pin to existing versions). Explicitly NOT in scope: the `caisson-oss` public
   flip, npm-mirror publish, Show HN, or any go-live posture change — the site and program
   stay pre-launch. The version-PR merge, tag, and publish dispatch remain operator acts.
3. **Company documents home: `docs/business/legal/` + `docs/business/finance/`** — extending
   the existing `docs/business/` surface (already outside the caisson-oss mirror whitelist).
   The operator uploads source documents (scp from the MacBook) during session Q; finance
   documents live in the private repo by explicit operator choice.
4. **Research budget: $130 on Cookiy, balanced pre-launch positioning research** — not a
   pricing-only study. General positioning/messaging validation with one $2,059-Everything
   reaction probe folded in; vehicle (survey vs. interviews vs. synthetic) chosen at plan time
   inside the budget. Launched from session Q (async recruit/fill), synthesized in session 4
   or after. The ADR-0319 screened-panel re-run trigger (anchor-move pending) is unchanged —
   this is the balanced general-research leg, not the anchor re-litigation.
5. **Subagent lane posture for this program: opus/sonnet/haiku only — no Fable subagents,
   including reviewers/auditors.** The session main threads are Fable; every dispatched
   subagent and workflow agent routes to opus/sonnet/haiku by scope. (Program-scoped override
   of the CLAUDE.md "fable for money/license seams" note; the main thread itself still covers
   those seams.)

6. **Standing convention (same sitting, follow-up picker):** the parallel-session wave
   pattern is documented as this repo's DEFAULT execution mode for multi-cluster backlogs —
   `docs/ops/parallel-session-waves.md`. Parameters locked: waves are the default whenever
   2+ bounded tree-disjoint clusters exist (sessions propose the split as a picker; worktrees
   never spin silently) · one PR per session is a HARD rule · a dedicated reconcile session is
   required at 2+ parallel branches (single-session work keeps the serial merge-drive
   pattern) · the convention lives in caisson now and is promoted to gridwork-core
   `identity/doctrine.md` after one full wave proves it.

## Consequences

Three worktrees cut from the same main SHA; no session merges or rebases mid-flight — session 4
owns integration and the boards' reconcile. CAISSON-85/86 stay Backlog until the P branch merges
and the train rides. Linear: CAISSON-100/101 filed and routed per decision 1.
