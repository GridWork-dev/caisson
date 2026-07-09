# Kickoff B — LIFT harvest buildout

**Worktree:** `~/lab/caisson-wt/lift-harvest` · **Branch:** `feat/lift-harvest` (off `main` @ go-live)
**Theme:** build new. Execute the **full remaining** ADR-0133 harvest program. **Operator note (2026-07-02):**
"full remaining harvest program bc a lot of it alr done" — so the FIRST act is a reconcile of built-vs-remaining,
then build only what's left. **Session model routing:** bounded package builds → **sonnet**; repo-scale
recon/synthesis → **opus**; grep/classify → **haiku**.

## Goal

Every item in the harvest program (`docs/state/harvest-program.md`) reaches a terminal state: **already-built**
(cited to the existing package), **built this session** (spec-gated → shipped), or **explicitly deferred**
(with a reason). Spec-first is binding: **no package code before its per-package SPEC is authored + locked**.

## Scope (source: `docs/state/harvest-program.md`, ADR-0133/0134/0135; agent-runner = ADR-0186)

**Act 0 — reconcile (do this first).** For each of the 11 Source-A gridwork-core targets, diff the harvest
intent against what already exists in `packages/`. Many already ship (ai-kit, ai-meter, local-ai, mcp-server,
guardrails, prompt-registry, observability, agent-dev all have dirs). Produce a **remaining-work table**:
per target → done / hardening-needed / not-started. The operator believes most is done — confirm precisely.

- **Source A — 11 gridwork-core packages → editions:** `agent-kernel` `agent-dev` `ai-config` `ai-evals`
  `guardrails` `observability` `ai-kit` `ai-meter` `prompt-registry` `local-ai` `mcp-server`.
- **agent-runner sellable (ADR-0186)** — the reserved Agentic-Dev member. SPEC already drafted:
  `outputs/specs/lift-phase/SPEC-agent-runner.md` (F1/F2/F5 boundary/config/pricing). This is the highest-value
  net-new build in the program.
- **Source B — Wardfile lift map** and **Source C — the 6-repo lift sweep** (`caisson-lift-sweep-REPORT.md`) —
  deduped into the ranked program. Take them in the program's ranked order.

## Flow (do NOT skip)

1. **Research/reconcile first** (Act 0 above) — the built-vs-remaining table is the session's spine.
2. **Ask the specific forks** via `AskUserQuestion` after recon — e.g.: the **ai-evals / guardrails asymmetry**
   (harden the existing AI-Kit modules ADR-0062/0063 vs seed new Agentic-Dev capability — flagged in
   harvest-program §A); agent-runner boundary/config/pricing (ADR-0186 F1/F2/F5); which Source-B/C lifts are
   in-scope for this wave. Do not auto-decide (the one operator rule).
3. **Spec-gate + build** each remaining lift — per-package SPEC → ADR lock → rebuild-clean (never a port; the
   pro-private `media-pipeline` firewall is binding — patterns only). Atomic commits.

## Verify / exit

Goal-backward vs the harvest program: every ranked item terminal (built/existing/deferred-with-reason); new
packages pass the standards gate + carry manifests + changesets. Tags per package (`ai`, edition tags).

## Pointers

`docs/state/harvest-program.md` (ranked program) · `outputs/specs/lift-phase/SPEC-agent-runner.md` +
`SLICE-PLAN.md` · ADR-0133/0134/0135/0186 · `docs/state/refactor-split-opportunities.md` · the pro-private
firewall + rebuild-clean rules in root `CLAUDE.md`.
