Confirmed: license and procurement FAQ answers also feed `FAQPage` JSON-LD (schema.org, AEO-relevant per ADR-0080 §6) — a copy fix on those strings updates both the visible page and the structured-data markup for free.

## W1 research 4/4 — updates-language inventory vs ADR-0244

### (1) Full inventory of hits

**Already correct (no change needed):**

| File:Line                                                                           | Quote                                                                                                                                                                    | Why it's fine                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `docs/gtm/pricing-packaging.md:82-101`                                              | "§Updates window (ADR-0244, locked 2026-07-05)" full section                                                                                                             | Already rewritten to state the 12-month window + ~40% renewal band verbatim                                |
| `apps/site/app/(marketing)/page.tsx:317-323` (home)                                 | "Compliance Updates keeps control mappings and evidence packs current. Developer adds credits and private-registry pulls."                                               | Describes the subscriptions as add-ons, never claims they're the _only_ path to updates                    |
| `apps/site/app/(marketing)/compliance/page.tsx:203-207`                             | "...you own the source... An optional Compliance Updates subscription tracks framework drift..."                                                                         | Same — no exclusivity claim                                                                                |
| `apps/site/app/(marketing)/build-vs-buy/page.tsx:118-124`                           | "...an optional updates plan keeps framework mappings current if you want it." / "Only the optional Compliance Updates plan lapses... not that your code stops working." | Already non-punitive-framed, matches ADR-0244 point 5                                                      |
| `apps/site/app/(marketing)/ai-kit/page.tsx:364-372`, `agentic-dev/page.tsx:485-495` | "$499/yr adds credits, framework updates, and private-registry pulls on top of any license you own."                                                                     | Same pattern, no contradiction                                                                             |
| `apps/site/app/(marketing)/marketplace/modules/[slug]/page.tsx:118`                 | "One-time, perpetual license. Own the source."                                                                                                                           | Terse, correct, no update claim to contradict                                                              |
| `apps/site/components/license-token-card.tsx:55`                                    | `"Perpetual — no expiry."`                                                                                                                                               | Data-driven off the real `grant.expiry` field (the license grant, not the updates window) — accurate as-is |
| `specs/04-voice-and-brand.md:53`                                                    | bans `lifetime updates` as a competitor-coded term                                                                                                                       | Already aligned with ADR-0244's rejection of unbounded updates                                             |

**Contradicts ADR-0244 (all frame "updates" as gated _entirely_ behind the named `Compliance Updates`/`Developer` subscriptions, with zero mention of the 12-month-included window or the generic ~40%-renewal mechanic that applies to _every_ one-time purchase):**

1. `apps/site/app/legal/eula/page.tsx:97-101` (Definitions → "Software")

   > "'Software' means the Caisson source code, the packages under the `@caisson` scope, related documentation, and any updates delivered under a Compliance Updates subscription, as licensed to you under this Agreement."

2. `apps/site/app/legal/eula/page.tsx:214-220` (Fees and payment)

   > "The perpetual license fee is a one-time charge. A Compliance Updates subscription, where purchased, is billed on a recurring basis until cancelled and grants access to new package versions with updated control mappings; it is optional and does not affect the perpetual license for versions already delivered."

3. `apps/site/app/legal/license/page.tsx:33-36` (FAQ — visible + FAQPage JSON-LD)

   > "Yes. The Commercial License is perpetual for the version you purchased. Compliance Updates is an optional subscription that delivers new versions with updated control mappings; it is not required to continue using the version you bought."

4. `apps/site/app/legal/license/page.tsx:228-232` (Mechanics → entitlement bullet)

   > "A Compliance Updates subscription delivers new package versions with updated control mappings as regulations change. This is optional; the perpetual license does not expire."

5. `apps/site/app/(marketing)/procurement/page.tsx:56-59` (FAQ — visible + FAQPage JSON-LD)

   > "One-time. The perpetual license fee is a single charge per edition or module, and the license doesn't expire, doesn't require renewal, and verifies offline: no call home required. Compliance Updates is a separate, optional, recurring subscription that delivers new package versions with updated control mappings; skipping or cancelling it doesn't affect the perpetual license you already hold."

6. `apps/site/app/(marketing)/procurement/page.tsx:236-244` (body copy, Invoicing & billing)

   > "The perpetual license fee is a one-time charge per edition or module. A Compliance Updates subscription, where purchased, bills on a recurring basis until cancelled and delivers new package versions with updated control mappings; it's optional and doesn't affect the perpetual license for versions you already have. The license itself doesn't expire, doesn't require renewal, and doesn't call home to stay valid."

7. `apps/site/components/cart-shared.tsx:90-95` (`CartTrustNote`, rendered on `/cart` + the cart drawer — a live checkout surface)
   > `"One-time perpetual license, billed once — no seat count, no renewal gate."`
   > The phrase **"no renewal gate"** directly asserts no renewal mechanism exists at all — the sharpest contradiction on any purchase-facing surface, because ADR-0244 explicitly creates an optional renewal SKU family.

**Silent gap, not a false claim (flag for addition, not correction):** `apps/site/app/(marketing)/marketplace/(hub)/plans/page.tsx:22-49` — the FAQ correctly describes today's two named subscriptions but has no entry at all for the base 12-month-included-then-renew mechanic (because per ADR-0244 ¶36 "the updates-renewal SKU family... is created at the checkout-flip session, not before" — so this page isn't wrong yet, just incomplete). Needs a new Q&A when the renewal SKUs ship.

### (2) Contradicts vs correct — summary

7 spots contradict (EULA ×2, license page ×2, procurement page ×2, cart trust badge ×1) — all share the same defect: framing updates as exclusively subscription-gated, omitting the included window + generic renewal. 8 spots already correct. 1 spot (`plans` page) is a scoped omission to backfill later, not a contradiction to fix now.

### (3) Draft replacements

**1. EULA Definitions (`apps/site/app/legal/eula/page.tsx:99-101`)**

(a) Minimal:

> "'Software' means the Caisson source code, the packages under the `@caisson` scope, related documentation, and any updates delivered under the license's included updates window or an active updates subscription, as licensed to you under this Agreement."

(b) Fuller:

> "'Software' means the Caisson source code, the packages under the `@caisson` scope, related documentation, and any updates you are entitled to under Section 5 (Fees and payment) — the included updates window, an optional updates renewal, or an active Compliance Updates or Developer subscription — as licensed to you under this Agreement."

**2. EULA Fees & payment (`apps/site/app/legal/eula/page.tsx:215-219`)**

(a) Minimal (prepend a sentence, keep the rest):

> "The perpetual license fee is a one-time charge that includes 12 months of updates from your Order date — registry access to any entitled-package version published in that window, plus everything already delivered. After that window, you may renew updates access for another 12 months at a reduced rate, or let it lapse; non-renewal never affects the perpetual license for versions already delivered. A Compliance Updates subscription, where purchased, is billed on a recurring basis until cancelled and grants access to new package versions with updated control mappings; it is optional and does not affect the perpetual license for versions already delivered."

(b) Fuller:

> "The perpetual license fee is a one-time charge. It includes twelve (12) months of updates from your Order date: registry access to any entitled-package version published within that window, plus everything already delivered to you. When that window closes, you may renew updates access for another 12 months at a reduced rate off then-current list, or do nothing — your Entitlement, and every version already delivered under it, keeps working exactly as before; non-renewal is never punitive. This updates window is separate from, and unaffected by, a Compliance Updates or Developer subscription, where purchased: an active subscription bills on a recurring basis until cancelled and layers on additional framework-mapping updates, evidence-pack regeneration, or credits; cancelling a subscription likewise does not affect the perpetual license for versions already delivered."

**3. License page FAQ (`apps/site/app/legal/license/page.tsx:34-35`)**

(a) Minimal:

> "Yes. The Commercial License is perpetual for the version you purchased, and your purchase includes 12 months of updates from your Order date. Compliance Updates (or the Developer plan) is an optional subscription that adds ongoing framework-mapping updates and credits; neither is required to continue using the version you bought."

(b) Fuller:

> "Yes, in two parts. The license itself is perpetual: the version you purchased keeps working, verified offline, for as long as you use it — no expiry, no renewal, no call home. Updates are separate: every purchase includes 12 months of registry updates from your Order date, renewable afterward at a reduced rate. Compliance Updates and the Developer plan are optional subscriptions layered on top for teams that want ongoing framework-mapping updates or credits; none of this changes the perpetual license for the version you already own."

**4. License page mechanics bullet (`apps/site/app/legal/license/page.tsx:228-232`)**

(a) Minimal (extend the existing bullet):

> "Your purchase includes 12 months of registry-pull updates from your Order date, renewable afterward at a reduced rate; letting it lapse never revokes access to versions already delivered. A Compliance Updates subscription, where purchased, additionally delivers new package versions with updated control mappings as regulations change. Both are optional; the perpetual license does not expire."

(b) Fuller (split into two bullets):

> "Your entitlement includes 12 months of updates from your Order date: registry pulls of any entitled-package version published in that window, plus everything already pulled. After 12 months you can renew updates access for another 12 months at a reduced rate, or do nothing — the code you already have keeps working."
> "A Compliance Updates or Developer subscription, where purchased, layers additional updates — framework-mapping refreshes, evidence-pack regeneration, or credits — on top of the included window. All of this is optional; the perpetual license itself does not expire."

**5. Procurement FAQ (`apps/site/app/(marketing)/procurement/page.tsx:57-59`)**

(a) Minimal:

> "One-time. The perpetual license fee is a single charge per edition or module, and the license doesn't expire, doesn't require renewal, and verifies offline: no call home required. It includes 12 months of updates from your Order date, renewable afterward at a reduced rate. Compliance Updates is a separate, optional, recurring subscription that delivers new package versions with updated control mappings; skipping either doesn't affect the perpetual license you already hold."

(b) Fuller:

> "One-time for the license, time-boxed for updates. The perpetual license fee is a single charge per edition or module: the license doesn't expire, doesn't require renewal, and verifies offline — no call home required. Your purchase includes 12 months of registry updates from the Order date; after that, you can renew updates access for another 12 months at a reduced rate, or let it lapse with no penalty to the code you already have. Compliance Updates is a separate, optional, recurring subscription that layers on ongoing framework-mapping updates; skipping either one never affects the perpetual license you already hold."

**6. Procurement body copy (`apps/site/app/(marketing)/procurement/page.tsx:237-243`)**

(a) Minimal:

> "The perpetual license fee is a one-time charge per edition or module and includes 12 months of updates from your Order date, renewable afterward at a reduced rate. A Compliance Updates subscription, where purchased, bills on a recurring basis until cancelled and delivers new package versions with updated control mappings; neither is required, and skipping either doesn't affect the perpetual license for versions you already have. The license itself doesn't expire, doesn't require renewal, and doesn't call home to stay valid."

(b) Fuller:

> "The perpetual license fee is a one-time charge per edition or module. It includes 12 months of registry updates from your Order date; after that window you can renew updates access for another 12 months at a reduced rate, or do nothing — everything you've already been entitled to keeps working. A Compliance Updates subscription, where purchased, is a separate, additional layer: it bills on a recurring basis until cancelled and delivers new package versions with updated control mappings. None of this is required, and letting any of it lapse never affects the perpetual license for versions you already have. The license itself doesn't expire, doesn't require renewal, and doesn't call home to stay valid."

**7. Cart trust badge (`apps/site/components/cart-shared.tsx:93`)** — live checkout surface, keep terse

(a) Minimal (surgical word-swap, same length):

> "One-time perpetual license, billed once — no seat count, no forced renewal."

(b) Fuller (adds the window, still one line):

> "One-time perpetual license, billed once — no seat count. 12 months of updates included; renewing after that is optional, never required to keep using what you own."

### (4) Kickoff-D price-dependent spots

None of the drafts above hardcode the renewal percentage — every one says "a reduced rate" / "reduced rate off then-current list" rather than "~40%," deliberately, so the EULA/legal copy stays valid regardless of the exact per-SKU cents Kickoff-D sets (ADR-0244 ¶3: "exact per-SKU cents are set at the checkout-flip session within a 35–50% band"). **One spot does need a placeholder for the build to fill in:** the new FAQ entry the `marketplace/(hub)/plans/page.tsx` page will need once the renewal SKU family ships (see the "silent gap" note above) — that entry should show the actual renewal price/percentage (e.g. "$XXX to renew for another 12 months") and is the only one of these that must wait on Kickoff-D's number rather than shipping today with generic language.
