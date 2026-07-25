// Golden parity for the agent-kernel poke's mirror (ADR-0378 lock 2): every constant + pure
// function in agent-kernel-logic.ts must be byte/number-identical to the real @caisson/agent-kernel
// package AND to the shipped packages/agent-kernel/src/__golden__/lifecycle-trace.json fixture. This
// test imports the real packages directly - it runs under bun (node:crypto resolves fine here),
// unlike the browser bundle the poke component ships in (see agent-kernel-logic.ts's header).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ValidationError } from "@caisson/kernel";
import {
  ACTS as REAL_ACTS,
  CANONICAL_LIFECYCLE as REAL_CANONICAL_LIFECYCLE,
  canTransition as realCanTransition,
  isTerminal as realIsTerminal,
  runLifecycle as realRunLifecycle,
  transition as realTransition,
  type Act as RealAct,
} from "@caisson/agent-kernel";

import {
  ACTS,
  CANONICAL_LIFECYCLE,
  ValidationErrorMirror,
  attemptTransition,
  canTransition,
  initLifecycleSession,
  isTerminal,
  runLifecycle,
  transition,
} from "./agent-kernel-logic";

describe("constant parity vs the real package", () => {
  test("ACTS and CANONICAL_LIFECYCLE are identical", () => {
    expect(ACTS).toEqual(REAL_ACTS);
    expect(CANONICAL_LIFECYCLE).toEqual(REAL_CANONICAL_LIFECYCLE);
    expect(CANONICAL_LIFECYCLE).toEqual([...ACTS]);
  });
});

describe("canTransition + isTerminal parity across every act pair", () => {
  test("canTransition matches the real package for all 49 (from, to) pairs", () => {
    for (const from of ACTS) {
      for (const to of ACTS) {
        expect(canTransition(from, to)).toBe(
          realCanTransition(from as RealAct, to as RealAct),
        );
      }
    }
  });

  test("isTerminal matches the real package for every act", () => {
    for (const act of ACTS) {
      expect(isTerminal(act)).toBe(realIsTerminal(act as RealAct));
    }
    expect(isTerminal("ship")).toBe(true);
    for (const act of ACTS.filter((a) => a !== "ship")) {
      expect(isTerminal(act)).toBe(false);
    }
  });

  test("the two documented branch edges are legal in both", () => {
    expect(canTransition("verify", "sweep")).toBe(true);
    expect(canTransition("verify", "plan")).toBe(true);
    expect(canTransition("sweep", "eval")).toBe(true);
    expect(canTransition("sweep", "ship")).toBe(true);
    expect(realCanTransition("verify", "plan")).toBe(true);
    expect(realCanTransition("sweep", "ship")).toBe(true);
  });
});

describe("transition() parity, including the thrown error shape", () => {
  test("a legal transition returns `to`, matching the real function", () => {
    expect(transition("spec", "plan")).toBe(realTransition("spec", "plan"));
    expect(transition("verify", "plan")).toBe(realTransition("verify", "plan"));
  });

  test("an illegal transition throws in both, with the same message/code/httpStatus shape", () => {
    let mirrorErr: unknown;
    try {
      transition("spec", "execute");
    } catch (e) {
      mirrorErr = e;
    }
    let realErr: unknown;
    try {
      realTransition("spec", "execute");
    } catch (e) {
      realErr = e;
    }
    expect(mirrorErr).toBeInstanceOf(ValidationErrorMirror);
    expect(realErr).toBeInstanceOf(ValidationError);
    expect(mirrorErr).toBeInstanceOf(Error);
    expect((mirrorErr as ValidationErrorMirror).message).toBe(
      (realErr as ValidationError).message,
    );
    expect((mirrorErr as ValidationErrorMirror).code).toBe(
      (realErr as ValidationError).code,
    );
    expect((mirrorErr as ValidationErrorMirror).httpStatus).toBe(
      (realErr as ValidationError).httpStatus,
    );
    expect((mirrorErr as ValidationErrorMirror).name).toBe(
      (realErr as ValidationError).name,
    );
    expect((mirrorErr as ValidationErrorMirror).details).toEqual(
      (realErr as ValidationError).details,
    );
  });

  test("ship is terminal in both: every outbound transition throws", () => {
    for (const to of ACTS) {
      expect(() => transition("ship", to)).toThrow(ValidationErrorMirror);
      expect(() => realTransition("ship", to as RealAct)).toThrow(
        ValidationError,
      );
    }
  });
});

const lifecycleStepSchema = z.object({
  seq: z.number().int().nonnegative(),
  from: z.enum(ACTS),
  to: z.enum(ACTS),
});

describe("runLifecycle parity against the golden fixture (BLESS unset)", () => {
  const golden = z.array(lifecycleStepSchema).parse(
    JSON.parse(
      readFileSync(
        // packages/agent-kernel/src/__golden__/lifecycle-trace.json, resolved from this file's own
        // directory (apps/site/components/poke/) so a glob-guessed path can never silently drift.
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
          "packages",
          "agent-kernel",
          "src",
          "__golden__",
          "lifecycle-trace.json",
        ),
        "utf8",
      ),
    ),
  );

  test("the mirror's canonical trace matches the fixture and the real package", () => {
    const mirrorTrace = runLifecycle(CANONICAL_LIFECYCLE);
    const realTrace = realRunLifecycle(REAL_CANONICAL_LIFECYCLE);
    expect(mirrorTrace).toHaveLength(6);
    expect(mirrorTrace).toEqual(golden);
    expect(mirrorTrace).toEqual(realTrace);
  });

  test("runLifecycle throws on the first illegal pair in a sequence, in both", () => {
    expect(() => runLifecycle(["spec", "plan", "ship"])).toThrow(
      ValidationErrorMirror,
    );
    expect(() =>
      realRunLifecycle(["spec", "plan", "ship"] as RealAct[]),
    ).toThrow(ValidationError);
  });

  test("a 0- or 1-element sequence yields an empty trace in both", () => {
    expect(runLifecycle([])).toEqual([]);
    expect(runLifecycle(["spec"])).toEqual([]);
    expect(realRunLifecycle([])).toEqual([]);
    expect(realRunLifecycle(["spec"] as RealAct[])).toEqual([]);
  });
});

describe("click-session replay: attemptTransition (runnable self-check)", () => {
  test("starts at spec with an empty trace", () => {
    const session = initLifecycleSession();
    expect(session.current).toBe("spec");
    expect(session.trace).toEqual([]);
  });

  test("a legal click advances current and appends the step", () => {
    const session = initLifecycleSession();
    const { session: next, step } = attemptTransition(session, "plan");
    expect(next.current).toBe("plan");
    expect(next.trace).toEqual([{ seq: 0, from: "spec", to: "plan" }]);
    expect(step).toEqual({ seq: 0, from: "spec", to: "plan" });
  });

  test("an illegal click throws and leaves the session untouched (check-before-mutate)", () => {
    const session = initLifecycleSession();
    expect(() => attemptTransition(session, "execute")).toThrow(
      ValidationErrorMirror,
    );
    // The session object itself is never mutated on a thrown attempt.
    expect(session.current).toBe("spec");
    expect(session.trace).toEqual([]);
  });

  test("a failed VERIFY reopens PLAN: execute -> verify -> plan is a full legal replay", () => {
    let session = initLifecycleSession();
    ({ session } = attemptTransition(session, "plan"));
    ({ session } = attemptTransition(session, "execute"));
    ({ session } = attemptTransition(session, "verify"));
    expect(session.current).toBe("verify");
    ({ session } = attemptTransition(session, "plan"));
    expect(session.current).toBe("plan");
    expect(session.trace.map((s) => `${s.from}->${s.to}`)).toEqual([
      "spec->plan",
      "plan->execute",
      "execute->verify",
      "verify->plan",
    ]);
  });

  test("the full canonical replay via clicks matches runLifecycle's trace", () => {
    let session = initLifecycleSession();
    for (const to of CANONICAL_LIFECYCLE.slice(1)) {
      ({ session } = attemptTransition(session, to));
    }
    expect(session.current).toBe("ship");
    expect(session.trace).toEqual(runLifecycle(CANONICAL_LIFECYCLE));
  });
});
