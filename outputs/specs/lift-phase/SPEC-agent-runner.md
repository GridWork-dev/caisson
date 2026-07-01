# SPEC — `@caisson/agent-runner` (sandboxed governed agent runner)

**Status: DRAFT — awaiting operator lock (proposed ADR-0186).** No code lands until this SPEC + its ADR are locked (Caisson cadence, ADR-0133 §4).

- **Slice:** LIFT slice 1 (build-now, revenue-additive sellable).
- **Edition:** Agentic-Dev.
- **Source (rebuild-clean, patterns only):** gridwork-core `tools/lib/glm-engine.ts` (391 LOC). Firewall-clean — gridwork-core only.
- **Type:** NEW SELLABLE. Completes the Agentic-Dev end-to-end story.
- **Tags:** `security` `ai` `external-system`.

## Goal (WHAT + WHY)

`@caisson/agent-dev` today ships the artifact/schema kernel (`@caisson/agent-kernel`), a
multi-harness emitter, and local memory — but **nothing that runs an agent**. The missing
primitive: _spawn a governed AI coding agent in a sandbox, get back an auditable
transcript + structured run report + a worktree diff._ This is the piece that turns
Agentic-Dev from "scaffolding for agents" into "run agents safely," and its
security posture (zero-secret-leak-by-construction) is itself the sales point for
compliance-conscious dev orgs — it dovetails with the existing `audited` lifecycle in
`agent-kernel`.

## Scope

Rebuild-clean the sandboxed subprocess runner as a provider-agnostic package. Keep the
three clean, dependency-light cores from the source pattern; strip every gridwork binding.

**In:**

- `spawn(config, task)` — launch a headless agent CLI as a detached subprocess in an
  isolated worktree. Env built from scratch via a `buildEngineEnv()`-style scrubber:
  **never spread `process.env`**; fixed non-secret passthrough allowlist + only the
  target provider's key; isolated `HOME`/config dir; `--strict-mcp-config` (no
  credentialed MCP); no side-effect tools.
- Transcript streaming to a `.jsonl` file that survives launcher exit.
- Run registry: `spawn`/`tail`/`status`/`kill`/`list`/`finalReport` — parse the
  transcript into a structured summary (tool calls, files touched, final result).
- **Leak-guard test** asserting no secret from `process.env` reaches the child env
  (the security contract is the differentiator — do NOT simplify it away).
- Provider-agnostic config: `{ binary, baseUrlEnv, authEnv, model }`.

**Out (defer to slice 2 / follow-up):** multi-agent orchestration, a hosted run UI,
non-CLI (SDK) agent backends, cost metering integration (`@caisson/ai-meter` wiring).

## Forks (operator must lock — see SLICE-PLAN.md F1, F2, F5)

- **F1** Package boundary + license: new commercial `@caisson/agent-runner` vs fold into
  `@caisson/agent-dev`. **Rec:** separate package, `LicenseRef-Caisson-Commercial`,
  Agentic-Dev edition member.
- **F2** Provider config shape: provider-agnostic `{binary, baseUrlEnv, authEnv, model}`
  vs claude-CLI-specific. **Rec:** provider-agnostic (the source is z.ai/`claude`-specific
  — generalize on lift).
- **F5** SKU: fold into Agentic-Dev edition price vs standalone per-module SKU. **Rec:**
  edition-only fold (consistent with ADR-0137 edition-below-sum).

## Decoupling seams (from ADR-0133 §8, apply on lift)

`~/.gridwork/env` → credential resolver (injected); `gw-glm` run-dir default → caller-supplied
root; z.ai base-URL/model env → the `{baseUrlEnv, authEnv}` config; drop `gw`/`tg-bridge`
bindings entirely (not present in this core).

## Tasks (for PLAN)

1. Scaffold `packages/agent-runner` through `tooling/` standards gate (tsconfig/eslint/test);
   `manifest.ts` declaring Agentic-Dev membership; commercial `LICENSE`.
2. Port env-scrub (`buildEngineEnv`) + leak-guard test first (security core).
3. Port spawn/registry (`node:child_process`/`node:fs`, dependency-light) + jsonl parse.
4. Provider-agnostic config type + one worked provider profile.
5. `finalReport` structured summary + tests.
6. Register in `apps/agent-dev` demo composition; rebuild registry index.

## Verify (goal-backward)

- Leak-guard test: no `process.env` secret in child env — **must pass** (fail = block ship).
- `bun run check` green (turbo + standards gate).
- A demo `spawn` against a stub CLI returns a parsed `finalReport` with tool-calls +
  files-touched populated from the jsonl.
- Registry index rebuilt; membership resolves to Agentic-Dev.

## Effort: M (~1–2 days + tests). Value: HIGH.
