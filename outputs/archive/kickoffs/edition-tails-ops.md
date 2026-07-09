# Kickoff C — Edition tails & ops hardening

**Worktree:** `~/lab/caisson-wt/edition-tails-ops` · **Branch:** `chore/edition-tails-ops` (off `main` @ go-live)
**Theme:** finish + operationalize what's built. **Session model routing:** bounded impl → **sonnet**;
recon/doc → **haiku**; observability/infra design → **opus**.

## Goal

Close the edition-completion tails and the ops/observability/CI hardening backlog. Each item ends
built-and-verified or deferred-with-reason. Nothing here is greenfield — it's finishing seams and
operationalizing the live fleet.

## Scope (source: `outputs/triage/2026-07-01-post-golive-triage.md` + Linear `CAISSON`)

**Edition tails**

- **CAISSON-4 [P1]** edition seam-completion follow-ups — OSCAL export polish + BYOK buyer + Bun-OTel spans (Linear: In Progress).
- **C5 [P2]** `local-ai` RentedTransport drivers — wire **Bedrock / Azure / Ollama** through the metered transport (ADR-0160).
- **CAISSON-2 [P2]** edition **members-fold** gated republish (`0.2.0`) to realize **ADR-0178**.
- **C2 [P3]** streaming test hygiene — ~80 LOC streaming-path coverage on `ai-kit` inference.

**Ops / observability / CI**

- **CAISSON-1 [P1]** **Grafana OTLP cutover** — repoint the 5 services off SigNoz to Grafana (ADR-0177 Grafana-sole-OTLP), verify, tear down SigNoz. **DEPLOY-class — coordinate with the operator before the cutover + teardown.**
- **CAISSON-3 [P2]** wire **support-bot escalations → Linear Triage** (inbound integration; `docs/state/linear-integration.md`).
- **Registry hardening [P2]** — set `registry-index` as a **required status check** + branch protection (tamper-prevention).
- **Terraform state [P2]** — move TF state to a **remote backend** (R2 + lock) before multi-operator.
- **D8(a) site UI [P3]** — migrate 3 FAQ pages to the `<Faq>` component + broaden `<Feature>`.

## Flow (do NOT skip)

1. **Research first** — confirm current state of each (e.g. is any CAISSON-4 sub-item already done? what does the Grafana cutover actually require vs the live SigNoz).
2. **Ask the specific forks** via `AskUserQuestion` — e.g.: Grafana cutover mechanics + teardown timing (DEPLOY-class); members-fold republish version + which editions; registry required-check rollout (does it block in-flight PRs?). Do not auto-decide (the one operator rule).
3. **Build** by priority (CAISSON-4 → C5 → CAISSON-1 ops → the rest). Atomic commits; DEPLOY-class steps stay operator-gated.

## Verify / exit

Goal-backward: each triage row closed or deferred-with-reason; Linear CAISSON-1/2/3/4 moved to their true state.
Tags: `infra` `observability` `frontend` `ai`. CAISSON-1 teardown is a separate operator-gated DEPLOY act.

## Pointers

`outputs/triage/2026-07-01-post-golive-triage.md` · `docs/state/linear-integration.md` · ADR-0177 (Grafana OTLP) ·
ADR-0178 (members-fold) · ADR-0160 (inference drivers) · `docs/state/decisions-and-forks.md`.
