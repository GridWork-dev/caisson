---
updated: 2026-07-08
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/launch-runbook.md
  - knowledge/decisions/ADR-0226-pre-launch-credential-sweep-locks.md
---

# Operator session runbook — 2026-07-08

The single ordered checklist of every operator-owed item that needs a human at a web UI /
login / value-handling step, compiled from the tracker §1, launch-runbook §1.1, and ADR-0226.
Run top to bottom in one sitting with the agent driving probes/parity between steps. **The
agent never sees a secret value** — every mint/paste/revoke is operator-only; the agent
handles names, probes, and Railway/GH variable _presence_ checks.

Scope line: this sitting covers rotations + vault + env hygiene + service config + sandbox
Paddle. The **Paddle PRODUCTION account/catalog** (launch-runbook §2) and the **CF-Access
`site_gate` + WORM COMPLIANCE flips** (launch-day acts, §3/P7) are separate acts — included
here only as pointers unless the picker says otherwise.

---

## Phase 1 — Credential rotations (ADR-0226 incident set; blocks the caisson-oss flip)

All three transited a chat/transcript (ADR-0226 Fork 4: on-incident rotation — this IS the
incident). Batch in one sitting. After each mint: value → `~/.gridwork/caisson.env` (or
`~/.gridwork/env` for the global one) + the 1Password vault item (Phase 2) + the consuming
service's Railway/GH variable; then the agent probes.

- [ ] **1.1 `OPENROUTER_API_KEY`** — openrouter.ai (one login, three acts):
  1. **Top up credits** (settings/credits — the account 402'd today; blocks PAL + embeddings).
  2. **Mint a fresh key** with a per-model spend cap; paste into `~/.gridwork/env`.
  3. **Revoke the leaked key.**
  - Consumers to update: `caisson-support-bot` Railway var; `aeo-probe` GH Actions secret
    (`gh secret set OPENROUTER_API_KEY` — sets Phase 4.4 up for free).
  - Agent probes: support-bot `/healthz`, one embed call, one PAL `listmodels`.
- [ ] **1.2 `DISCORD_TOKEN`** — Discord Developer Portal (one visit, three acts):
  1. **Regenerate the bot token** (minimal gateway intents); old token dies on regenerate.
  2. **Verify privileged intents** (Server Members + Message Content) are ON — P4 says
     verify, don't assume.
  3. In the guild: **generate a permanent invite URL** (Phase 4.1 consumes it).
  - Consumers: `caisson-support-bot` Railway var.
  - Agent probes: bot Online in guild; `SUPPORT_CHANNEL_ID`/`MEMBER_ROLE_ID` present.
- [ ] **1.3 `MIRROR_PUSH_TOKEN`** — github.com settings → fine-grained PATs:
  1. **Mint** scoped to `caisson-sh/caisson-oss` ONLY, **Contents: RW + Workflows: RW**
     (the Workflows permission is the missing one — `mirror-sync` has failed on every main
     push since 2026-07-04).
  2. `gh secret set MIRROR_PUSH_TOKEN` on `caisson-sh/caisson`.
  3. **Revoke the transcript-leaked PAT.**
  - Agent probes: re-run the failed `mirror-sync` workflow → green.

## Phase 2 — 1Password "Caisson Launch" vault (ADR-0226 Fork 3)

The vault is the durable recovery store; `~/.gridwork/caisson.env` stays the SOT (ADR-0224
F6). One item per env-var NAME, title === name, no grouped fields.

- [ ] **2.1** `op` CLI signed in (operator; the vault is the sanctioned caisson-launch
      exception to the no-1Password posture). Create the vault if absent.
- [ ] **2.2** Mirror every Phase-1 rotated value + any launch-set var not yet mirrored
      (operator pastes; titles must equal the env var names exactly).
- [ ] **2.3** Agent runs `bun tooling/scripts/vault-parity-check.ts` (names-only, read-only)
      → drive to exit 0: add missing items / delete extras / flag stale `updated_at`.

## Phase 3 — Env hygiene

- [ ] **3.1 Scrub superseded values from env backups** — after Phase 1, old
      `OPENROUTER_API_KEY`/`DISCORD_TOKEN` values linger in any `~/.gridwork/*.env.bak*`
      backups (the Cookiy key scrub 2026-07-07 set the precedent). Operator deletes/edits;
      agent greps names-only to confirm no stale-value files remain.
- [ ] **3.2 Greptile teardown** — org settings → uninstall the Greptile GitHub app from
      `caisson-sh`; drop `GREPTILE_API_KEY` from `~/.gridwork/caisson.env` (+ its vault item
      if one exists). Vendor retired 2026-07-06.
- [ ] **3.3 Railway env parity** — agent runs `bun tooling/scripts/railway-env-sync.ts`
      (names-only) across the 5 services; reconcile drift.

## Phase 4 — Service configuration (dashboard/API sets)

- [ ] **4.1 `NEXT_PUBLIC_DISCORD_INVITE_URL`** on `caisson-site` (value from 1.2.3);
      redeploy site; dashboard Community section renders.
- [ ] **4.2 `RESEND_API_KEY` on `caisson-license`** — agent checks presence (name-only);
      if absent, operator mints at resend.com → Railway var → redeploy; agent triggers one
      lifecycle email path to verify (sandbox purchase-confirmation).
- [ ] **4.3 E2E probe account** — operator creates a throwaway buyer account, clicks its ONE
      verification email, sets `CAISSON_E2E_ACCOUNT_EMAIL`/`CAISSON_E2E_ACCOUNT_PASSWORD` in
      `~/.gridwork/caisson.env`; agent runs the buyer-dashboard-flow live leg (self-skips
      today) → green.
- [ ] **4.4 `aeo-probe` GH Actions secrets** — `OPENROUTER_API_KEY` set in 1.1; optional:
      `POSTHOG_CAPTURE_KEY`/`POSTHOG_CAPTURE_HOST`, `DATAFORSEO_LOGIN`/`PASSWORD` (skip
      unless wanted — the monthly cron arms on the required one alone).
- [ ] **4.5 Plausible goals** — plausible.io dashboard: quickstart page-goal +
      `docs_cta_click` + `signup_complete` custom-event goals (code events already ship).
- [ ] **4.6 Paddle sandbox `adjustment.created`** — Paddle sandbox dashboard → the
      notification destination → subscribe `adjustment.created`; agent fires one simulated
      chargeback and verifies the ADR-0294 alert lands (first live delivery ever observed).

## Phase 5 — In-session decisions (no login, operator judgment)

- [ ] **5.1 EULA polish approval** — the five proposed edits in
      `outputs/specs/research-response/eula-continuity-polish-2026-07-08.md` (§365(n)
      successor language the highest-value). Approve/mark up → the clause ships with the
      pricing-terms rework.
- [ ] **5.2 `feat/comparison-pages` review** — one file, one verified fact; merge or discard.

## Phase 6 — Post-rotation gate (the payoff)

- [ ] **6.1** Agent runs the fresh-export **entitlement-token scan gate** against a clean
      mirror export.
- [ ] **6.2** With Phase 1 done + 6.1 green, the **`caisson-oss` public flip + first
      `confirm=publish` npm dispatch** unblocks (ADR-0222). Executing it is its own
      operator call — flip the repo public, run the manual dispatch, verify the `@caisson-sh`
      packages land on npmjs.

## Pointers only (separate acts, NOT this sitting unless re-scoped)

- **Paddle PRODUCTION** account verification + catalog recreation (`launch-runbook.md` §2;
  `tools/paddle-catalog-recreate.ts --execute` stays gated) — seller verification has
  Paddle-side lead time; start the verification submission early if desired.
- **CF-Access `site_gate` flip** + **WORM GOVERNANCE→COMPLIANCE** (`launch-runbook.md`
  §3 / P7) — launch-day acts, chained behind Paddle production.
- **D2/D3 pricing picker** — waits on the Cookiy quant legs maturing.
