# ADR-0352 — Sandbox-demo PLAN-gate locks: preview contract, F2 coupling, F5 unit + riders

- **Date:** 2026-07-16
- **Status:** Accepted (operator-locked at the 2026-07-16 picker, two rounds)
- **Parent:** ADR-0350 (F1-F6 — unchanged; these are subordinate locks the adversarial
  round surfaced, none reopens F1-F6)
- **Research:** Codex `threat_model` dispatch (5 risks + 2 new forks, all 8 factual claims
  independently CONFIRMED by a verification agent) — recorded in
  `outputs/research/agent-runtime-options-expansion-2026-07-16.md` §sandbox.

## Factual correction (build-order rider satisfied)

ADR-0350's rider named the `create-caisson --demo` generator leg (ADR-0274 pt 1) as the
unbuilt dependency that "builds FIRST". **That leg already shipped 2026-07-07** — PR #143
(`15c50bd6`): `packages/cli/src/demo.ts` (`generateDemo`, watermarked commercial stubs,
full-catalog), wired end-to-end at `cli.ts` `--demo`. The PLAN budgets **zero** generator
tasks; the unbuilt program is 100% the web/job harness consuming the existing
`generateDemo()`. ADRs are append-only — this ADR records the correction; ADR-0350's fork
answers stand.

## Locks

### Preview contract (the fork ADR-0350's F1 one-liner hid)

**Per-request generated files + ONE shared prebuilt preview.** Each demo run generates the
visitor's files via `generateDemo()` **called in-process** (never the general CLI, never
`git init` subprocesses) and streams the file tree + generation output; alongside it the
page embeds one **shared, operator-prebuilt** demo-app preview (built through the normal
CI/deploy pipeline, not per visitor). Consequences accepted with the pick: the preview is
real but not the visitor's own artifact; the per-request path carries **no install, no
build, no network, no subprocess** — the default demo output's missing `start` script and
the demo path's inability to select the Next overlay (both verified) stop mattering.
The SPEC's "running/visible artifact <2 min" exit criterion is satisfied by files+stream
(visible, the visitor's own) plus the shared live preview (running); the PLAN restates it
in exactly those two halves.

### F2 coupling — "bundle" means one page, independent deploys

One combined buyer surface/launch; the (d) excerpts ship as **immutable static content
with their own deploy, feature flag, and rollback**. The F5 kill switch disables only
demo-run submission/preview — never the excerpt evidence. Excerpts additionally require:
an append-only excerpt manifest (exact paths, source commit, approving operator, license
posture) + secret/credential/internal-endpoint scanning on every excerpt before publish.

### F5 cap unit — run-count + concurrency, Postgres-shared, fail-closed

The hard daily cap meters **run count** plus queue depth plus global concurrency on a
**Postgres-shared counter**: atomic reserve at enqueue, re-check at worker dequeue, greyed
UI CTA when tripped. The eval-store `count-then-insert` pattern (verified racy by its own
comment) is **banned** for this cap; the stress-test exit criterion includes a concurrent
last-slot test proving only admissible requests enqueue.

## Binding riders on the PLAN

1. **Bot gate = fail-closed Turnstile at demo-run enqueue** (reuse the shipped
   `turnstile.ts` pattern from /api/ask). The F3 email stays telemetry/attribution ONLY —
   never a security principal or quota key. Per-IP/IPv6-prefix/session quotas ride
   `@caisson/rate-limit`'s PG account-store, not any in-memory throttle.
2. **Email normalization** reuses the registrable-domain (tldts) + disposable-domain
   predicates as **pure extracted functions** if shared — never a coupling from the
   sandbox to the license service.
3. **F6 restated honestly:** "no direct feature-code dependency" between the demo path and
   the eval-license leg (verified) — not "share no code" (both depend on
   `@caisson/registry-schema`).
4. **Shared-preview build discipline:** the prebuilt preview's install/build happens in
   CI/deploy with the standard pipeline (frozen lockfile; no visitor input reaches it);
   any future move to per-request install/build reopens the isolation fork by definition
   and requires a new ADR.

## Consequences

- The sandbox-demo PLAN decomposes immediately: (1) excerpt surface (own deploy/flag),
  (2) demo-run job (in-process generateDemo + streaming + TTL artifacts), (3) Turnstile +
  rate-limit + F5 PG counter + kill switch, (4) shared prebuilt preview, (5) ladder copy
  (F4) — with the abuse/cost stress test gating public exposure per the SPEC's exit
  criteria.
- Cookiy positioning study `019f57b1` recruitment: operator locked **stop at n=5** (same
  picker) — the interim synthesis (`outputs/research/cookiy-positioning-synthesis-2026-07-16.md`)
  is the final read for that study; its copy recommendations stay unlocked on the fork
  board.
