---
title: "SPEC — Cloudflare front rate-limit + WAF for the Railway fleet"
status: "draft - operator lock required"
tags: [infra, security, external-system, billing, secrets]
item: cloudflare-front-rate-limit
class: DEPLOY (terraform apply + DNS flip — operator-gated, not inside the autonomous cycle)
supersedes: none
new-adr: next available (ceiling is 0217 → file ≥ 0218 on operator lock)
---

# SPEC — Cloudflare front rate-limit + WAF for the Railway fleet

**Status: DRAFT — operator lock required.** This document does NOT authorize building. It
resolves the DEPLOY-class item `cloudflare-front-rate-limit` deferred at **ADR-0204** into a
locked design + open forks; the operator locks the forks (a new ADR, ≥ 0218) before any code
or terraform lands. `terraform apply` and the DNS flip are a **separate operator DEPLOY act**
after merge — never the autonomous cycle (doctrine: SHIP stops at the merged PR).

> **Live-verification note (2026-07-02).** The two external-fact tables this SPEC leans on were
> re-verified live this session, not recalled from memory: the **Paddle webhook IP allowlist**
> (§3, Risk 3) and the **Cloudflare plan-tier capability table** (§1). Both matched exactly and
> now carry `verified live 2026-07-02` provenance. The **one** thing that could NOT be confirmed
> live is Cloudflare's per-zone **dollar pricing** (the plans page did not render figures) — it
> is flagged **operator-to-verify** everywhere it appears rather than presented as settled fact.

## Goal (WHAT + WHY)

Put Cloudflare's edge rate-limiting + WAF managed rules **in front of** the Railway fleet so
volumetric/abusive traffic is stopped at the edge before it reaches origin — the "more robust
durable fix" ADR-0204 named and deferred. Today the only rate defense is **in-process,
single-replica** token buckets (`services/license/src/rate-limit.ts`,
`services/docs/src/rate-limit.ts`): correct as last-mile guarantees but they share no state
across replicas and burn origin CPU/$ on every rejected request. The apex/www/admin hosts are
**already CF-proxied yet carry zero WAF managed rules and zero edge rate-limit rules** — pure
upside sitting unclaimed. This SPEC adds the edge layer as **complementary defense-in-depth**
(the app-level limiters stay, unchanged) and does it without breaking the one hard constraint:
Paddle's webhook must never be rate-limited or challenged (real-money provisioning path).

## Why now / trigger

- **ADR-0204 explicitly deferred it** as DEPLOY-class ("Putting Cloudflare in front of these
  two grey-origin services … is the more robust durable fix but is DEPLOY-class; deferred" —
  `knowledge/decisions/ADR-0204-strix-pentest-remediation.md`, Decision §2 / Rejected).
  `docs/state/decisions-and-forks.md` (fork table, ~line 631) carries the one-line pointer.
- **Single-replica ceiling is a live limitation, not hypothetical.** Both limiters' own header
  comments flag that they hold only at 1 replica; the moment either Railway service scales,
  the in-memory buckets stop being correct and CF's edge is the _only_ layer that still counts
  distributed abuse right (Risk 6).
- **Free upside is already paid for.** apex/www/admin are proxied now; a Free WAF Managed
  Ruleset + one Free rate-limit rule can deploy on the current $0 CF tier with no DNS change
  and no cost fork — the cheapest half of this item is claimable immediately.
- **Safe staging window.** The pre-launch CF-Access `site_gate` is still on and checkout runs
  against Paddle **sandbox** (CLAUDE.md "Still open"; `~/.claude/projects/…/golive-tail-merge-deploy-wave.md`),
  so rules can be staged + gate-probed before real buyer traffic exists.

## Non-goals

- **Not building an MCP-endpoint WAF rule.** `packages/mcp-server` is consumed by `apps/base`,
  which is **not** one of the 5 live Railway services (`docs/state/providers.md` Live URLs);
  there is no public MCP hostname to gate. Note the pattern "apply the same rule shape when
  `apps/base`/MCP goes live" — do not build against a non-existent surface (Risk 5).
- **Not building a `registry.caisson.sh` rule.** The registry Worker already runs natively at
  CF's edge (`caisson-registry.broken-wood-97a9.workers.dev`); the custom route
  `registry.caisson.sh` is a separate un-done fast-follow (`docs/state/stage2-deploy-plan.md`
  D11) — once bound it inherits this zone's rules automatically, no extra work here.
- **Not removing or re-writing the app-level limiters.** `services/{license,docs}/src/rate-limit.ts`
  (ADR-0204) stay verbatim as defense-in-depth. This SPEC is purely additive at the CF layer.
- **Not extracting the two near-duplicate limiters into a shared package.** Explicitly deferred
  in their own comments; unrelated to this item.
- **Not the `apps/site` waitlist client-IP fix.** A pre-existing inconsistency —
  `apps/site/app/api/waitlist/route.ts` reads `x-forwarded-for` with a comment claiming "not
  CF-Connecting-IP", but apex/www ARE proxied so it _could_ trust `CF-Connecting-IP` — is a
  flagged **drive-by candidate**, not built here.

## Current state (real files)

- **DNS / proxy topology** — `infra/terraform/main.tf` (single CF zone `caisson.sh`, provider
  `cloudflare/cloudflare ~> 5.0`):
  - `caisson.sh` + `www.caisson.sh` → CNAME to Railway, **`proxied = true`** (orange-cloud,
    already behind CF). Gated by the removable pre-launch `site_gate` (`infra/terraform/access.tf`,
    ADR-0082).
  - `admin.caisson.sh` → **`proxied = true`**. Gated permanently by `access.tf` `admin_gate`
    (ADR-0138/0140) **and** the fail-closed in-app CF-Access-JWT check
    `apps/admin/src/middleware.ts` (aud-pinned, ADR-0204).
  - `license.caisson.sh` → **`proxied = false`** (grey/DNS-only) **deliberately**, so Paddle's
    webhook POSTs (`services/license/src/app.ts` `/webhook`, ADR-0108/0116) reach the Railway
    origin directly with Railway's own Let's Encrypt cert, no CF in the path.
  - `docs-api.caisson.sh` → grey/DNS-only, same pattern (comment `main.tf:10,59`); **not itself
    declared** in `main.tf` (provisioned outside tracked terraform — likely a direct Railway
    custom-domain).
- **App-level rate limiting (ADR-0204, deployed 2026-07-02)** —
  `services/license/src/rate-limit.ts` + `services/docs/src/rate-limit.ts`: in-process
  fixed-window token buckets, client IP from **`X-Real-IP` only** (`clientIp()`; the header
  Railway's edge overwrites and a client can't spoof — the Strix vuln-0001 fix), plus a
  header-independent `checkGlobal()` flood ceiling. License buckets: `webhook`
  (Paddle POST, rate-gated **before** signature verify, `app.ts` ~line 270) + `issue`
  (bearer-gated, defense-in-depth before the bearer check). Docs buckets: `query`
  (OpenRouter-embedding $/hit) + `static` (`/llms.txt`, `/llms-full.txt`). Env-tunable
  (`LICENSE_RL_*`, `DOCS_RL_*`). Both single-instance; multi-replica flagged as a future
  follow-up in each file's header.
- **`apps/site`** — **no app-level rate limiting** (grep for `rateLimit` across `apps/site/src`
  - `apps/admin/src` is empty). Buyer sign-in (better-auth, `apps/site/lib/auth*.ts`) and the
    waitlist route (`apps/site/app/api/waitlist/route.ts`) rely on Turnstile + honeypot only.
- **CF plan** — currently **Free** (`docs/state/providers.md`).
- **IaC surface + token scope** — `infra/terraform/{main.tf,access.tf,versions.tf}` already use
  the CF provider v5 for DNS + Access. `versions.tf:13` documents the `CLOUDFLARE_API_TOKEN`
  scope as **"Zone:DNS:Edit + Account:Cloudflare Pages:Edit"** — no WAF/Firewall permission, so
  `cloudflare_ruleset` will 403 until the token is widened (prerequisite, Risk 7).

## Design

Everything is provisioned as `cloudflare_ruleset` resources in `infra/terraform/` (CF provider
v5 already pinned) — same IaC pattern the repo uses for DNS/Access. Two ruleset phases:
`http_request_firewall_managed` (WAF managed rules) and `http_ratelimit` (rate limiting). All
apply is DEPLOY-class → operator-gated `terraform apply`, staged behind a `terraform plan`.

### 1. Plan-tier constraint (drives the whole rule set — this is the central fork)

CF rate-limit/WAF capability by plan. **Capability rows verified live 2026-07-02** against
`developers.cloudflare.com/learning-paths/application-security/rate-limiting/features/` + the
`cloudflare/cloudflare-docs` partial `rate-limiting-availability-by-plan.mdx` (doc last-modified
2026-04-16) — the rules/zone, match-field, and window rows below were confirmed exact against
those live pages. **Plan dollar pricing is NOT verified here:** the CF pricing page did not
render per-zone figures on the 2026-07-02 pass, so the `~$20/mo/zone` (Pro) and `~$200/mo/zone`
(Business) numbers are indicative training-recall only — **operator to confirm against
`cloudflare.com/plans/` before the Fork-B cost decision.**

|                            | Free (current)                                             | Pro (~$20/mo/zone — operator-verify)          | Business (~$200/mo/zone — operator-verify) |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Rate-limit rules / zone    | **1**                                                      | 2                                             | 5                                          |
| Match fields               | **Path + Verified Bot only** (no `http.host`)              | + Host/URI/Full-URI/Query                     | + Method/Source-IP/User-Agent              |
| Counting/mitigation window | fixed 10s                                                  | up to 1 min                                   | up to 10 min                               |
| WAF Managed Rules          | **Free Managed Ruleset only** (baseline high-severity CVE) | full Cloudflare Managed Ruleset (OWASP-style) | full                                       |

**The Free tier fits only because the protected routes have zone-unique path names today**
(`/webhook`, `/issue`, `/query`) — a single Free rule can `OR` several paths into one
expression, but they share one counter/threshold and there's no `http.host` to disambiguate by
subdomain. This is workable but fragile (a future service reusing `/query`/`/issue` on another
proxied host silently widens the one rule's blast radius) and leaves zero headroom. Pro's
host-field + 2nd rule + full managed ruleset is the natural fit — a **cost fork the operator
owns** (Fork B).

### 2. WAF managed rules (no fork — pure upside on the current $0 tier)

Deploy the **Free Managed Ruleset** on the zone via a `http_request_firewall_managed` ruleset.
Covers all currently-proxied hosts (apex/www/admin) with baseline high-severity CVE protection
at $0. If Fork B lands Pro, swap in the full Cloudflare Managed Ruleset in the same resource.

### 3. Rate-limit rules (shape depends on Fork A + Fork B)

One `http_ratelimit` ruleset. Rule priority order matters — a Skip/bypass rule MUST evaluate
**before** any counting/block rule.

- **Expensive-path rule** (always) — the highest-value target. Matches the origin-$/abuse path
  set: `/query` (docs — OpenRouter embed spend), `/api/auth/*` (site login, better-auth —
  currently has **zero** rate limiting at any layer, highest-value quick win, no DNS change
  since apex is already proxied). On Free this is the single allowed rule (paths OR'd, shared
  threshold); on Pro it splits by host into a dedicated rule.
- **`/issue` + admin defense-in-depth** (Pro-gated — needs a 2nd rule) — a rate-limit rule
  behind the existing bearer / Access+JWT gates.
- **Paddle skip rule** (only if Fork A flips `license` to proxied) — a Skip rule scoped to
  Paddle's published webhook IPs + `/webhook` path + the `Paddle` user-agent, **ordered
  first**, so no rate-limit/WAF/challenge action ever touches a webhook POST. Paddle webhook
  source IPs (**verified live 2026-07-02** against
  `developer.paddle.com/webhooks/about/respond-to-webhooks`) — Live: `34.232.58.13`,
  `34.195.105.136`, `34.237.3.244`, `35.155.119.135`, `52.11.166.252`, `34.212.5.7`; Sandbox
  differs: `34.194.127.46`, `54.234.237.108`, `3.208.120.145`, `44.226.236.210`,
  `44.241.183.62`, `100.20.172.113`. Paddle's own guidance on that page is precisely this rule
  shape — "configure your firewall to bypass bot checks on webhook endpoint paths … use Paddle
  IP addresses and match `Paddle` as the user agent." Paddle requires a 200 within 5s and
  retries on failure (sandbox: 3× within 15 min; live: 60× over 3 days) — a challenge/limit
  here silently drops real purchase-provisioning events. **The IP list is NOT contractually
  pinned; re-verify at build time (Task 5), preferably by fetching Paddle's live allowlist
  endpoint `GET /ips` (environment-scoped: sandbox base URL → sandbox IPs, production →
  production), rather than hardcoding the snapshot above (Risk 3).** Source-IP matching in a
  Skip rule needs the Method/Source-IP fields → **Business** tier, OR (cheaper) keep `license`
  grey (Fork A default) and skip this rule entirely.

### 4. Provisioning + token scope (prerequisite)

`cloudflare_ruleset` requires the `CLOUDFLARE_API_TOKEN` scope widened beyond the current
DNS+Pages (`versions.tf:13`) to include **Zone:WAF:Edit** (or equivalent Firewall permission).
Widen the token in the CF dashboard + update the `versions.tf` scope comment first — a small,
easy-to-miss prereq that otherwise 403s every apply.

### 5. Staging / verification — the gate-probe convention

Verify with the established **no-`-L`** curl gate-probe (project memory
`golive-tail-merge-deploy-wave.md`: `curl -L` follows a CF-Access/challenge 302 to a page that
200s → false "looks open"). Read status + redirect target directly:
`curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<host>/<path>`. A rule that
engaged returns **429/403 + a `cf-ray` header** (add `-D -` to read it); a Paddle-path probe
against a flipped `license` must **pass through** (200, no challenge redirect). Stage against
the Paddle **sandbox** flow first (pre-launch gate still on).

### 6. Rollback

Every CF resource is additive terraform state with **no app-code dependency**:
`terraform destroy -target='<ruleset resource>'` removes a rule, or flip a host's `proxied` back
to `false` to fully remove CF from its path. The app-level limiters keep working unchanged
regardless of the CF layer's state — rollback is fast and total.

### 7. What stays app-level (defense-in-depth, not superseded)

`services/{license,docs}/src/rate-limit.ts` (`X-Real-IP` + `checkGlobal`, ADR-0204) remain the
last-mile guarantee that holds even if CF is bypassed, misconfigured, or (for a still-grey
`license`) simply not in the path. CF is complementary — catches distributed/volumetric abuse
before origin spend and is the only layer that stays correct across a multi-replica deploy.

## Open forks (operator-owned — do NOT auto-decide; lock as the new ADR ≥ 0218)

**Fork A — which grey host(s) to flip to proxied.**

- (a) **Flip `docs-api` only; leave `license` grey.** _[Recommended — confidence HIGH]_ Docs
  has no hard real-time/no-challenge constraint (`/query`, `/llms*.txt` are ordinary
  API/static traffic) → clean CF win, zero Paddle-class risk. License's grey/DNS-only posture
  _already_ satisfies "never rate-limited/challenged" (no CF in the path), so leaving it avoids
  building + forever maintaining the Paddle-IP skip-rule. Evidence: Risks 2 & 4;
  ADR-0108/0116 webhook contract.
- (b) **Flip both; harden `license` with the Paddle skip-rule-above-everything.** More complete
  edge coverage (CF DDoS/WAF also fronts the webhook host) at the cost of ongoing Paddle-IP
  re-sync (Risk 3) + strict rule-ordering discipline (Risk 2) + likely Business tier for
  Source-IP matching. **This option flips `license` off the deliberate grey/DNS-only posture
  ADR-0204 documented → it REQUIRES the new superseding ADR (≥ 0218) to record the amendment;
  it does not silently override 0204.**
- (c) **Flip neither; only add WAF + rate-limit rules to the already-proxied apex/www/admin.**
  Zero DNS change, zero new risk surface; loses edge coverage of the two API hosts. This is the
  strict subset that is pure upside and needs no Fork-A decision at all.

**Fork B — CF plan tier (cost fork).** Stay **Free** (1 rule, no host field — fits only via
zone-unique paths) vs upgrade to **Pro** (2 rules + host field + full managed ruleset) vs
**Business** (needed only if Fork A(b) requires Source-IP skip matching). **The capability
deltas driving this fork are verified live (§1); the per-zone dollar cost is NOT — operator to
confirm current Pro/Business pricing at `cloudflare.com/plans/` before committing the spend**
(`~$20` and `~$200`/mo/zone are indicative only). _Recommendation: ship the Free upside now
(managed ruleset + 1 expensive-path rule), evaluate Pro as a follow-up once real traffic exists
— confidence MEDIUM._ Do not auto-decide; this is a recurring spend the operator owns.

## Tasks

Each task is bounded; verify commands run from repo root. Terraform tasks author + `plan` only
— **`terraform apply` is the operator DEPLOY gate**, not part of EXECUTE.

1. **Widen the CF API token scope (prereq).** In the CF dashboard add Zone:WAF:Edit to the
   token behind `CLOUDFLARE_API_TOKEN`; update the scope comment at `infra/terraform/versions.tf:13`.
   Verify: `cd infra/terraform && terraform validate` passes; a `terraform plan` targeting the
   Task-2 ruleset returns a plan (not a 403 auth error).
2. **WAF Free Managed Ruleset** — add a `cloudflare_ruleset` (phase
   `http_request_firewall_managed`) deploying the CF Free Managed Ruleset on the zone.
   Verify: `terraform plan` shows the ruleset add with no other diff; capture the plan output.
3. **Expensive-path rate-limit rule** — add a `cloudflare_ruleset` (phase `http_ratelimit`),
   one rule matching the `/query` + `/api/auth/*` path set, threshold/window from terraform
   variables (env-tunable). Verify: `terraform plan` shows exactly one rate-limit rule; assert
   the expression references the intended paths.
4. **(Fork A(a)/(b)) Bring `docs-api` under CF** — declare `docs-api.caisson.sh` in
   `infra/terraform/main.tf` (or flip its record to `proxied = true`). Verify: `terraform plan`
   shows the proxied flip; post-apply gate-probe (operator) shows a `cf-ray` header on a
   `docs-api` response and the app still 200s.
5. **(Fork A(b) ONLY) Paddle skip rule + flip `license`** — **first re-verify the Paddle webhook
   IP allowlist at build time** (fetch `GET /ips` against the sandbox + production base URLs, or
   re-read `developer.paddle.com/webhooks/about/respond-to-webhooks`; do NOT trust the §3
   snapshot blind — it is dated 2026-07-02 and the list is not contractually pinned), then add a
   first-priority Skip rule scoped to those IPs + `/webhook` + the `Paddle` UA; set
   `license.caisson.sh` `proxied = true`. Verify: the terraform IP set matches the freshly
   fetched allowlist; `terraform plan` shows the skip rule ordered above the rate-limit rule;
   post-apply sandbox webhook flow returns 200 pass-through (no 403/429/challenge) and a
   non-Paddle flood on `/webhook` is rate-limited.
6. **Staging gate-probe pass + rollback drill** — run the no-`-L` gate-probe against each
   protected path past its threshold (expect 429 + `cf-ray`) and a rollback rehearsal
   (`terraform destroy -target` on one ruleset, re-probe returns to baseline). Verify: probe
   transcript recorded in the SHIP/DEPLOY note; rollback re-probe shows the rule gone.
7. **File the lock ADR + update state.** Write the new ADR (next available, ≥ 0218) recording
   the Fork A + Fork B resolutions and the rule set; update
   `docs/state/decisions-and-forks.md` (move the row from open → locked) and
   `docs/state/providers.md` (CF tier + proxied hosts). Verify: `gw verify docs` (or the repo's
   ADR-index check) passes; `docs/adr-index.md` lists the new ADR.

## Verification (goal-backward)

Re-ask the goal — _is CF's edge rate-limit + WAF now in front of the fleet, without breaking
Paddle, and are the app-level limiters intact?_

- A flood past threshold against a protected path (`/query`, `/api/auth/*`) is stopped at the
  edge — gate-probe returns **429 + `cf-ray`**, and origin logs show the request never
  arrived (edge-terminated).
- The Free Managed Ruleset is live on apex/www/admin — a known-malicious probe returns
  **403 + `cf-ray`**.
- **Paddle is untouched:** if `license` stayed grey (Fork A(a)/(c)) there is provably no CF in
  its path; if flipped (Fork A(b)), the sandbox webhook flow returns **200 pass-through** with
  no challenge, the skip rule sits first in the ruleset order, and its IP set matches the
  allowlist re-fetched at build time (Task 5).
- The app-level limiters are **byte-identical** — `git diff` touches no
  `services/{license,docs}/src/rate-limit.ts`; both still reject over-limit at origin.
- Rollback is proven — `terraform destroy -target` on a ruleset returns the probe to baseline
  with zero app change.
- The lock ADR (≥ 0218) exists and `docs/state/decisions-and-forks.md` + `providers.md` reflect
  the new posture; `terraform plan` is clean (no drift) after apply.

## Risks

1. **Free-tier fit is fragile.** 1 rule, no `http.host` field — safe only because
   `/webhook`/`/issue`/`/query` are zone-unique today; a future service reusing a path silently
   widens the one rule's scope, and there's no headroom for a 2nd rule. Mitigation: the Pro
   evaluation (Fork B); document the zero-headroom constraint in the lock ADR.
2. **Paddle webhook must never be challenged.** A broad Managed-Challenge/JS-Challenge on a
   proxied `license` breaks the webhook (no browser). Mitigation: keep `license` grey (Fork
   A(a), the safe default — current posture already satisfies this) OR a first-ordered Paddle
   Skip rule; getting rule order wrong silently drops real-money provisioning events (Paddle
   retries — sandbox 3×/15 min, live 60×/3 days, confirmed live 2026-07-02 — mask a sustained
   miss as "webhooks just stopped").
3. **Paddle IP-list drift.** The published IP list isn't contractually pinned (confirmed on the
   2026-07-02 live pass — the docs even ship a `GET /ips` API that returns the _current_
   environment-scoped allowlist). If Fork A(b) is chosen, the IP-scoped Skip rule must be
   re-verified at build time (Task 5) and re-synced periodically. Mitigation: pull the allowlist
   from Paddle's `GET /ips` endpoint (sandbox vs production auto-scoped) rather than hardcoding;
   record a re-check cadence in the lock ADR; prefer path + `Paddle`-UA matching where the tier
   allows, so the rule degrades safely if a single IP rotates.
4. **Grey status quo is already the safe default.** `license` grey/DNS-only fully satisfies
   "not rate-limited/challenged." Flipping it is a _net-new_ risk surface taken on only for
   CF's DDoS/edge coverage — a genuine two-way fork (Fork A), not a foregone "flip both."
5. **MCP surface doesn't exist yet.** No public MCP hostname (`apps/base` isn't a live Railway
   service). Designing its rule now is speculative — scoped out; note "same pattern when it
   goes live."
6. **In-process limiters are single-replica-only** (both files' headers). CF-front limiting is
   _genuinely complementary_, not redundant: it's the only layer that stays correct if either
   service scales past 1 replica. This is the core "why now."
7. **Terraform token scope is DNS+Pages-only** (`versions.tf:13`). `cloudflare_ruleset` 403s
   until Zone:WAF:Edit is added — a small, easy-to-miss prereq (Task 1); touches a credential
   (`secrets` tag).
8. **CF plan pricing is unconfirmed.** The per-zone dollar cost (Pro/Business) could not be
   verified on the 2026-07-02 live pass — the pricing page returned no figures. Fork-B is a
   recurring-spend decision; the operator must confirm current pricing at `cloudflare.com/plans/`
   before committing. Lower stakes than the IP list (a wrong price mis-informs a cost decision,
   it does not break payments), but not to be presented as settled.

## ADR interactions

- **ADR-0204 (strix-pentest-remediation)** — **REALIZES** the DEPLOY-class deferral this item
  was filed under. Does **NOT supersede** ADR-0204's app-level `X-Real-IP` + `checkGlobal`
  limiters — they stay as defense-in-depth (Non-goals, Design §7). If Fork A(b) is chosen, the
  license-flip **AMENDS** the deliberate grey/DNS-only posture ADR-0204 documented for
  `license.caisson.sh`; that amendment is recorded in this item's own new ADR (≥ 0218), not a
  supersede of 0204's code fix.
- **ADR-0108 / ADR-0116 (license issuer / billing-scope, Paddle webhook path)** — **EXTENDS /
  PROTECTS.** The webhook contract (200 within 5s, retries, no challenge — re-confirmed live
  2026-07-02) is a binding constraint on any rule touching `license.caisson.sh`; the Paddle
  Skip rule (Fork A(b)) exists solely to honor it.
- **ADR-0082 (site go-live posture; removable pre-launch `site_gate`)** — **EXTENDS.** WAF +
  rate-limit rules coexist with and outlive the removable Access gate; staging happens against
  the sandbox while the gate is still on. Rules must not assume the gate is present.
- **ADR-0138 / ADR-0140 (admin control-plane + permanent `admin_gate`)** and ADR-0204's admin
  CF-Access-JWT middleware — **EXTENDS.** An admin rate-limit rule is defense-in-depth _behind_
  the existing Access + in-app JWT gate, never a replacement for it.
- **ADR-0114 / ADR-0115 (unified Railway hosting + Railway PG)** — context only. This layer
  sits at CF's edge in front of the Railway origins; no hosting-mode change.
- **New ADR (≥ 0218)** — on operator lock, file the next-available ADR (ceiling is currently
  **0217**) recording the Fork A hostname resolution, the Fork B plan-tier resolution, and the
  final rule set. Append-only; do not edit an existing ADR to record this.
