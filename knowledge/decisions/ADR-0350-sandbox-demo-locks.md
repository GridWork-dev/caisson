# ADR-0350 — Pre-purchase sandbox: server-side demo-run job, all six forks locked

- **Date:** 2026-07-16
- **Status:** Accepted (operator-locked at the 2026-07-16 sandbox picker, two rounds)
- **Spec:** `outputs/specs/sandbox-demo/SPEC.md` (draft-for-lock since ADR-0323 Decision 4c)
- **Grounds:** Cookiy 12-real-interview round 2026-07-10 (study `019f4a11`) — buyers distrust
  demo videos and ask, unprompted, for a testable environment before buying.

## Decisions (the SPEC's F1–F6, all locked)

| #   | Fork                                          | Lock                                                                                                                                                                                              |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Mechanism                                     | **(c) server-side demo-run job** — `create-caisson --demo` runs server-side per request, streamed output + preview; per-run-bounded compute (matches the SPEC's own recommendation).              |
| F2  | Ship (d) excerpts independently?              | **No — bundle with (c)**: the read-only full-file excerpt surface lands WITH the demo-run build as one combined demo surface (operator override of the SPEC's ship-independently recommendation). |
| F3  | Identity/rate-limit floor                     | **Lightweight email capture** (unverified) + IP rate limits — no card-auth/review-queue friction on a surface carrying no commercial source.                                                      |
| F4  | Trial framing                                 | **Fold as a ladder** inside the ADR-0272 trial-path framing: sandbox → eval license → purchase, sequential rungs, not competing CTAs.                                                             |
| F5  | Cost ceiling                                  | **Hard daily compute budget cap with auto-disable** — fails closed to "sandbox temporarily unavailable", never an open-ended bill.                                                                |
| F6  | Sequencing vs the eval-license leg (ADR-0289) | **Build first, independent** — follows from the timing lock below; the two share no code today.                                                                                                   |

**Timing:** build NOW, in a parallel worktree session per the ADR-0328 wave convention
(tree-disjoint from the agent-runtime program, ADR-0349).

## Build-order rider (binding on the PLAN)

Option (c) depends on the **unbuilt `create-caisson --demo` generator leg** (ADR-0274 point 1
— demo stubs/watermarks for commercial modules, no license-service change). That leg builds
FIRST inside this same program; the demo-run job consumes it. The heavier eval-license
delivery leg (ADR-0289) stays untouched and unblocking.

## Security seam (from the SPEC, binding)

No license-signing keys or production credentials near the demo-run path; demo-mode env only.
Per-IP/per-session rate limits + the F5 kill switch before the surface goes public. Tags at
SPEC/PLAN: `external-system`, `security`, `billing`, `frontend` (as the SPEC declares).

## Consequences

- The sandbox-demo SPEC's fork board is fully dispositioned; its frontmatter flips to locked.
- Exit criteria stay as the SPEC's own: unverified visitor → running/visible artifact in
  under 2 minutes; abuse/cost stress test green before public exposure.
