# PLAN — S4: trajectory evals (CAISSON-111 slice 5 of 6)

- **Executes:** ADR-0360 U-7 · SPEC `SPEC-caisson-111-loop-slices.md` §6.
- **Depends:** S3 merged (approval events exist to score). Serial.
- **Branch:** `admin/caisson-111-s4-trajectory-evals` (one PR).
- **Tags:** `ai` — EVAL fires; deterministic graders first, green-only baseline discipline
  with the `assertRunEligibleForBaseline` pre-BLESS guard.

## Tasks

1. **`projectToolCalls(events)`** in agent-trajectory — a SIBLING projection folding
   `tool.proposed/approved/denied/result` into a scored-consumable tool-call list
   (name, args digest, approval actor/outcome, result ok, seqs). `project()` and
   `RunProjection` stay byte-stable (the S2a band change was the one recorded delta;
   nothing further).
2. **ai-evals extension** (accepts the ai-evals → agent-trajectory dep,
   primitive→primitive): a trajectory fixture kind via the existing `input.kind`
   discriminator idiom + graders:
   - tool-choice vs allowlist (deterministic);
   - unnecessary-call detection (deterministic heuristic, documented ceiling);
   - approval compliance from the folded approve/deny events (deterministic);
   - budget adherence — near-free off `usageTotals` (all four bands incl. `priced`) +
     `classifyExit`.
3. **Dataset** — trajectory fixtures generated from real `runToolLoop` runs against the
   mock model (deterministic, zero network), including THE parent-SPEC acceptance row:
   one deliberate budget-violation case failing RED (isolate via a valid confidence
   trailer per the Kickoff-R defense-eval lesson — fail-closed paths must not mask
   each other).
4. Judged criteria constants only where a deterministic grader can't reach (intel
   `ACTIONABILITY_CRITERIA` pattern), cassette-replayed in CI.
5. Changesets: agent-trajectory minor (projectToolCalls), ai-evals minor.
6. Verify: dependents chain + standards-gate (no tracker ids in shipped source) +
   publish-config guard + sot; EVAL green with the RED case proving the harness bites.

## Routing

Builder: `gw-typescript-pro` (sonnet) worktree off post-S3 main; SHIP: opus review
(grader-quality focus: do graders pin contracts or mirror implementations); `ai` tag
EVAL gate. No security tag (read-only over trajectory data; approval ENFORCEMENT was
S3's audit).
