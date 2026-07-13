---
phase: codex-production-browser-audit
project: caisson
created: 2026-07-10
status: accepted
tags: [ai, ui, frontend, auth, security, external-system]
---

# Goal

Give Caisson a reusable Codex Browser playbook that audits the real production product with grounded design judgment and reversible probe-account behavior, while keeping deterministic Playwright coverage independent.

## Acceptance Criteria

1. A repo-specific Codex skill under `.agents/skills/` can drive a production audit from the Codex app and explicitly selects GPT-5.6 Browser/Computer Use for visual interaction; GPT-5.3-Codex-Spark is excluded as the primary auditor because it is text-only.
2. Every run begins with current Exa research, then locks Refero styles, screens, and flows appropriate to the selected surfaces before applying Caisson's `PRODUCT.md`, `DESIGN.md`, and Impeccable principles.
3. The audit covers three rings: public marketing/docs/marketplace, the authenticated buyer lifecycle, and the admin cockpit in a separately authorized operator browser session.
4. The buyer ring may exercise any dedicated probe-account mutation only when the run manifest names its precondition, expected state transition, compensating action, and cleanup proof before execution.
5. Purchases, irreversible subscription changes, account deletion, identity/email/password changes, permission escalation, messages to real recipients, and mutations outside designated synthetic fixtures remain denied even when the probe account is authenticated.
6. A failed or unprovable compensating action stops the active ring, records a cleanup-blocking P0 finding, and prevents later mutations from running against that state.
7. Every finding carries reproducible evidence: ring, journey, production URL, viewport, theme, auth state, steps, screenshots, observed and expected state, console/network evidence where relevant, design-rule source, severity, confidence, and clean-session replay result.
8. Design findings are evaluated against a reference lock and the Impeccable/Caisson rules; behavioral findings prove user-visible state transitions, recovery, accessibility, responsive behavior, and negative/error paths rather than treating screenshot similarity as correctness.
9. The Codex audit is advisory and never gates CI directly; only an operator-approved finding that reproduces from a clean session may be promoted into a separately authored deterministic Playwright test.
10. The skill produces a dated evidence bundle, an audit report, a mutation/revert journal, design forks for the operator picker, and candidate deterministic tests without changing production code or committing automatically.

## Context

- Picker lock: operator selected Codex-app playbook, full probe-account mutation with reverts, and three-ring coverage on 2026-07-10; recorded in `knowledge/decisions/ADR-0322-codex-production-browser-audit.md`.
- Existing deterministic capture: `apps/site/scripts/visual-harness.ts` already covers route screenshots, interaction states, the buyer probe account, and production CF Access headers.
- Existing advisory ledger: `tooling/design-critic/README.md` and `tooling/design-critic/findings.toml` preserve design findings without gating merges.
- Existing live behavior proof: `apps/site/live/buyer-dashboard-flow.live.test.ts` and `apps/site/live/probe-session.ts` own deterministic buyer-session assertions.
- Product/design authority: `PRODUCT.md`, `DESIGN.md`, `specs/03-design-framework.md`, and `specs/04-voice-and-brand.md`.
- OpenAI Browser guidance: <https://developers.openai.com/codex/app/browser>.
- OpenAI Computer Use guidance: <https://developers.openai.com/api/docs/guides/tools-computer-use>.
- Codex repo skills: <https://learn.chatgpt.com/docs/customization/overview#skills>.

## Scope

- **In scope:** a repo-local Codex skill; Exa/Refero/Impeccable grounding; three-ring surface and journey manifests; safe production authentication guidance; mutation/revert contracts; evidence/report schemas; design and behavior rubrics; clean-session replay; operator picker output; candidate-test graduation rules; local validation scripts and tests.
- **Out of scope:** replacing or invoking the Playwright visual harness as the audit engine; adding a Responses API computer-use runner; automatically writing Playwright tests into CI; real purchases; destructive production actions; background deployment; changing the production site during an audit; packaging the skill as a distributable plugin.

## Locked approach

### Execution surface

Use a repo-specific Codex skill at `.agents/skills/caisson-production-browser-audit/`. The skill invokes the Codex app's built-in Browser for public surfaces and a dedicated, separately authorized Chrome/Computer Use session for authenticated buyer and admin rings. Helper scripts may prepare manifests, validate evidence, and reconcile reports, but they do not implement a second browser driver.

### Model route

Use GPT-5.6 for the visual agent and enable the fast service tier when the current Codex surface offers it. Do not route screenshot judgment or Computer Use to GPT-5.3-Codex-Spark. Spark may assist later text-only report cleanup, but no visual verdict may depend on it.

### Research order

1. Query Exa for current product/category and browser-testing evidence.
2. Use Refero styles to establish visual direction, screens for concrete product patterns, and flows for journey sequencing.
3. Write a reference lock and decision ledger.
4. Read `PRODUCT.md`, `DESIGN.md`, and the relevant Impeccable register/rubric.
5. Audit production; never infer production state from repository code alone.

### Three rings

1. **Ring 1 — public:** marketing, docs, marketplace, comparison, glossary, legal, authentication entry points, responsive navigation, search, and cart discovery.
2. **Ring 2 — buyer:** probe-account login, dashboard, cart, plan/license/credits/invoices/activity/members/AI-key and compliance surfaces, including reversible mutations.
3. **Ring 3 — admin:** the operator-authorized admin cockpit, including empty/error/loading states, logs, commerce, product, fleet, support, and intel-triage. Read-only is the default; a mutation is allowed only against an explicitly synthetic fixture with a proven compensator and an operator-approved allowlist.

### Mutation and reversion contract

Before any mutation, the run manifest must contain:

- the exact probe or synthetic-fixture owner;
- a state snapshot sufficient to restore the prior state;
- the action and expected visible/system state transition;
- the compensating action;
- the cleanup assertion;
- a stop condition when cleanup fails.

The agent records `planned → applied → observed → reverted → verified`. It may not begin the next mutation until `verified`. Mutations without a complete compensator are observations only.

### Evidence and verdicts

- Capture before/action/after/revert screenshots at original detail.
- Use CDP only when needed for DOM, applied styles, console, network, accessibility, or performance evidence; never treat CDP access as permission to widen the task.
- Re-drive each alleged P0/P1 behavior failure from a clean session once; run three independent replays in exhaustive mode.
- Mark blocked and unreachable states honestly. A later step behind a failed prerequisite has no coverage.
- Separate `design`, `behavior`, `accessibility`, `performance`, `content`, and `security-boundary` findings.

### Graduation into deterministic coverage

The Codex audit may stage a candidate scenario, never a CI-ready test. Promotion requires operator acceptance, a clean-session replay, a deterministic fixture, stable selectors/assertions, no model judgment in the oracle, and an independently reviewed Playwright implementation. The existing Playwright and live-test suites remain the sole deterministic behavior gate.

## Behavioral and full-testing principles

1. **Start from a user goal.** A route rendering is not a journey passing.
2. **Prove state transitions.** Record the visible state and the relevant network/DOM signal before and after an action.
3. **Exercise recovery.** Test cancellation, back navigation, invalid input, retry, empty state, loading state, and degraded dependencies.
4. **Test the boundaries.** Cover signed-out/signed-in, entitled/unentitled, empty/populated, mobile/desktop, light/dark, keyboard/pointer, reduced motion, and slow/failing network where safely reproducible.
5. **Treat accessibility as behavior.** Verify focus order, names/roles, keyboard completion, focus return, contrast, touch targets, and non-color status communication.
6. **Treat copy as an interface contract.** Labels describe the next action; errors explain recovery; commercial and compliance claims remain true-to-built.
7. **Keep the oracle observable.** Findings cite what a user or browser can observe, not private implementation preference.
8. **Fail closed on production state.** Unknown identity, stale authentication, missing cleanup proof, or an unexpected external handoff stops mutation.
9. **Separate discovery from regression.** Agent judgment discovers and explains; deterministic tests pin stable behavior after approval.
10. **Prefer evidence over volume.** One replayable journey with before/after/revert proof outweighs a hundred unverified screenshots.

## Tag rationale

- `ai`: the deliverable is a reusable model-driven audit workflow and requires an eval before ship.
- `ui` / `frontend`: the workflow judges rendered product surfaces and must receive UI review.
- `auth`: buyer and admin rings use authenticated production sessions.
- `security`: the workflow controls production mutations, credentials, CDP access, and prompt-injection exposure.
- `external-system`: the audit acts against caisson.sh, its auth boundary, and linked provider surfaces.
