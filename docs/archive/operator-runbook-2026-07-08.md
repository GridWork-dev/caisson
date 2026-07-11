---
updated: 2026-07-11
status: archived
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

- [x] **1.1 `OPENROUTER_API_KEY` — per-service key split (re-planned 2026-07-08)**. Done already:
      credits topped up (+$60) and ALL old keys revoked (operator). Cost verdict from the log/telemetry
  analysis: the exhaustion was ~92 tracked frontier-model calls (PAL consensus/review lanes) at
  ~$0.81 avg over the audit-heavy week — embeddings were the call-count wall in the activity feed
      but pennies of spend. The docs service did re-embed its full corpus on every boot (fixed by the
      content-hash embed cache + caisson-docs Railway volume). Remaining act: **mint SIX named keys**
      at openrouter.ai → Keys, each with its own credit limit, so the next burn is attributable
      per-service in one glance:

  | key name              | limit | paste target                                                                                    |
  | --------------------- | ----- | ----------------------------------------------------------------------------------------------- |
  | `gw-box`              | $50   | `~/.gridwork/env` `OPENROUTER_API_KEY` (PAL, gw memory, dream, graphify)                        |
  | `caisson-docs`        | $5    | Railway → caisson-docs → `OPENROUTER_API_KEY`                                                   |
  | `caisson-support-bot` | $10   | Railway → caisson-support-bot → `OPENROUTER_API_KEY`                                            |
  | `caisson-site-ask`    | $10   | Railway → caisson-site → `OPENROUTER_API_KEY` (verify/add — ask-ai shipped after the last sync) |
  | `caisson-intel`       | $5    | `services/intel/.env`, then `docker compose up -d` in `services/intel`                          |
  | `caisson-aeo-probe`   | $5    | `gh secret set OPENROUTER_API_KEY` on `caisson-sh/caisson` (covers Phase 4.4 leg 1)             |
  - Agent probes after paste: support-bot `/healthz`, one docs `/query` (embed path), PAL
    `listmodels`, site ask route.
  - **DONE 2026-07-08:** six keys minted + propagated (Railway ×3, box env, intel `.env` +
    recreate, GH secret) — all six verified live against the OpenRouter key endpoint. The
    PAL MCP picks up the box key at next session start. **Resolved WONTFIX:** no per-key
    credit limit was set at mint (`limit=null` on all six) — the operator explicitly
    **waived** per-key caps 2026-07-08 (uncapped keys accepted; attribution, not caps, was
    the goal of the split — see `docs/deploy/STATE.md`'s 2026-07-08 entry). Not an open ask.

- [x] **1.2 `DISCORD_TOKEN`** — Discord Developer Portal (one visit, three acts) —
      **DONE 2026-07-08** via the vault flow: token regenerated + propagated, support-bot
      redeployed SUCCESS; invite URL captured (4.1 consumed it same pass):
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

Re-planned 2026-07-08: the agent DRIVES the vault via the `op` CLI (values flow env-file → op
inside the fill script's process; the agent's output stays names-only). The operator's only
manual step is the signin.

- [x] **2.1** Operator, in his own terminal (session token lands in a root-600 file, never in
      the conversation): `op signin --raw | install -m 600 /dev/stdin ~/.config/op/.gw-session`
      — DONE (note: the CLI session idles out at 30 min; re-run the same one-liner when a
      later phase needs the vault again).
- [x] **2.2** (DONE 2026-07-08 — vault created; full fill ran twice: placeholder pass, then
      the post-rotation realign; per-service `OPENROUTER_API_KEY` names are collision-prefixed
      by the sync tool, with the 6-field master item kept as `non-env`.)
      Agent: `op vault create "Caisson Launch"` → refresh the mirror
      (`bun tooling/scripts/railway-env-sync.ts`) → run the vault-fill script: one item per
      env NAME (title === name), one concealed field per service section (the per-service
      separation), tags = sections. `ROTATE-ME-2026-07-08` placeholders for the rotate-pending
      set (OPENROUTER_API_KEY per-service fields, DISCORD_TOKEN, MIRROR_PUSH_TOKEN, the E2E
      account pair) — GH-only/pre-provisioning items tagged `non-env` (excluded from the parity
      diff by the tag exemption). After Phase-1 rotations land: re-sync + re-run the fill to
      replace placeholders with real values (create-only seeding never clobbers pasted fields).
- [x] **2.3** Agent runs `bun tooling/scripts/vault-parity-check.ts` (names-only, read-only)
      → drive to exit 0: add missing items / delete extras / flag stale `updated_at`.
      **DONE 2026-07-08: exit 0** with `--rotated-after 2026-07-08` — 126 env names agree,
      7 legitimate non-env exclusions printed by title.

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

- [x] **4.1 `NEXT_PUBLIC_DISCORD_INVITE_URL`** on `caisson-site` (value from 1.2.3);
      redeploy site; dashboard Community section renders. **DONE 2026-07-08** (var set +
      site redeployed SUCCESS; eyeball the dashboard Community section at next login).
- [ ] **4.2 `RESEND_API_KEY` on `caisson-license`** — agent checks presence (name-only);
      if absent, operator mints at resend.com → Railway var → redeploy; agent triggers one
      lifecycle email path to verify (sandbox purchase-confirmation).
- [ ] **4.3 E2E probe account** — operator creates a throwaway buyer account, clicks its ONE
      verification email, sets `CAISSON_E2E_ACCOUNT_EMAIL`/`CAISSON_E2E_ACCOUNT_PASSWORD` in
      `~/.gridwork/caisson.env`; agent runs the buyer-dashboard-flow live leg (self-skips
      today) → green.
- [x] **4.4 (DONE 2026-07-08 — all five secrets set: OPENROUTER_API_KEY, POSTHOG_CAPTURE_KEY/HOST,
      DATAFORSEO_LOGIN/PASSWORD)** `aeo-probe` GH Actions secrets — ALL legs (picker 2026-07-08) —
      `OPENROUTER_API_KEY` set in 1.1, plus `POSTHOG_CAPTURE_KEY`/`POSTHOG_CAPTURE_HOST`
      (the caisson-prod project's capture key) and `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`
      (needs a DataForSEO account — create/login at dataforseo.com if none exists).
- [ ] **4.5 Plausible goals** — plausible.io dashboard: quickstart page-goal +
      `docs_cta_click` + `signup_complete` custom-event goals (code events already ship).
- [ ] **4.6 Paddle sandbox `adjustment.created`** — Paddle sandbox dashboard → the
      notification destination → subscribe `adjustment.created`; agent fires one simulated
      chargeback and verifies the ADR-0294 alert lands (first live delivery ever observed).

## Phase 5 — In-session decisions (no login, operator judgment)

- [ ] **5.1 EULA polish approval** — the five proposed edits in
      `outputs/archive/specs/research-response/eula-continuity-polish-2026-07-08.md` (§365(n)
      successor language the highest-value). Approve/mark up → the clause ships with the
      pricing-terms rework.
- [ ] **5.2 `feat/comparison-pages` review** — one file, one verified fact; merge or discard.

## Phase 6 — Post-rotation gate (the payoff)

- [ ] **6.1** Agent runs the fresh-export **entitlement-token scan gate** against a clean
      mirror export.
- [ ] **6.2** With Phase 1 done + 6.1 green, record the **`caisson-oss` public flip + first
      `confirm=publish` npm dispatch** as UNBLOCKED (ADR-0222) — but do NOT execute it this
      sitting (picker 2026-07-08: held for its own deliberate sitting; the flip is externally
      visible and effectively irreversible).

## Pointers only (separate acts, NOT this sitting unless re-scoped)

- **Paddle PRODUCTION** account verification + catalog recreation (`launch-runbook.md` §2;
  `tools/paddle-catalog-recreate.ts --execute` stays gated) — seller verification has
  Paddle-side lead time; start the verification submission early if desired.
- **CF-Access `site_gate` flip** + **WORM GOVERNANCE→COMPLIANCE** (`launch-runbook.md`
  §3 / P7) — launch-day acts, chained behind Paddle production.
- **D2/D3 pricing picker** — waits on the Cookiy quant legs maturing.
