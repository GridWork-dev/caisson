---
updated: 2026-09-24
status: live
grounds:
  - knowledge/decisions/ADR-0328-three-session-closeout-program-train-timing-research-budget.md
  - docs/state/decisions-and-forks.md
---

# Parallel-session waves — the execution convention (ADR-0328 D6)

How multi-cluster work executes in this repo. Locked at the 2026-07-12 picker; first wave =
the P/Q/R close-out program. Promote to gridwork-core `identity/doctrine.md` after one full
wave proves the pattern (operator carries it into a gw-core session).

## When a wave applies (default, not exception)

A **wave** is the DEFAULT execution mode whenever the backlog holds two or more bounded,
tree-disjoint work clusters. Serial single-session execution is the exception, used when
clusters interlock on the same trees or the work needs one unified context. A session facing
a multi-cluster backlog proposes the split (disjointness map + per-session scope) as a picker;
the operator's pick arms it — worktrees are never spun silently.

## Wave mechanics

- **One worktree + branch per session**, all cut from the SAME pinned main SHA
  (`git worktree add ~/lab/caisson-kickoff-<x> -b feature/kickoff-<x>-<slug> origin/main`).
  Record the base SHA in each kickoff.
- **A kickoff file in each worktree** (`KICKOFF-<X>-<slug>.md`, untracked) carries scope,
  boundaries, and the collision map. The session deletes it before its first commit.
- **One PR per session — hard rule.** Push the branch, open exactly one ready-for-review PR
  (draft PRs skip CI per PR 214), and NEVER merge or rebase mid-flight: no session touches
  `main`, and base drift is resolved once, at reconcile. Severable side-work goes back to the
  backlog, not into a second PR.
- **Boards frozen during the wave.** `docs/state/*` restructuring, ADR filing beyond the
  session's own scope locks, and cross-session status rows belong to the reconcile session.
  Each session's status lives in its PR body + final report.
- **Changesets:** unique, descriptive filenames (collision-free by construction).
- **Collision map:** each kickoff names the trees it owns; overlaps are assigned to exactly
  one session before the wave starts.

## Arming a wave (the preparing session's checklist)

The session that arms a wave runs these IN ORDER — a wave never cuts from a dirty state:

1. **Clean slate:** every open PR merged (or explicitly parked with a reason), remote
   branches pruned to `main` only, all worktrees removed and their local branches deleted,
   `bun run sot` green, latest main CI green.
2. **Lock the program:** picker round → ADR + board/tracker rows; file and route the Linear
   tickets; pin every cross-session contract (fixture paths, schemas, naming) in the tickets
   BEFORE branches exist — parallel sessions have no coordination channel mid-flight.
3. **Commit the program docs, THEN cut every branch from that same clean tip:**
   `git worktree add ~/lab/caisson-kickoff-<x> -b feature/kickoff-<x>-<slug> origin/main`
   for each session (the tip must contain this convention + the wave's ADR so sessions can
   read them).
4. **Write the kickoffs** (scope · program rules · owned-trees collision map · boundaries ·
   base SHA), then **adversarially review them** (opus/sonnet lenses: contradictions vs the
   boards, collision-map gaps, executability) and fix findings before hand-off — the first
   wave's review caught two P1s that would have shipped silently.
5. **Hand-off:** give the operator, per session, the worktree `cd` path + a one-line start
   prompt ("Read KICKOFF-<X>-<slug>.md and execute it").

## Session posture

Each session runs a Fable main thread with ultracode; every subagent and workflow agent
routes to **opus/sonnet/haiku only — no Fable dispatches**, including review/audit lanes
(the main thread itself covers the money/license seams). Sessions are research-driven:
proactive exa lookups, investigation before execution, and mid-session `AskUserQuestion`
pickers for every fork (design forks included) — never auto-decided. Execution uses parallel
workflows with per-stage scoped models, then the full act flow: gates → VERIFY → SWEEP →
SHIP audit → open the PR.

## The reconcile session (required at 2+ parallel branches)

After ALL wave sessions report, a dedicated reconcile session:

1. Merges the branches serially (squash), resolving cross-branch drift at each step.
2. Runs the full doc sweep + board reconcile (trackers, fork board, adr-index, counts).
3. Runs the gate/test/harness pass on merged main (all required checks + the live-harness
   legs that apply) and fixes what surfaces.
4. Executes any operator-gated post-merge acts queued by the wave (deploys, train rides),
   each individually operator-approved.

Single-session (non-wave) work keeps the existing serial merge-drive pattern.

## Status-report contract (per session, consumed by reconcile)

Shipped (with PR + commit refs) · deferred (with reasons) · fork answers taken mid-session ·
collision notes (any file touched outside the kickoff's owned trees) · gate evidence.

## Provenance

ADR-0328 D6 (2026-07-12). First wave: P (build) · Q (operator close-out) · R (eval/test
hardening), reconciled by session 4. Precedent run: Session A (2026-07-11) — parallel but
multi-PR; the one-PR rule exists because its 6-PR queue made the merge drive the bottleneck.
