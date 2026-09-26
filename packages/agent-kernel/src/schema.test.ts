import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
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

  test("bundled-file paths reject traversal/absolute at parse time, accept relative", () => {
    for (const category of ["references", "assets", "scripts"] as const) {
      for (const path of ["../escape.sh", "a/../../escape.sh", "/etc/passwd"]) {
        expect(() =>
          parseArtifact({ ...SKILL, [category]: [{ path, content: "x" }] }),
        ).toThrow(ValidationError);
      }
      expect(
        parseArtifact({
          ...SKILL,
          [category]: [{ path: "helpers/setup.sh", content: "x" }],
        }),
      ).toBeDefined();
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

describe("agentskills.io SKILL.md portability fields", () => {
  test("absent portability fields round-trip a skill unaffected", () => {
    expect(parseArtifact(SKILL)).toEqual(SKILL);
  });

  test("all four fields round-trip when present", () => {
    const enriched = {
      ...SKILL,
      license: "Apache-2.0",
      compatibility: "Designed for Claude Code (or similar products)",
      metadata: { author: "caisson", channel: "stable" },
      allowedTools: ["Bash(git:*)", "Read"],
    };
    const parsed = parseArtifact(enriched);
    if (parsed.kind !== "skill") throw new Error("expected a skill");
    expect(parsed).toEqual(enriched);
    expect(parsed.metadata).toEqual({ author: "caisson", channel: "stable" });
    expect(parsed.allowedTools).toEqual(["Bash(git:*)", "Read"]);
  });

  test("only skills carry the portability fields — an agent rejects them (.strict)", () => {
    expect(() => parseArtifact({ ...AGENT, license: "MIT" })).toThrow(
      ValidationError,
    );
  });

  test("a name over 64 chars and a description over 1024 chars are rejected", () => {
    expect(() => parseArtifact({ ...SKILL, name: "a".repeat(65) })).toThrow(
      ValidationError,
    );
    expect(() =>
      parseArtifact({ ...SKILL, description: "d".repeat(1025) }),
    ).toThrow(ValidationError);
  });

  test("license over 256 and compatibility over 500 chars are rejected", () => {
    expect(() => parseArtifact({ ...SKILL, license: "l".repeat(257) })).toThrow(
      ValidationError,
    );
    expect(() =>
      parseArtifact({ ...SKILL, compatibility: "c".repeat(501) }),
    ).toThrow(ValidationError);
  });

  test("metadata bounds — over-long key/value and over 32 entries are rejected", () => {
    expect(() =>
      parseArtifact({ ...SKILL, metadata: { ["k".repeat(129)]: "v" } }),
    ).toThrow(ValidationError);
    expect(() =>
      parseArtifact({ ...SKILL, metadata: { k: "v".repeat(1025) } }),
    ).toThrow(ValidationError);
    const tooMany = Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`k${i}`, "v"]),
    );
    expect(() => parseArtifact({ ...SKILL, metadata: tooMany })).toThrow(
      ValidationError,
    );
  });

  test("an allowed-tools token with internal whitespace or an empty array is rejected", () => {
    expect(() =>
      parseArtifact({ ...SKILL, allowedTools: ["Bash git"] }),
    ).toThrow(ValidationError);
    expect(() => parseArtifact({ ...SKILL, allowedTools: [] })).toThrow(
      ValidationError,
    );
  });
});
