// Module golden suite (ADR-0021 §golden / ADR-0013 golden-first). Declares the DETERMINISTIC
// outputs @caisson-sh/agent-kernel pins: the canonical lifecycle transition trace and the round-tripped
// agent/skill/rule sample. The fixtures live in `src/__golden__` (the manifest `golden` dir) and are
// re-blessed via `BLESS=1` when the output legitimately changes. This descriptor REFERENCES the
// to-be-built FSM/schema API (`runLifecycle` / `parseArtifact`) — golden-first: the fixtures + the red
// test land before the logic that turns them green.
import { toErrorResponse } from "@caisson-sh/kernel";
import { defineModuleGolden } from "@caisson-sh/testing/golden-module";
import { CANONICAL_LIFECYCLE, runLifecycle, type Act } from "./lifecycle.ts";
import { parseArtifact } from "./schema.ts";
import { validateArtifactSet } from "./validate.ts";

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

// ── Reference-integrity (ghost-ref) validation golden, golden-first for `src/validate.ts` ────────────
// An authored artifact may reference OTHER artifacts BY NAME — an agent depending on a skill, a skill
// depending on a rule — through a `dependencies: string[]` cross-ref field. The reference-integrity
// validator (ADR-0065, `src/validate.ts`) resolves every such ref against the AUTHORED SET at validate
// time: the mcp-server registry-ALLOWLIST pattern applied to artifact names. A ref that names a member
// of the set RESOLVES; a ref that names nothing in the set is a GHOST — the validator THROWS a typed
// `ValidationError` (it never guesses, never silently drops a ref: fail-closed, one ghost rejects the
// whole set).
//
// This fixture PINS that contract — a table of authored sets → outcome — and landed BEFORE the logic
// (ADR-0013 golden-first): it was committed green with `produce` ECHOING the authored outcomes (the
// validator did not exist yet, so importing it would have failed the suite to RESOLVE — a broken tree
// — rather than assert a contract). The schema was then extended with the optional `dependencies`
// cross-ref field and this `produce` body was rewired to run each set through the real
// `validateArtifactSet`. The committed `validate.json` now enforces — BLESS unset — that the live
// validator reproduces the input→outcome table byte-for-byte. The EXPECTED outcomes below ARE the
// validator's spec, authored deterministically.
//
// The contract the outcomes encode (the algorithm the validator implements), per scenario:
//   • clean set → `{ ok: true, resolved }` — `resolved` is every `"<name>-><dep>"` ref edge, SORTED.
//   • ghost ref → `{ ok: false, error }` — `error` is `toErrorResponse(validationError).body.error`
//     = `{ code: "validation_error", message, details: { missingRef, referencedBy } }`. The throw is
//     `new ValidationError("unresolved reference '<ref>' from '<name>'", { missingRef, referencedBy })`,
//     fired on the FIRST unresolved ref in authored order (deterministic — no partial resolution).

/** A scenario artifact: a schema agent/skill/rule SHAPE plus its by-name `dependencies` cross-refs. */
type AuthoredArtifact = Record<string, unknown>;

/** A clean set's outcome: the sorted `"<name>-><dep>"` ref edges the validator returns. */
interface ResolvedOutcome {
  ok: true;
  resolved: string[];
}

/** A ghost-ref outcome: the client-safe envelope the validator's `ValidationError` throw serializes to. */
interface GhostOutcome {
  ok: false;
  error: {
    code: string;
    message: string;
    details: { missingRef: string; referencedBy: string };
  };
}

/** One reference-integrity scenario: an authored set and the outcome validation owes it. */
interface ValidateCase {
  name: string;
  artifacts: AuthoredArtifact[];
  expected: ResolvedOutcome | GhostOutcome;
}

/** The fixed reference-integrity contract table the golden pins. */
interface ValidateFixture {
  cases: ValidateCase[];
}

const VALIDATE_FIXTURE: ValidateFixture = {
  cases: [
    {
      // A resolvable chain: agent → skill → rule, every ref naming a member of the set.
      name: "resolved-cross-refs",
      artifacts: [
        {
          kind: "agent",
          name: "planner",
          description: "Decomposes a locked spec into atomic tasks.",
          capabilities: ["plan_write"],
          tools: ["read", "write"],
          whenToInvoke: "A locked spec needs a task DAG before EXECUTE.",
          dependencies: ["guided-execution"],
        },
        {
          kind: "skill",
          name: "guided-execution",
          description: "Execute a plan task-by-task with review gates.",
          trigger: "user",
          steps: ["dispatch a subagent per task", "review the diff"],
          dependencies: ["no-any-in-prod"],
        },
        {
          kind: "rule",
          name: "no-any-in-prod",
          description:
            "Production code may not use `any` or silence a real type error.",
          severity: "error",
          dependencies: [],
        },
      ],
      expected: {
        ok: true,
        resolved: [
          "guided-execution->no-any-in-prod",
          "planner->guided-execution",
        ],
      },
    },
    {
      // A set with no cross-refs at all — trivially clean (resolution is empty, never an error).
      name: "resolved-no-cross-refs",
      artifacts: [
        {
          kind: "rule",
          name: "atomic-commits",
          description:
            "One logical change per commit; diff hygiene is non-negotiable.",
          severity: "error",
          dependencies: [],
        },
        {
          kind: "agent",
          name: "scout",
          description: "Surveys a path:line map for bounded recon.",
          capabilities: ["recon"],
          tools: ["grep", "read"],
          whenToInvoke: "A bounded survey of where code lives.",
          dependencies: [],
        },
      ],
      expected: { ok: true, resolved: [] },
    },
    {
      // A ghost DEPENDENCY: the agent depends on a skill that is not in the authored set.
      name: "ghost-dependency",
      artifacts: [
        {
          kind: "agent",
          name: "orchestrator",
          description: "Drives the 7-act lifecycle for a workstream.",
          capabilities: ["orchestrate"],
          tools: ["read", "write", "bash"],
          whenToInvoke: "A phase needs act sequencing.",
          dependencies: ["missing-skill"],
        },
        {
          kind: "rule",
          name: "spec-first",
          description: "No PLAN without a SPEC; no EXECUTE without a PLAN.",
          severity: "error",
          dependencies: [],
        },
      ],
      expected: {
        ok: false,
        error: {
          code: "validation_error",
          message: "unresolved reference 'missing-skill' from 'orchestrator'",
          details: {
            missingRef: "missing-skill",
            referencedBy: "orchestrator",
          },
        },
      },
    },
    {
      // A ghost SKILL REF: the skill references a rule that is not in the authored set.
      name: "ghost-skill-ref",
      artifacts: [
        {
          kind: "skill",
          name: "deploy-flow",
          description: "Open the PR and gate the merge on CI green.",
          trigger: "manual",
          steps: ["open the PR", "await CI green"],
          dependencies: ["ghost-rule"],
        },
      ],
      expected: {
        ok: false,
        error: {
          code: "validation_error",
          message: "unresolved reference 'ghost-rule' from 'deploy-flow'",
          details: { missingRef: "ghost-rule", referencedBy: "deploy-flow" },
        },
      },
    },
  ],
};

export const agentKernelGolden = defineModuleGolden({
  module: "@caisson-sh/agent-kernel",
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
    {
      // The live reference-integrity validator (see the block comment above `VALIDATE_FIXTURE`).
      // Each authored set runs through `validateArtifactSet`; a clean set yields its sorted ref edges,
      // a ghost ref throws a `ValidationError` rendered to the client-safe `toErrorResponse` envelope.
      // The committed `validate.json` enforces this byte-for-byte with BLESS unset.
      name: "validate",
      input: VALIDATE_FIXTURE,
      produce: (input) =>
        (input as ValidateFixture).cases.map((c) => {
          try {
            return {
              name: c.name,
              ok: true,
              resolved: validateArtifactSet(c.artifacts),
            };
          } catch (err) {
            return {
              name: c.name,
              ok: false,
              error: toErrorResponse(err).body.error,
            };
          }
        }),
    },
  ],
});
