// Curated Caisson-native AGENTS (ADR-0065/0066). A minimal default set authored against the
// agent-kernel `AgentArtifact` schema through the `defineAgent` builder — validated `.strict()` at
// module load. An agent is a capability-scoped worker: `capabilities` are normalized verbs, `tools`
// are the engine-neutral authority surface (NOT a vendor tool roster), `whenToInvoke` is the trigger.
// Each agent declares a by-name `dependencies` cross-ref to the rules/skills it leans on; every ref
// names a member of the default set, so the reference-integrity validator resolves the whole graph
// clean. Caisson-native content, authored directly against this schema.
import { type AgentArtifact, defineAgent } from "@caisson-sh/agent-kernel";

/** The default agent set an adopter of the agent-dev edition gets out of the box (engine-neutral). */
export const CAISSON_AGENTS: readonly AgentArtifact[] = [
  defineAgent({
    name: "code-reviewer",
    description:
      "Reviews a bounded diff for correctness, idiom, and the project's type discipline.",
    capabilities: ["code_review"],
    tools: ["read", "grep"],
    whenToInvoke: "A bounded diff needs an idiom pass before it ships.",
    dependencies: ["no-any-in-prod", "validate-at-boundaries"],
  }),
  defineAgent({
    name: "security-auditor",
    description:
      "Audits a diff against the security floor — secret handling, input validation, and egress.",
    capabilities: ["security_audit"],
    tools: ["read", "grep"],
    whenToInvoke: "A diff touches secrets, auth, input, or an outbound call.",
    dependencies: ["constant-time-secret-compare", "bounded-outbound-fetch"],
  }),
  defineAgent({
    name: "test-author",
    description:
      "Writes a failing test first, then the minimal change that turns it green.",
    capabilities: ["test_authoring"],
    tools: ["read", "write"],
    whenToInvoke: "A bounded change has a behavior specifiable up front.",
    dependencies: ["goal-backward-verify"],
  }),
];
