---
updated: 2026-09-24
status: live
grounds:
  - apps/site/live/probe-session.ts
  - apps/site/live/buyer-dashboard-flow.live.test.ts
  - apps/site/live/prod-routes.live.test.ts
  - apps/site/lib/auth-config.ts
  - apps/site/lib/auth-server.ts
  - infra/terraform/access.tf
  - apps/admin/src/lib/admin-auth-config.ts
  - apps/admin/src/lib/admin-auth-server.ts
  - apps/admin/src/lib/admin-session.ts
  - apps/admin/scripts/seed-harness-session.ts
  - .agents/skills/caisson-production-browser-audit/SKILL.md
  - .agents/skills/caisson-production-browser-audit/references/safety.md
  - .agents/skills/caisson-production-browser-audit/references/journeys.md
  - docs/state/outstanding-work.md
  - docs/state/providers.md
  - docs/deploy/STATE.md
  - knowledge/decisions/ADR-0322-codex-production-browser-audit.md
  - knowledge/decisions/ADR-0323-browser-audit-remediation-cookiy-response.md
  - knowledge/decisions/ADR-0317-op-primary-store.md
  - tooling/scripts/vault-parity-check.ts
---

# Runbook: Ring-2/3 Codex probe account provisioning (ADR-0322/0323 D3)

Provisions the two probe identities the `caisson-production-browser-audit` skill needs:
Ring 2 (buyer, `caisson.sh`) and Ring 3 (admin, `admin.caisson.sh`). One-time setup;
re-run individual sections on rotation (see §7).

Do not print secret values anywhere in this runbook's execution — env var **names**
only, per `identity/security.md`.

---

## 0. What already exists (don't re-provision)

**Current status:** Ring-2 credentials and email verification are historical evidence and require
a fresh §5 verification before they count as ready. Ring 3 is not created, allowlisted, or
verified; CAISSON-104 remains operator-gated.

Per ADR-0317's 2026-07-10 credential sweep, the **Ring-2 creds already exist** end to
end: `~/.gridwork/caisson.env` has all four keys (confirmed present, values not
inspected here):

```
export CAISSON_E2E_ACCOUNT_EMAIL
export CAISSON_E2E_ACCOUNT_PASSWORD
export CAISSON_E2E_CF_CLIENT_ID
export CAISSON_E2E_CF_CLIENT_SECRET
```

And ADR-0317 records "E2E account creds already present" in the 1Password "Caisson
Launch" vault. **If these four are already set and the probe account has completed its
one-time email verification (§1.3), skip straight to §5 (verification) for Ring 2.**

Ring 3 has **no** equivalent today — `apps/admin` is GitHub-OAuth-only (ADR-0283, no
password/sign-up path), and the current `ADMIN_GITHUB_ALLOWED_USER_IDS` on Railway
service `caisson-admin` holds only the operator's own numeric GitHub id (`265439716`,
per `docs/deploy/STATE.md`). §3 provisions a **second**, dedicated id for the probe.

---

## 1. Ring-2 (buyer) probe account — one-time creation

### 1.1 Pick the probe identity — OPERATOR-INPUT

Choose an email the operator controls (can receive the one-time verification email) and
a password meeting better-auth's floor (min 8 chars, `apps/site/lib/auth-config.ts`
`newPasswordField`). This account is dedicated — never a real buyer, never reused for
anything else (`safety.md` preflight rejects "default, personal, shared" profiles).

### 1.2 Create the account (self-serve sign-up, scripted)

The site's better-auth instance requires email verification before a **password**
account can sign in (`requireEmailVerification: true`, `apps/site/lib/auth-server.ts:169`)
— sign-up itself is unauthenticated and fully scriptable. `/api/auth/*` is public;
Cloudflare Access covers `/dashboard*` and `/cart*` only
(`infra/terraform/access.tf`, `site_gate`).

```bash
source ~/.gridwork/caisson.env

curl -sS -X POST https://caisson.sh/api/auth/sign-up/email \
  -H "Origin: https://caisson.sh" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Caisson E2E Probe",
    "email": "'"${CAISSON_E2E_ACCOUNT_EMAIL}"'",
    "password": "'"${CAISSON_E2E_ACCOUNT_PASSWORD}"'"
  }'
```

Mirrors the exact request `apps/site/live/buyer-dashboard-flow.live.test.ts`'s
`ensureProbeSession` sends. The `Origin` header is mandatory — better-auth's CSRF check
403s any auth POST without it (`apps/site/live/probe-session.ts:10-11`,
`MISSING_OR_NULL_ORIGIN`).

This returns success but the account **cannot sign in yet** — it is pending
verification (next step). This is expected, not a harness bug (documented in the live
test file's header comment).

### 1.3 Complete email verification — OPERATOR-INPUT (unavoidable manual step)

better-auth has no API to bypass `requireEmailVerification` for a password account —
the email round-trip is the trust boundary
(`emailVerification.sendOnSignUp: true`, `autoSignInAfterVerification: true` in
`auth-server.ts`). Open the inbox for `CAISSON_E2E_ACCOUNT_EMAIL`, find the
"verify-email" template send, click the link once. After this, sign-in works for every
future run — this is a ONE-TIME step per account, not per session.

### 1.4 Confirm sign-in works

```bash
source ~/.gridwork/caisson.env

curl -sS -i -X POST https://caisson.sh/api/auth/sign-in/email \
  -H "Origin: https://caisson.sh" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"${CAISSON_E2E_ACCOUNT_EMAIL}"'","password":"'"${CAISSON_E2E_ACCOUNT_PASSWORD}"'"}' \
  | grep -i "^HTTP\|^set-cookie"
```

Expect `HTTP/2 200` and a `set-cookie: caisson.session_token=...` line
(`SESSION_COOKIE_NAME` in `auth-server.ts:48`). If this 403s on Origin, check the
header is present; if 401/no-cookie, the account is still unverified — return to §1.3.

---

## 2. CF-Access service-token acquisition (gates `/dashboard*` + `/cart*`)

### 2.1 What it is

`infra/terraform/access.tf` (lines 68-100) provisions a Cloudflare Access **service
token** resource `cloudflare_zero_trust_access_service_token.e2e_prober` (name
`caisson-e2e-prober`), admitted by a `non_identity` policy
(`site_gate_service_auth`) layered onto the `site_gate` application that covers ONLY
`/dashboard*` + `/cart*` on apex + www (ADR-0303 scoped the gate down from whole-host).
It does not touch anything else — marketing/docs/marketplace/api are public
(unauthenticated) since ADR-0303.

### 2.2 Get the token (already provisioned — do not re-`terraform apply` to rotate casually)

The token already exists; its two header values are Terraform **sensitive outputs**:

```bash
cd /home/gw/lab/caisson/infra/terraform
terraform output -raw e2e_prober_client_id      # -> CAISSON_E2E_CF_CLIENT_ID value
terraform output -raw e2e_prober_client_secret  # -> CAISSON_E2E_CF_CLIENT_SECRET value
```

Only run these if the env/vault values are lost — `terraform output` prints the raw
secret to stdout, so pipe straight into `op`/the env file, never paste into chat or a
log.

### 2.3 Inject on every gated request

Every request to `/dashboard*` or `/cart*` MUST carry both headers:

```
CF-Access-Client-Id: <CAISSON_E2E_CF_CLIENT_ID>
CF-Access-Client-Secret: <CAISSON_E2E_CF_CLIENT_SECRET>
```

For a Playwright/Chrome context, set them once as `extraHTTPHeaders` on the browser
context (`apps/site/live/buyer-dashboard-flow.live.test.ts:133-138`) rather than
per-request — the pattern the Ring-2 Codex Computer-Use profile should mirror. Keeping
the headers on that context is convenient for gated navigation; public auth POSTs do not require
them. Rotate
by `terraform taint cloudflare_zero_trust_access_service_token.e2e_prober && terraform
apply` — this is a real rotation (old token stops working immediately); update the env

- vault value in the same sitting (§4).

---

## 3. Ring-3 (admin) probe GitHub account — one-time setup

`apps/admin` accepts **GitHub OAuth only** — no magic link, no email+password
(`apps/admin/src/lib/admin-auth-server.ts:1-7`, "this is a single-operator control-plane,
not a buyer product"). There is no scriptable sign-up/sign-in path for production. The
`seed-harness-session.ts` script that mints a session without OAuth is explicitly
**LOCAL-DEV-ONLY** — it inserts fake rows into a throwaway loopback Postgres and its own
header comment says "NOT product code... Never run against a real DB." Do not adapt it
for production Ring-3.

The Cloud Run-ready application has two fail-closed edge layers. Both are armed when
their mode variable is absent; only the exact `disabled` mode in `development` or
`test` can turn either one off:

- `ORIGIN_SECRET_MODE` controls the Worker-injected origin header gate on every route,
  including `/healthz`; `ORIGIN_SECRET_NEXT` permits a two-phase rotation beside the
  current `ORIGIN_SECRET`.
- `CF_ACCESS_MODE` controls validation of the admin application token using the bare
  `CF_ACCESS_TEAM_DOMAIN` hostname and the application-specific `CF_ACCESS_AUD` tag.

Browser probes do not add either credential manually: Cloudflare Access supplies the
JWT and the Worker replaces any client origin header with its service secret. A raw
origin request without that header must return 403, including on health routes. Cloud
Run therefore uses a `tcpSocket` startup probe on the container port, never an HTTP
probe that would bypass or fail the gate. The Wave-3 application PR stays unmerged until
the Worker fronts Railway and the matching Railway origin secret is seeded.

### 3.1 Create a dedicated admin-probe GitHub account — OPERATOR-INPUT

Create (or designate) a GitHub account that is NOT the operator's personal account —
`safety.md`'s preflight explicitly rejects "default, personal, shared, guest, identical"
profiles for the distinct admin operator profile requirement. This is a real GitHub
account with its own credentials (and ideally 2FA); it needs no repo/org access, only
the ability to complete an OAuth consent screen for the "Caisson Admin" GitHub OAuth
app (client id `Ov23li2yV6PG6Ll3oepd`, recorded in the **2026-07-07 — EXECUTED: ninth-sitting
seven-PR wave deploy + admin OAuth flip** entry of [deploy state](../deploy/STATE.md)). Cited by
heading, not line: `STATE.md` is prepend-only, so line numbers drift with every new entry.

### 3.2 Get its numeric GitHub user id

Admin's allowlist is keyed on the **immutable numeric id**, never the username
(`apps/admin/src/lib/admin-auth-config.ts:1-9` — "NEVER the GitHub username/login
(renameable/re-registerable)"). Once the probe account exists:

```bash
curl -sS https://api.github.com/users/<probe-github-username> | grep '"id"'
```

### 3.3 Add it to the allowlist (append, never replace)

`ADMIN_GITHUB_ALLOWED_USER_IDS` is a comma-separated Set
(`admin-auth-config.ts` `parseAllowedGithubIds`) currently holding only
`265439716` (operator). Append the new id — do not overwrite:

```bash
railway variables -s caisson-admin \
  --set "ADMIN_GITHUB_ALLOWED_USER_IDS=265439716,<probe-numeric-id>"
```

This requires a redeploy of `caisson-admin` to take effect for the
account-**creation**-time gate (`admin-auth-server.ts`'s `databaseHooks.account.create.
before` — env vars are not hot-reloaded, `admin-auth-server.ts:99-101`). The
**per-request** recheck (`admin-session.ts`'s `verifyAdminSession`) reads the same
cached value, so it redeploys together — one `railway up -s caisson-admin` (or the
Railway dashboard env-var save, which triggers its own redeploy) covers both.

### 3.4 First sign-in (interactive, unavoidable)

There is no way to script the OAuth handshake itself — the Ring-3 Codex Computer-Use
profile must drive a real browser through:

1. Navigate to `https://admin.caisson.sh/login`.
2. Click "Sign in with GitHub".
3. Authenticate as the probe GitHub account (credentials from wherever §4 stores them)
   and approve the OAuth consent screen.
4. Confirm landing on `/` (the admin overview) — not `/login` (a redirect back to login
   means the numeric id isn't on the allowlist yet; re-check §3.3 and that the redeploy
   completed).

This is the profile's persistent session going forward (`caisson-admin.session_token`
cookie, `SameSite=Strict`+`HttpOnly`, `admin-auth-server.ts:76-87`) — Codex Computer-Use
profiles persist cookies across runs the same way a real Chrome profile does, so this
interactive step is ONE-TIME per profile, not per audit run.

---

## 4. Where each credential is saved

Repo convention (ADR-0317): **1Password "Caisson Launch" vault is the primary SoT**
(one item per env-var NAME, title === name); `~/.gridwork/caisson.env` is a derived
mirror agents/local scripts read from; Railway service env is the deployed-app copy.
On conflict, op wins; a new credential lands in op first, then propagates.

| Credential                                               | 1Password item (title)                                                               | `caisson.env` key                                                                                   | Railway service                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Ring-2 probe email                                       | `CAISSON_E2E_ACCOUNT_EMAIL`                                                          | `CAISSON_E2E_ACCOUNT_EMAIL`                                                                         | — (local/box only)                                                                          |
| Ring-2 probe password                                    | `CAISSON_E2E_ACCOUNT_PASSWORD`                                                       | `CAISSON_E2E_ACCOUNT_PASSWORD`                                                                      | —                                                                                           |
| CF-Access service token id                               | `CAISSON_E2E_CF_CLIENT_ID`                                                           | `CAISSON_E2E_CF_CLIENT_ID`                                                                          | —                                                                                           |
| CF-Access service token secret                           | `CAISSON_E2E_CF_CLIENT_SECRET`                                                       | `CAISSON_E2E_CF_CLIENT_SECRET`                                                                      | —                                                                                           |
| Ring-3 probe GitHub username + password (+ 2FA recovery) | **new item, OPERATOR-INPUT title** e.g. `CAISSON_ADMIN_PROBE_GITHUB`                 | not applicable (not an app secret — a personal login; store login only in op, never in caisson.env) | —                                                                                           |
| Ring-3 probe GitHub numeric id                           | fold into the same item as a labeled field, or `ADMIN_GITHUB_ALLOWED_USER_IDS_PROBE` | not applicable                                                                                      | `caisson-admin` → `ADMIN_GITHUB_ALLOWED_USER_IDS` (comma-joined with the operator id, §3.3) |

After adding the new Ring-3 vault item(s), run the parity checker (it only diffs
NAMEs against `caisson.env`, and the Ring-3 GitHub login has no `caisson.env`
counterpart by design — expect it to report that item as vault-only, which is correct
here, not drift):

```bash
bun tooling/scripts/vault-parity-check.ts
```

---

## 5. Verification commands (headless, per ring)

### Ring 2 — buyer

Full round-trip proof (sign-in + gate + session cookie), one Bun one-liner using the
repo's own helper:

```bash
cd apps/site && bunx turbo run test:live --filter=@caisson/site
# or: cd apps/site && bun run test:live   (runs `bun test ./live`, incl.
#     buyer-dashboard-flow.live.test.ts and prod-routes.live.test.ts)
```

Or a bare curl proving just the session establishes (no browser):

```bash
source ~/.gridwork/caisson.env
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://caisson.sh/api/auth/sign-in/email \
  -H "Origin: https://caisson.sh" -H "Content-Type: application/json" \
  -d '{"email":"'"${CAISSON_E2E_ACCOUNT_EMAIL}"'","password":"'"${CAISSON_E2E_ACCOUNT_PASSWORD}"'"}'
# expect: 200
```

### Ring 3 — admin

There is no password/API sign-in to script for admin (§3), so headless verification
means **re-checking an already-established session**, not re-authenticating from
scratch. After the one-time interactive OAuth login (§3.4), the browser-audit preflight
uses the selected admin profile itself to issue:

```http
GET https://admin.caisson.sh/api/auth/get-session
credentials: include (the selected profile's own cookie jar)
```

The response must be 2xx JSON with non-empty `session` and `user` objects. The skill's
`probeAdminSession` helper converts that response to one boolean; only that boolean enters
`runPreflight`. Never extract or copy `caisson-admin.session_token`, and never record the
response's email, user id, session id, cookie value, or value lengths. Empty/invalid JSON,
a redirect, or a non-2xx response blocks Ring 3 until the operator re-authenticates the
profile interactively. `admin-session.ts` re-verifies the allowlist on every call, so
narrowing `ADMIN_GITHUB_ALLOWED_USER_IDS` fails this check even with a technically live
cookie.

---

## 6. Revert/janitor expectations (ADR-0322 mutation contract)

Both rings inherit ADR-0322 Decision 4 + `safety.md`'s mutation-allow contract: every
mutation the audit performs against these probe accounts must predeclare owner,
precondition, before-snapshot, expected transition, compensator, and cleanup assertion,
journaled `planned → applied → observed → reverted → verified`. This runbook's
provisioning steps are setup, not audit mutations, but the same boundary applies to
anything the probe accounts touch afterward:

- **Ring 2:** the probe account is "deliberately zero-purchase"
  (`buyer-dashboard-flow.live.test.ts:11-13`) — every dashboard assertion expects EMPTY
  state. Any audit mutation (e.g. adding an AI key, inviting a member) needs a
  predeclared compensator that returns the account to zero-purchase/empty before the
  ring closes. `safety.md`'s absolute denylist forbids real purchases, irreversible
  subscription changes, identity/password/MFA changes, and role/permission changes on
  this account outright — those are never in scope for a compensator, they're just
  never attempted.
- **Ring 3:** default read-only; any mutation requires an operator-allowlisted
  **synthetic fixture** (not the probe admin account's own identity/permissions) plus a
  verified compensator. On a failed or unprovable revert, the skill's own contract is to
  record a P0, set `mutation_lock: true`, and stop that ring — this runbook does not
  relax that; provisioning only gets the identity to the point where the skill's own
  journal takes over.
- If either probe account ever accumulates un-revertible state (e.g. Ring 2 dashboard
  no longer renders empty), the fix is out-of-band: manually clean the row(s) via the
  admin cockpit (or a scoped DB statement) before the next audit run, not a mutation the
  next run's journal is responsible for inheriting.

---

## 7. Rotation / repeatability — what to re-run

| Rotated item                                               | Re-run                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAISSON_E2E_ACCOUNT_PASSWORD`                             | Update op item + `caisson.env` (§4); no re-signup needed — better-auth password-reset or direct DB update; re-verify with §5 Ring-2 curl.                                                                                                     |
| CF-Access service token (`e2e_prober`)                     | `terraform taint` + `apply` (§2.3) — **immediately breaks the old token**, do this and update op/`caisson.env` in the same sitting; re-verify §5.                                                                                             |
| `ADMIN_GITHUB_ALLOWED_USER_IDS` (probe id removed/rotated) | Re-run §3.2 (new numeric id if the probe GitHub account itself changed) + §3.3 (`railway variables --set`, comma-joined) + redeploy `caisson-admin`; re-run §3.4 interactive login on the new/same Computer-Use profile; re-verify §5 Ring-3. |
| Ring-3 probe GitHub account password/2FA                   | Standard GitHub account recovery — no allowlist change needed (the numeric id is stable across a password change); just re-authenticate the Computer-Use profile (§3.4) if its stored session expired.                                        |
| `ADMIN_BETTER_AUTH_SECRET` rotated                         | Every existing admin session (including the probe's) is invalidated (cookies are HMAC-signed with this secret) — re-run §3.4 interactive login only; no allowlist change.                                                                     |
| Vault drift suspected                                      | `bun tooling/scripts/vault-parity-check.ts` (§4) — diffs by NAME only, flags anything present in one home but not the other.                                                                                                                  |

Full re-provisioning from zero = §1 → §2 → §3 → §4 → §5. Ring-2 sign-up is public, so
the Cloudflare service token can be recovered before or after account creation, but it must exist
before dashboard/cart verification. Ring 3's allowlist entry must exist before its first
interactive login attempt.
