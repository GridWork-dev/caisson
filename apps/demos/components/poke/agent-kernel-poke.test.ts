// The agent-kernel poke's checkable claims, now that it drives the REAL @caisson-sh/agent-kernel and
// the hand-ported mirror (agent-kernel-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. It imports the package's `./browser` entry, not the node-capable `.` barrel — pinned on the
//      specifier itself, because that one character of laziness is the whole regression.
//   3. The click session replays the real `transition()`: an illegal click throws the package's own
//      ValidationError, and the canonical replay reproduces the SHIPPED golden trace.
//   4. No transition rule is restated poke-side — the stepper enumerates the real ACTS and asks the
//      real canTransition/isTerminal.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import {
  ACTS,
  CANONICAL_LIFECYCLE,
  canTransition,
  isTerminal,
  runLifecycle,
  transition,
  type Act,
} from "@caisson-sh/agent-kernel";

import { attemptTransition, initLifecycleSession } from "./agent-kernel-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "agent-kernel-poke.tsx");

const GOLDEN_TRACE = JSON.parse(
  readFileSync(
    join(
      WORKSPACE_ROOT,
      "packages/agent-kernel/src/__golden__/lifecycle-trace.json",
    ),
    "utf8",
  ),
) as readonly { seq: number; from: Act; to: Act }[];

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: files.length alone proves nothing. These files are reachable ONLY through
    // @caisson-sh/agent-kernel/browser's own imports — the browser entry (first hop), a module behind
    // it (second hop), and one behind the kernel seam (a second cross-package hop), so a resolver
    // that went blind inside a workspace package fails here.
    expect(walk.files).toContain("packages/agent-kernel/src/browser.ts");
    expect(walk.files).toContain("packages/agent-kernel/src/lifecycle.ts");
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the node-only half of agent-kernel never enters the client graph", () => {
    expect(walk.files).not.toContain("packages/agent-kernel/src/hooks.ts");
    expect(walk.files).not.toContain(
      "packages/agent-kernel/src/audit-lifecycle.ts",
    );
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A third entry here means a new non-workspace dependency joined the client graph — a review
    // event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on the `.` barrel", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/agent-kernel/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });

  test("the poke imports ./browser, never the node-capable barrel", () => {
    // The specifier itself is the contract: swapping it back to "@caisson-sh/agent-kernel" would
    // still typecheck, still build, and quietly pull node:child_process into the client chunk.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(/ from "@caisson-sh\/agent-kernel\/browser";$/m);
    expect(src).not.toMatch(/ from "@caisson-sh\/agent-kernel";$/m);
  });
});

describe("the stepper enumerates the real FSM, with no rule restated poke-side", () => {
  test("the session starts at the package's first act with an empty trace", () => {
    const session = initLifecycleSession();
    expect(session.current).toBe(ACTS[0]);
    expect(session.current).toBe("spec");
    expect(session.trace).toEqual([]);
  });

  test("ship is the only terminal act, per the real isTerminal", () => {
    expect(ACTS.filter((a) => isTerminal(a))).toEqual(["ship"]);
  });

  test("the two branch edges the poke exists to show are the package's own", () => {
    expect(canTransition("verify", "plan")).toBe(true);
    expect(canTransition("sweep", "ship")).toBe(true);
    expect(canTransition("execute", "ship")).toBe(false);
  });
});

describe("the click session replays the real transition()", () => {
  test("a legal click advances current and appends the step", () => {
    const { session, step } = attemptTransition(initLifecycleSession(), "plan");
    expect(session.current).toBe("plan");
    expect(step).toEqual({ seq: 0, from: "spec", to: "plan" });
    expect(session.trace).toEqual([step]);
  });

  test("an illegal click throws the PACKAGE's ValidationError and leaves the session untouched", () => {
    const session = initLifecycleSession();
    let err: unknown;
    try {
      attemptTransition(session, "execute");
    } catch (e) {
      err = e;
    }
    if (!(err instanceof ValidationError)) {
      throw new Error("expected the package's ValidationError");
    }
    expect(err.code).toBe("validation_error");
    expect(err.httpStatus).toBe(400);
    // Check-before-mutate: nothing was recorded on the rejected attempt.
    expect(session.current).toBe("spec");
    expect(session.trace).toEqual([]);
  });

  test("ship is terminal: every outbound click throws", () => {
    let session = initLifecycleSession();
    for (const to of CANONICAL_LIFECYCLE.slice(1)) {
      ({ session } = attemptTransition(session, to));
    }
    expect(session.current).toBe("ship");
    for (const to of ACTS) {
      expect(() => attemptTransition(session, to)).toThrow(ValidationError);
    }
  });

  test("a failed VERIFY reopens PLAN: execute -> verify -> plan is a full legal replay", () => {
    let session = initLifecycleSession();
    for (const to of ["plan", "execute", "verify", "plan"] as const) {
      ({ session } = attemptTransition(session, to));
    }
    expect(session.current).toBe("plan");
    expect(session.trace.map((s) => `${s.from}->${s.to}`)).toEqual([
      "spec->plan",
      "plan->execute",
      "execute->verify",
      "verify->plan",
    ]);
  });

  test("the canonical click replay equals runLifecycle AND the shipped golden trace", () => {
    let session = initLifecycleSession();
    for (const to of CANONICAL_LIFECYCLE.slice(1)) {
      ({ session } = attemptTransition(session, to));
    }
    expect(session.trace).toEqual(runLifecycle(CANONICAL_LIFECYCLE));
    expect(session.trace).toEqual(GOLDEN_TRACE);
    expect(session.trace).toHaveLength(6);
  });

  test("the poke never widens the FSM: every click is exactly one real transition()", () => {
    for (const from of ACTS) {
      for (const to of ACTS) {
        const session = { current: from, trace: [] };
        const legal = canTransition(from, to);
        if (legal) {
          expect(attemptTransition(session, to).session.current).toBe(
            transition(from, to),
          );
        } else {
          expect(() => attemptTransition(session, to)).toThrow(ValidationError);
        }
      }
    }
  });
});
