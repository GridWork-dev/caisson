import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { type Artifact, parseArtifact } from "./schema.ts";

const AGENT: Artifact = {
  kind: "agent",
  name: "code-reviewer",
  description: "Reviews a diff for correctness and the security floor.",
  capabilities: ["code_review", "security_audit"],
  tools: ["read", "grep", "bash"],
  whenToInvoke: "A bounded diff needs an idiom + security pass before SHIP.",
};

const SKILL: Artifact = {
  kind: "skill",
  name: "guided-execution",
  description: "Execute a written plan task-by-task with review checkpoints.",
  trigger: "user",
  steps: ["dispatch a fresh subagent per task", "review the diff"],
};

const RULE: Artifact = {
  kind: "rule",
  name: "no-any-in-prod",
  description:
    "Production code may not use `any` or silence a real type error.",
  severity: "error",
};

describe("artifact schema", () => {
  test("each kind round-trips exactly", () => {
    expect(parseArtifact(AGENT)).toEqual(AGENT);
    expect(parseArtifact(SKILL)).toEqual(SKILL);
    expect(parseArtifact(RULE)).toEqual(RULE);
  });

  test("an unknown field is rejected (.strict), not dropped", () => {
    expect(() => parseArtifact({ ...AGENT, rogue: 1 })).toThrow(
      ValidationError,
    );
  });

  test("an unknown discriminant is rejected", () => {
    expect(() => parseArtifact({ ...AGENT, kind: "daemon" })).toThrow(
      ValidationError,
    );
  });

  test("a wrong-shaped member for its kind is rejected", () => {
    // a `skill` carrying agent-only fields — strict + the wrong member shape both reject.
    expect(() => parseArtifact({ ...SKILL, tools: ["x"] })).toThrow(
      ValidationError,
    );
    // an empty steps[] violates the min(1) floor.
    expect(() => parseArtifact({ ...SKILL, steps: [] })).toThrow(
      ValidationError,
    );
  });

  test("a non-kebab slug and an out-of-set severity are rejected", () => {
    expect(() => parseArtifact({ ...AGENT, name: "Code Reviewer" })).toThrow(
      ValidationError,
    );
    expect(() => parseArtifact({ ...RULE, severity: "fatal" })).toThrow(
      ValidationError,
    );
  });

  test("the ValidationError carries safe field paths, never the rejected value", () => {
    try {
      parseArtifact({ ...AGENT, rogue: "leak-me" });
      throw new Error("expected a throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(JSON.stringify((err as ValidationError).details)).not.toContain(
        "leak-me",
      );
    }
  });
});

describe("activation/paths extension (ADR-0264)", () => {
  test("absent activation round-trips unaffected (rule and skill)", () => {
    expect(parseArtifact(RULE)).toEqual(RULE);
    expect(parseArtifact(SKILL)).toEqual(SKILL);
  });

  test("`always` and `manual` activation round-trip without paths", () => {
    const rule = parseArtifact({ ...RULE, activation: "always" });
    if (rule.kind !== "rule") throw new Error("expected a rule");
    expect(rule.activation).toBe("always");

    const skill = parseArtifact({ ...SKILL, activation: "manual" });
    if (skill.kind !== "skill") throw new Error("expected a skill");
    expect(skill.activation).toBe("manual");
  });

  test("`paths` activation round-trips with its glob list", () => {
    const scoped = parseArtifact({
      ...RULE,
      activation: "paths",
      paths: ["src/**/*.ts", "packages/*/src/**"],
    });
    if (scoped.kind !== "rule") throw new Error("expected a rule");
    expect(scoped.activation).toBe("paths");
    expect(scoped.paths).toEqual(["src/**/*.ts", "packages/*/src/**"]);
  });

  test("`paths` activation without a paths[] is rejected", () => {
    expect(() => parseArtifact({ ...RULE, activation: "paths" })).toThrow(
      ValidationError,
    );
  });

  test("`paths` activation with an empty paths[] is rejected", () => {
    expect(() =>
      parseArtifact({ ...SKILL, activation: "paths", paths: [] }),
    ).toThrow(ValidationError);
  });

  test("an absolute path glob is rejected", () => {
    expect(() =>
      parseArtifact({ ...RULE, activation: "paths", paths: ["/etc/passwd"] }),
    ).toThrow(ValidationError);
  });

  test("a `..` traversal segment in a path glob is rejected", () => {
    expect(() =>
      parseArtifact({
        ...SKILL,
        activation: "paths",
        paths: ["../escape/**"],
      }),
    ).toThrow(ValidationError);
  });

  test("an unrecognized activation value is rejected", () => {
    expect(() => parseArtifact({ ...RULE, activation: "sometimes" })).toThrow(
      ValidationError,
    );
  });

  test("an agent artifact does not carry activation/paths fields", () => {
    expect(() => parseArtifact({ ...AGENT, activation: "always" })).toThrow(
      ValidationError,
    );
  });
});
