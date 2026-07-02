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
- **Paddle is wired end-to-end today, but against the SANDBOX catalog.** `packages/pricebook/src/purchases.ts`
  and `packages/pricebook/src/plans.ts` (the server-side grant resolver) and `apps/site/lib/catalog.ts`
  (the client-side checkout catalog) all carry **real Paddle SANDBOX price ids** (`pri_01kwd76…`) for
  the 4 editions + the bundle + the 2 annual subscriptions (ADR-0106/0116 go-live wiring, comment block
  `purchases.ts` lines 62–79). This is not a placeholder — sandbox checkout has been smoke-tested
  end-to-end per `docs/state/decisions-and-forks.md` (commerce-goes-live session, 2026-07-01).
- **The license issuer's production signing key is ALREADY provisioned and baked in** — this is NOT a
  launch-day step. `infra/license-issuer/ISSUER_PUBLIC_KEY.md` records the production Ed25519 keypair
  (fingerprint `0ae7d2abb886ca3d`); `packages/license-verify/src/verify.ts` lines 26–27 confirm the KAT
  test vector was already replaced with this production key. §5 below only re-verifies it works.

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

| #   | Blocker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                                                       | Status (as of this session)                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Paddle production account** does not exist yet — only Sandbox is configured. `PADDLE_API_KEY` on `caisson-license` today is `pdl_sdbx_*`-shaped.                                                                                                                                                                                                                                                                                                                                     | `docs/state/go-live-legal-and-entity.md` line 61: "Paddle SANDBOX → production … Hard blocker."                | **OPERATOR TO DO** — §2 walks it.                                                                                                                                                                                                                                                                                                                                         |
| P2  | **Paddle MoR attribution line + refund policy are not on the site.** Paddle requires Terms & Conditions carrying the MoR attribution verbatim, a refund policy, and buyer support details before go-live. `grep -il "paddle\|merchant of record\|refund" apps/site/app/legal/{terms,privacy}/page.tsx` returns **nothing** — only `apps/site/app/legal/eula/page.tsx` mentions Paddle-adjacent terms.                                                                                  | `docs/state/go-live-legal-and-entity.md` lines 32–39; verified by grep this session.                           | **GAP — not fixed by this runbook.** Site copy is a separate track (design/copy, per `CLAUDE.md`); flag before flipping §3.                                                                                                                                                                                                                                               |
| P3  | **Per-module à-la-carte checkout is NOT wired** — only the 4 editions + bundle + 2 subscriptions have real Paddle price ids. The 14 individual-module rows in `packages/pricebook/src/purchases.ts` and their mirror in `apps/site/lib/catalog.ts` (`modulePlaceholderId()`) are still `price_<slug>_module_PLACEHOLDER` strings — not real Paddle price ids, so `Paddle.Checkout.open()` will reject them at the Paddle.js layer if a buyer clicks a per-module "Add to cart" button. | `apps/site/lib/catalog.ts` lines 70–78; `packages/pricebook/src/purchases.ts` lines 111+ (`PLACEHOLDER` rows). | **GAP.** Two options, operator's call: (a) create the 14 module Products/Prices in Paddle production + fill both books before flip, or (b) hide/disable per-module "buy" affordances in the storefront UI until (a) lands, so the flip doesn't expose a broken checkout button. This runbook does not pick for you — **do not flip §3 with P3 unresolved and undecided.** |
| P4  | **Discord privileged intents + role/channel env** — `SUPPORT_CHANNEL_ID` / `MEMBER_ROLE_ID` and the Developer Portal's Server Members + Message Content intents were the last-known-pending item (2026-07-01). May already be resolved — **verify, don't assume.**                                                                                                                                                                                                                     | `docs/state/p6-deploy-runbook.md` lines 37–45; `docs/state/go-live-legal-and-entity.md` line 66.               | **VERIFY** — §4 has the check.                                                                                                                                                                                                                                                                                                                                            |
| P5  | **Rotate the Discord bot token + OpenRouter key** — both were pasted into a chat session earlier and flagged for rotation; no evidence in the repo that this happened.                                                                                                                                                                                                                                                                                                                 | `docs/state/go-live-legal-and-entity.md` line 68; `docs/state/p6-deploy-runbook.md` line 47.                   | **VERIFY / DO before flip** if not already done — a leaked bot token is a live credential exposure regardless of launch timing.                                                                                                                                                                                                                                           |
| P6  | **Business entity** — operator locked sole-proprietor-until-first-sale (Paddle accepts an Individual seller: gov ID + W-9 + payout account). Not a blocker for §2.                                                                                                                                                                                                                                                                                                                     | `docs/state/go-live-legal-and-entity.md` lines 9–26.                                                           | **NO ACTION NEEDED** — informational only, included so you don't second-guess it mid-flip.                                                                                                                                                                                                                                                                                |

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
automatically. In the Production dashboard → Catalog, create one Product + one Price per SKU, matching
the locked numbers (ADR-0106 § numbers superseded by ADR-0137's below-sum reprice; `apps/site/lib/pricing.ts`
lines 52–254 is the live display source of truth and already carries these exact amounts):

| Product            | Price            | Billing               | ADR                  |
| ------------------ | ---------------- | --------------------- | -------------------- |
| Compliance         | $749.00          | one-time              | ADR-0137             |
| All-Access Bundle  | $1,499.00        | one-time              | ADR-0137             |
| AI Production Kit  | $599.00          | one-time              | ADR-0137 (unchanged) |
| Local-first AI     | $349.00          | one-time              | ADR-0137             |
| Agentic-Dev        | $249.00          | one-time              | ADR-0137             |
| Compliance-Updates | $1,499.00 / year | recurring annual      | ADR-0106             |
| Developer          | $499.00 / year   | recurring annual      | ADR-0106             |
| Enterprise / SLA   | —                | no price (Contact us) | ADR-0095 §2          |

Per-module à-la-carte (14 SKUs, $99–$299 per the ADR-0129 sheet) — **only create these now if you
resolved P3(a) above.** If you're going with P3(b) (hide the buttons), skip this and come back to it
later as its own, smaller change.

Do **not** re-use the Sandbox price ids — Paddle Production mints entirely new `pri_…` ids.

### 2.3 Update the two source files that resolve Paddle price ids to grants

This is a **code change**, not an env var. Both books fail closed on an unrecognized price id
(`resolvePurchase`/`resolvePlan` throw — `ConfigError`, ADR-0089 §6 / ADR-0113), so a missed row means
a real paid purchase grants nothing rather than silently succeeding — get this right before flipping.

1. `packages/pricebook/src/purchases.ts` — replace the 5 real sandbox keys (lines 83, 88, 93, 98, 103:
   `compliance`, `bundle`, `ai-kit`, `local-ai`, `agent-dev`) with the new production `pri_…` ids from
   §2.2. Bump `PURCHASE_BOOK_VERSION` (line 28, append-only per ADR-0006 — do not edit a version in
   place, bump the date-stamp string).
2. `packages/pricebook/src/plans.ts` — replace the 2 real sandbox keys (lines 82, 88: `developer`,
   `compliance_updates`) with the new production ids. Bump `PRICEBOOK_VERSION` (line 25).
3. `apps/site/lib/catalog.ts` — replace `EDITION_PRICE_IDS` (lines 53–58) and `BUNDLE_PRICE_ID`
   (line 60) with the same new ids — **these must be byte-identical to the pricebook's keys**, or a
   buyer's checkout will pass a price id the webhook's resolver doesn't recognize (`catalog.test.ts`
   pins this cross-package invariant — run it after editing, see verify below).
4. If you resolved P3(a): fill the 14 module-row keys in `purchases.ts` (currently
   `price_<slug>_module_PLACEHOLDER`) and `catalog.ts`'s `modulePlaceholderId()` output with the new
   real ids too, in the same commit.
5. Run `bun test packages/pricebook packages/registry-schema apps/site/lib/catalog.test.ts` (or `bun run check`
   for the full gate) before committing — this is a normal EXECUTE-act code change, commit it through
   the standard 7-act flow, not by hand-editing on `main`. **Do this well before the flip window** — it
   ships through the ordinary PR + CI + merge path (`greptile-gate` fires on this diff: `billing`/`credits`
   are in the security-critical glob per `CLAUDE.md`'s PR review gate section).

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

---

## 3. Step 2 — Pricing final-confirm checkpoint (operator-owned, ADR-0106)

No code change is expected here — this is a **look, don't touch** gate, because ADR-0106 reserved the
final-numbers adjustment to the operator's silent discretion up until the gate flips (ADR-0106 §
"Pre-flip safety clause"; `CLAUDE.md` "Still open" section: "the operator may still adjust a number
before checkout goes live, but the site no longer _says_ so").

1. Open `apps/site/lib/pricing.ts` (lines 52, 60, 68, 76, 230, 246, 254) side-by-side with the Paddle
   Production catalog from §2.2. Confirm every amount matches exactly: Compliance $749 · AI-Kit $599 ·
   Agentic-Dev $249 · Local-first $349 · Bundle $1,499 · Compliance-Updates $1,499/yr · Developer
   $499/yr. **Verified this session:** `pricing.ts` already carries these exact numbers (matches
   ADR-0137's below-sum reprice), so if you did §2.2 correctly there should be nothing to change.
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
Access login page appears, click through to `/pricing` or `/build`, confirm the "Add to cart" → Paddle
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

| Check                     | Command / action                                                                                                      | Expect                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Site public               | `curl -sSI https://caisson.sh/`                                                                                       | 200, no Access redirect                                                                             |
| WWW public                | `curl -sSI https://www.caisson.sh/`                                                                                   | 200, no Access redirect                                                                             |
| Admin still gated         | `curl -sSI https://admin.caisson.sh/`                                                                                 | Access redirect/403, **unchanged**                                                                  |
| License health            | `curl https://license.caisson.sh/health`                                                                              | `{"ok":true}`                                                                                       |
| License issue fail-closed | `curl -X POST https://license.caisson.sh/issue -H "Authorization: Bearer wrong"`                                      | 401                                                                                                 |
| Webhook fail-closed       | `curl -X POST https://license.caisson.sh/webhook -d '{}'`                                                             | 401                                                                                                 |
| Paddle env is Production  | Paddle.js overlay on a real checkout click                                                                            | no "Sandbox" watermark                                                                              |
| Real purchase → grant     | live or throwaway-SKU purchase (§2 verify)                                                                            | webhook 200-delivered, entitlement granted                                                          |
| Registry entitled-fetch   | `curl -H "Authorization: Bearer <license token>" https://caisson-registry.<subdomain>.workers.dev/modules/<gated id>` | 200 post-purchase, 404 pre-purchase                                                                 |
| Refund revokes            | refund the test purchase, re-run the registry check                                                                   | back to 404 within a few minutes                                                                    |
| Discord role grant        | check the buyer's Discord roles post-purchase (if Discord link configured)                                            | edition role + `Customer` role present                                                              |
| Legal content             | view `caisson.sh/legal/terms` in a browser                                                                            | Paddle MoR attribution + refund policy visible (P2 — **must be resolved before this row can pass**) |

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
- **Do NOT flip §4 while P2 (legal content) or P3 (per-module checkout) are unresolved and undecided.**
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
