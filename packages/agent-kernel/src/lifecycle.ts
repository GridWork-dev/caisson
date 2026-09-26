// The lifecycle act FSM (ADR-0065). The 7 acts and the legal-transition adjacency ONLY — an illegal
// transition throws (flag-never-guess), never a silent skip. Engine-neutral: this models the act
// ORDERING a governed run moves through; it does not run an act or call an engine.
import { ValidationError } from "@caisson-sh/kernel";

/** The 7 acts, in canonical order. */
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

/**
 * Legal forward adjacency. The two branch edges:
 *   - `verify → plan` — a failed goal-backward verify opens a fresh PLAN cycle (does not SHIP).
 *   - `sweep → ship` — an untagged phase skips EVAL straight to SHIP.
 * An EVAL regression is a fail-stop (no edge out of `eval` but `ship`); `ship` is terminal.
 */
const TRANSITIONS: Record<Act, readonly Act[]> = {
  spec: ["plan"],
  plan: ["execute"],
  execute: ["verify"],
  verify: ["sweep", "plan"],
  sweep: ["eval", "ship"],
  eval: ["ship"],
  ship: [],
};

/** The canonical full 7-act path — the golden-pinned happy path. */
export const CANONICAL_LIFECYCLE: readonly Act[] = [...ACTS];

/** One recorded transition in a lifecycle trace. */
export interface LifecycleStep {
  seq: number;
  from: Act;
  to: Act;
}

/** True iff `from → to` is a legal edge. */
export function canTransition(from: Act, to: Act): boolean {
  return TRANSITIONS[from].includes(to);
}

/** True iff `act` has no successor (only `ship`). */
export function isTerminal(act: Act): boolean {
  return TRANSITIONS[act].length === 0;
}

/**
 * Advance one act. Returns `to` on a legal edge; THROWS a `ValidationError` on an illegal one —
 * flag-never-guess. `details` carries only act names (safe), never a value or stack.
 */
export function transition(from: Act, to: Act): Act {
  if (!canTransition(from, to)) {
    throw new ValidationError(`Illegal lifecycle transition: ${from} → ${to}`, {
      from,
      to,
      legal: TRANSITIONS[from],
    });
  }
  return to;
}

/**
 * Run a fixed act sequence through the FSM, returning the validated transition trace. Each
 * consecutive pair must be a legal edge; an illegal pair throws. A 0- or 1-element sequence yields
 * an empty trace.
 */
export function runLifecycle(sequence: readonly Act[]): LifecycleStep[] {
  const steps: LifecycleStep[] = [];
  for (let i = 1; i < sequence.length; i++) {
    const from = sequence[i - 1]!;
    const to = sequence[i]!;
    transition(from, to); // validates the edge; throws on an illegal pair
    steps.push({ seq: i - 1, from, to });
  }
  return steps;
}
