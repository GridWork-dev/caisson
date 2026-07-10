# ADR-0317 — 1Password "Caisson Launch" is the primary secret SoT (amends ADR-0224 F6)

**Status:** accepted · 2026-07-10 (close-out follow-up, cred-parity sweep). **Tags:** `secrets`,
`external-system`. Flips the secret source-of-truth and records the parity+validation result.

## Context

ADR-0224 F6 made `~/.gridwork/caisson.env` the canonical secret store and the 1Password
"Caisson Launch" vault a recovery mirror. The operator reframed this 2026-07-10: **1Password is now
the primary secret SoT**; local (`caisson.env`) and Railway service env are derived copies. The
motivation is a single durable, access-controlled home for every credential ahead of launch, rather
than a box-local file being canonical.

## Decision

1. **op "Caisson Launch" is the primary secret SoT.** One item per env-var NAME (title === name),
   per-service concealed fields where a name carries different values per service (the
   `OPENROUTER_API_KEY` item holds all six: `caisson-docs`/`caisson-site`/`caisson-support-bot`/
   `gw-box`/`caisson-intel`/`aeo-probe`). `caisson.env` and Railway env are derived; on conflict,
   op wins.
2. **Parity is the invariant.** `tooling/scripts/vault-parity-check.ts` gates name-parity between
   `caisson.env` and the vault; the 2026-07-10 sweep also reconciled Railway-only names. A new
   credential lands in op first, then propagates to `caisson.env` (local) and the owning Railway
   service.
3. **CI secrets stay in gh** (`MIRROR_PUSH_TOKEN`, `SEMGREP_APP_TOKEN`, `OPENROUTER_API_KEY`, `R2_*`,
   etc.) — GitHub Actions can't read op — but their values are mirrored into op so op remains the
   complete recovery set. gh is a derived consumer, not a second SoT.

## The 2026-07-10 parity result (recorded)

- Vault: 135 → **147 items**. Created 7 real caisson.env gaps (BetterStack ×2, Discord ops/proof ×3,
  license/paddle proof ×2) + 5 Railway config values (abandoned-checkout ×3, docs-embed deadline,
  support channel id). E2E account creds already present.
- Railway-vs-vault: full parity — every per-service secret already in the vault, including the six
  per-service OpenRouter keys as concealed fields on one item.
- **Live validation (status-only probes, keys never printed):** Paddle (sandbox) · Resend · Linear ·
  Discord bot · OpenRouter · BetterStack · PostHog capture (`phc_` ingest) all 200; Cloudflare token
  valid (account-owned `cfat_`, `wrangler whoami`-verified — `/user/tokens/verify` 401s by design for
  account tokens). `SEMGREP_APP_TOKEN` set in gh from the local `semgrep login` token (arms the
  dormant `semgrep-pro` CI leg).

## Consequences

- The write-router in gridwork-core `identity/retrieval.md` (secrets → `~/.gridwork/env` only) is
  unchanged for the _operator/agent local_ layer; this ADR governs the _caisson product_ credential
  set specifically, where op is now canonical.
- Rotations start in op, then propagate — the parity tool flags any drift.
- No secret value is ever committed, logged, or printed; this ADR and the runbook
  (`docs/state/provider-key-setup-2026-07-10.md`) hold names + navigation only.

## Still open (operator go-live acts, not this ADR)

Paddle PRODUCTION account + live prices · `registry.caisson.sh` publish flip (dormant behind
`CAISSON_PUBLISH_DRY_RUN=true`) · Plausible dashboard goals · Linear Business plan · the new
`MIRROR_PUSH_TOKEN` (fine-grained, Contents+Workflows) once the operator sets it.
