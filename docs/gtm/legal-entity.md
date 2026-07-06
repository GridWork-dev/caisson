---
updated: 2026-07-05
status: live
grounds:
  - docs/state/go-live-legal-and-entity.md
---

# Legal & entity posture

The business-layer read on Caisson's legal/entity surface: who the seller is today, who legally
sells + is liable + handles tax on every transaction, what the EULA currently says vs. what it
must say before checkout goes live, the privacy/analytics posture, and the open items still
outstanding. Distilled from `docs/state/go-live-legal-and-entity.md` (the operator-actionable
checklist) plus the ADRs and live site copy cited inline. **Not legal/tax advice.**

## 1. Entity status

Operator is a **Georgia sole proprietor today; GA LLC formation is deferred to first sale**
(`docs/state/go-live-legal-and-entity.md`, verified against GA SOS + multiple 2026 guides,
2026-07-01). Locked rationale for the deferral: GA LLC formation is $100 online (eCorp,
~7 business days, expeditable) + $60/yr recurring, carries **no franchise tax** (GA's net-worth
tax only applies to LLCs electing C-corp tax treatment — irrelevant to a pass-through), and Paddle
already accepts an **Individual** seller (government ID + W-9 + payout account) identically to how
it accepts a formed entity. Because the turnaround is days and the cost is trivial, there is no
value in pre-paying the liability shield before there is revenue to protect.

**Trigger to form the LLC:** first meaningful revenue or the first enterprise prospect (whichever
comes first) — operator-owned, not automatic. **Same-week bundle at that point:** file Articles of
Organization ($100 eCorp) → free EIN at IRS.gov (~10 min) → operating agreement (unfiled template)
→ separate business bank account. FinCEN BOI reporting is exempt for domestic US LLCs as of early
2026 (verify at fincen.gov/boi before filing — rules move). Delaware C-corp conversion is
explicitly out of scope unless/until raising VC.

## 2. The merchant-of-record chain

**Paddle Billing is Merchant of Record for every Caisson sale** — this supersedes an earlier
Stripe-as-MoR assumption baked into the original commerce model (ADR-0108 supersedes ADR-0012's
commerce-model assumption + amends ADR-0089's cycle→grant event source). Paddle, not GridWork
Digital LLC, is the seller of record:

- **Who legally sells:** Paddle. The buyer's invoice, checkout, and receipt all carry Paddle's
  name — site copy states this directly: "Paddle.com is the Merchant of Record for all our
  orders" (`apps/site/app/legal/terms/page.tsx`), echoed in the EULA ("processed through our
  merchant of record", `apps/site/app/legal/eula/page.tsx`), the privacy policy, and the
  procurement FAQ page.
- **Who's liable:** Paddle absorbs chargeback + fraud handling and executes every approved refund
  (`apps/site/app/legal/terms/page.tsx`: "Paddle is the Merchant of Record and executes every
  approved refund"). GridWork Digital LLC is the software vendor Paddle resells for, not the
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

**Gap the EULA must close before the checkout flip — ADR-0244 (locked 2026-07-05):** every
one-time purchase is perpetual-use **plus 12 months of updates included** from the purchase date
(registry pulls of any entitled-package version published within that window, plus everything
already pulled); continued updates past that window are an **optional renewal at ~40% of
then-current list** (exact per-SKU cents land at the checkout-flip session, within a 35–50% band).
Non-renewal is never punitive — everything already entitled keeps working. **Today's EULA text
states neither the included window nor the renewal rate** — it currently reads as if any update
beyond initial delivery requires opting into the separate Updates subscription from day one, which
is a materially different (and less generous) commitment than what ADR-0244 locks. ADR-0244 is
explicit that this policy "MUST be in checkout + EULA copy before the checkout flip" — this is a
named, unclosed launch blocker, not yet built.

**Credits get the equivalent treatment — ADR-0245 (locked 2026-07-05):** unused subscription-cycle
credit grants **pool and roll over** (no use-it-or-lose-it reset); every grant — subscription-cycle,
top-up pack (the $49 pack, ADR-0222), or promotional — **expires 12 months after issue**; consumption
is **FIFO oldest-grant-first**, so a steady subscriber's balance near expiry burns before newer
grants. Same gap: **neither the EULA nor the checkout/dashboard credit-balance copy states the
12-month expiry or FIFO-burn behavior yet.**

**Open pricing-structure fork — do not treat as decided:** a separate, wider question is under
research and explicitly NOT part of the ADR-0244/0245 locks above — the operator redirected an R3
compliance-package-split pricing question into a broader **catalog-doctrine research round**: "all
editions become bundle options over an individually-sellable package catalog, with an explicit
OSS/commercial-line and package-split standard." Findings are slated for
`outputs/research/catalog-doctrine-2026-07.md` (not yet written as of this distillation — see
`docs/gtm/pricing-packaging.md` for the same open-fork framing). Nothing about edition/module
_catalog shape_ is locked; only the purchase-mechanics terms above (updates window, renewal rate,
credit rollover/expiry) are.

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

| Item                                                                                 | Owner / trigger                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EULA update-window + renewal-rate clause (ADR-0244)                                  | Operator/build — must land before the checkout flip; not yet written into EULA or checkout copy                                                                                   |
| Credit rollover/12-month-expiry/FIFO clause (ADR-0245)                               | Operator/build — same flip gate; not yet written into EULA or dashboard credit-balance copy                                                                                       |
| Real counsel pass on the EULA                                                        | Operator — page itself is marked pending review before first sale                                                                                                                 |
| DPA (Data Processing Agreement) template                                             | Operator — not legally forced for early B2C, but Caisson's buyer profile (audit-focused technical founder) makes it a near-certain early ask; have one ready at launch, not built |
| GA LLC formation                                                                     | Operator — triggers at first meaningful revenue or first enterprise prospect, not before                                                                                          |
| Rotate leaked Discord/OpenRouter creds                                               | Operator — flagged pre-launch, no evidence of completion as of the source doc                                                                                                     |
| MSA/enterprise contract, SOC 2 report (~$10–30k, 3–6 mo), Delaware C-corp conversion | Deferred by design, not gaps — MSA waits for a buyer wanting custom terms; SOC 2 is a post-v1 enterprise-procurement item; C-corp conversion only applies if raising VC           |

## Contradictions found while distilling

- **EULA copy vs. ADR-0244:** the live EULA text ("does not expire and does not require renewal,
  periodic payment... to remain valid") reads as an unbounded perpetual-updates commitment gated
  only by an optional separate subscription — closer to the failure mode ADR-0244 was locked to
  close than to the policy it actually locks (perpetual-use _plus a 12-month included-updates
  window_, then optional paid renewal). This is a real gap, not just an omission: the current text
  and the locked policy describe two different commitments. Flagged in §3 above; not resolved by
  this doc — resolution is a copy change at the checkout-flip build.
- **A prior draft of this file (found at `~/lab/caisson/docs/gtm/legal-entity.md`, a different
  checkout) described the Stripe driver as "retired code."** ADR-0116 is explicit that it is not:
  Stripe stays a live, tested, buyer-selectable driver inside `@caisson/billing` for buyers'
  _own_ products — only dormant on Caisson's own platform webhook mount (ADR-0200). Corrected in
  §2 above.
