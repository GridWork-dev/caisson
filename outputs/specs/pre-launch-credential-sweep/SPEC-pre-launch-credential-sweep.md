# SPEC — pre-launch credential sweep: scoped-key regen, rotation ordering, and the 1Password launch-vault parity check

**Status: SPEC — four operator forks open (see Forks).** Locked context this spec honors
and does NOT re-open: the operator runs a full pre-launch credential audit, regenerates
every credential as a **scoped-only** key, and keeps the launch set in **ONE 1Password
vault kept in parity with the env files**. Per **ADR-0224 (F6=A)**, `~/.gridwork/caisson.env`
is the operational **SOT** the runtime + live-harness read and assert parity against; the
1Password vault is the durable **human-recovery store**, not the SOT. Day-to-day agent
sourcing stays `~/.gridwork/env`, which source-chains `caisson.env`.

- **Relates:** ADR-0106 (license issuer keypair) · ADR-0201/0221 (WORM+KMS live-proof
  prover creds) · ADR-0222 (public npm scope `@caisson-sh/*`, mirror-owned publishing) ·
  ADR-0223 (registry npm delivery) · ADR-0224 F6 (caisson.env = launch SOT) · ADR-0069
  (publish auth = ephemeral GITHUB_TOKEN, no stored npm PAT).
- **Executes:** the `docs/state/launch-runbook.md` P5 rotation row and Bucket C /
  CAISSON-14 of `outputs/specs/post-wave-hardening/SPEC-post-wave-hardening.md` (the KMS
  alias-tag rider rides this sweep, not before it).
- **Tracking:** Linear owns the WORK items; this spec owns the inventory, ordering, vault
  structure, and verify commands. Every credential is referred to by env-var **NAME
  only** — no secret value appears in this spec, in the parity tool's output, or in any
  artifact it produces.

## Goal (WHAT + WHY)

Turn a scattered, partly-leaked credential surface into a **rotated, scoped, single-vault**
launch set with a mechanical parity check that agents can run forever. WHY now: two
credentials (`OPENROUTER_API_KEY`, `DISCORD_TOKEN`) were pasted into chat sessions and one
GH secret (`MIRROR_PUSH_TOKEN`) into a transcript — those are live exposures regardless of
launch timing; and the account-wide npm login token must become a `@caisson-sh`-scoped
automation token before the mirror publishes publicly (ADR-0222). Everything else is
scope-tightening + provenance while the deploy context is fresh.

**Scope note on "the 19 vars":** `~/.gridwork/caisson.env` holds ~113 names, but only
**~19 are rotatable credentials** (below). The remaining ~90 are Railway-injected
metadata (`RAILWAY_*`, `*__RAILWAY_*`, `PG*` host/port/user, `POSTGRES__*`),
`NEXT_PUBLIC_*` values (public by design — client Paddle/PostHog/Turnstile/Plausible/auth
URLs), Discord role/channel IDs (`ROLE_*_ID`, `CUSTOMER_ROLE_ID`, `GUILD_ID`,
`*_CHANNEL_ID`), and `CAISSON_LICENSE_PUBLIC_KEY` (public half of the issuer keypair) —
**config, not secrets; out of scope for rotation** but IN scope for the name-level parity
check (the vault mirrors the whole operational set, secrets and config alike, so a missing
name is caught either way).

## 1. Inventory — every rotatable credential by NAME

Verified against `~/.gridwork/caisson.env`, `~/.gridwork/env`, `.github/workflows/*.yml`
(`secrets.*` refs), `infra/terraform/variables.tf`, `registry/worker/wrangler.toml`, and
the `caisson-sh/caisson-oss` mirror repo. **Store** = where the live value is read from at
runtime/CI (`env` = caisson.env or gridwork env; `GH` = this repo's Actions secrets;
`GH-mirror` = the mirror repo's secrets; `Railway` = Railway-managed injected var; `CF` =
Cloudflare token used by wrangler/terraform).

| NAME                                                                                                               | Store                 | Consumed by                                                                  | Current scope                              | Target scope                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`                                                                                               | env                   | `services/support-bot` (RAG answers), memory embeddings                      | account key, **pasted in chat**            | fresh key, per-model spend cap                                                                             |
| `DISCORD_TOKEN`                                                                                                    | env                   | `services/support-bot` (bot login)                                           | bot token, **pasted in chat**              | fresh bot token, minimal gateway intents                                                                   |
| `MIRROR_PUSH_TOKEN`                                                                                                | GH                    | `.github/workflows/mirror-sync.yml` (force-push to `caisson-sh/caisson-oss`) | fine-grained PAT, **pasted in transcript** | fresh fine-grained PAT, `contents:write` on `caisson-oss` ONLY                                             |
| `NPM_TOKEN`                                                                                                        | GH-mirror             | mirror repo's publish workflow → npmjs `@caisson-sh/*` (ADR-0222/0223)       | **account-wide classic** login token       | **granular automation** token, publish-scoped to `@caisson-sh` only                                        |
| `CAISSON_LICENSE_SIGNING_KEY`                                                                                      | env                   | `services/license` issuer (Ed25519 sign, ADR-0106)                           | dev keypair, provisioned                   | **operator fork** — fresh launch keypair (see Fork 1); public half → `CAISSON_LICENSE_PUBLIC_KEY`          |
| `LICENSE_ISSUE_TOKEN`                                                                                              | env                   | license issue endpoint bearer                                                | dev bearer                                 | fresh bearer, rotate with the keypair                                                                      |
| `ADMIN_ISSUE_TOKEN`                                                                                                | env (to-be-set)       | `apps/admin` reissue + `services/license` (AM-5, launch-runbook line 482)    | not yet set                                | new bearer, admin-scoped, set at deploy (CAISSON-17)                                                       |
| `DOCS_SERVICE_TOKEN`                                                                                               | env                   | `apps/site` → `services/docs` RAG bearer                                     | dev bearer                                 | fresh bearer                                                                                               |
| `BETTER_AUTH_SECRET`                                                                                               | env                   | `apps/site`/dashboard session signing                                        | dev secret                                 | fresh 32B secret                                                                                           |
| `PADDLE_API_KEY`                                                                                                   | env                   | `packages/billing` server calls                                              | **SANDBOX**                                | **production key at commerce flip** (Fork/ordering)                                                        |
| `PADDLE_WEBHOOK_SECRET`                                                                                            | env                   | Paddle webhook verify (`crypto.timingSafeEqual`)                             | SANDBOX                                    | production secret at commerce flip                                                                         |
| `PADDLE_CLIENT_TOKEN` / `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`                                                          | env                   | client checkout (public by design)                                           | SANDBOX                                    | production client token at commerce flip                                                                   |
| `LINEAR_API_KEY`                                                                                                   | env                   | support-bot escalation → Linear Triage sink (ADR-0206)                       | `lin_api_` account key                     | fresh key (Linear keys are account-scoped; narrow by bot user)                                             |
| `RESEND_API_KEY`                                                                                                   | env + gridwork env    | `packages/email` sends                                                       | shared key                                 | fresh key, sending-domain scoped                                                                           |
| `RESEND_FROM`                                                                                                      | env                   | from-address (config, not secret)                                            | —                                          | verify domain only                                                                                         |
| `TURNSTILE_SECRET`                                                                                                 | env                   | server-side Turnstile verify (site key is public)                            | shared secret                              | fresh secret                                                                                               |
| `GRAFANA_OTLP_TOKEN`                                                                                               | env                   | fleet OTLP push (ADR-0177)                                                   | write token                                | fresh token, OTLP-write only                                                                               |
| `GRAFANA_QUERY_TOKEN`                                                                                              | env                   | `apps/admin /ops` Tempo query (ADR-0207)                                     | query token                                | fresh token, read/query only                                                                               |
| `OTEL_EXPORTER_OTLP_HEADERS`                                                                                       | env                   | carries the OTLP auth header (derived)                                       | mirrors GRAFANA_OTLP_TOKEN                 | regenerate with the OTLP token                                                                             |
| `CLOUDFLARE_API_TOKEN`                                                                                             | env (gridwork) + CF   | `registry/worker/deploy.sh` + `infra/terraform` apply                        | broad account token                        | scope to the exact set in `infra/terraform/variables.tf:4` (Zone:DNS + Pages + Access + WAF on caisson.sh) |
| `RAILWAY_TOKEN`                                                                                                    | GH                    | `.github/workflows/deploy-railway.yml`                                       | project deploy token                       | fresh project-scoped token                                                                                 |
| `LHCI_GITHUB_APP_TOKEN`                                                                                            | GH                    | `.github/workflows/lighthouse.yml`                                           | LHCI app token                             | fresh app token (low blast radius)                                                                         |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`                                                                      | env (live-proof only) | `packages/field-crypto` KMS + `infra/worm` WORM prover; Bedrock (local-ai)   | shared prover creds (ADR-0201)             | least-privilege prover principal, tag-scoped (ADR-0221; see §5 rider)                                      |
| DB creds — `CAISSON_DATABASE_URL`, `BETTER_AUTH_DB_URL`, `CAISSON_ADMIN_DB_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD` | Railway               | all services                                                                 | Railway-managed cluster password           | rotate **in Railway console** → re-sync mirror (operator-only)                                             |

**Excluded (config/public, parity-tracked but not rotated):** all `RAILWAY_*` /
`*__RAILWAY_*` metadata, `PG*` non-password, `NEXT_PUBLIC_*` (except the Paddle client
token which flips with commerce), `ROLE_*_ID`/`CUSTOMER_ROLE_ID`/`GUILD_ID`/`*_CHANNEL_ID`
Discord config, `CAISSON_LICENSE_PUBLIC_KEY`, `CF_ACCESS_AUD`/`CF_ACCESS_TEAM_DOMAIN`
(identifiers), `PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_POSTHOG_KEY` (client `phc_` key). The
built-in CI `GITHUB_TOKEN` is ephemeral (ADR-0069) — **never rotated, never stored.**

## 2. Rotation procedure per credential class

Every rotation follows: **(a)** mint the new scoped credential at the provider · **(b)**
write it into the SOT store (Railway var for injected vars, `caisson.env`/`~/.gridwork/env`
for local, GH/GH-mirror secret for CI) · **(c)** mirror into the 1Password launch vault
(operator, §4) · **(d)** run the verification probe · **(e)** revoke the old credential
only after the probe is green. Blast radius = what breaks in the window between (b) and a
successful redeploy.

| Class                               | Members                                                                                                                      | Blast radius                                                                                                 | Verification probe                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaked-now (rotate immediately)** | `OPENROUTER_API_KEY`, `DISCORD_TOKEN`, `MIRROR_PUSH_TOKEN`                                                                   | support-bot answers stop / bot goes offline / mirror-sync no-ops (guarded green)                             | support-bot health `/healthz`; bot shows Online in guild; `mirror-sync` workflow_dispatch → green push                                                |
| **Bearer tokens**                   | `LICENSE_ISSUE_TOKEN`, `ADMIN_ISSUE_TOKEN`, `DOCS_SERVICE_TOKEN`, `BETTER_AUTH_SECRET`                                       | license issue 401 / admin reissue 401 / docs RAG 401 / all sessions invalidated                              | authenticated curl to each endpoint returns 200 (not 401); dashboard login round-trip                                                                 |
| **License keypair**                 | `CAISSON_LICENSE_SIGNING_KEY` (+ public half)                                                                                | **every issued license fails Ed25519 verify** — zero prod licenses today, non-zero after first sale (Fork 1) | `packages/license-verify` verifies a freshly-issued token against the new public key; registry Worker offline-Ed25519 filter still resolves           |
| **npm publishing**                  | `NPM_TOKEN` (granular, `@caisson-sh`)                                                                                        | mirror publish to npmjs fails                                                                                | mirror repo publish dry-run authenticates + resolves `@caisson-sh` scope                                                                              |
| **Paddle (commerce flip)**          | `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN`                                                             | checkout + webhook fulfillment down                                                                          | Paddle sandbox→prod: a test purchase webhook verifies + grants; `NEXT_PUBLIC_PADDLE_ENV=production`                                                   |
| **SaaS API keys**                   | `LINEAR_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET`, `GRAFANA_OTLP_TOKEN`, `GRAFANA_QUERY_TOKEN`, `LHCI_GITHUB_APP_TOKEN` | escalation sink / email / captcha / metrics push / metrics query / lighthouse CI degrade individually        | per-provider: Linear issue create in `CAISSON`; Resend test send; Turnstile verify 200; `admin /ops` renders a Tempo trace; a metric lands in Grafana |
| **Infra tokens**                    | `CLOUDFLARE_API_TOKEN`, `RAILWAY_TOKEN`                                                                                      | wrangler/terraform apply fails / Railway deploy fails                                                        | `wrangler whoami` + `terraform plan` (zero diff); `railway whoami` + a no-op status                                                                   |
| **AWS prover**                      | `AWS_ACCESS_KEY_ID`/`SECRET`                                                                                                 | live-proof legs skip (self-skip without creds)                                                               | `CAISSON_KMS_LIVE=1 … test:live` in field-crypto passes (needs §5 rider first)                                                                        |
| **DB (Railway-managed)**            | cluster password → the `*_DATABASE_URL`/`PG*` set                                                                            | all services lose DB until redeploy                                                                          | rotate in Railway console; `railway-env-sync` re-mirror; each service `/healthz` green post-redeploy                                                  |

## 3. Ordering — before / at / after launch

**Before launch (do first, blocks the flip):**

1. The three **leaked-now** rotations — exposure is live today, independent of launch.
2. `NPM_TOKEN` → granular `@caisson-sh` automation token (mirror repo), before the mirror
   goes public (ADR-0222).
3. Scope-tighten `CLOUDFLARE_API_TOKEN` to the exact `variables.tf:4` grant set; rotate
   `RAILWAY_TOKEN`, the bearer tokens, `BETTER_AUTH_SECRET`, and all SaaS API keys to
   fresh scoped values.
4. **CAISSON-14 KMS rider** (§5) — must land before the AWS prover creds are re-scoped, or
   the live proof can't run its verify probe.
5. License keypair decision (Fork 1) executed.

**At launch / commerce flip (the one operator-gated DEPLOY act):** 6. Paddle **production** credentials replace the sandbox set; `PADDLE_ENV`/
`NEXT_PUBLIC_PADDLE_ENV` → `production`. Ordered AFTER the license service + migrations
are live (launch-runbook Bucket D / CAISSON-16), so purchase webhooks don't 500 in the gap.

**After launch (cadence, not gating):** 7. AWS prover creds rotate on the ops cadence (only touched when a live-proof runs). 8. DB cluster password rotation is Railway-console operator work, on cadence (Fork 4).

## 4. The 1Password launch vault + the parity-check tool

### Vault structure

- **One vault, `Caisson Launch`.** One item per credential/config NAME in the operational
  set, **item title === env-var name** (Fork 3 sets granularity). Each item carries the
  value (operator-entered — agents never write it), plus fields: `scope` (target scope
  from §1), `consumer` (from §1), `store` (env / GH / GH-mirror / Railway / CF),
  `rotated` (ISO date). The vault mirrors the **whole** operational set (secrets + tracked
  config) so a name-level diff catches a dropped var either way.
- The vault is the **recovery store, not the SOT** (ADR-0224 F6=A). Runtime + the
  live-harness read `caisson.env`; the vault exists so a lost env file is recoverable with
  rotation provenance.

### Parity tool (agent-buildable) — `tooling/scripts/vault-parity-check.ts` (Recommended home; Fork 2)

Colocated with the existing `tooling/scripts/railway-env-sync.ts` (same read-only,
names-only, `~/.gridwork/caisson.env`-anchored pattern — reuse it, don't invent a home).
**Contract (mirrors railway-env-sync's READ-ONLY header):**

- Reads vault item **titles + `updated_at` only** via `op item list --vault "Caisson Launch"
--format json` (1Password CLI, already the operator's tool — no new dependency, no vault
  SDK). ponytail: `op` CLI over a custom client.
- Reads `caisson.env` **names only** via the same `grep -oE "^[A-Za-z_][A-Za-z0-9_]*="`
  path the sweep uses — **never sources the file, never reads a value.**
- Diffs the two name sets → reports: `in env, missing from vault` · `in vault, missing
from env` · (optional) items whose `updated_at` predates a `--rotated-after` date, so a
  stale-rotation drift surfaces. **Prints NO values in any branch** — the invariant is
  enforced by only ever handling `title`/`updated_at`/name strings.
- Exit non-zero on any drift → wire into `gw verify` fanout or a pre-launch check.
- **One runnable check behind it** (`vault-parity-check.test.ts`, mirroring
  `railway-env-sync.test.ts`): feed a fixture env-name set + a fixture `op`-JSON stub →
  assert the three diff buckets are correct and that no fixture value string ever appears
  in stdout. `// ponytail: fixture-stub op output; no live vault in CI.`

## 5. CAISSON-14 rider — fix the `kms:CreateAlias` ResourceTag condition

**Anchor:** `infra/kms/provision.ts` (print-only prover-policy generator). **Bug:** the
`KmsProofOps` statement authorizes `kms:CreateAlias` under
`Condition: { StringEquals: { "kms:ResourceTag/Purpose": PURPOSE } }` (line 44–55). AWS
authorizes `CreateAlias` against **both** the alias resource and the target key — but
**aliases cannot carry tags**, so the `kms:ResourceTag` condition never matches the alias
resource and every `CreateAlias` call is denied. The live proof **does** create an alias
(`packages/field-crypto/live/kms.live.test.ts:74`, `AliasName:
alias/${PURPOSE}-${label}-${RUN}`), so the printed policy would block a real proof run.

**Fix shape (least-privilege preserved):** split `kms:CreateAlias` out of the
ResourceTag-conditioned block into a dedicated statement scoped by **alias-name prefix**
(the only tag-free way to scope an alias):

- Remove `kms:CreateAlias` from `KmsProofOps` (leaving the tag-conditioned key ops intact).
- Add `KmsProofAlias`: `Allow kms:CreateAlias` (and `kms:DeleteAlias` for the CAISSON-13
  cleanup) on `Resource: ["arn:aws:kms:*:*:alias/caisson-field-crypto-live-proof-*",
"arn:aws:kms:*:*:key/*"]` — the alias leg scoped by the name pattern, the key leg still
  narrowed by the existing `kms:ResourceTag/Purpose` condition (CreateAlias evaluates the
  key under the statement's condition; the name-prefix ARN bounds the alias).

**Timing:** executes WITH this sweep, not before — the policy is print-only until the
dedicated prover principal is minted (per post-wave SPEC Bucket C).
**Verify:** `bun infra/kms/provision.ts` prints the split policy; attach to the prover;
`CAISSON_KMS_LIVE=1 AWS_… bun run --cwd packages/field-crypto test:live` creates the
tagged CMK **and** its alias without an AccessDenied.

## 6. Operator-only vs agent-buildable

**Operator-only (agents never touch the secret):** minting every new credential at its
provider; entering values into Railway / `caisson.env` / `~/.gridwork/env` / GH secrets /
the mirror repo secret / the 1Password vault; revoking old credentials; the Paddle
sandbox→production flip; DB password rotation in the Railway console; the four fork picks.

**Agent-buildable (no secret ever handled):** the `vault-parity-check.ts` tool + its test
(§4); the CAISSON-14 `provision.ts` policy fix + its verify (§5); a names-only sweep
report enumerating what's rotated vs pending (reads NAMES via grep, never values); wiring
the parity check into `gw verify`; the launch-runbook edit recording the rotation order.

## 7. Out of scope

- **Actually holding, moving, or printing any secret value** — this spec and every tool it
  spawns are names/titles/timestamps only. The operator performs all value-handling steps.
- **Rotating the excluded config/public set** (§1) — those are identifiers, not secrets.
- **The ephemeral CI `GITHUB_TOKEN`** — never stored, never rotated (ADR-0069).
- **DB schema migrations / the Railway deploy acts themselves** — those are the
  launch-runbook Bucket D (CAISSON-16/17/18/15), gated separately.
- **A generic multi-vault / secrets-manager abstraction** — one vault, one flat parity
  check; YAGNI until a second environment exists.
- **CAISSON-19** (operator revoke of real purchase entitlements) — its own SPEC.

## Forks (operator-owned — wait for the picker)

**Fork 1 — license Ed25519 issuer keypair: rotate or keep?**

- **(a) Regenerate a fresh launch keypair now (Recommended — confidence HIGH).** Zero prod
  licenses have been issued (pre-launch, Paddle sandbox), so the blast radius is nil today
  and non-zero after the first sale; minting the launch keypair clean into the vault gives
  full rotation provenance from license #1. Evidence: ADR-0106 provisioned a dev keypair;
  no prod issuance in `services/license` history.
- (b) Keep the provisioned keypair. Saves one step, but carries a dev-context key into
  production with no rotation record.

**Fork 2 — parity-tool home: `tooling/scripts/` or the `gw` CLI?**

- **(a) `tooling/scripts/vault-parity-check.ts` (Recommended — confidence HIGH).**
  Colocates with `railway-env-sync.ts` (identical read-only, names-only, caisson.env
  contract); caisson-specific; no cross-repo `gw` change. Evidence:
  `tooling/scripts/railway-env-sync.ts` is the established twin.
- (b) A `gw` subcommand (e.g. `gw verify vault`). More discoverable, but adds a
  caisson-specific check to the shared gridwork-core CLI for a one-repo concern.

**Fork 3 — vault item granularity: one item per var, or per service?**

- **(a) One item per env-var NAME, title === name (Recommended — confidence MED).** Makes
  the name-level parity diff exact and trivial. Evidence: §4 parity contract keys on titles.
- (b) One item per service (grouped fields). Fewer items to eyeball, but breaks 1:1
  name parity — the tool would need per-field parsing. **Operator taste call.**

**Fork 4 — post-launch rotation cadence.**

- (a) 90-day for all tokens, on-incident for keypairs/DB.
- **(b) Per-class: 90-day SaaS/infra tokens, on-incident-only for the license keypair +
  DB password (Recommended — confidence LOW; this is policy, not a technical default).**
- (c) On-incident-only across the board. **Purely operator policy — presented, not decided.**

## Verify (goal-backward)

Re-ask the goal, not the task list: **is the launch credential surface rotated, scoped,
single-vaulted, and mechanically parity-checked?**

- Each of the three leaked credentials: old value revoked, new scoped value live, probe green.
- `NPM_TOKEN` is a granular `@caisson-sh`-scoped automation token; the account-wide token
  is revoked.
- Every §1 credential's target-scope column is satisfied (no broad account tokens remain
  where a scoped one suffices).
- `vault-parity-check.ts` exits **zero** against `Caisson Launch` ↔ `caisson.env`, and its
  test proves no value string is ever emitted.
- `infra/kms/provision.ts` prints the split alias policy; `field-crypto` `test:live`
  creates a CMK + alias with no AccessDenied.
- The four forks were operator-picked, not silently decided; the launch-runbook records the
  final rotation order.

## Effort / value

**Effort:** rotation execution = operator session (value-handling is all operator) ·
parity tool + test = **S** (agent, reuse railway-env-sync pattern) · CAISSON-14 rider =
**XS** (agent). **Value:** **HIGH** — closes two live chat-leaked credentials + a leaked
PAT, scopes the npm blast radius before the mirror goes public, and leaves a forever-runnable
parity check; the rider unblocks the KMS live proof.
