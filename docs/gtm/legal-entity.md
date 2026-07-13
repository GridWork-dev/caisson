---
updated: 2026-07-13
status: live
grounds:
  - docs/state/go-live-legal-and-entity.md
  - docs/business/caisson-software-llc.md
---

# Legal & entity posture

The business-layer read on Caisson's legal/entity surface: who the seller is today, who legally
sells + is liable + handles tax on every transaction, what the EULA currently says vs. what it
must say before checkout goes live, the privacy/analytics posture, and the open items still
outstanding. Distilled from `docs/state/go-live-legal-and-entity.md` (the operator-actionable
checklist) plus the ADRs and live site copy cited inline. **Not legal/tax advice.**

## 1. Entity status

**Caisson Software LLC** — Georgia member-managed single-member LLC, formed 2026-07-06 via
Northwest Registered Agent (operator action superseding the 2026-07-01 defer-to-first-sale
lock; the entity carries the under-18 ownership structure, so it formed ahead of revenue).
EIN ISSUED 2026-07-10 (CP-575 in hand, ahead of the 2026-07-15 estimate — see
`docs/business/caisson-software-llc.md` §1). The entity SOT — facts, EIN cheat sheet, the
operating-agreement lawyer brief (transfer-at-18 + minor-IP-assignment clauses), and the
approval → EIN → OA → Mercury → Paddle-production order of operations — is
**`docs/business/caisson-software-llc.md`**; this section is the GTM-layer summary only.
Paddle production proceeds as business type **Private** (entity, formation docs + EIN), not
Individual. Public surfaces carry the entity as "Caisson Software LLC … based in Atlanta,
Georgia" + `admin@caisson.sh` — no street address on the site (Northwest's address takes
service of process; the principal address goes only to IRS/Mercury, neither public). Delaware
C-corp conversion stays out of scope unless/until raising VC.

## 2. The merchant-of-record chain

**Paddle Billing is Merchant of Record for every Caisson sale** — this supersedes an earlier
Stripe-as-MoR assumption baked into the original commerce model (ADR-0108 supersedes ADR-0012's
commerce-model assumption + amends ADR-0089's cycle→grant event source). Paddle, not Caisson
Software LLC, is the seller of record:

- **Who legally sells:** Paddle. The buyer's invoice, checkout, and receipt all carry Paddle's
  name — site copy states this directly: "Paddle.com is the Merchant of Record for all our
  orders" (`apps/site/app/legal/terms/page.tsx`), echoed in the EULA ("processed through our
  merchant of record", `apps/site/app/legal/eula/page.tsx`), the privacy policy, and the
  procurement FAQ page.
- **Who's liable:** Paddle absorbs chargeback + fraud handling and executes every approved refund
  (`apps/site/app/legal/terms/page.tsx`: "Paddle is the Merchant of Record and executes every
  approved refund"). Caisson Software LLC is the software vendor Paddle resells for, not the
  transaction counterparty.
- **Who handles tax:** Paddle computes, collects, and remits global sales tax/VAT and owns nexus
  tracking (ADR-0108 context) — the dominant reason for the Stripe→Paddle switch: a solo founder
  selling globally would otherwise carry tax registration + remittance in every buyer jurisdiction
  directly.
- **Mechanics:** Paddle Billing (the current product, not legacy Paddle Classic) — Products/Prices
  per SKU, Paddle.js checkout (no card data touches Caisson infra), server-side verification via
  `@paddle/paddle-node-sdk` against the `Paddle-Signature` header. `transaction.completed` is the
  sole grant trigger, firing on both the initial purchase and every renewal payment; `custom_data`
  binds the Caisson account at checkout and propagates onto the transaction natively (removing the
  metadata-stamping workaround Stripe required, ADR-0108).
- **Paddle is the sole mounted buyer-purchase webhook** (ADR-0200): `services/license`'s
  `POST /webhook` is the one live payment-webhook surface, driven by `createPaddleBilling`. The
  **Stripe driver is not retired** — ADR-0116 keeps it live and tested inside the buyer-facing
  `@caisson/billing` package (the toolkit a _buyer_ composes into their own product to bill their
  own customers) — it is simply **dormant on Caisson's own platform revenue path**: no Stripe
  webhook is mounted, no Stripe secret is held, by the platform itself. A second live provider on
  the platform path would require a new ADR, not a config flip.

## 3. EULA posture

Live at `apps/site/app/legal/eula/page.tsx` (last updated 27 June 2026; the page itself notes the
text is pending a real counsel pass before first sale). Current grant: a **perpetual,
non-exclusive, worldwide, non-transferable** license per Order, one-time fee, described as not
expiring and not requiring "renewal, periodic payment, or a network call to remain valid" for the
version(s) covered by that Order. A separate, optional, recurring "Compliance Updates
subscription" is the only path to new package versions/control mappings today, framed as
independent of and non-affecting to the perpetual grant.

**Updates-window clause — ADR-0244 (locked 2026-07-05), CLOSED in the EULA:** every one-time
purchase is perpetual-use **plus 12 months of updates included** from the purchase date (registry
pulls of any entitled-package version published within that window, plus everything already
pulled); continued updates past that window are an **optional renewal at 40% of then-current
list**. Non-renewal is never punitive — everything already entitled keeps working. **The live EULA
text now states both the included window and the renewal rate** (`apps/site/app/legal/eula/page.tsx`
§5 Fees and payment, ~lines 220-229: "includes 12 months of updates from your Order date… After
that window, you may renew updates access for another 12 months at 40% of the then-current list
price, or let it lapse"). ADR-0244's checkout-flip blocker on this clause is closed.

**Credits get the equivalent treatment — ADR-0245 (locked 2026-07-05), CLOSED on the dashboard,
still open in the EULA:** unused subscription-cycle credit grants **pool and roll over** (no
use-it-or-lose-it reset); every grant — subscription-cycle, top-up pack (the $49 pack, ADR-0222),
or promotional — **expires 12 months after issue**; consumption is **FIFO oldest-grant-first**, so
a steady subscriber's balance near expiry burns before newer grants. The dashboard side is done —
`apps/site/app/dashboard/credits/page.tsx` carries an "Expiring within 30 days" badge with FIFO
copy ("they burn first automatically") per an ADR-0245/0252 code comment. **The EULA text alone
still doesn't state the 12-month expiry or FIFO-burn behavior** — the remaining launch-blocker
surface for this clause is EULA copy only, not checkout/dashboard.

**Pricing structure — locked, not open:** the R3 compliance-package-split question that was
redirected into the catalog-doctrine research round **locked 2026-07-06** (ADR-0257 vocabulary ·
ADR-0258 numbers): editions dissolved into six individually-priced bundles over a fully à-la-carte
package catalog, live in Paddle SANDBOX. See `docs/gtm/pricing-packaging.md` for the current
six-bundle matrix. The purchase-mechanics terms above (updates window, renewal rate, credit
rollover/expiry) are unaffected by that lock — they govern any SKU, bundle or module alike.

## 4. Privacy / analytics posture

- **Plausible Analytics runs cookieless, site-wide, on the marketing layout** (ADR-0118) —
  no cookie, no PII, no consent banner required by design; env-gated (`PLAUSIBLE_DOMAIN`), inert
  otherwise. Deliberately scoped to aggregate traffic (page views, the pricing→checkout funnel),
  not system observability (that's OTel/SigNoz, a separate sink).
- **PostHog is scoped to the authenticated `/dashboard` only**, never the marketing layout
  (`components/posthog-init.tsx`), and runs `persistence: "memory"` — no cookie, no localStorage,
  state lives only for the page's lifetime. `cookieless_mode: "always"` was deliberately ruled out
  because it forbids `identify()`, which the account-linked dashboard analytics depend on.
- **Ask-AI question-text capture — ADR-0236** (extends ADR-0234 F6, an explicit operator override
  of the tabled "defer" recommendation): question text is captured server-side with a visible
  consent notice in the widget before first submit ("Questions are stored to improve the
  product — don't include secrets or personal data"), scoped to `{day, lane, question_text,
answered|escalated}` — no IP, no user id, no answer text, no Turnstile token; anonymous by
  construction, not by scrubbing after the fact. **Hard-deleted after 90 days**
  (`apps/site/app/legal/privacy/page.tsx`: "Stored questions are hard-deleted after 90 days"),
  enforced by the same daily-maintenance path that expires `ask_ai_spend` rows. Plausible counts
  for ask-AI usage are unaffected and never carry question text.
- **Split-by-surface analytics posture — ADR-0237 fork F8:** the site-presentation rework
  reaffirms the marketing-stays-cookieless / dashboard-may-identify split above as the standing
  analytics architecture rather than reopening it.
- **Privacy Policy is live day one** (`apps/site/app/legal/privacy/page.tsx`) — required
  regardless of Paddle: any site reachable from California triggers CalOPPA, and Caisson
  processes auth/billing/audit data independent of the MoR relationship, so the policy is also a
  buyer-trust signal on its own.

## 5. Open legal items

| Item                                                                                 | Owner / trigger                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credit rollover/12-month-expiry/FIFO clause (ADR-0245)                               | Operator/build — same flip gate; dashboard credit-balance copy done, EULA text still doesn't state it                                                                                             |
| Real counsel pass on the EULA                                                        | Operator — page itself is marked pending review before first sale                                                                                                                                 |
| DPA (Data Processing Agreement) template                                             | Operator — not legally forced for early B2C, but Caisson's buyer profile (audit-focused technical founder) makes it a near-certain early ask; have one ready at launch, not built                 |
| GA LLC formation                                                                     | **CLOSED** — formed 2026-07-06 (operator superseded the defer-to-first-sale lock; see §1)                                                                                                         |
| Rotate leaked Discord/OpenRouter creds                                               | **CLOSED** — credential sweep executed 2026-07-08 (per-service OpenRouter key split, `DISCORD_TOKEN` rotated); `MIRROR_PUSH_TOKEN` rotated + verified working 2026-07-10 (unrelated to this leak) |
| MSA/enterprise contract, SOC 2 report (~$10–30k, 3–6 mo), Delaware C-corp conversion | Deferred by design, not gaps — MSA waits for a buyer wanting custom terms; SOC 2 is a post-v1 enterprise-procurement item; C-corp conversion only applies if raising VC                           |
