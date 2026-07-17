# SPIKE — AI SDK v7 (`ai@7.0.22`) seam, for the CAISSON-111 loop slice

- **Executes:** PLAN T2 (`outputs/specs/agent-runtime/PLAN.md`), CAISSON-109.
- **Proof:** `packages/ai-kit/test/v7-seam-spike.test.ts` — 5 deterministic tests, all green
  (`bun test test/v7-seam-spike.test.ts` → `5 pass, 0 fail`), zero network (every model is a
  `MockLanguageModelV4` from `ai/test`). No production code touched.
- **SDK source read directly** (not just docs): `packages/ai-kit/node_modules/ai/dist/index.js`
  (v7.0.22, matches the repo pin) — the callback dispatch and step-loop control flow below are
  cited from the actual bundled implementation, not inferred from types alone.

## Findings

### (a) `onStepEnd` throw is swallowed — CONFIRMED

Test: `v7-seam-spike.test.ts:84-104`. A model that always resolves, with an `onStepEnd` that
increments a counter then throws, still returns `result.text === "ok"` and
`result.steps.length === 1`; the counter proves the callback DID run. `generateText` never
rejects.

Root cause in the SDK (`ai/dist/index.js:2632-2640`, the shared `notify()` helper that fans out
every step-end callback):

```js
async function notify(options) {
  await Promise.all(
    asArray3(options.callbacks).map(async (callback) => {
      try {
        await (callback == null ? void 0 : callback(options.event));
      } catch (e) {}
    }),
  );
}
```

Every callback registered on `onStepEnd`/`onStepFinish` runs inside a `try { } catch (e) {}` with
an **empty catch body** — the error is discarded, not logged, not re-thrown, not attached to the
result. This is unconditional: no option flips it off. **`onStepEnd` can never be authoritative
for anything that must fail the run** (metering settle, approval-gate enforcement, trajectory
append) — a throw there is functionally silent.

### (b) `prepareStep` throw ABORTS the call — CONFIRMED (asymmetric with (a))

Test: `v7-seam-spike.test.ts:106-121`. A `prepareStep` that throws makes `generateText` reject
with that exact error object (`rejects.toBe(boom)`).

Root cause (`ai/dist/index.js:5240` call site, inside the per-step `do { try { ... } finally { ...
} } while (...)` loop at `index.js:5228-5665`): `prepareStep` is invoked with a plain `await`,
**no surrounding `try/catch`** — only a `finally` that clears the step timeout. A thrown error
propagates straight out of the `do/while` and out of `generateText`.

**This is the opposite failure mode from (a) in the same loop**: a step-setup hook
(`prepareStep`) is fail-closed by accident of control flow, while a step-teardown hook
(`onStepEnd`) is fail-open by design. Any code relying on "a hook throwing stops the run" must
run in `prepareStep` (or the caller's own loop, see (d)) — never in `onStepEnd`.

### (c) `stopWhen` bounds a multi-step tool loop — CONFIRMED

Test: `v7-seam-spike.test.ts:123-167`, two cases:

- A model that **never** naturally stops (always emits a `tool-calls` finish) is halted at
  exactly 3 steps under `stopWhen: stepCountIs(3)` — `result.steps.length === 3`,
  `calls === 3`, `result.finishReason === "tool-calls"` (the bound fired, the model did not).
- `hasToolCall("ping")` stops the loop at 1 step — the SDK's own `isStopConditionMet` check
  (`index.js` step-loop `while` condition, `stopConditions` param) runs **after** a step
  executes, so the step that satisfies the condition still counts and completes; the bound
  cannot pre-empt mid-step.

`stopWhen` is a real, enforced ceiling independent of the model's behavior — this is the correct
primitive for a budget/step ceiling in the loop slice.

### (d) An explicit `generateText`-loop can interpose reserve/execute/settle — CONFIRMED

Test: `v7-seam-spike.test.ts:170-222`. Driving `generateText` one step at a time
(`stopWhen: stepCountIs(1)`, feeding `responseMessages` forward into the next call's `messages`)
inside a hand-rolled `do/while` lets the caller run its own `reserve()` before and `settle()`
after every single step, deterministically ordered
(`reserve:1, settle:1:5, reserve:2, settle:2:5, reserve:3, settle:3:20`) — 2 tool-call steps then
a natural stop, 3 total. This shape gives the caller full authority over the reserve/settle
boundary per step, sidestepping both (a) and (b): the caller's own `try/catch` around each
`generateText` call is authoritative, unlike `onStepEnd`.

## Verdict: **GO-WITH-CONSTRAINTS** for the CAISSON-111 loop slice

The v7 seam is usable for a governed loop, but only if the loop slice is built on the
**explicit per-step `generateText` harness (pattern d)**, never on the SDK's built-in
multi-step callbacks for anything money- or approval-critical. Binding constraints for
CAISSON-111:

1. **Never metering-gate, approve, or append a trajectory event from inside `onStepEnd` /
   `onStepFinish`.** A thrown guard there is silently discarded (finding a) — a budget-exceeded
   or approval-denied signal raised there would never stop the run. Use it only for
   best-effort observation (matches ADR-0351's `agent-runtime` PLAN T4: recorder failures there
   are explicitly "caught + surfaced as a warning, never fail the call" — that posture is
   correct for `onStepEnd`, and only for `onStepEnd`).
2. **Reserve-before-call and settle-after-call belong in the caller's own per-step loop**
   (pattern d), driving `generateText` with `stopWhen: stepCountIs(1)` per step and threading
   `responseMessages` forward — not in any v7 lifecycle callback. This is the only place a
   thrown "insufficient credits" or "approval required, park the run" error is guaranteed to
   propagate and halt execution before the next step's model/tool call.
3. **`prepareStep` is fail-closed and may be used for a pre-step gate** (e.g., re-checking a
   budget or an approval-parked state before spending on the next step) — but because it is
   fail-closed _by accident of missing error handling_, not by documented contract, do not
   depend on that remaining true across an SDK minor bump without re-running this spike's test
   (b) against the new pin.
4. **`stopWhen` is safe and required as the hard step ceiling** (finding c) — combine
   `stepCountIs(N)` with a caller-side budget check in the per-step loop (constraint 2) rather
   than relying on `stopWhen` alone for money bounds, since `stopWhen` only counts steps, not
   spend.
5. **Re-run all four spike tests against any `ai` version bump** before trusting this verdict —
   findings (a) and (b) are undocumented control-flow, not a public contract; the AI SDK
   changelog does not commit to preserving them across the `7.x` line, let alone a future major.

This gates CAISSON-111: the loop slice may proceed, built on pattern (d) with the reserve/settle
and approval logic living in caisson code, never inside `onStepEnd`/`onStepFinish`.
