# @caisson/agent-kernel

## 0.6.0

### Minor Changes

- 586916f: Skills can now ship bundled files. A skill artifact gains three optional maps — `references` and `assets` for supporting docs and static files, and `scripts` for executable helpers — each a relative path plus its content. The multi-harness emitter writes them into every SKILL.md directory it produces.

  Executable content is trust-tiered. The curated default skill set always emits its scripts; scripts on a skill set you supply yourself are held back unless you pass `allowScripts`, and any withheld scripts are reported rather than dropped silently. References and assets always emit. All three fields are optional, so skills authored before this release are unaffected.

## 0.5.0

### Minor Changes

- ce1e576: Add the agentskills.io SKILL.md portability fields to `SkillArtifact`: optional `license`, `compatibility`, `metadata`, and `allowedTools`, each bounded to the specification's caps and validated through the Zod strict boundary. Skill `name` and `description` gain the spec's 64 and 1024 character caps. Every field is optional, so an absent field round-trips byte-identically and every previously authored skill parses unchanged. No `scripts`, `references`, or `assets` fields — that trust boundary is deferred to a later write-gate program.

## 0.4.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.4.0

### Minor Changes

- 8c53ca3: `RuleArtifact` and `SkillArtifact` gain an optional `activation` (`always` / `paths` /
  `manual`) and `paths` (bounded, relative-glob-only) pair, letting an authored rule or skill scope
  its activation instead of always loading. The multi-harness emitter fixes the shipped Cursor
  degrade (rules no longer hardcode `alwaysApply: true`) and gains three new targets — Devin Desktop
  (mirrored to the legacy Windsurf path), GitHub Copilot (repo-wide instructions + per-artifact
  path-scoped instructions), and Cline — plus an `EmittedBundle.warnings[]` channel that fires a
  specific, actionable warning whenever a target cannot represent the source's activation intent
  instead of silently degrading it. The emitted `AGENTS.md` is reframed as the universal multi-tool
  base layer (Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot coding agent all read it
  natively) — its emitted content and path are unchanged.

## 0.3.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.3.0

### Minor Changes

- cf66d65: Add a secret-redacting structured event logger. `makeRedactingLogger` builds a
  logger that redacts every string leaf and any credential- or PII-named field in a
  structured event before handing it to your own write sink (file, database, log
  shipper), and `toRedactedJsonlLine` serializes one redacted event to a single JSON
  Lines record. Use it as the default scrub pass before agent audit-trail events are
  persisted, so API keys, tokens, and other secrets accidentally captured in an event
  payload never reach disk or a downstream log store.

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
