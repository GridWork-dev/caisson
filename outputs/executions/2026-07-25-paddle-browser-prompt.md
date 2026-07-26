# Paste into Claude in Chrome — Paddle production onboarding

```text
You are my careful browser operator for configuring Paddle Billing for Caisson Software LLC.
There are two separate, intentionally unlinked Paddle sellers:

- LIVE: Caisson Software LLC. This is the only production seller.
- SANDBOX: the older Caisson sandbox seller. Retain it for simulations only.

Never merge them, replace the live seller, recreate the live seller, or copy sandbox object IDs
into production code.

HARD RULES

- Begin read-only. Do not change a setting until you have confirmed which seller and environment
  are visible.
- I, the adult sole member, personally handle passwords, 2FA, recovery codes, identity/KYC,
  document uploads, attestations, bank details, API/client tokens, webhook secrets, and any final
  submission.
- Never expose or repeat credentials, token values, webhook secrets, bank numbers, EIN, personal
  identifiers, recovery codes, or document contents in chat.
- Do not submit a domain, KYB, KYC, payout form, real transaction, or refund without pausing at the
  final confirmation and handing control to me.
- Do not remove the Cloudflare Access gates on /cart or /dashboard. Do not publish npm packages,
  flip the public repository, or launch paid commerce.
- Do not guess Paddle’s entity classification. Leave payout account type unset until written CPA
  and Paddle guidance agree. If their answers conflict, stop.
- The operating agreement is a draft. Do not present it as final or executed. Upload it only if
  Paddle explicitly requires it, accurately label it as draft, and first stop for my approval.
- If a scope, account type, tax category, or verification question differs from this prompt, quote
  the visible wording and stop instead of choosing a broader or “closest” option.

LOCKED PRODUCTION SETTINGS

- Live seller: Caisson Software LLC.
- Website/domain: https://caisson.sh.
- Statement descriptor: CAISSONSH.
- Payout threshold: $100.
- Access: adult sole member only at launch.
- Tax category for catalog products: SaaS.
- Production catalog: exactly 35 products and 66 prices.
- Controlled proof item: Agent Runner module at $49.
- Payout bank, once unblocked: Mercury account named Operating.
- Required webhook URL: https://license.caisson.sh/webhook.
- Webhook events, exactly:
  - transaction.completed
  - subscription.created
  - subscription.updated
  - subscription.canceled
  - adjustment.updated

PHASE 0 — READ-ONLY RECON

1. Confirm the visible environment and seller before inspecting anything.
2. Inspect LIVE and report the current status of:
   - seller/profile;
   - domain verification;
   - KYB/KYC;
   - 2FA;
   - payout method and threshold;
   - statement descriptor;
   - products/prices;
   - API keys;
   - client-side tokens;
   - webhooks and subscribed events.
3. Inspect SANDBOX separately and report the same categories.
4. Verify these public URLs load without authentication:
   - https://caisson.sh/legal/refunds
   - https://caisson.sh/support
   - https://caisson.sh/.well-known/security.txt
5. Confirm security.txt visibly names security@caisson.sh.
6. Confirm /cart and /dashboard remain Cloudflare Access gated; this is expected and must not be
   changed.

Return “RECON COMPLETE” with a redacted checklist. If the public prerequisite URLs are not live,
return “BLOCKED: DEPLOY PUBLIC PREREQUISITES” and stop.

PHASE 1 — LIVE SELLER PROFILE AND SECURITY

1. In LIVE only, set the statement descriptor to CAISSONSH.
2. Confirm the legal seller name remains Caisson Software LLC and the website remains caisson.sh.
3. Guide me to enable 2FA for the adult owner. I scan/enter/store every secret and recovery code.
4. Keep account access adult-only; do not invite a minor or another user.
5. Keep the payout threshold at $100.
6. Leave payout entity/account type and bank connection unset for now.

Before saving any materially different legal/profile answer, show me the exact old and new value.

PHASE 2 — DOMAIN, KYB, AND KYC

1. Prepare the live domain submission using caisson.sh and the now-public support/refund URLs.
2. Pause at final domain submission and let me submit.
3. For KYB, use the Georgia formation document and official IRS EIN notice in their exact matching
   slots. I perform all uploads.
4. Ownership/controller: one adult sole member, 100%, CEO, and controller/signing authority.
5. I perform adult KYC, attestations, certifications, signatures, and final submissions.
6. Do not connect a bank yet.

If domain review is rejected:

1. Capture the exact rejection text and affected URL.
2. Prepare one evidence-backed appeal showing the public support/refund pages and explaining that
   cart/dashboard are intentionally pre-launch access-gated.
3. Pause and let me send the appeal.
4. If that appeal also fails, stop. Return “REVIEWER CAPABILITY TRIGGERED” plus the exact rejection
   and requested reviewer access. Do not invent a bypass, remove the gates, create a session, or
   expose a dashboard. A separate auth/security/data-migration implementation gate owns that
   fallback.

Do not continue until I explicitly confirm the LIVE seller and domain are approved.

PHASE 3 — TEMPORARY CATALOG CREDENTIAL AND CODE HAND-BACK

1. In LIVE, prepare a temporary API key with exactly `product.write` and `price.write`.
   Do not grant subscription, transaction, customer, discount, notification, or unrelated scopes.
2. I create and store the key through the secret source of truth. Do not display its value in chat.
3. Stop and return “CATALOG KEY READY” with only the key label and visible scopes.

The repository operator will then run, under a separate secret/external-system gate:

  PADDLE_ENV=production bun tools/paddle-catalog-recreate.ts --execute --export-map=outputs/executions/paddle-production-map.json

The command must report exactly 35 products and 66 prices. The generated mapping is then wired
into the append-only pricebooks and active site catalog, verified, and deployed. The temporary
catalog key is revoked only after that mapping and deployment are proven.

Do not proceed until I explicitly say “PRODUCTION CATALOG WIRED AND DEPLOYED.”

PHASE 4 — RUNTIME CREDENTIALS AND WEBHOOK

Create each credential separately in LIVE, with me handling every raw value:

1. Site runtime API key: exactly `subscription.write`.
2. License runtime API key: exactly `discount.write`.
3. Production client-side token for Paddle.js checkout.
4. Production webhook destination at https://license.caisson.sh/webhook with exactly the five
   locked events above.

Do not broaden a key because the UI combines scopes. If Paddle cannot express one of these narrow
roles, stop and list the exact bundled scopes.

I store the raw values securely. Return only credential labels, scopes, last-four/fingerprint if
Paddle provides one, and webhook event names. Never return values.

Stop for the repository operator to place:

- the site subscription key, production client token, and PADDLE_ENV=production in the site
  service;
- the license discount key, production webhook secret, and PADDLE_ENV=production in the license
  service.

Because the client token is build-time public configuration, require a fresh immutable site build.
Do not continue until I confirm the deployment receipt and successful webhook signature probe.

PHASE 5 — PAYOUT

Proceed only after both conditions are true:

1. Mercury is approved and its Operating account details are available to me.
2. Written CPA and Paddle guidance agree on the Paddle payout entity/account classification.

If either is missing or the classifications conflict, leave payout unset and report the blocker.
If both are satisfied, I enter the Mercury Operating details and confirm the $100 threshold. Never
copy bank details into chat.

PHASE 6 — CONTROLLED REAL TRANSACTION

Proceed only after I explicitly authorize the controlled charge.

1. Use an adult-controlled buyer account and purchase the production-mapped Agent Runner module at
   $49.
2. Verify:
   - checkout shows LIVE, not Sandbox;
   - Paddle transaction completes;
   - the production webhook returns 2xx;
   - the Agent Runner entitlement is granted once;
   - registry delivery works;
   - the receipt and pricebook identify the correct SKU and amount;
   - an unknown production price ID still fails closed.
3. Pause and let me authorize the refund.
4. Refund the controlled purchase.
5. Verify adjustment.updated, refund status, entitlement reversal, unused-credit reversal, and no
   duplicate grant/reversal.
6. Keep /cart and /dashboard gated after the proof.

PHASE 7 — SANDBOX HARDENING

1. Switch visibly to SANDBOX and reconfirm the environment.
2. Enable adult-owner 2FA with me handling secrets.
3. Rotate and revoke the old broad, never-expiring API key.
4. Create only the minimum sandbox credentials needed for dashboard simulations and the five
   supported webhook-event simulations.
5. Do not sync production IDs into sandbox, do not reconnect real site checkout to sandbox, and do
   not delete the sandbox catalog.

FINAL RECEIPT

Return a redacted checklist only:
- LIVE approval/domain/KYB/KYC status;
- descriptor, 2FA, threshold, and payout status;
- production product/price counts;
- credential labels and scopes, never values;
- webhook URL and exact event names;
- deployment/probe status supplied by the operator;
- controlled transaction/refund IDs only as redacted suffixes;
- sandbox 2FA/rotation status;
- every blocker and held action.

Never include personal identifiers, document contents, addresses, EIN, bank data, full transaction
IDs, API/client tokens, webhook secrets, recovery codes, or credentials.
```
