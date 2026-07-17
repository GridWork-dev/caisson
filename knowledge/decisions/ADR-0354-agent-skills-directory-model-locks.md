# ADR-0354 — Agent Skills directory model, slices 1-2: portability fields + spec-pure SKILL.md

Status: accepted · 2026-07-17 (Kickoff-U Lane 3, CAISSON-116, PR #246; operator picker locks
during the wave incl. the same-day spec-pure re-lock; filed at the reconcile sitting per the
ADR-0328 wave convention. Extends ADR-0264's emitter discipline.)

## Decision

1. **Slice 1 — agentskills.io portability fields on `SkillArtifact` (kernel):** four optional
   fields — `license` (≤256) · `compatibility` (1-500) · `metadata` (string→string, key ≤128 /
   value ≤1024 / ≤32 entries) · `allowedTools` (bare-token array: non-empty, no whitespace, ≤128
   each, ≤64 tokens) — plus spec caps `name` ≤64 and `description` ≤1024. ADR-0264 discipline
   holds: all optional, absent ⇒ byte-identical round-trip; agents/rules schemas stay `.strict()`
   and reject the new fields.
2. **`allowedTools` is a portability array, not an execution grant** — emitted as the spec's
   space-separated `allowed-tools` string; deliberately NOT the tool-exec `CommandSpec` shape.
   Execution authority stays tool-exec's concern.
3. **Slice 2 — two directory emit targets:** Claude Code moves from flat
   `.claude/skills/<name>.md` to `.claude/skills/<name>/SKILL.md`, and a NEW universal
   skills-only surface emits `.agents/skills/<name>/SKILL.md` (Codex's current home,
   Cursor-compatible). The two SKILL.md files are byte-identical twins (the Devin/Windsurf twin
   precedent). A fidelity warning fires when a `paths`/`manual`-activation skill hits the
   `.agents` surface (ADR-0264 no-silent-degrade).
4. **Spec-pure SKILL.md frontmatter (operator re-lock, same day):** `trigger` is NOT an
   agentskills.io field and is dropped from the SKILL.md emit on BOTH surfaces; trigger intent
   still reaches consumers via the AGENTS.md aggregate and the artifact itself. The
   Devin/Windsurf emitter keeps its native `trigger` enum — a different target with a real field.

## Rejected

- **Carrying `trigger` in SKILL.md frontmatter as an extension** — a non-spec field on a surface
  sold as spec-conformant; the aggregate already carries the intent.
- **Reusing the tool-exec `CommandSpec` shape for `allowedTools`** — couples a portability list to
  an execution-authority contract.
