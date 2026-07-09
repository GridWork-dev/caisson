# EVAL — Wave 1 · P4a: Local-first AI edition (ai-tag quality evaluation)

Act 6. Conditional quality evaluation for the SPEC-declared `ai` tag, over the retrieval/inference
surface. Closes the documented EVAL-debt (P4a merged green in PR#11 carrying only SPEC.md + PLAN.md;
VERIFY.md recorded the gap and SWEEP.md queued it as follow-up 1). Retroactive: written by reading
the merged code + tests, not a live `eval-runner` dispatch.

## Why no eval-runner dataset run

`gw-eval` dispatches `system/apps/eval-runner` against a registered dataset in `@caisson/ai-evals`.
**No local-ai dataset exists there** — the eval-runner's evaluation surface is prompt/agent-output
quality against a labeled corpus, and P4a's `ai`-tagged surface is not a prompt pipeline: the edition
ships a deterministic retrieval engine (hybrid RRF) and a deterministic CRDT sync engine, with the one
genuinely model-dependent leg (`OnnxEmbeddingBackend`) explicitly stubbed in CI by ADR-0064. There is
no model output to grade against a rubric — the quality question for this phase is **"does the
retrieval/sync surface behave correctly and deterministically"**, which the golden-pinned fixtures
below already answer with a stronger guarantee (byte-exact determinism) than an eval-runner score
would. This EVAL note substitutes the cited tests as the evaluation evidence, per the act brief.

## Evaluated surface

| Surface                         | What "quality" means here                                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hybrid retrieval (RRF fusion)   | The fused ranking is correct AND deterministic for a fixed corpus/query — not just "a result comes back"            | `local-store/src/store.ts:132-153` (RRF_K=60 fusion); `golden.ts:1-40` (the fixed 4-doc fixture designed so fusion is observable, not a single-leg echo — `fox`/`fox-quick`/`lazy-fox`/`canine` ranks pinned in prose); `golden.test.ts` (`matchGolden` against `__golden__/rrf-ranking.json`, `BLESS` unset)                                                                 |
| FTS-only degrade                | A vector-leg fault degrades gracefully to the always-available FTS5 floor, never an empty or wrong result           | `store.ts:167-179` (`vecLeg` returns empty on no query vector; explicit dim-mismatch THROWS rather than silently truncating/padding); `store.test.ts:24-67` (degrade-to-FTS-only + vec-only paths both asserted)                                                                                                                                                              |
| Sync convergence determinism    | Two replicas that diverge under concurrent edits converge to the IDENTICAL state regardless of merge order          | `sync/reconcile.ts:48-104` (pure, input-order-independent LWW reduction — `reconcileReplicas([A,B]) === reconcileReplicas([B,A])` per the file header); `sync/convergence.integration.test.ts:150-187` (two real `bun:sqlite` replicas, byte-equal snapshot after a round-trip); `:189-206` (two independent reconcile runs over the same inputs produce an identical result) |
| Conflict-resolution correctness | LWW + tombstone goldens pin the EXACT expected converged state for a hand-constructed conflict, not just "no crash" | `sync/reconcile.test.ts`, `sync/tombstone.test.ts` (golden fixtures `__golden__/lww-resolve.json` + `__golden__/tombstone-resolve.json` via `matchGolden`, `BLESS` unset)                                                                                                                                                                                                     |
| Offline license verify (KAT)    | The shipped production public key correctly verifies a real production-signed token, byte-exact                     | `license-verify/src/verify.test.ts:70-208` (KAT against `__golden__/prod-signed-token.json`, the SHIPPED contract — not a dev key stand-in)                                                                                                                                                                                                                                   |

## Determinism posture (why golden-pinning IS the eval here)

Every surface above is evaluated by **golden-pinned regression**, not a scored rubric, because every
input is fully controlled (a fixed corpus, a fixed query, a fixed conflict shape, a fixed signed
token) and the expected output is a single correct answer, not a graded-quality spectrum:

- The RRF fixture (`golden.ts:11-40`) is deliberately constructed so the fusion result is
  **observable** — a doc that tops only one leg (`fox-quick`, last in vec / top in FTS) must be
  rescued into the top results by the fusion math, and a doc that is strong in one leg but absent
  from the other (`canine`, #2 vec / no FTS hit) must drop below a hybrid winner. A wrong RRF
  implementation changes the pinned ranking, not just a score — `BLESS` unset means CI fails loudly on
  drift rather than silently degrading.
- The sync goldens pin the converged state of a **hand-constructed conflict** (concurrent per-field
  edits + a delete) — the "right answer" is computable by hand from the LWW rule, so the golden is a
  correctness oracle, not a regression snapshot of incidental behavior.
- The license KAT is pinned against the **production** key (`prod-signed-token.json`), not a dev
  stand-in — the eval question "does verify accept what the real issuer signs" is answered against
  the actual shipped contract.

## Acknowledged gap (consistent with VERIFY.md's Acknowledged SEAMS)

No eval evidence exists for the **real on-device ONNX embedding quality** (does
`Xenova/all-MiniLM-L6-v2` actually produce useful retrieval embeddings for real text) — `EVAL` here
covers the deterministic engine surfaces only. ADR-0064 mandates no live model in CI, so this gap is
by design, not an oversight; `SWEEP.md` follow-up 3 ("wire the ONNX seam") is the tracked path to
closing it with a manual, out-of-CI harness.

## Verdict: PASS

The `ai`-tagged retrieval and sync surfaces are evaluated to golden-pinned, deterministic correctness
— a stronger bar than a scored eval-runner pass for surfaces with a single right answer. No
eval-runner dataset exists for this surface (no prompt/agent-output grading applies), and the one
model-dependent leg (on-device embedding quality) is out of scope by the same ADR-0064 boundary
VERIFY.md and SWEEP.md already recorded. No regression; nothing blocks SHIP.
