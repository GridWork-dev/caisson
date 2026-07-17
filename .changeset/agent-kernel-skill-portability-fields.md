---
"@caisson/agent-kernel": minor
---

Add the agentskills.io SKILL.md portability fields to `SkillArtifact`: optional `license`, `compatibility`, `metadata`, and `allowedTools`, each bounded to the specification's caps and validated through the Zod strict boundary. Skill `name` and `description` gain the spec's 64 and 1024 character caps. Every field is optional, so an absent field round-trips byte-identically and every previously authored skill parses unchanged. No `scripts`, `references`, or `assets` fields — that trust boundary is deferred to a later write-gate program.
