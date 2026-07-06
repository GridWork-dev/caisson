---
"@caisson/agent-kernel": minor
"@caisson/agent-dev": minor
---

ADR-0264: `RuleArtifact` and `SkillArtifact` gain an optional `activation` (`always` / `paths` /
`manual`) and `paths` (bounded, relative-glob-only) pair, letting an authored rule or skill scope
its activation instead of always loading. The multi-harness emitter fixes the shipped Cursor
degrade (rules no longer hardcode `alwaysApply: true`) and gains three new targets — Devin Desktop
(mirrored to the legacy Windsurf path), GitHub Copilot (repo-wide instructions + per-artifact
path-scoped instructions), and Cline — plus an `EmittedBundle.warnings[]` channel that fires a
specific, actionable warning whenever a target cannot represent the source's activation intent
instead of silently degrading it. The emitted `AGENTS.md` is reframed as the universal multi-tool
base layer (Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot coding agent all read it
natively) — its emitted content and path are unchanged.
