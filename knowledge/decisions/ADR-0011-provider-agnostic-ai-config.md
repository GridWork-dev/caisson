# ADR-0011 — Provider-agnostic AI config + agent-assisted setup

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

The `ai-config` package (base) + the AI Production Kit provide **one configuration surface that
resolves any provider** — OpenAI, Anthropic, Gemini, OpenRouter, and local runtimes — plus a
**buyer settings file** (`forge.config.*`) for their own preferences (default model lanes, budgets,
BYOK). No provider is hardcoded anywhere; swapping providers is a config change, not a code change
(← gridwork's per-tenant model-router/BYOK + gridwork-core's capability→lane router, rebuilt clean).

The **agent-assisted setup** (the "coach, not wizard" the market lacks) reads/writes this config:
the bundled agent walks env/providers/DB/deploy interactively. This is both the onboarding UX
(P3) and a differentiator — every competitor leaves provider wiring as DIY.

Rejected: hardcoding a single provider (the #1 thing that makes AI boilerplates brittle + locks
buyers in). A config without a settings file (no place for BYOK/budget/lane preferences). Wizard-only
setup (the market's documented 2–4h-of-friction failure mode).

Binding: no package references a provider SDK directly — all inference routes through `ai-config`;
the agent-setup writes a valid config from the settings file; budgets/lanes are enforced via the
credit/circuit-breaker layer (ADR-0007).
