---
updated: 2026-07-17
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/decisions-and-forks.md
  - docs/deploy/STATE.md
---

# Operator walkthrough — every open operator act

The single checklist of everything that needs the operator's hands or call, ordered
roughly by leverage. Each row cites the board/ADR that owns it — this file routes a
walkthrough sitting; `docs/state/outstanding-work.md` stays the tracker of record.
Tick items here during a sitting, then true up the board.

A rendered standing synthesis of the whole live estate (fleet, surfaces, seams, gates,
plus this list) is the **Caisson — Live State** artifact:
<https://claude.ai/code/artifact/80d606b9-1465-4ba6-a52a-890ee6ba1857> — regenerated on
request; the repo owns truth, the artifact restates.

## Strategic (operator call, not a dashboard click)

- [ ] **W3 public flip** — HELD on business optics (2026-07-17 lock: wait for
      Mercury/Paddle maturity). All technical gates verified green; the 7-step firing
      checklist is `outputs/research/w3-flipgate-verification-2026-07-17.md`. Flipping
      makes caisson-oss public, arms npm delivery, and lands free native branch
      protection.
- [ ] **Production Paddle account** — checkout is sandbox end-to-end; the production
      account + live price ids are the remaining commerce gate. Pricing final numbers
      stay operator-adjustable until this lands (ADR-0012 anchors, ADR-0082 committed
      display).

## Deploy-arming acts (env flips on live services)

- [ ] **Arm the WORM anchor scheduler** — set `ANCHOR_CHECKPOINT_SCHEDULE`,
      `CAISSON_WORM_BUCKET`, `CAISSON_TSA_URL` on caisson-license (ADR-0346 DEPLOY act;
      ships inert today).
- [ ] **PostHog LLM-obs** — set `POSTHOG_CAPTURE_KEY` on the site + support-bot deploys
      to activate the shipped capture code (ADR-0356; deliberately dormant).

## Dashboard reads (2–5 minutes each; unblocks audit reruns)

- [ ] **OpenRouter** — regen the dead `OPENROUTER_MANAGEMENT_KEY` (M2); restores
      per-key usage reads.
- [ ] **Railway** — confirm Postgres backup recency on both DBs (main + admin).
- [ ] **Tailscale admin console** — review ACLs, node list, key expiry (box-side audit
      cannot read these; the binary itself is current at 1.98.9).
- [ ] **Arnica** — read current findings in the dashboard (email alerts wired; the
      finding list itself never reviewed).
- [ ] **Grafana Cloud org portal** — exact quota GB usage (org-admin-only page).
- [ ] **Blacksmith** — authoritative CI minutes (fork PF2-1; local estimates only).
- [ ] **1Password** — `op signin` + run the vault parity check (interactive; last
      parity exit 0 at the vault sweep).

## Design-tooling adoption residuals (2026-07-13 round, `outputs/research/design-reference-layer-2026-07-13.md`)

- [ ] **Stitch trial key** — provision `STITCH_API_KEY` (+ gw-core files
      `system/mcps/stitch.toml`); unblocks the half-day pricing-hero variant trial.
      superdesign stays gated on the Stitch verdict.
- [ ] **Recraft API key** — provision `RECRAFT_API_KEY` (PAYG ~$0.04/img) if the
      image lane is wanted; revisit at 30d telemetry.
- [ ] **FixAEO free scan** — ~5 min in a browser; external validation of the shipped
      llms.txt/robots/schema. Never pay (ADR-0254).

## Optional / time-gated

- [ ] **Paddle webhook secret rotation** (M3) — optional hardening; notification
      settings expose the secret inline.
- [ ] **DMARC aggregates** — in ~3–7 days, read the first reports at
      admin@gridwork.dev (the `caisson.sh._report._dmarc.gridwork.dev` authz record
      went live 2026-07-17; content arrives on receiver cadence).

## Closed 2026-07-17 (context for the sitting)

Tailscale 1.98.9 upgrade · DMARC external-report authorization (terraform,
`f45ab6bd`) · `--strict-digests` CI enforcement (PR 267) · caisson-oss build-check
healed · rotation fork resolved as accepted residual · intel findings freshness proven
against the live DB (77 findings, scheduler hot at ~14-min cadence).
