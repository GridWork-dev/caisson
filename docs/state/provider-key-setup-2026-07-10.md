---
updated: 2026-07-10
status: live
grounds:
  - docs/state/providers.md
  - knowledge/decisions/ADR-0224-live-verification-harness.md
  - knowledge/decisions/ADR-0315-close-out-triage-locks.md
---

# Provider key setup + parity runbook — 2026-07-10

Two jobs in one doc: (A) the four immediate operator setup acts from the close-out picker, and
(B) the full **secret-parity consolidation** — flip 1Password "Caisson Launch" from a recovery
mirror to the **primary secret SoT**, then bring local (`~/.gridwork/caisson.env`) ↔ Railway
per-service ↔ op into full name+value parity, every value present and probe-verified. Part C is the
live per-provider retrieval walkthrough (exa-researched 2026-07-10, workflow `wf_cfc82898-7ee`) for
any value that has to come fresh from a provider dashboard. **This doc holds NO secret values — only
env-var NAMES and dashboard navigation.**

**SoT reframe (records a decision):** ADR-0224 F6 made `caisson.env` canonical and op the mirror.
The operator flipped this 2026-07-10 — **op is the primary secret store**; local + Railway are
derived. To be recorded as an ADR once parity lands (this doc is the working runbook, not the lock).

## Homes (current)

| Home                       | Holds                                                                                            | Count        |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------ |
| `~/.gridwork/caisson.env`  | app-runtime (Paddle/Resend/PostHog/Linear/Discord/Grafana/AWS/Turnstile/better-auth/DB)          | 137 names    |
| `~/.gridwork/env` (global) | CLI/MCP (`CLOUDFLARE_*`, `EXA_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `RESEND_API_KEY`)        | overlap      |
| gh repo secrets            | CI-only (`MIRROR_PUSH_TOKEN`, `OPENROUTER_API_KEY`, `POSTHOG_CAPTURE_*`, `R2_*`, `CLOUDFLARE_*`) | 11           |
| Railway service env        | deployed runtime copies (OpenRouter six + `TRIGGER_SECRET_KEY` live ONLY here)                   | per-service  |
| 1Password "Caisson Launch" | **new primary SoT** (was recovery mirror)                                                        | to reconcile |

**Known gaps before the vault diff:** OpenRouter's six per-service keys and `TRIGGER_SECRET_KEY`
are Railway-only; Semgrep/Renovate/rotated-mirror are net-new.

---

## Part A — four immediate operator acts

### A1. Security stack install

```bash
cd /home/gw/lab/caisson && tools/security/install.sh
```

No sudo for the core (uv tools + `~/.local/bin`: semgrep/trivy/trufflehog/osv-scanner/nuclei/ptai

- HexStrike framework). Prompts for `sudo pacman` ONLY for offensive binaries — skippable. Verify:
  `tools/security/scan.sh --layer ci` (`SEMGREP_JOBS=1` if semgrep hits io_uring). `uv` present
  (0.11.18); semgrep already installed (1.168.0).

### A2. Semgrep free token → `SEMGREP_APP_TOKEN`

Free tier includes cross-file Pro-rule analysis (10 contributors / 10 private repos) — the token,
not a paid plan, flips CI to Pro. Fastest: `semgrep login` (browser → `~/.semgrep/settings.yml`).
Dashboard: semgrep.dev → Settings → Tokens → Create, scope **Agent/CI**. Then:

```bash
gh secret set SEMGREP_APP_TOKEN --repo caisson-sh/caisson
```

### A3. Renovate (digest pins, ADR-0315)

Install github.com/apps/renovate → **Only select repositories** → org `caisson-sh` → repo
`caisson`. It opens a "Configure Renovate" onboarding PR; the digest-only `renovate.json` lands with
the ADR-0315 scan-triage execution (you just install):

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["docker:pinDigests"],
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchUpdateTypes": ["major", "minor", "patch"],
      "enabled": false
    }
  ]
}
```

### A4. Mirror PAT rotate

The current `MIRROR_PUSH_TOKEN` lacks **Workflows** → the sync 403s on `.github/workflows/ci.yml`.
New fine-grained token: github.com/settings/personal-access-tokens/new → resource owner
**`caisson-sh`** → **Only select → `caisson-oss`** → **Contents = Read and write**, **Workflows =
Read and write** (nothing else). Org may require owner approval (org Settings → Personal access
tokens → Pending requests). Set in both:

```bash
gh secret set MIRROR_PUSH_TOKEN --repo caisson-sh/caisson    # + op item edit (Part B)
```

---

## Part B — parity consolidation (op-driven; needs the op session)

Operator, separate terminal (account shorthand `my`):

```bash
op signin --account my --raw > /tmp/claude-1000/-home-gw-lab-caisson/9b6b9cfb-9653-4aca-9158-ea5a37cbd62f/scratchpad/op-session.txt
```

Then the driven flow (values never printed — Railway→op piped directly):

1. **Enumerate by name:** caisson.env (137), global (caisson-relevant), gh secrets, Railway
   per-service (`railway variables -s <svc> --json | jq keys`). Name-union.
2. **Read vault:** `op item list --vault "Caisson Launch" --format json` → present titles.
3. **Diff → gaps.**
4. **Fill op:** locally-readable → `op item create/edit`; Railway-only → `railway variables --json`
   piped to `op item create` (no display); missing → operator retrieves via Part C.
5. **Probe each** (present ⇒ valid): Paddle `/event-types`, Resend `/domains`, PostHog capture,
   Linear `viewer`, Discord `users/@me`, OpenRouter `/key`, Cloudflare `/user/tokens/verify`,
   Grafana OTLP 200, R2 head-bucket, AWS `kms:DescribeKey`.
6. **Record** parity result + the SoT-flip ADR; refresh `docs/state/providers.md`.

Delete the session file after: `rm …/op-session.txt`.

---

## Part C — per-provider retrieval walkthrough (live, 2026-07-10)

### Paddle (Billing) — sandbox and production are SEPARATE workspaces

- **`PADDLE_API_KEY`** — Developer Tools → Authentication → API keys → New. `pdl_live_apikey_…` /
  `pdl_sdbx_apikey_…`; once-shown; 90-day default. Wrong-env key = `403`.
- **`PADDLE_WEBHOOK_SECRET`** — Developer Tools → Notifications → destination → Edit → Secret key
  (`pdl_ntfset_…`). No one-click roll → new destination + cut over.
- **`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`** — Developer Tools → Authentication → Client-side tokens.
  `live_…`/`test_…`. Revoke is permanent.
- **Go-live:** live workspace → recreate Catalog products/prices (not copied) → base URL
  `sandbox-api`→`api.paddle.com` → new live API key + client token + `NEXT_PUBLIC_PADDLE_ENV=production`
  → swap every sandbox price/product ID → new live notification destination + its own secret → set
  Default Payment Link.

### Resend — single dashboard

- **`RESEND_API_KEY`** — resend.com/api-keys → Create → **Sending access** (send-only). `re_…`, once.
- **`RESEND_FROM` / domain** — resend.com/domains → Add Domain (subdomain e.g. `updates.caisson.sh`)
  → add DKIM/SPF/DMARC records → Verify.

### PostHog (US Cloud, caisson-prod 493539)

- **`NEXT_PUBLIC_POSTHOG_KEY`** (`phc_…`, public) — us.posthog.com/project/493539/settings →
  Project variables → Project API key. Pair `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.
- **`POSTHOG_CAPTURE_KEY`** (`phx_…` personal) — us.posthog.com/settings/user-api-keys → Create,
  least-privilege scopes, once-shown, **Roll key** to rotate.

### Plausible — domain-based, no snippet key

- **`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`** = `caisson.sh` (no key).
- **Stats API key** (metrics only) — Settings → API keys → New; `Authorization: Bearer`.
- **Goals** (open ADR-0254 item) — Site → Settings → Goals → Add: Pageview `/getting-started` +
  Custom events `docs_cta_click` / `signup_complete` (names must match code exactly).

### Linear

- **`LINEAR_API_KEY`** (`lin_api_…`) — Settings → Account → Security & access → Personal API keys →
  New. Raw header, **no `Bearer`**. Delete-and-recreate to rotate.
- **Business plan** ($16/user/mo, operator billing) — Settings → Workspace → Plans → Business.
  Unlocks Triage Rules, Agents, Code Intelligence, Insights. **Cycles are NOT Business-gated.**
- **`LINEAR_TEAM_ID` / `LINEAR_TRIAGE_STATE_ID`** — `Cmd+K` → "Copy model UUID", or GraphQL
  `{ teams { nodes { id name key } } }` then `{ team(id:"…"){ states { nodes { id name type } } } }`
  → pick `type=="triage"` (exists only after team Settings → Triage → Turn on Triage).

### Discord (developer portal)

- **`DISCORD_TOKEN`** — Applications → app → Bot → Reset Token (once).
- **`DISCORD_CLIENT_ID` / `_CLIENT_SECRET`** — OAuth2 → General (Reset Secret).
- **Redirect URI** — OAuth2 → Redirects → `https://caisson.sh/api/auth/callback/discord`.
- **Privileged intents** — Bot → Privileged Gateway Intents → Message Content + Server Members
  (direct under 10k installs). Restart bot; Intents bitfield must match toggles.

### GitHub fine-grained PAT — see A4. `github_pat_…`, Contents RW + Workflows RW, repo `caisson-oss`, owner `caisson-sh`.

### Cloudflare Turnstile

- **`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET`** — dash → Turnstile → Add widget →
  hostname `caisson.sh` + Managed → Create. Secret re-viewable only via Rotate.

### Cloudflare API token + account id

- **`CLOUDFLARE_API_TOKEN`** — My Profile → API Tokens → Custom Token → `Zone:DNS:Edit` +
  `Account:Workers Scripts:Edit` (+`Workers Routes:Edit`) + `Account:Workers R2 Storage:Edit`;
  Zone = `caisson.sh`. Verify `/user/tokens/verify`.
- **`CLOUDFLARE_ACCOUNT_ID`** — Account Home → API section (or any workers URL).

### Grafana Cloud — TWO token mechanisms (has bitten the project)

- **OTLP ingest = Cloud Access Policy token (`glc_`)** — grafana.com → Security → Access Policies
  (org-level, write scopes). `OTEL_EXPORTER_OTLP_HEADERS` = HTTP Basic `base64(<instanceID>:<glc_>)`,
  not the token alone. The OpenTelemetry connection tile pre-fills all three env vars.
- **Dashboard/HTTP API = Service Account token (`glsa_`)** — `<stack>.grafana.net` → Administration
  → Service accounts. Cannot push OTLP; a `glc_` cannot call the instance API. Query tokens are
  `glc_` with `*:read` scopes.

### Trigger.dev

- **`TRIGGER_SECRET_KEY`** — cloud.trigger.dev → project → API keys, per-env (`tr_prod_…`/`tr_dev_…`).
  The `tr_pat_…` PAT is CI-deploy only, not runtime.

### AWS (KMS + S3 WORM) — one IAM key pair covers both

- **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`** — IAM → Users → programmatic-only user →
  least-privilege policy (KMS `Encrypt`/`Decrypt`/`GenerateDataKey` pinned to the key ARN, never
  `*`; S3 `PutObject`/`GetObject`/`PutObjectRetention`/`PutObjectLegalHold`/`ListBucket` on the WORM
  bucket) → Create access key (Other), once-shown. KMS rides these same creds.

### Cloudflare R2

- **`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`** — dash → R2 → Manage R2 API tokens → Create →
  Object Read & Write → **Apply to specific buckets only**. Once-shown.
- **`R2_ACCOUNT_ID`** — the `<id>` in `https://<id>.r2.cloudflarestorage.com`.

### OpenRouter (per-service attribution)

- **six `sk-or-v1-…` keys** — openrouter.ai/keys → Create Key, Name = service label (`gw-box` /
  `caisson-docs` / `caisson-support-bot` / `caisson-site-ask` / `caisson-intel` /
  `caisson-aeo-probe`), optional per-key credit limit. Scriptable via a Management API key:
  `POST /api/v1/keys {name, limit, limit_reset}`. Usage: `GET /api/v1/key`.

### Semgrep / Renovate — see A2 / A3.
