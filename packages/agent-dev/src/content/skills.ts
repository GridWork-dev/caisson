// Curated Caisson-native SKILLS (ADR-0065/0066). A minimal default set authored against the
// agent-kernel `SkillArtifact` schema through the `defineSkill` builder — validated `.strict()` at
// module load. A skill is an ordered workflow with a trigger class (`user`/`manual`/`runtime`); each
// `steps[]` is non-empty (the schema enforces `min(1)`). Caisson-native content, not carried over
// from another naming scheme. Some skills declare a by-name `dependencies` cross-ref to ANOTHER
// artifact in the default set; reference integrity (no ghost refs) is enforced over the whole set by
// the `validateArtifactSet` check.
import { type SkillArtifact, defineSkill } from "@caisson-sh/agent-kernel";

/** The default skill set an adopter of the agent-dev edition gets out of the box (engine-neutral). */
export const CAISSON_SKILLS: readonly SkillArtifact[] = [
  defineSkill({
    name: "spec-first",
    description:
      "Answer WHAT and WHY before HOW; draft no implementation plan until the goal is locked.",
    trigger: "manual",
    steps: [
      "state the goal and the success condition in one paragraph",
      "enumerate the constraints and the explicit non-goals",
      "lock the spec before any task is planned",
    ],
  }),
  defineSkill({
    name: "guided-execution",
    description:
      "Execute a written plan one task at a time with a review gate between tasks.",
    trigger: "user",
    steps: [
      "dispatch a fresh worker for the next unblocked task",
      "review the resulting diff against the task's acceptance",
      "unblock the next task only after the gate passes",
    ],
    // A curated helper script: the review gate for step three. As part of the trusted default set it
    // always emits (the executable-content trust tier); a caller override must opt scripts in.
    scripts: [
      {
        path: "gate-check.sh",
        content:
          '#!/usr/bin/env bash\n# Refuse to advance while the working tree is dirty.\nset -euo pipefail\ntest -z "$(git status --porcelain)"\n',
      },
    ],
  }),
  defineSkill({
    name: "goal-backward-verify",
    description:
      "Re-ask the spec's original goal against the merged diff, not the task checklist.",
    trigger: "manual",
    steps: [
      "read the locked goal and the merged diff side by side",
      "ask whether the diff achieves the goal, not whether tasks closed",
      "record pass, fail, or partial — partial enumerates the gaps",
    ],
    dependencies: ["spec-first"],
  }),
];
