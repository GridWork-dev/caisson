// Pure, deterministic mirror of @caisson/agent-kernel's lifecycle act FSM (packages/agent-kernel/
// src/lifecycle.ts, ADR-0065). The real module's only import is `ValidationError` from
// "@caisson/kernel" (the "." entry point) - but that barrel (packages/kernel/src/index.ts)
// re-exports crypto.ts and migration-assembly.ts, both of which `import "node:crypto"`, in the SAME
// module graph as ValidationError, and neither package publishes a narrower subpath (agent-kernel's
// package.json `exports` map has only "."). None of that resolves in a browser bundle, so every
// constant and function below is mirrored by hand and pinned in agent-kernel-logic.test.ts, which
// imports the real "@caisson/agent-kernel" and "@caisson/kernel" packages directly (tests run under
// bun, not a browser) and asserts parity - including against the shipped
// packages/agent-kernel/src/__golden__/lifecycle-trace.json fixture.
//
// No Date.now(), no Math.random(): every transition is a synchronous, deterministic replay of a
// click sequence over a fixed act graph.

/** Mirrors ACTS, packages/agent-kernel/src/lifecycle.ts - the 7 acts, in canonical order. */
export const ACTS = [
  "spec",
  "plan",
  "execute",
  "verify",
  "sweep",
  "eval",
  "ship",
] as const;
export type Act = (typeof ACTS)[number];

/** Mirrors the private TRANSITIONS table, packages/agent-kernel/src/lifecycle.ts. The two branch
 *  edges: `verify -> plan` (a failed goal-backward verify reopens PLAN, never SHIP) and
 *  `sweep -> ship` (an untagged phase skips EVAL). `ship` is terminal. */
const TRANSITIONS: Record<Act, readonly Act[]> = {
  spec: ["plan"],
  plan: ["execute"],
  execute: ["verify"],
  verify: ["sweep", "plan"],
  sweep: ["eval", "ship"],
  eval: ["ship"],
  ship: [],
};

/** Mirrors CANONICAL_LIFECYCLE, packages/agent-kernel/src/lifecycle.ts. */
export const CANONICAL_LIFECYCLE: readonly Act[] = [...ACTS];

/** Mirrors LifecycleStep, packages/agent-kernel/src/lifecycle.ts. */
export interface LifecycleStep {
  seq: number;
  from: Act;
  to: Act;
}

/** Mirrors canTransition(), packages/agent-kernel/src/lifecycle.ts. */
export function canTransition(from: Act, to: Act): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Mirrors isTerminal(), packages/agent-kernel/src/lifecycle.ts. */
export function isTerminal(act: Act): boolean {
  return TRANSITIONS[act].length === 0;
}

/** Mirrors ValidationError's code/httpStatus/name shape, packages/kernel/src/errors.ts. The real
 *  class extends the abstract CaissonError (sets `name` to the concrete subclass name via
 *  `new.target.name`, stores an allowlisted `details` bag); this mirror reproduces exactly that
 *  shape for the one subclass agent-kernel's lifecycle FSM throws. */
export class ValidationErrorMirror extends Error {
  readonly code = "validation_error";
  readonly httpStatus = 400;
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ValidationError";
    if (details !== undefined) this.details = details;
  }
}

/** Mirrors transition(), packages/agent-kernel/src/lifecycle.ts: returns `to` on a legal edge,
 *  THROWS a ValidationErrorMirror on an illegal one - flag-never-guess, never a silent skip. */
export function transition(from: Act, to: Act): Act {
  if (!canTransition(from, to)) {
    throw new ValidationErrorMirror(
      `Illegal lifecycle transition: ${from} → ${to}`,
      { from, to, legal: TRANSITIONS[from] },
    );
  }
  return to;
}

/** Mirrors runLifecycle(), packages/agent-kernel/src/lifecycle.ts: validates every consecutive pair
 *  in a fixed sequence, throwing on the first illegal one. */
export function runLifecycle(sequence: readonly Act[]): LifecycleStep[] {
  const steps: LifecycleStep[] = [];
  for (let i = 1; i < sequence.length; i++) {
    const from = sequence[i - 1]!;
    const to = sequence[i]!;
    transition(from, to);
    steps.push({ seq: i - 1, from, to });
  }
  return steps;
}

// ---- Local click-session replay (poke-only state; not part of the real package's public API) ----

/** One click session: the current act plus every legal transition taken so far. */
export interface LifecycleSession {
  current: Act;
  trace: LifecycleStep[];
}

/** A labeled sample starting point - always `spec`, the real FSM's only entry act. */
export function initLifecycleSession(): LifecycleSession {
  return { current: ACTS[0], trace: [] };
}

/** Attempts one click: `transition()` first (check-before-mutate, same order as the real FSM), so an
 *  illegal target throws before the session changes at all - the break-it control never leaves a
 *  half-applied step behind. */
export function attemptTransition(
  session: LifecycleSession,
  to: Act,
): { session: LifecycleSession; step: LifecycleStep } {
  const from = session.current;
  transition(from, to);
  const step: LifecycleStep = { seq: session.trace.length, from, to };
  return { session: { current: to, trace: [...session.trace, step] }, step };
}
