---
"@caisson/agent-dev": minor
---

Emit skills as agentskills.io SKILL.md directories. Claude Code skills move from the flat `.claude/skills/<name>.md` to `.claude/skills/<name>/SKILL.md`, and a new universal `.agents/skills/<name>/SKILL.md` cross-tool surface (Codex's current home, Cursor-compatible) is emitted with byte-identical SKILL.md content. The SKILL.md frontmatter now renders the optional portability fields (license, compatibility, space-separated allowed-tools, nested metadata) when a skill sets them. The AGENTS.md aggregate and every other target are unchanged; a skill whose activation cannot be represented on the `.agents` surface raises a fidelity warning rather than degrading silently.
