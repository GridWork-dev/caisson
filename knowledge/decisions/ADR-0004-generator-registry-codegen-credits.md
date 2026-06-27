# ADR-0004 — `create-stack` generator + versioned registry + codegen-credits

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Forge ships a **generator** (`packages/cli`, `create-stack`) over a **versioned module registry**
(`registry/`). The generator composes a tailored repo from the buyer's edition+module selection —
driven either by the CLI directly or **by the buyer's AI agent via the auth-gated MCP server**
(ADR-0008). This is the Option-C differentiation (Gate 3): the "AI production codebase starter"
where the buyer's agent assembles + configures the stack.

Each generation is a `generation` record + a **credit debit** (codegen-credits, ADR-0007) — the
metered monetization unique to Option C. The **registry is the single source** the CLI, the
buyer's agent, and the docs all read (one artifact, many consumers).

A module enters the registry **only through the `tooling/` standards gate + golden-file harness**
(ADR-0002) — the registry-publish flow is the one ingress. The internal authoring/validation
pipeline for modules is the **deferred dedicated session (D9)**; this ADR fixes the ingress
invariant + the credit meter, not that pipeline.

Rejected: shipping editions as static zips only (forecloses the agent-driven, metered generation
that is the whole Option-C thesis). An unversioned registry (breaks reproducible generation +
per-module changelogs).

Binding: generation always meters a credit debit; no registry write bypasses the standards gate.
