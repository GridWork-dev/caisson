# ADR-0264 — Emitter expansion: IR activation extension now, Devin/Copilot/Cline targets, fidelity warnings, AGENTS.md universal base

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 3, dx-demos-compat session).
Supersedes ADR-0066 IN PART (the "AGENTS.md for Codex" naming only — the no-substrate rule
is intact). Extends ADR-0002 (Zod-strict boundary discipline applies to the schema change).
Append-only. **Tags:** none (agent-dev edition surface; no money/auth seam).

## Decision

1. **Extend the source IR now** (operator pick above the warnings-only rec): `RuleArtifact`
   and `SkillArtifact` gain optional activation fields — `activation?: "always" | "paths" |
"manual"` + `paths?: string[]` — through the Zod `.strict()` boundary (schema.ts,
   validate.ts, golden fixtures, every render function). This also **fixes the shipped
   Cursor degrade** (cursorRule hardcodes `alwaysApply: true` today; it now derives from
   activation). Field names are tracked against the open agentsmd RFC #179 — if the AAIF
   ratifies different names, a later ADR migrates; the bet is accepted.
2. **Three new targets:** **Devin Desktop** — emits BOTH `.devin/rules/*.md` (current) and
   `.windsurf/rules/*.md` (legacy fallback; Cognition rebrand 2026-06-02) · **GitHub
   Copilot** — `.github/copilot-instructions.md` (repo-wide) + per-artifact path-scoped
   `.github/instructions/*.instructions.md` with `applyTo` · **Cline** — `.clinerules/*.md`
   with `paths` frontmatter. JetBrains + Amazon Q deferred (near-zero-LOC follow-ups; both
   need the warning mechanism to ship honestly).
3. **`EmittedBundle` gains `warnings: readonly string[]`** — whenever a target cannot
   represent the source activation semantics (e.g. Cline has no file-level "manual";
   JetBrains encodes nothing in-file), the emitter warns loudly, never silently degrades
   (the kickoff's fidelity requirement; xcaffold prior art).
4. **The Codex target is reframed as the universal AGENTS.md base layer** — rename in
   comments/manifest/module-page copy via this superseding ADR (`codexAgents` is private,
   API-safe). AGENTS.md is read natively by Codex, Cursor, Devin, Zed, Gemini CLI, and the
   Copilot coding agent (60k+-project standard, verified). The agent-dev module page's
   marketing copy updates in the same PR (sells-claim honesty). No bespoke
   `AGENTS.<tool>.md` overlay convention — RFC #185 is unratified; YAGNI.

Rejected: **warnings-only, defer IR** (operator pick overrode); **all-five targets now**;
**bespoke overlay files**; **leaving the Codex under-claim in place**.

## Consequences

- Golden fixtures regenerate via the documented `BLESS=1 bun test ./packages/agent-dev`
  flow; the frontmatter-injection suite extends to every new frontmatter-bearing target.
- The Devin target's dual-path output doubles two golden files — accepted cost of covering
  both installed bases through the rebrand.
