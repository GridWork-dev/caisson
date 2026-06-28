// Curated content tests (T20 · ADR-0065). Proves the rebuild-clean default set PARSES (every member
// round-trips the agent-kernel `.strict()` schema) and VALIDATES (the whole set passes the T12
// reference-integrity / ghost-ref check). The `define*()` builders already validate each artifact at
// module load; these tests assert the SET-level contract the emitter and edition composition rely on,
// plus the rebuild-clean firewall (no gw-prefixed names).
import { describe, expect, test } from "bun:test";
import { parseArtifact, validateArtifactSet } from "@caisson/agent-kernel";
import {
  CAISSON_AGENTS,
  CAISSON_DEFAULT_ARTIFACTS,
  CAISSON_RULES,
  CAISSON_SKILLS,
} from "./index.ts";

describe("curated Caisson-native default content (T20)", () => {
  test("the default set is the union of agents + skills + rules by kind", () => {
    expect(CAISSON_AGENTS.length).toBe(3);
    expect(CAISSON_SKILLS.length).toBe(3);
    expect(CAISSON_RULES.length).toBe(4);
    expect(CAISSON_DEFAULT_ARTIFACTS.length).toBe(
      CAISSON_AGENTS.length + CAISSON_SKILLS.length + CAISSON_RULES.length,
    );
    const kinds = CAISSON_DEFAULT_ARTIFACTS.reduce<Record<string, number>>(
      (acc, a) => ({ ...acc, [a.kind]: (acc[a.kind] ?? 0) + 1 }),
      {},
    );
    expect(kinds).toEqual({ rule: 4, skill: 3, agent: 3 });
  });

  test("every artifact re-parses strict and round-trips byte-identically", () => {
    for (const artifact of CAISSON_DEFAULT_ARTIFACTS) {
      expect(parseArtifact(artifact)).toEqual(artifact);
    }
  });

  test("every artifact name is a unique kebab-case slug", () => {
    const names = CAISSON_DEFAULT_ARTIFACTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("the set is rebuild-clean — no gw-prefixed content (pro-private firewall)", () => {
    for (const artifact of CAISSON_DEFAULT_ARTIFACTS) {
      expect(artifact.name.startsWith("gw-")).toBe(false);
    }
  });

  test("the whole set passes reference-integrity with the expected resolved graph (T12)", () => {
    expect(validateArtifactSet(CAISSON_DEFAULT_ARTIFACTS)).toEqual([
      "code-reviewer->no-any-in-prod",
      "code-reviewer->validate-at-boundaries",
      "goal-backward-verify->spec-first",
      "security-auditor->bounded-outbound-fetch",
      "security-auditor->constant-time-secret-compare",
      "test-author->goal-backward-verify",
    ]);
  });

  test("a ghost cross-ref against the set is rejected fail-closed (T12)", () => {
    const broken: readonly unknown[] = [
      ...CAISSON_DEFAULT_ARTIFACTS,
      {
        kind: "agent",
        name: "ghost-referrer",
        description: "depends on an artifact that is not in the authored set",
        capabilities: ["code_review"],
        tools: ["read"],
        whenToInvoke: "a deliberately dangling cross-ref must throw",
        dependencies: ["does-not-exist"],
      },
    ];
    // The validator throws a redaction-safe error naming the missing ref + referrer (T12 contract).
    expect(() => validateArtifactSet(broken)).toThrow(
      "unresolved reference 'does-not-exist' from 'ghost-referrer'",
    );
  });
});
