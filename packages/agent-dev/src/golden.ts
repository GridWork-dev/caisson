// Multi-harness emit golden (ADR-0013 golden-first · ADR-0066 engine-neutral emitter). Pins the
// BYTE-STABLE per-harness bundle the agent-dev emitter must render from ONE typed Caisson schema:
// `.claude/` for Claude Code (agents + `skills/<name>/SKILL.md` directory skills + rules + a hooks
// manifest), the universal `.agents/skills/<name>/SKILL.md` cross-tool skills surface, a
// single aggregated `AGENTS.md` for Codex, and per-artifact `.cursor/rules/*.mdc` for Cursor. The binding contract
// (ADR-0066) the committed tree enforces: Claude Code is ONE emit target among several — no harness
// is the substrate, and the same schema fans out to every harness shape.
//
// Golden-first (ADR-0013): this fixture + its test landed before the emitter logic, then `produce`
// was wired to the live `renderHarnessBundles(EMIT_INPUT)`; the committed `src/__golden__/emit/` tree
// enforces byte-equality with BLESS unset — the emitter must reproduce it exactly. The emitter owns
// the bundle types; this fixture re-exports them so consumers (and the test) keep one import surface.
import { parseArtifact, type Artifact } from "@caisson-sh/agent-kernel";
import { defineModuleGolden } from "@caisson-sh/testing/golden-module";
import { renderHarnessBundles, type EmitInput } from "./emitter.ts";

export type {
  EmitHookBinding,
  EmitInput,
  EmittedFile,
  EmittedBundle,
} from "./emitter.ts";

// ── Shared artifact prose (DRY: each datum is authored once; the emitter renders it per harness, so
// the cross-harness bytes agree and the input round-trips the agent-kernel schema). ─────────────────
const REVIEWER_DESC = "Reviews a diff for correctness and the security floor.";
const REVIEWER_INVOKE =
  "A bounded diff needs an idiom + security pass before SHIP.";
const GUIDED_DESC =
  "Execute a written plan task-by-task with review checkpoints.";
const RULE_DESC =
  "Production code may not use `any` or silence a real type error.";

// The fixed input: one curated agent + skill + rule, validated through the agent-kernel `.strict()`
// schema (a mis-shaped artifact throws here, never reaches the emitter), plus two lifecycle hook
// bindings naming the in-bundle reviewer agent. The rule exercises `paths` activation (representable
// everywhere — Cursor globs, Devin/Windsurf glob trigger, Copilot applyTo, Cline paths — so it never
// warns); the skill exercises `manual` activation (representable in Cursor/Devin/Windsurf but NOT in
// Cline, and un-representable in Claude Code — both fire the ADR-0264 fidelity warning).
const EMIT_ARTIFACTS: readonly Artifact[] = [
  {
    kind: "agent",
    name: "code-reviewer",
    description: REVIEWER_DESC,
    capabilities: ["code_review", "security_audit"],
    tools: ["read", "grep", "bash"],
    whenToInvoke: REVIEWER_INVOKE,
  },
  {
    kind: "skill",
    name: "guided-execution",
    description: GUIDED_DESC,
    trigger: "user",
    steps: [
      "dispatch a fresh subagent per task",
      "review the diff",
      "unblock the next task",
    ],
    activation: "manual",
    // The agentskills.io SKILL.md portability fields — exercised here so the golden
    // pins their frontmatter rendering (space-separated allowed-tools, nested metadata map).
    license: "Apache-2.0",
    compatibility: "Designed for Claude Code (or similar products)",
    metadata: { author: "caisson", channel: "stable" },
    allowedTools: ["Bash(git:*)", "Read"],
    // Bundled-file maps (ADR-0264 write-gate): references/assets always emit; scripts emit because this
    // golden runs with `allowScripts: true`. All three fan into both SKILL.md directory targets.
    references: [
      {
        path: "checklist.md",
        content:
          "# Review checklist\n\n- diff matches the task\n- tests pass\n",
      },
    ],
    assets: [{ path: "flow.txt", content: "task -> review -> unblock\n" }],
    scripts: [
      { path: "run.sh", content: "#!/usr/bin/env bash\necho next-task\n" },
    ],
  },
  {
    kind: "rule",
    name: "no-any-in-prod",
    description: RULE_DESC,
    severity: "error",
    activation: "paths",
    paths: ["src/**/*.ts", "packages/*/src/**/*.ts"],
  },
].map(parseArtifact);

export const EMIT_INPUT: EmitInput = {
  artifacts: EMIT_ARTIFACTS,
  hooks: [
    { on: "before:execute", use: "code-reviewer" },
    { on: "before:ship", use: "code-reviewer" },
  ],
  // Trusted-tier render: scripts emit alongside references/assets (the withheld path is covered in
  // emitter.test.ts). Pins the bundled-file layout under both SKILL.md directory targets.
  allowScripts: true,
};

export const agentDevGolden = defineModuleGolden({
  module: "@caisson-sh/agent-dev",
  goldenDir: "src/__golden__",
  cases: [
    {
      name: "emit",
      input: EMIT_INPUT,
      // The live emitter: the committed `__golden__/emit/` tree enforces that
      // `renderHarnessBundles` reproduces every harness bundle byte-for-byte (BLESS unset).
      produce: () => renderHarnessBundles(EMIT_INPUT),
    },
  ],
});
