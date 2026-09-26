import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  defineAgent,
  defineRule,
  defineSkill,
  validateArtifactSet,
} from "./validate.ts";

const PLANNER = {
  kind: "agent",
  name: "planner",
  description: "Decomposes a locked spec into atomic tasks.",
  capabilities: ["plan_write"],
  tools: ["read", "write"],
  whenToInvoke: "A locked spec needs a task DAG before EXECUTE.",
  dependencies: ["guided-execution"],
};

const GUIDED = {
  kind: "skill",
  name: "guided-execution",
  description: "Execute a plan task-by-task with review gates.",
  trigger: "user",
  steps: ["dispatch a subagent per task", "review the diff"],
  dependencies: ["no-any-in-prod"],
};

const RULE = {
  kind: "rule",
  name: "no-any-in-prod",
  description: "Production code may not use `any`.",
  severity: "error",
  dependencies: [],
};

describe("validateArtifactSet (reference integrity)", () => {
  test("resolves a chain into sorted `<name>-><dep>` edges", () => {
    expect(validateArtifactSet([PLANNER, GUIDED, RULE])).toEqual([
      "guided-execution->no-any-in-prod",
      "planner->guided-execution",
    ]);
  });

  test("a set with no cross-refs resolves to an empty graph", () => {
    expect(validateArtifactSet([RULE])).toEqual([]);
    // dependencies may be omitted entirely (optional, no default).
    const { dependencies: _omit, ...noDeps } = RULE;
    expect(validateArtifactSet([noDeps])).toEqual([]);
  });

  test("a ghost ref throws a ValidationError naming the missing ref + referrer", () => {
    try {
      validateArtifactSet([{ ...PLANNER, dependencies: ["missing-skill"] }]);
      throw new Error("expected a throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const e = err as ValidationError;
      expect(e.message).toBe(
        "unresolved reference 'missing-skill' from 'planner'",
      );
      expect(e.details).toEqual({
        missingRef: "missing-skill",
        referencedBy: "planner",
      });
    }
  });

  test("a ghost ref never resolves earlier good edges (fail-closed, no partial)", () => {
    expect(() =>
      validateArtifactSet([
        { ...GUIDED, dependencies: ["no-any-in-prod", "ghost-rule"] },
        RULE,
      ]),
    ).toThrow(ValidationError);
  });

  test("a mis-shaped member rejects the whole set", () => {
    expect(() => validateArtifactSet([{ ...PLANNER, rogue: 1 }])).toThrow(
      ValidationError,
    );
  });
});

describe("define*() builders", () => {
  test("each builder builds + validates its kind", () => {
    expect(
      defineAgent({
        name: "code-reviewer",
        description: "Reviews a diff for the security floor.",
        capabilities: ["code_review"],
        tools: ["read", "grep"],
        whenToInvoke: "A bounded diff needs a pass before SHIP.",
      }).kind,
    ).toBe("agent");

    expect(
      defineSkill({
        name: "guided-execution",
        description: "Execute a plan task-by-task.",
        trigger: "user",
        steps: ["dispatch a subagent per task"],
        dependencies: ["no-any-in-prod"],
      }).dependencies,
    ).toEqual(["no-any-in-prod"]);

    expect(
      defineRule({
        name: "no-any-in-prod",
        description: "Production code may not use `any`.",
        severity: "error",
      }).severity,
    ).toBe("error");
  });

  test("a builder rejects an invalid artifact (strict)", () => {
    // A non-kebab name is a valid `string` to the type system but fails the slug regex at runtime.
    expect(() =>
      defineRule({
        name: "Bad Name",
        description: "non-kebab slug rejected at parse time",
        severity: "error",
      }),
    ).toThrow(ValidationError);
  });
});
