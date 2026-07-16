# Agent-runtime read-only audit — 2026-07-15

- **Provenance:** operator-supplied read-only audit (external session), pasted into the
  2026-07-15 reconcile session and integrated here verbatim-in-substance. No files were
  changed by the audit itself.
- **Status:** research input to Fork AR-1 (`docs/state/decisions-and-forks.md`) — the
  agent-runtime expansion direction. NOT a lock; the operator picks the direction.

## Executive verdict

Caisson already has a substantial AI production platform and an agent-development substrate.
Its strongest differentiation is not "agents" by themselves — it is **governed AI execution**:
metering, credit enforcement, prompt versioning, guardrails, evaluations, audit provenance,
isolated execution, and local-first retrieval.

The missing middle is a cohesive agent runtime:

```text
Strong production primitives
        ↓
Missing integrated run/step/tool/approval/checkpoint layer
        ↓
Existing CLI, MCP, product assistants, watchers, and harness emitters
```

The best opportunity is to connect the existing pieces, not introduce another broad framework.

## What exists today

| Layer                        | Capabilities                                                                                                                                                                                 | Assessment                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI production core           | Provider-agnostic configuration; metered text, streaming, and embeddings; reserve-before-call accounting; append-only prompts; PII/secret/claim guards; deterministic and model-graded evals | Strong and unusually complete. Fixed gateway `resolve → render → guard → reserve → provider → usage → guard → reconcile` (`packages/ai-kit/README.md:18`), backed by `packages/ai-meter/README.md:11`, `packages/guardrails/README.md:14`, `packages/ai-evals/README.md:14`. |
| Agent substrate              | Typed agent/skill/rule artifacts, seven-act lifecycle FSM, governance hooks, isolated CLI runner, local memory, governed command execution, multi-harness emitter                            | Good substrate, partial runtime. The kernel explicitly does not run an LLM (`packages/agent-kernel/README.md:15`); the live runner is re-exported but not composed into Agentic-Dev (`packages/agent-dev/src/index.ts:35`).                                                  |
| Agent delivery               | Generates Claude, AGENTS.md, Cursor, Devin/Windsurf, Copilot, and Cline instruction surfaces from one schema                                                                                 | Strong portability feature (`packages/agent-dev/src/emitter.ts:4`).                                                                                                                                                                                                          |
| Buyer-facing AI              | Site Ask AI, documentation RAG, Discord/Slack support bot, MCP setup coach                                                                                                                   | Shipped, guarded, grounded. Ask AI: Turnstile, spend reservation, retrieval-only grounding, citations, fail-safe escalation (`apps/site/lib/ask-ai/handler.ts:191`); support uses the central docs corpus (`services/support-bot/README.md:4`).                              |
| Operational intelligence     | Compliance, SOC 2, competitor, GitHub, analytics, and error watchers; optional LLM enrichment; Linear/Telegram outputs                                                                       | Real automation, deterministic-first (`services/intel/README.md:7`).                                                                                                                                                                                                         |
| Market/visibility automation | Monthly 18-question citation probe across three OpenRouter-routed engines, optional Google AI Overview checks, PostHog capture                                                               | Differentiated GTM automation, not an agent runtime (`.github/workflows/aeo-probe.yml:3`).                                                                                                                                                                                   |
| Delivery pipelines           | 11 workflows: CI, deterministic quality, security scans, support evals, version PRs, immutable publishing, release train, Railway deployment, Lighthouse, AEO                                | Broad and mature release automation.                                                                                                                                                                                                                                         |

Agentic-Dev defaults today: 3 agents (`code-reviewer`, `security-auditor`, `test-author` —
`packages/agent-dev/src/content/agents.ts:13`), 3 skills (`spec-first`, `guided-execution`,
`goal-backward-verify` — `content/skills.ts:13`), 4 rules (`content/rules.ts:12`). The repo's
42 `AGENTS.md` files include contracts, templates, and goldens — not 42 executable agents.

## Where the platform stops

- `ai-kit` owns `generateText`/`streamText` but has no tool-loop agent.
- `agent-kernel` governs lifecycle transitions but performs no model execution.
- `agent-runner` executes one isolated headless CLI process; multi-agent orchestration, hosted
  run UI, SDK backends, and cost metering are explicitly deferred (`packages/agent-runner/AGENTS.md:45`).
- `agent-dev` does not wire a live runner into its composition.
- No common durable model for `run → step → model call → tool proposal → approval → tool result → checkpoint`.
- Runner usage is not wired into `ai-meter`.
- `ai-evals` evaluates outputs and recorded judges — not trajectories, tool selection, handoffs,
  or approval behavior.
- `SkillArtifact` is metadata plus a string step array (`packages/agent-kernel/src/schema.ts:92`);
  it cannot package scripts, references, assets, compatibility, or structured outputs.
- MCP exposes 3 base tools + 4 optional setup-coach tools (`packages/mcp-server/src/server.ts:338`,
  `src/coach.ts:192`) — no resources, prompts, elicitation, async tasks, or run progress.
- Internal AI accounting is fragmented across ai-kit, site Ask AI, support, intel, AEO, and the
  runner rather than sharing one trajectory + cost schema.
- Matches the repo's own classification: AI Production and Agentic-Dev remain "partial" with
  transport/runtime seams intentionally open (`docs/build-state.md:211`).

## External patterns (exa-researched, primary docs)

- **Vercel AI SDK v7**: `ToolLoopAgent`, bounded multi-step execution, `stopWhen`, `prepareStep`,
  runtime context, tool-approval patterns — lowest-friction loop engine since ai-kit already
  isolates AI SDK usage. (ai-sdk.dev/v7/docs/agents/building-agents · /agents/loop-control)
- **Trigger.dev**: durable AI sessions, checkpoint recovery, human-in-the-loop pauses, subagents;
  caisson already has a Trigger.dev job adapter — prove installed-version compatibility before
  adopting newer APIs. (trigger.dev/docs/ai-chat/overview · /patterns/human-in-the-loop)
- **Agent Skills spec**: SKILL.md + scripts, references, assets, compatibility, licensing,
  metadata, allowed tools — materially richer than caisson's SkillArtifact. (agentskills.io/specification.md)
- **MCP**: elicitation + experimental async tasks fit approvals/long jobs, but client support is
  uneven. (modelcontextprotocol.io 2025-06-18 elicitation · 2025-11-25 tasks)
- **OTel GenAI conventions**: agent/workflow/planning/tool-execution spans — mapping target,
  still marked development.
- **LangGraph**: mature checkpointing/threads/time-travel/interrupts — credible only if arbitrary
  graph composition becomes a product requirement; today it overlaps kernel + jobs.

## Options (Fork AR-1)

1. **Compose a governed single-agent runtime (audit-recommended).** One run/step/approval/usage
   event contract; AI SDK v7 bounded tool loops; adapt `tool-exec`; every model/tool step charged
   through `ai-meter`; durable checkpoints + human approval on the existing jobs port. Largest
   cross-package change; security-sensitive state/retry/approval contracts.
2. **Expand portable skills first.** Bring `SkillArtifact` to the Agent Skills directory model
   (scripts, references, assets, compatibility, permissions, structured IO, validation, golden
   emitter coverage). Sellable/portable quickly; leaves execution/durability/metering external.
3. **Productize vertical automations first.** Reference agents for compliance evidence, repo
   review, docs support, intel monitoring on current primitives. Buyer-visible sooner; risks
   duplicating orchestration/telemetry/approval logic per vertical.
4. **Lead with MCP interoperability.** Resources, prompts, docs retrieval, approval elicitation,
   run status/progress, async tasks on the MCP server. Client support uneven; still needs a
   durable executor behind it.

## Recommended implementation order (option 1, if locked)

1. Append-only trajectory schema: runs, steps, calls, tool proposals, approvals, results, usage, checkpoints.
2. Instrument the existing CLI runner + ai-kit against it BEFORE adding another executor.
3. Bounded AI SDK v7 tool loop with tool-exec, guardrails, prompt registry, per-step metering.
4. Durable pause/resume through the existing jobs port (Trigger.dev as one adapter).
5. Extend evals: tool choice, unnecessary calls, approval compliance, budget adherence, final output.
6. Same runtime through CLI and MCP.
7. Subagents only after single-agent cancellation/retries/metering/replay are proven.

Do NOT turn the seven-act lifecycle FSM into the execution graph — keep it the governance
wrapper. Avoid LangGraph/A2A until a locked requirement demands arbitrary graphs or cross-vendor
remote-agent collaboration.

Audit note: local `graphify-out/graph.json` was absent and the live graphify instance targets
gridwork-core; the audit used targeted repo-wide search + direct source inspection.
