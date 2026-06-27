// Module golden suite (ADR-0021 §golden / ADR-0013 golden-first). Declares the DETERMINISTIC
// outputs @caisson/agent-kernel pins: the canonical lifecycle transition trace and the round-tripped
// agent/skill/rule sample. The fixtures live in `src/__golden__` (the manifest `golden` dir) and are
// re-blessed via `BLESS=1` when the output legitimately changes. This descriptor REFERENCES the
// to-be-built FSM/schema API (`runLifecycle` / `parseArtifact`) — golden-first: the fixtures + the red
// test land before the logic (T4) that turns them green.
import { defineModuleGolden } from "@caisson/testing/golden-module";
import { CANONICAL_LIFECYCLE, runLifecycle, type Act } from "./lifecycle.ts";
import { parseArtifact } from "./schema.ts";

/**
 * One of each artifact kind. Authored in the schema SHAPE order (kind → name → description → …) so the
 * Zod `.strict()` round-trip output is byte-identical to the committed `agent-schema.json` golden.
 */
const ARTIFACT_SAMPLE: readonly unknown[] = [
  {
    kind: "agent",
    name: "code-reviewer",
    description: "Reviews a diff for correctness and the security floor.",
    capabilities: ["code_review", "security_audit"],
    tools: ["read", "grep", "bash"],
    whenToInvoke: "A bounded diff needs an idiom + security pass before SHIP.",
  },
  {
    kind: "skill",
    name: "guided-execution",
    description: "Execute a written plan task-by-task with review checkpoints.",
    trigger: "user",
    steps: [
      "dispatch a fresh subagent per task",
      "review the diff",
      "unblock the next task",
    ],
  },
  {
    kind: "rule",
    name: "no-any-in-prod",
    description:
      "Production code may not use `any` or silence a real type error.",
    severity: "error",
  },
];

export const agentKernelGolden = defineModuleGolden({
  module: "@caisson/agent-kernel",
  goldenDir: "src/__golden__",
  cases: [
    {
      name: "lifecycle-trace",
      input: CANONICAL_LIFECYCLE,
      produce: (input) => runLifecycle(input as readonly Act[]),
    },
    {
      name: "agent-schema",
      input: ARTIFACT_SAMPLE,
      produce: (input) => (input as readonly unknown[]).map(parseArtifact),
    },
  ],
});
