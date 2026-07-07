---
updated: 2026-07-07
status: live
---

# Caisson LAUNCH-ACT runbook

**Status: RUNBOOK — operator-executed, not autonomous (DEPLOY-class per doctrine).** Nothing in this
file runs inside the autonomous SPEC→PLAN→EXECUTE→VERIFY→SWEEP→SHIP loop; every command below is a
human hand at the keyboard. Doctrine: `identity/doctrine.md` (Autonomy line + DEPLOY, gridwork-core).

This is the executable act ADR-0107 named ("the deliberate launch act") and ADR-0107's own checklist
deferred: take `caisson.sh` from **pre-launch** (Cloudflare-Access-gated, Paddle SANDBOX) to **live
self-serve** (public, Paddle PRODUCTION). It supersedes ADR-0107's step-10 mechanics in one place (§3
below) because the underlying Terraform file that step points at has since grown a second, unrelated,
PERMANENT gate — see the correction in §0.

---

## 0. Read this first

### What "pre-launch" means today (verified against code + Terraform, 2026-07-02)

- **Hosting moved off Cloudflare Pages onto Railway** between when ADR-0107 was written (2026-06-29)
  and now (ADR-0114/0115, cutover 2026-07-01). The Pages project is torn down
  (`infra/terraform/main.tf` lines 12–14). `caisson.sh` + `www.caisson.sh` are now Cloudflare-proxied
  CNAMEs to the Railway `caisson-site` service; Cloudflare Access still gates them because Access is
  **hostname-bound**, not origin-bound (`infra/terraform/main.tf` lines 1–4, 16–35).
- **Paddle is the sole buyer-purchase webhook source** (ADR-0200) — the platform holds no Stripe
  webhook route or secret (ADR-0116). The webhook is mounted at `POST /webhook` on the `caisson-license`
  Railway service (`services/license/src/app.ts` lines 263–336), reachable at
  `https://license.caisson.sh/webhook`.
- **Paddle is wired end-to-end today, but against the SANDBOX catalog.** The pricebook's
  `purchases.ts`, `renewals.ts`, and `plans.ts` (the server-side grant/renewal resolvers) and
  `apps/site/lib/catalog.ts` (the client-side checkout catalog) all carry **real Paddle SANDBOX
  price ids** for the ADR-0257/0258 six-bundle catalog (`pri_01kwwqa…`, W7 big-bang 2026-07-06:
  6 bundles, 22 modules, the per-SKU renewal rows, and the 2 annual subscriptions; the 4 edition
  products and the legacy $1,499 bundle are ARCHIVED sandbox-side and reject transactions). This
  is not a placeholder — the W7 rebuild was smoke-tested per SKU class via pricing-preview, and
  the earlier end-to-end sandbox checkout proof stands (commerce-goes-live session, 2026-07-01).
- **The license issuer's production signing key is ALREADY provisioned and baked in** — this is NOT a
  launch-day step. `infra/license-issuer/ISSUER_PUBLIC_KEY.md` records the production Ed25519 keypair;
  the ADR-0226 rotation EXECUTED 2026-07-05 (×2 — PRs #117/#118; the rotation-1 fixture was itself a
  leaked prod token, so the key rotated again). Active fingerprint: **`a170f7a0ab89bab0`**; the
  `0ae7d2abb886ca3d` and `c0bfb8277a840d2e` keys are retired (see that file's retired-keys table).
  `packages/license-verify/src/verify.ts` carries the active baked key; the license service + registry
  Worker were redeployed on it. §5 below only re-verifies it works.

### Critical correction to ADR-0107's flip mechanic

ADR-0107 §3 says "delete `infra/terraform/access.tf` … or flip the policy `decision` from `allow` to
`bypass`." **Deleting the whole file is now wrong.** `access.tf` was extended by ADR-0138/ADR-0140
(2026-06-30) to also hold `admin_gate` — the **permanent**, unrelated Cloudflare Access application
gating `admin.caisson.sh` (the operator control-plane). The file's own header comment says this in
plain language: "Unlike the pre-launch site gate (removed at go-live), this app is permanent … so the
go-live step that opens/removes `site_gate` cannot also open `admin.caisson.sh`"
(`infra/terraform/access.tf` lines 55–61). **§3 below flips only the `site_gate` resource's
`decision` and `include` fields in place — it never touches `admin_gate` and never deletes the
file.**

### What this runbook does NOT cover (out of scope / already done)

- Discord role-grant wiring (ADR-0203) — built and deployed; §4's verify step checks it, this runbook
  doesn't build it.
- License issuer keypair generation — done (see above).
- CF-Access-JWT middleware on `apps/admin` (ADR-0204 vuln-0003 fix) — separate, permanent, unrelated to
  this flip. Do not touch `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` on `caisson-admin`.
- SSRF guard, rate-limit trusted-IP fix, BYOK owner-gate (ADR-0204) — already shipped in code, nothing
  to do here.

---

## 1. Pre-flight blockers (resolve before starting §2)

These are **operator-owned, not box-drivable**, and are cited gaps this session found while researching
— not new asks invented for this doc.

| #   | Blocker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                  | Status (as of this session)                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Paddle production account** does not exist yet — only Sandbox is configured. `PADDLE_API_KEY` on `caisson-license` today is `pdl_sdbx_*`-shaped.                                                                                                                                                                                                                                                                                                                                                | `docs/state/go-live-legal-and-entity.md` line 61: "Paddle SANDBOX → production … Hard blocker."                           | **OPERATOR TO DO** — §2 walks it.                                                                                                                                                                                                                                                                                                        |
| P2  | **Paddle MoR attribution line + refund policy** — RESOLVED 2026-07-03. The MoR attribution (Paddle's verbatim required text) + a refund section landed via PR #61 (commit `89a1a87`, after this row's grep ran); the refund policy was then rewritten to match Paddle's buyer terms / Refund Policy (14-day EU/UK statutory withdrawal + digital-delivery waiver + per-line refunds per ADR-0218/0200) — the paddle-legal copy PR. Residual: none; re-verify the pages render before flipping §3. | `apps/site/app/legal/terms/page.tsx` ("Payment processing — Paddle (Merchant of Record)" + "Refund policy" sections).     | **VERIFIED 2026-07-05** — `bun run build` + the standalone server (`.next/standalone`, the same `bun apps/site/server.js` entry point the Dockerfile runs) served `/legal/terms`, `/legal/privacy`, and `/legal/eula` locally: all three 200, and the "Paddle (Merchant of Record)" attribution line renders verbatim on `/legal/terms`. |
| P3  | **Per-module production price ids don't exist yet** — the 11 standalone module SKUs (ADR-0238 dropped the four edition-core rows; ADR-0227's sweep minted the SANDBOX products) carry real SANDBOX `pri_…` ids in `packages/pricebook/src/purchases.ts` + `apps/site/lib/catalog.ts` (`MODULE_PRICE_IDS`), so per-module checkout IS wired against sandbox. Paddle Production mints entirely new ids — same posture as the editions/bundle/subscriptions in §2.2–2.3.                             | `apps/site/lib/catalog.ts` (`MODULE_PRICE_IDS`); `packages/pricebook/src/purchases.ts` (REAL module rows, 2026-07-02).    | **FOLDED INTO §2.2/§2.3** — mint the 11 module Products/Prices in production and fill both books in the same commit as the edition/bundle ids. No separate operator fork remains (the old wire-or-hide choice is obsolete: sandbox wiring shipped 2026-07-02).                                                                           |
| P4  | **Discord privileged intents + role/channel env** — `SUPPORT_CHANNEL_ID` / `MEMBER_ROLE_ID` and the Developer Portal's Server Members + Message Content intents were the last-known-pending item (2026-07-01). May already be resolved — **verify, don't assume.**                                                                                                                                                                                                                                | `docs/state/p6-deploy-runbook.md` lines 37–45; `docs/state/go-live-legal-and-entity.md` line 66.                          | **VERIFY** — §4 has the check.                                                                                                                                                                                                                                                                                                           |
| P5  | **Rotate the three transited credentials** — `OPENROUTER_API_KEY`, `DISCORD_TOKEN`, `MIRROR_PUSH_TOKEN` all transited a chat session/transcript and are an ADR-0226 Fork-4 _incident_ (rotation mandated, not optional). Full per-credential runbook: §1.1 below. The issuer-keypair half of the sitting is DONE: the fresh launch Ed25519 keypair + `LICENSE_ISSUE_TOKEN` rotated 2026-07-05 (×2, PRs #117/#118 — §1.1 step 1).                                                                  | ADR-0226; `outputs/specs/audit-v2-remediation/p0-license-token-cred-incident/SPEC.md` (findings `4460dfca` / `47b2f472`). | **Issuer keypair + `LICENSE_ISSUE_TOKEN`: ROTATED 2026-07-05.** The three web-minted values (`OPENROUTER_API_KEY` / `DISCORD_TOKEN` / `MIRROR_PUSH_TOKEN`) remain **OPERATOR TO DO — block the caisson-oss public flip** (§1.1 sequencing gate).                                                                                         |
| P6  | **Business entity** — operator locked sole-proprietor-until-first-sale (Paddle accepts an Individual seller: gov ID + W-9 + payout account). Not a blocker for §2.                                                                                                                                                                                                                                                                                                                                | `docs/state/go-live-legal-and-entity.md` lines 9–26.                                                                      | **NO ACTION NEEDED** — informational only, included so you don't second-guess it mid-flip.                                                                                                                                                                                                                                               |
| P7  | **WORM retention-mode flip GOVERNANCE → COMPLIANCE (ADR-0230)** — the live `caisson-worm` default stays GOVERNANCE pre-launch; at the commerce flip, escalate launch-forward anchors to COMPLIANCE via the ADR-0202 gated extend-only escalation (explicit operator DEPLOY act, never autonomous). Pre-launch GOVERNANCE-era anchors are not retro-escalated by default.                                                                                                                          | ADR-0230; §7's DEPLOY block landed the live anchors under GOVERNANCE (Mode GOVERNANCE, RetainUntilDate 2033).             | **LAUNCH GATE** — execute alongside the §2 Paddle production flip.                                                                                                                                                                                                                                                                       |

---

## 1.1 Credential-rotation runbook (P5 — operator value-handling; agent never touches values)

Executes ADR-0226 Fork 1 + Fork 4 for the P0 audit incident
(`outputs/specs/audit-v2-remediation/p0-license-token-cred-incident/SPEC.md`). Batch all four in
one sitting; mirror every new value into the `Caisson Launch` 1Password vault (title === env var
name, ADR-0226 Fork 3) and `~/.gridwork/caisson.env`.

1. **Ed25519 issuer keypair + `LICENSE_ISSUE_TOKEN`** — **DONE 2026-07-05 (rotated ×2)**: the
   agent-side bake landed as PR #117 (injectable verifier + runtime dev-key fixtures + negative bake
   pins + the entitlement-token scan gate), the review pass caught the re-minted worker fixture as
   itself a live prod token, and the key rotated AGAIN (PR #118). `caisson-license` + the registry
   Worker redeployed on fingerprint `a170f7a0ab89bab0`; old-key tokens are dead. Original runbook
   text kept below for the mechanics: mint a fresh keypair per
   `infra/license-issuer/ISSUER_PUBLIC_KEY.md` "Rotation"; private half → `CAISSON_LICENSE_SIGNING_KEY`
   (PKCS8 DER, base64) in `~/.gridwork/caisson.env`; fresh bearer → `LICENSE_ISSUE_TOKEN`. Then hand
   the PUBLIC half to the agent side: verify.ts `LICENSE_PUBLIC_KEY_SPKI_B64` + the registry
   Worker's baked verify key update in ONE commit, redeploy `caisson-license` + the Worker
   (the parked key-bake follow-up PR). Rationale: real prod-signed tokens were committed
   (now deleted from HEAD, still in git history + published mirror snapshots); offline verify has
   no revocation list, so rotating the baked key is the ONLY way to invalidate them.
2. **`OPENROUTER_API_KEY`** (support-bot RAG + memory embeddings): mint fresh with a per-model
   spend cap → env + vault; revoke the leaked key. Probe: support-bot `/healthz` green + one
   embed call succeeds.
3. **`DISCORD_TOKEN`** (support-bot login): regenerate in the Developer Portal (minimal gateway
   intents) → env + vault; the old token dies on regenerate. Probe: bot Online in the guild.
4. **`MIRROR_PUSH_TOKEN`** (GH secret on `caisson-sh/caisson`): mint a fine-grained PAT scoped to
   `caisson-sh/caisson-oss` ONLY with **Contents: read-write AND Workflows: read-write** →
   `gh secret set MIRROR_PUSH_TOKEN`; revoke the transcript-leaked PAT. The Workflows permission
   is REQUIRED, not optional: the mirror snapshot carries `.github/workflows/` (the oss repo owns
   npmjs publishing per ADR-0222) and the current token lacks it — **`mirror-sync` has been failing
   on every `main` push since 2026-07-04** ("refusing to allow a Personal Access Token to
   create or update workflow ci.yml without workflow scope"). Non-blocking today (mirror is
   PRIVATE, publish is manually gated) but the rotation must fix it. Probe: `mirror-sync`
   workflow_dispatch → green force-push.

**Sequencing gate (P0 spec Task 5): the caisson-oss public flip + first `confirm=publish` npm
dispatch MAY NOT proceed until** (1) the keypair rotation is live (license service + Worker
redeployed on the new key) — **DONE 2026-07-05**, (2) the golden/demo dev-key replacements are
merged (P0 agent-side PR) — **DONE 2026-07-05 (PR #117)**, (3) the entitlement-token scan gate is
green on a fresh mirror export, and (4) all three rotations above are confirmed with probes green +
old values revoked — **steps 2–4 (OpenRouter / Discord / mirror PAT) still OPERATOR TO DO**. Record
rotation dates here when done. (Related, same flip gate but tracked in the pre-launch sweep SPEC: the granular
`@caisson-sh`-scoped `NPM_TOKEN`.)

---

## 2. Step 1 — Paddle production credential + catalog swap

### 2.1 Create the Paddle production account

1. In the existing Paddle account (Sandbox was created against `caisson.sh`), request **Production**
   access: Paddle Dashboard → complete seller verification (business/individual details, payout
   account, tax forms). This is a Paddle-side review — allow lead time.
2. Confirm you're using **Paddle Billing**, not legacy Paddle Classic (already true for Sandbox; keep
   it consistent).

### 2.2 Recreate the product catalog in Paddle PRODUCTION

Paddle Sandbox and Production are **separate catalogs with separate ids** — nothing carries over
automatically. The target is the **ADR-0257/0258 six-bundle catalog exactly as the W7 sandbox
big-bang built it (2026-07-06)** — production recreation is a re-run of the same target table with
production ids swapped in. `apps/site/lib/pricing.ts` (`BUNDLE_PRICES`/`MODULE_PRICES`/`PLAN_PRICES`)
is the live display SOT and already carries every amount; `packages/pricebook/src/upgrades.ts`
(`BUNDLE_RETAIL`/`SKU_RETAIL`) is the cents authority. The idempotent rebuild is scripted at
**`tools/paddle-catalog-recreate.ts`** (CAISSON-31): it derives this exact table from
`apps/site/lib/pricing.ts` (no hand-typed amounts, so it cannot drift from the site or pricebook),
prints the create plan on a **dry run (default)**, and creates against the Paddle API with
`--execute` (reads `PADDLE_API_KEY`, `PADDLE_ENV` switch defaults to `sandbox`), idempotent by
`custom_data` so a re-run skips existing objects and never duplicates; every product gets
`tax_category: saas`. `bun tools/paddle-catalog-recreate.ts --self-check` pins the 31-product shape
and the ADR-0260 numbers. (The earlier ad-hoc rebuild pattern is in the PR #130 record.)

| Product (bundles)  | Price            | Billing               | ADR         |
| ------------------ | ---------------- | --------------------- | ----------- |
| Compliance         | $1,049.00        | one-time              | ADR-0258    |
| AI-Production      | $739.00          | one-time              | ADR-0258    |
| Local-first        | $629.00          | one-time              | ADR-0258    |
| Agentic-Dev        | $329.00          | one-time              | ADR-0260    |
| Provenance         | $399.00          | one-time              | ADR-0260    |
| Everything         | $2,059.00        | one-time              | ADR-0258    |
| Compliance-Updates | $1,499.00 / year | recurring annual      | ADR-0106    |
| Developer          | $499.00 / year   | recurring annual      | ADR-0106    |
| Enterprise / SLA   | —                | no price (Contact us) | ADR-0095 §2 |

Plus, exactly as in sandbox: the **22 à-la-carte module SKUs** ($49–$299, `MODULE_PRICES` /
`SKU_RETAIL` — the 11 original modules + the 11 W7 carve/standalone SKUs incl. ui-pro $129 and
credits) and the **per-SKU "Updates Renewal" prices** at the ADR-0260 §5 flat-40% X9 cents
(bundles $419/$289/$249/$129/$159/$819 + the per-module ladder). Do NOT create edition products —
the four editions and the legacy $1,499 bundle are RETIRED (archived in sandbox; legacy
entitlements resolve via the alias map forever).

Do **not** re-use the Sandbox price ids — Paddle Production mints entirely new `pri_…` ids.

### 2.3 Update the two source files that resolve Paddle price ids to grants

This is a **code change**, not an env var. Both books fail closed on an unrecognized price id
(`resolvePurchase`/`resolvePlan` throw — `ConfigError`, ADR-0089 §6 / ADR-0113), so a missed row means
a real paid purchase grants nothing rather than silently succeeding — get this right before flipping.

1. `packages/pricebook/src/purchases.ts` — replace the W7 sandbox keys (the 6 bundle rows + the
   22 module-SKU rows, `pri_01kwwqa…`/`pri_01kwj…` sections) with the new production `pri_…` ids
   from §2.2. Bump `PURCHASE_BOOK_VERSION` (append-only per ADR-0006 — do not edit a version in
   place, bump the date-stamp string).
2. `packages/pricebook/src/renewals.ts` — replace the renewal-price sandbox keys (the 16 legacy +
   12 W7 rows) with the production renewal ids; bump `RENEWAL_BOOK_VERSION`. And
   `packages/pricebook/src/plans.ts` — replace the 2 subscription keys (`developer`,
   `compliance_updates`); bump `PRICEBOOK_VERSION`.
3. `apps/site/lib/catalog.ts` — replace `BUNDLE_PRICE_IDS` (all 6) and `MODULE_PRICE_IDS` (all 22)
   with the same new ids — **byte-identical to the pricebook's keys**, or a buyer's checkout passes
   a price id the webhook's resolver doesn't recognize (`catalog.test.ts` pins this cross-package
   invariant against `PURCHASE_BOOK` — run it after editing, see verify below).
4. The retired ids get NO production counterpart — the four ADR-0238 edition-core rows, the four
   archived edition products, and the legacy $1,499 bundle stay unmapped so `resolvePurchase`
   keeps failing closed on stale redeliveries, and `pruneCart` (LIVE_PRICE_IDS) keeps dropping
   persisted cart lines that carry them.
5. Run `bun test packages/pricebook packages/registry-schema apps/site/lib/catalog.test.ts` (or `bun run check`
   for the full gate) before committing — this is a normal EXECUTE-act code change, commit it through
   the standard 7-act flow, not by hand-editing on `main`. **Do this well before the flip window** — it
   ships through the ordinary PR + CI + merge path with the in-session SHIP audit lane on the diff
   (money seams → gw-security-auditor on fable, per `CLAUDE.md`'s PR review gate section).

### 2.4 Set production credentials on Railway

Paddle Dashboard → Developer Tools → Authentication (Production environment):

**`caisson-license`** (`services/license/src/server.ts` lines 67–81 read these):

```bash
railway variables --service caisson-license \
  --set "PADDLE_API_KEY=<pdl_live_...>" \
  --set "PADDLE_WEBHOOK_SECRET=<new production webhook signing secret, from §2.5>" \
  --set "PADDLE_ENV=production"
```

**Gotcha (load-bearing):** `PADDLE_ENV` on the server defaults to `"production"` for ANY value other
than the literal string `"sandbox"` (`server.ts` line 71: `process.env.PADDLE_ENV === "sandbox" ?
"sandbox" : "production"`). If the service currently has `PADDLE_ENV=sandbox` set, you must either
overwrite it to `production` or unset it — leaving it as `sandbox` after swapping the API key will
route Production-shaped requests at Paddle's Sandbox API base and fail closed at Paddle's end.

**`caisson-site`** (`apps/site/lib/paddle-checkout.ts` lines 14–17, 26–39 read these — client-exposed):

```bash
railway variables --service caisson-site \
  --set "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<production client-side token>" \
  --set "NEXT_PUBLIC_PADDLE_ENV=production"
```

**Gotcha (the opposite default, easy to invert by accident):** the client reads the **opposite**
default from the server — `NEXT_PUBLIC_PADDLE_ENV` defaults to `"sandbox"` unless it is **exactly**
`"production"` (`paddle-checkout.ts` line 15). You must explicitly set it, not just remove it.

**Gotcha (build-time inlining):** `NEXT_PUBLIC_*` vars are baked into the JS bundle at **build** time,
not read at runtime. A Railway "restart" that reuses an old image will NOT pick up the new value — you
need a fresh `railway up` (or a new deploy triggered by the §2.3 commit landing on `main`, if
auto-deploy is armed) so Next.js rebuilds with the new env in scope.

### 2.5 Point the Paddle webhook at production + capture the new signing secret

1. Paddle Production Dashboard → Developer Tools → Notifications → add a destination:
   `https://license.caisson.sh/webhook`.
2. Subscribe to exactly these event types — verified against what the parser actually switches on
   (`packages/billing/src/paddle-events.ts` lines 199–234): `transaction.completed`,
   `subscription.created`, `subscription.updated`, `subscription.canceled`, `adjustment.updated`.
   **`adjustment.updated` is easy to miss** — it's the refund settlement event (an approved refund
   fires `adjustment.updated` with `action=refund, status=approved`, which the mapper turns into
   `refund.completed` and claws back credits/entitlements, `paddle-events.ts` lines 219–234). Without
   it subscribed, a Production refund will never revoke access.
3. Capture the destination's signing secret → feed it into §2.4's `PADDLE_WEBHOOK_SECRET`.
4. `license.caisson.sh` is **not** behind Cloudflare Access and **not** Cloudflare-proxied — it's a
   grey-cloud DNS-only CNAME straight to Railway (`infra/terraform/main.tf` lines 57–68, comment: "the
   Paddle Merchant-of-Record webhook endpoint Paddle's servers must reach directly"). No CF-Access
   change is needed or possible for this endpoint — it was never gated.

### 2.6 Redeploy

```bash
railway up -y --service caisson-license --ci
railway up -y --service caisson-site --ci
```

(Or let the §2.3 merge + armed auto-deploy — `deploy-railway.yml` — do it, if that's wired; verify
either way per §4.)

### Verify (§1 of the required probes)

```bash
# license service is up and reading the new provider config (does not leak which env)
curl -sS https://license.caisson.sh/health
# → {"ok":true}

# /issue still fail-closed on a bad bearer — proves the service booted with LICENSE_ISSUE_TOKEN set,
# unrelated to the Paddle swap but cheap to re-check after any redeploy
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://license.caisson.sh/issue \
  -H "Authorization: Bearer wrong" -H "Content-Type: application/json" -d '{}'
# → 401

# webhook now fails closed on an UNSIGNED request (proves PADDLE_WEBHOOK_SECRET is set — a 401 here
# is correct and expected; do NOT expect a 200 without a real Paddle signature)
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://license.caisson.sh/webhook -d '{}'
# → 401

# Paddle dashboard: Developer Tools → Notifications → the new destination shows "Active"
```

**The real end-to-end check is a live test purchase — do this only after §3's legal-content gap (P2) is
resolved, since a real buyer could otherwise land on checkout.** Two options:

- **(a) Real SKU, real refund.** Buy the cheapest wired SKU (Agentic-Dev, $249) with a real card at
  `caisson.sh` (through the CF-Access gate, as yourself, before flipping §3), then:
  1. Confirm Paddle Dashboard → Notifications shows the `transaction.completed` delivery as
     **200 delivered** to `/webhook`.
  2. Confirm the buyer account's `/dashboard` shows the `agent-dev` entitlement granted.
  3. `POST /issue` (Bearer `LICENSE_ISSUE_TOKEN`, body `{"accountId": "<the buyer's account id>",
"tier": …, "major": 0, "expiry": null}`) returns a signed token whose claims include
     `agent-dev` — confirms the grant → entitlement-resolve → sign path is live end to end.
  4. `curl -H "Authorization: Bearer <that token>" https://caisson-registry.<account-subdomain>.workers.dev/modules/<an agent-dev-member module id>`
     returns **200** (was 404 pre-purchase) — confirms the registry Worker's entitlement filter
     (`registry/worker/handler.ts` lines 78–139) reads the license correctly against production.
  5. Refund the transaction from the Paddle dashboard. Confirm the mapper's `adjustment.updated` path
     fires: the entitlement flips to revoked and the registry re-check in step 4 goes back to 404.
     (Refund settlement is asynchronous on Paddle's side — allow a few minutes before re-checking.)
  6. If Discord linking + push is configured, confirm the buyer's linked Discord account received the
     `agentic-dev` role (`ADR-0203`), and that the refund does **not** auto-remove it — role removal on
     refund is a deliberate manual step (`/role-remove` in the support bot), not automated.
- **(b) Cheap throwaway Product.** Create a temporary $1 one-time Product/Price in Paddle Production
  (not part of the real catalog, no pricebook row), run steps 1–2 above against it via a raw
  `Paddle.Checkout.open({items:[{priceId: "<temp price>", quantity:1}], customData:{account_id: "..."}})`
  console call, confirm the webhook fires and grants nothing incorrectly (an unrecognized price id
  should make `apply-billing-event`'s resolver throw — confirm the failure mode is a clean 500 +
  Paddle retry, not a silent 200), then archive the temp Product. Lower-fidelity than (a) — it doesn't
  exercise a real SKU's grant path — but avoids a real $249 charge if you only want to prove
  signature-verify + delivery plumbing.

**Paddle production does not accept test cards** — either option involves a real charge. There is no
sandbox-in-production equivalent.

### Rollback (§1)

- **Wrong price ids / broken grant path discovered after redeploy:** revert the §2.3 commit (new PR,
  not a force-push — `identity/doctrine.md` atomic-commit rule) and redeploy both services from the
  prior commit. The old Sandbox ids are harmless in Production (they simply won't match anything real
  Paddle sends), so reverting is safe and fast.
- **Compromised or wrong Production API key/webhook secret:** rotate immediately in the Paddle
  dashboard (Developer Tools → Authentication → regenerate) and re-run §2.4/§2.6. The old secret stops
  verifying signatures the moment you regenerate — no separate revoke step.
- **A bad live transaction already granted something wrong:** refund it from the Paddle dashboard (see
  verify step 5 above) — the mapper's refund path claws back unspent credits and soft-revokes the
  entitlement grant automatically; it does not touch already-consumed credits (by design, ADR-0113).
- **You are not ready to keep Production live at all:** you can leave `PADDLE_API_KEY`/`PADDLE_ENV` as
  Production on the services (harmless with no real traffic) and simply not proceed to §3 — the CF-Access
  gate staying up is what actually keeps the public off checkout. Section 3's rollback is the real safety
  net, not this one.

### 2.7 Configure Retain dunning + map the subscription lifecycle to entitlements

> Added 2026-07-07 (D7 Paddle prep, CAISSON-31). This is a **live-doc update to operational
> procedure**, not an ADR — the runbook records how the flip is run; append-only rules govern
> `knowledge/decisions/`, not this file.

Only the two annual subscriptions (Compliance-Updates, Developer) have a dunning lifecycle; one-time
bundle/module purchases do not. Two settings make a failed renewal end in a clean revoke rather than
a silent access leak.

**a) Retain → Payment recovery → set to Cancel (NOT Pause).** Paddle Production Dashboard → Retain →
payment-recovery/dunning settings. On the final failed retry Paddle must **cancel** the
subscription, not pause it. This **cannot be verified in Sandbox** — it is a Production Retain
config; set it during the flip. Why it is load-bearing: the entitlement-revoke path keys on the
`subscription.canceled` event (`services/license/src/apply-billing-event.ts` →
`revokeSubscriptionGrants`). If Retain is left on **Pause**, a non-paying subscription goes
`status=paused` and **never** fires `subscription.canceled`, so its updates entitlement keeps
resolving forever — access after non-payment. Cancel is also consistent with the 40%-renewal
re-purchase design: a canceled sub is not reinstated, the buyer re-purchases.

**b) Subscribe to the lifecycle events (already in §2.5's list) and know the entitlement mapping.**
Paddle's default is auto-cancel at day 30 after 7 retries: `subscription.past_due` → retries →
`subscription.canceled`. The mapper's behaviour, grounded in `apply-billing-event.ts`:

| Paddle subscription lifecycle                      | Normalized event                    | Entitlement effect                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `past_due` (inside the dunning retry window)       | none — deliberately **not** handled | **Still entitled (grace).** No revoke fires while Paddle retries; the buyer keeps updates access through the retry window. Nothing to wire — grace is the _absence_ of a revoke.          |
| `subscription.canceled` (Retain gives up → Cancel) | `subscription.canceled`             | **Revoke.** `revokeSubscriptionGrants` soft-revokes the grants sourced from this subscription id. An entitlement the buyer _also_ holds via an active one-time grant survives (refcount). |
| `subscription.updated` (plan change)               | `subscription.updated`              | **No effect** (recorded; the proration grant is the deferred SD-1).                                                                                                                       |

So: let `past_due` run its retries (grace, no action), and let `subscription.canceled` do the
revoke. Do **not** wire a `past_due` revoke — that would cut a buyer off mid-retry-window.

---

## 3. Step 2 — Pricing final-confirm checkpoint (operator-owned, ADR-0106)

No code change is expected here — this is a **look, don't touch** gate, because ADR-0106 reserved the
final-numbers adjustment to the operator's silent discretion up until the gate flips (ADR-0106 §
"Pre-flip safety clause"; `CLAUDE.md` "Still open" section: "the operator may still adjust a number
before checkout goes live, but the site no longer _says_ so").

1. Open `apps/site/lib/pricing.ts` (`BUNDLE_PRICES`/`MODULE_PRICES`/`PLAN_PRICES`) side-by-side with
   the Paddle Production catalog from §2.2. Confirm every amount matches exactly: Compliance $1,049 ·
   AI-Production $739 · Local-first $629 · Agentic-Dev $329 · Provenance $399 · Everything $2,059 ·
   the 22 module SKUs · Compliance-Updates $1,499/yr · Developer $499/yr (ADR-0258/0260; the
   below-sum + Everything-ladder invariants are CI-pinned in `pricing.test.ts`, so if `pricing.ts`
   is green on `main` the numbers are the locked ones).
2. If you want to change a number **now** (last free window — see ADR-0106's grandfather policy: once
   real buyers exist, every future increase must forward-grandfather existing buyers, never claw back):
   edit `pricing.ts`'s display amount and the matching Paddle Price in the dashboard. The pricebook
   row's dollar amount is NOT stored in code (`purchases.ts`/`plans.ts` carry credits + entitlements,
   never the price — the amount lives only on the Paddle Price object and in `pricing.ts`'s display,
   per the `purchases.ts` header comment lines 68–72). A price change is therefore a **two-place edit**
   (Paddle dashboard + `pricing.ts`), not a pricebook change.
3. This is the last point where a pricing change carries near-zero consistency cost. After §5 (the
   flip), a change requires the grandfather machinery.

**No rollback needed** — nothing is mutated by this step unless you choose to change a number, in which
case rollback is "change it back" in both places.

---

## 4. Step 3 — CF-Access pre-launch gate removal (the launch act)

**Precondition:** §2 is live and verified (a real purchase granted correctly in Production), P2/P3/P4/P5
from §1 are resolved or a conscious operator call has been made on each, and §3's pricing check is done.

### What this touches and what it must NOT touch

`infra/terraform/access.tf` holds two independent resource pairs:

- `cloudflare_zero_trust_access_policy.site_gate` + `cloudflare_zero_trust_access_application.site_gate`
  — gates `caisson.sh` + `www.caisson.sh`. **This is the one you flip.**
- `cloudflare_zero_trust_access_policy.admin_gate` + `cloudflare_zero_trust_access_application.admin_gate`
  — gates `admin.caisson.sh`. **PERMANENT. Do not edit, do not delete, do not flip (ADR-0138/0140/0204).**

### 4.1 Edit `access.tf`

Change the `site_gate` policy resource from an allowlist to a bypass-everyone policy. Verified against
the Cloudflare provider's own schema (`registry.terraform.io/providers/cloudflare/cloudflare` v5.19,
`zero_trust_access_policy` resource: `decision` accepts `"bypass"`; `include` accepts an `everyone = {}`
block — same shape this file already uses for `email_domain`):

```diff
 resource "cloudflare_zero_trust_access_policy" "site_gate" {
   account_id = var.cloudflare_account_id
-  name       = "Caisson site - pre-launch operators (${var.site_access_email_domain})"
-  decision   = "allow"
-  include = [{
-    email_domain = {
-      domain = var.site_access_email_domain
-    }
-  }]
+  name       = "Caisson site - public (post-launch)"
+  decision   = "bypass"
+  include = [{
+    everyone = {}
+  }]
 }
```

Leave the `cloudflare_zero_trust_access_application.site_gate` resource block itself unchanged — only
the policy's `decision`/`include`/`name` move. (You may also delete the app + policy resources entirely
instead of flipping — ADR-0107's original alternative — but flipping is the safer, more reversible
choice: it keeps one resource identity across the launch instead of a destroy/recreate, and rollback is
a one-line revert instead of a re-provision.)

### 4.2 Apply

```bash
cd infra/terraform
export CLOUDFLARE_API_TOKEN=...   # never commit
terraform plan
# EXPECT: exactly one resource to change (cloudflare_zero_trust_access_policy.site_gate) — decision
# + include + name. ZERO changes to admin_gate, ZERO changes to any DNS record, ZERO changes to any
# other resource. If the plan shows anything else, STOP and investigate before applying.
terraform apply
```

Single-operator local-state `apply` is the accepted posture today (ADR-0107 §3, ADR-0208 #3 — no
remote-state lock exists; that's a deliberate, documented deferral, not an oversight).

### Verify (§3 of the required probes)

```bash
# BEFORE apply — confirm the gate is still up (baseline)
curl -sSI https://caisson.sh/ | head -5
# → expect a Cloudflare Access redirect (302 to a cloudflareaccess.com login) or 403, NOT a 200 with
#   Caisson's own headers

# AFTER apply — confirm it's public
curl -sSI https://caisson.sh/
curl -sSI https://www.caisson.sh/
# → expect 200 (or a normal Next.js redirect/rewrite), Caisson's own security headers
#   (X-Content-Type-Options, X-Frame-Options, HSTS — services/license's SECURITY_HEADERS pattern is
#   mirrored on apps/site), no Access challenge

curl -sS https://caisson.sh/healthz
# → 200

# admin MUST STILL be gated — this is the check that proves you didn't touch admin_gate
curl -sSI https://admin.caisson.sh/
# → still an Access redirect/403, unchanged from before this whole runbook
```

Then, in a real browser (incognito, no prior CF-Access session cookie): load `caisson.sh`, confirm no
Access login page appears, click through to `/marketplace` (the unified hub — `/pricing` and `/build` 301 into it since
ADR-0237/PR #102), confirm the "Add to cart" → Paddle
checkout overlay opens against **Production** (Paddle's overlay shows a "Sandbox" watermark banner when
misconfigured — if you see that banner post-flip, `NEXT_PUBLIC_PADDLE_ENV` didn't take; see §2.4's
build-time-inlining gotcha).

### Rollback

**Fast (seconds, no infra change):** revert the `access.tf` diff from §4.1 back to `decision =
"allow"` and the `email_domain` include block, then `terraform apply` again. Cloudflare Access
evaluates policy changes live — the gate re-engages on the next request, no propagation delay to
speak of. This is the single command sequence to memorize for "we need the site private again right
now":

```bash
cd infra/terraform
git checkout -- access.tf   # if the diff is uncommitted, or `git revert <commit>` if it landed
terraform apply
```

**If you also need to stop taking money** (worse case — a Production billing bug, not just "put the
gate back"): additionally scale `caisson-license` to 0 or pull `PADDLE_WEBHOOK_SECRET` (webhook then
fails closed 401, Paddle retries and eventually gives up / you handle the backlog manually) — the
CF-Access gate alone does not stop the grey-cloud, ungated `license.caisson.sh/webhook` from receiving
Paddle traffic, since that endpoint was never behind Access in the first place (§2.5 point 4).

---

## 5. Full post-flip verification sweep (run all of these once, after §4)

| Check                       | Command / action                                                                                                      | Expect                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Site public                 | `curl -sSI https://caisson.sh/`                                                                                       | 200, no Access redirect                                                                                                      |
| WWW public                  | `curl -sSI https://www.caisson.sh/`                                                                                   | 200, no Access redirect                                                                                                      |
| Admin still gated           | `curl -sSI https://admin.caisson.sh/`                                                                                 | Access redirect/403, **unchanged**                                                                                           |
| License health              | `curl https://license.caisson.sh/health`                                                                              | `{"ok":true}`                                                                                                                |
| License issue fail-closed   | `curl -X POST https://license.caisson.sh/issue -H "Authorization: Bearer wrong"`                                      | 401                                                                                                                          |
| Webhook fail-closed         | `curl -X POST https://license.caisson.sh/webhook -d '{}'`                                                             | 401                                                                                                                          |
| Paddle env is Production    | Paddle.js overlay on a real checkout click                                                                            | no "Sandbox" watermark                                                                                                       |
| Real purchase → grant       | live or throwaway-SKU purchase (§2 verify)                                                                            | webhook 200-delivered, entitlement granted                                                                                   |
| Registry entitled-fetch     | `curl -H "Authorization: Bearer <license token>" https://caisson-registry.<subdomain>.workers.dev/modules/<gated id>` | 200 post-purchase, 404 pre-purchase                                                                                          |
| Refund revokes              | refund the test purchase, re-run the registry check                                                                   | back to 404 within a few minutes                                                                                             |
| Discord role grant          | check the buyer's Discord roles post-purchase (if Discord link configured)                                            | edition role + `Customer` role present                                                                                       |
| Legal content               | view `caisson.sh/legal/terms` in a browser                                                                            | Paddle MoR attribution + refund policy visible (P2 — **must be resolved before this row can pass**)                          |
| Entity + MoR match          | view `caisson.sh/legal/eula` and a checkout overlay                                                                   | seller reads **Caisson Software LLC** everywhere; the verbatim Paddle MoR sentence shows on Terms + at checkout (CAISSON-31) |
| Retain = Cancel             | Paddle Production → Retain → payment recovery                                                                         | recovery action is **Cancel**, not Pause (§2.7a) — cannot be checked in Sandbox                                              |
| Subscription cancel revokes | cancel a test subscription in Paddle, re-run the registry entitled-fetch                                              | the updates entitlement flips to 404 after `subscription.canceled` delivers (§2.7b)                                          |

---

## 6. DO-NOT list

- **Do NOT delete `infra/terraform/access.tf` wholesale.** It now holds the permanent `admin_gate` too
  (see §0's correction). Only edit the `site_gate` policy block (§4.1).
- **Do NOT touch `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` on `caisson-admin`.** Unrelated permanent
  gate (ADR-0140/ADR-0204), not part of this flip.
- **Do NOT expose `admin.caisson.sh`.** It has no in-app auth beyond the CF-Access-JWT middleware
  (ADR-0204 vuln-0003) — Access is load-bearing there, not cosmetic like it was for the marketing site.
- **Do NOT leave `PADDLE_WEBHOOK_SECRET` matching between Sandbox and Production**, and do not delete
  the Sandbox destination in Paddle — keep Sandbox alive and pointed at a **staging** environment (or
  simply leave it configured-but-unused) for future pre-prod testing. Sandbox creds are cheap to keep
  around; do not fold them into the production env vars.
- **Do NOT flip §4 before §2's live-purchase verify passes.** A public site with a broken grant path is
  worse than a gated one — buyers pay and get nothing, which is a support/refund/trust problem, not
  just a bug.
- **Do NOT flip §4 while P2 (legal content) is unresolved.** (P3 folded into §2.2/§2.3 — the 11 module SKUs mint production ids alongside the editions.)
  P2 is a Paddle policy requirement, not just a nicety. P3 left as-is (option (b), hide the buttons) is
  fine to launch with — P3 left as-is with the buttons still visible is not.
- **Do NOT force-push or hand-edit `main` for the §2.3 pricebook change.** It goes through the normal
  PR + `greptile-gate` (billing/credits are security-critical paths) + merge flow like any other code
  change — this runbook is DEPLOY-class for the _credential and DNS/Access_ acts, not a license to skip
  the standards gate on the code change that feeds them.
- **Do NOT assume the Discord privileged-intents / rotate-creds items (P4/P5) are already done** — this
  session found them flagged-but-unconfirmed in `docs/state/go-live-legal-and-entity.md`. Verify, don't
  trust the doc's age.
- **Rollback command to memorize** (put the gate back right now, no other changes):
  ```bash
  cd infra/terraform && git checkout -- access.tf && terraform apply
  ```

---

## 7. Post-merge DEPLOY block — the 2026-07-02 ADR-0218–0221 wave

> **EXECUTED 2026-07-02/03 (operator-approved), all four Done in Linear.** CAISSON-16: migration
> checksum drift at v3 (PR #69 edited a pinned `*_SCHEMA_SQL` in place) reconciled read-only, blessed
> as the sole drift, then migrations `0006`–`0009` applied to the live Railway PG (the ledger was at
> v1–v5 — `0006 account_member` had never reached prod). CAISSON-17: surface provisioned
> (`apps/admin/scripts/provision-admin-mutation-surface.ts`) + env set; **grantee gotcha** — the
> first run granted `admin/admin_write/app` to `postgres` (CURRENT_USER default), not `admin_app`;
> fixed with an explicit grant, then a live grant→revoke round-trip PASSED (dual log rows + WORM
> anchors, typo'd account → 404). CAISSON-18: env-gated S3 store (PR #79) proven — anchors in
> `caisson-worm` with Object-Lock retention to 2033. **Flagged residual:** the bucket's default lock
> mode is **GOVERNANCE**, this section said COMPLIANCE — operator to confirm posture or escalate the
> bucket default (extend-only escalation stays per ADR-0202). CAISSON-15: Terraform imported +
> applied (rate-limit + WAF rulesets, docs-api proxied), `429`s proven on `/query` with cf-ray;
> `license.caisson.sh` untouched grey-cloud. Both `caisson-license` + `caisson-admin` redeployed
> from merged `main` (SUCCESS; license `/health` 200). The section below is kept as the historical
> runbook.

**DEPLOY-class, operator-executed. Separate from the launch flip above** — this is the ordered
deploy of the four hardening items that merged to `main` today (PRs #66–69: ADR-0218 Paddle per-line
refund · ADR-0219 CF front rate-limit · ADR-0220 admin mutation surface v1 · ADR-0221 live-seams
KMS/ONNX). Merge ≠ deploy: the code is on `main`, none of it is live until these run. **Order is
load-bearing — do them in sequence** (each Linear issue tracks its own runbook detail). Nothing here
is inside the autonomous loop.

1. **CAISSON-16 — DB migrations `0008`/`0009` BEFORE the license redeploy.** The Paddle per-line
   refund (ADR-0218) adds nullable `line_item_id` columns to `entitlement_grant` + `credit_event`,
   and the admin mutation surface (ADR-0220) adds its schema — both ship as new numbered migrations
   `0008`/`0009`. Run them **first**, against the live Railway Postgres, so the new schema exists
   before any new code reads it: `caisson-license`'s idempotent `preDeployCommand` migrate applies
   the ledger, but confirm the two new files are in the assembled sequence and applied **before** you
   `railway up` the new `caisson-license` image — a redeploy that boots the new code against the old
   schema fails closed on the missing column.
2. **CAISSON-17 — admin provisioning.** Provision the ADR-0220 mutation surface on `caisson-admin`:
   the DDL for the dedicated **`admin_write`** role (distinct from the read-only `admin_app` role,
   per AM-2 override — grant it only the four v1 mutation actions' tables), and set the two new env
   vars the admin app reads — **`ADMIN_ISSUE_TOKEN`** (the admin-scoped reissue credential, AM-5 —
   NOT the license `LICENSE_ISSUE_TOKEN`) and **`CAISSON_LICENSE_ISSUE_URL`** (the `services/license`
   `/issue` endpoint the admin surface calls). WORM dual-logging is on day 1 (AM-4).
3. **CAISSON-18 — WORM store swap to S3 Object-Lock.** Point the audit-worm store at the real
   **`caisson-worm`** S3 bucket with Object-Lock (COMPLIANCE mode, extend-only retention per
   ADR-0202) — the swap the ADR-0201/0221 live proof exercised (5/5 green tonight). Set the bucket +
   AWS creds on the owning service; verify a write lands an immutable object and the retention floor
   is enforced.
4. **CAISSON-15 — Cloudflare front rate-limit (ADR-0219).** `terraform import` the existing CF
   resources into state (they predate this module), `terraform plan` (**expect only the new
   rate-limit + WAF rules to add — zero changes to `site_gate`/`admin_gate`/DNS**), `terraform
apply`, then **probe for a `429`**: hammer the proxied docs-api path past the Free-tier threshold
   and confirm Cloudflare returns `429` (the edge limiter is live). `license.caisson.sh` stays
   grey-cloud/un-proxied — the rate-limit is docs-api-proxied only, the app-level limiters (ADR-0204)
   stay in place underneath.

### Transfer aftermath (repo moved to `caisson-sh/caisson`, 2026-07-02)

The monorepo transferred into the **`caisson-sh`** GitHub org (repo home is now
`github.com/caisson-sh/caisson`; the old `GridWork-dev/caisson` URL auto-redirects). One operational
gotcha this move surfaced, worth memorizing:

- **If CI jobs ever queue with ZERO runners after an org/repo move**, the runscaler **scale set must
  be deleted and recreated** — a stale scale set keeps pointing at the old repo/org URL and silently
  registers no runners. The fix: correct the scale-set URL, then **`systemctl stop` → `systemctl
start`** the runscaler unit cleanly (not a hot reload), and **cancel + re-run** any jobs that were
  queued against the dead set — they do not auto-recover onto the new runners. (This is exactly what
  happened at the transfer: the old scale set had to be torn down and recreated on both the box and
  the Mac mini, and the Greptile app was reinstalled on the new org.)

## 8. Edge license-revocation deny-set (ADR-0225 R-4=B)

Operator `purchase_revoke` (admin v2) revokes a paid entitlement in the DB **and** — when the
per-action "revoke edge access" checkbox is on — records the account's license ids in the
`license_revocation` table and (once the edge publisher is provisioned) republishes the full edge
**deny-set** so the registry Worker stops serving that buyer's paid modules. This closes the gap
that a DB-only revoke leaves: the Worker verifies a SIGNED offline license token against a baked
Ed25519 pubkey and **never reads the DB**, so without the deny-set a revoked buyer keeps
`npm install` access to premium modules until their token expires (forever, for a `expiry: null`
perpetual-per-major token).

**How it works (code, no infra opened by this PR):**

- **Truth** is the DB table **`license_revocation`** (keyed on `license_id`) — written inside the
  mutation transaction, ALWAYS. Republishing that truth to the edge artifact is a POST-COMMIT,
  BEST-EFFORT step that runs ONLY when the publisher is provisioned (env-gated — see DEPLOY below).
  The mutation surfaces the outcome per revoke as **`edgePublish`**: `"ok"` = the full set was
  republished · `"failed"` = the revoke is durable but the artifact write threw (re-publish out of
  band, do NOT retry the mutation) · `"skipped"` = no edge revoke was requested, OR the publisher is
  unprovisioned, so the DB is the sole truth and the Worker fails open (nothing denied at the edge).
- **Artifact** = a JSON object `{ "revokedLicenseIds": ["<uuid>", …] }` at the fixed R2 key
  **`revocations/deny-set.json`**. Republish-whole, not delta (operator actions are low-volume).
- **Key = the signed `claims.licenseId`** — the ONLY per-license stable id the offline token
  verifiably carries (there is no `accountId` in the token). Consequence: the edge deny is
  **license-scoped = account-scoped in practice** (every `license_grant.license_id` the account
  holds is denied), while the DB revoke stays source-scoped (R-2). Correct for the
  fraud/chargeback/ToS case (kill their edge access); the refcount-survivor nuance (a buyer keeps a
  sibling entitlement but their whole token is denied until reissued with reduced claims) is
  **R-4=C reissue-rotation, explicitly deferred** — hence the per-action checkbox, so the operator
  never silently over-denies a legit sibling.
- **Worker read** (`registry/worker/revocation-list.ts`): a module-cached `Set` refreshed on a
  **60s TTL**, stale-while-revalidate (`ctx.waitUntil`, never awaited before serving). **STRICT
  fail-open is the binding invariant** — an absent R2 binding, a fetch error, or a malformed artifact
  keeps the prior set (empty on first failure = nobody denied), so a deny-set outage NEVER breaks
  installs. Wired into the entitlement resolver in `deploy-entry.ts` (additive; `handler.ts`
  untouched).

**The staleness window (read this before relying on a revoke for edge cutoff):**

- After a revoke publishes, the edge stops honoring the token within **≤ the TTL (60s)** of the
  next Worker request that triggers a refresh — NOT instantly, and only once the artifact is
  actually published to R2.
- **Before the R2 binding is provisioned** (operator-gated DEPLOY — see below), the deny-set is
  ALWAYS empty (fail-open), so `revokeEdgeAccess` writes the DB truth but the edge does not yet
  enforce it. The dashboard view and any FRESH token issue reflect the revoke immediately; the
  already-distributed token keeps edge access until the binding is live.
- The deny-set does **not** shrink a `expiry: null` token's blast radius on its own — it is the
  mechanism that finally cuts a perpetual token's edge access. Pair fraud/ToS revokes with the
  paid-token TTL policy (a non-null default TTL turns "denied via list" into "also self-expires").

**Operator-gated DEPLOY — EXECUTED 2026-07-05 (operator-approved): the deny-set is FULLY LIVE.**
The R2 bucket + `REVOCATIONS` Worker binding, the authed PUT shim (`CAISSON_REVOCATIONS_PUT_URL`
on `caisson-admin`), and the `license_revocation` DDL are all provisioned — a revoke now
republishes to the edge and `edgePublish` reports `ok`/`failed`, no longer `skipped`. The original
provisioning steps are kept below as the runbook record:

1. Create the R2 bucket + bind it to the registry Worker as **`REVOCATIONS`** (name matches
   `deploy-entry.ts`); consistent with the existing inline-deploy model, no new heavyweight infra.
   `infra/terraform` owns the real binding — code + tests here use an injected double.
2. Set **`CAISSON_REVOCATIONS_PUT_URL`** (+ optional **`CAISSON_REVOCATIONS_PUT_TOKEN`** bearer) on
   `caisson-admin` to an authorized PUT target for `revocations/deny-set.json` (a pre-signed R2 URL or
   a small authed shim in front of the bucket). The publisher itself is ALREADY built
   (`apps/admin/src/lib/admin-mutations-runtime.ts` `denySetPublisher`) — it activates when this env is
   set and reports `edgePublish: "skipped"` until then. No aws-sdk / SigV4 / R2 credential is added to
   the admin blast radius; the operator provisions the endpoint that owns the bucket write.
3. Provision the `license_revocation` table + the `admin_action_log` `purchase_revoke` action ALTER
   on the Railway Postgres (rides the same admin DEPLOY step as the ADR-0220 mutation surface).

Until (1)-(3) run, admin v2 revoke is DB-truth-only at the edge; the fail-open Worker path means the
absence is safe, not broken. Each revoke's `edgePublish` field tells the operator which state that
action landed in (`skipped` before provisioning, `ok`/`failed` after).

**Reversing an edge deny (queued follow-up).** There is no admin un-revoke path for
`license_revocation` rows yet — a mistaken edge deny is undone only by deleting the row(s) directly
(then republishing) or issuing a fresh token after a reissue. Acceptable pre-launch given the
mandatory impact preview + type-to-confirm gate; a `purchase_unrevoke` mutation is queued alongside
the publisher provisioning above so the reversal is not a raw-SQL-against-production action either.
