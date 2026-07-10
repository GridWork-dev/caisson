# ADR-0320 — Codex production browser audit lane

- **Status:** accepted
- **Date:** 2026-07-10
- **Decider:** operator (three-fork picker)
- **Grounds:** Exa-first OpenAI product research; official Browser and Computer Use documentation; Refero style/screen/flow research; `outputs/specs/codex-production-browser-audit/SPEC.md`

## Context

Caisson already has a deterministic Playwright visual harness, live buyer-flow tests, and an advisory design-critic ledger. Those tools capture known surfaces and pin stable behavior, but they do not provide an agent's user-goal reasoning, design judgment, exploratory recovery testing, or operator-facing design-fork synthesis against the real production product.

OpenAI's current Browser surface can navigate, click, type, screenshot, inspect rendered state, and use CDP. Current Computer Use examples use GPT-5.6; GPT-5.3-Codex-Spark is text-only and cannot be the primary visual auditor.

## Decisions

1. Build a repo-specific Codex-app skill, not a Responses API browser runner. Use helper scripts only for manifests, validation, evidence, and report reconciliation.
2. Use GPT-5.6 Browser/Computer Use for visual execution, with the fast service tier when available. Exclude Codex-Spark from visual verdicts.
3. Cover three rings: public product, authenticated buyer lifecycle, and the admin cockpit in a separately authorized operator session.
4. Permit full dedicated probe-account mutation only when every action has a predeclared compensator and cleanup assertion. Stop the ring on any failed or unprovable revert.
5. Keep real purchases, irreversible subscription/account changes, permission escalation, real-recipient communication, and non-probe mutations forbidden.
6. Keep the lane advisory. It may stage candidate scenarios, but only operator-approved, clean-session-reproduced findings may graduate into independently authored deterministic Playwright tests.

## Rejected options

- Build a Responses API `computer` runner now: it creates a second automation stack and overlaps the mature Playwright execution layer.
- Use GPT-5.3-Codex-Spark as the browser agent: its current text-only surface cannot inspect screenshots or operate Computer Use.
- Make the audit strictly read-only: it misses the state-transition and recovery behavior the dedicated probe account exists to test.
- Restrict the first version to public surfaces: it omits the buyer and admin workflows where empty, entitlement, mutation, and recovery states carry the highest product risk.
- Auto-promote findings into CI: model judgment and exploratory state are not deterministic regression oracles.

## Consequences

- Audit runs require the Codex desktop app, Browser/Computer Use, a dedicated probe browser profile, and a separately authorized admin profile.
- Production-state cleanup becomes part of the evidence contract, not an afterthought.
- The skill needs security, UI, and AI evaluation before ship.
- The Playwright visual harness and live tests remain independent and authoritative for deterministic coverage.

## Citations

- Spec: `outputs/specs/codex-production-browser-audit/SPEC.md`.
- OpenAI Browser: <https://developers.openai.com/codex/app/browser>.
- OpenAI Computer Use: <https://developers.openai.com/api/docs/guides/tools-computer-use>.
- Codex repo skills: <https://learn.chatgpt.com/docs/customization/overview#skills>.
- Existing visual harness: `apps/site/scripts/visual-harness.ts`.
- Existing design ledger: `tooling/design-critic/README.md`.
