===== LEG: vanta =====

## PATTERN: Homepage 'All the frameworks you need' section: an 8-card grid (SOC 2, ISO 27001, HIPAA, GDPR, NIST AI RMF, ISO 42001, HITRUST, FedRAMP), each card a clickable framework name + one-line buyer-motivation benefit ('Get audit-ready fast', 'Manage AI risk', 'Demonstrate responsible AI governance').

MECHANISM: Turns a compliance checklist into a legitimacy/breadth signal at a glance and doubles as internal nav to deep pages — buyers scan for their framework, click straight into the relevant depth page instead of reading prose.
PLACEMENT: The Compliance bundle depth page and/or /marketplace: a grid of the actual compliance-module primitives caisson ships (OSCAL conformance, HIPAA/audit-worm, field-crypto, tenancy-rls) each as a card with a real one-line benefit tied to what the module does — no invented framework claims, only ones the bundle genuinely implements.
EFFORT: one component · BRAND: Strong fit — reinforces honest-artifact copy since every card names a real shipped capability, not a claimed certification.

## PATTERN: Proof strip directly under the hero: five short fragment stats with no full sentences ('Eliminated 10 spreadsheets', '2,000 hrs. saved annually', '20% faster deal cycles', 'Automated 93% of questionnaires', 'Saved hundreds of thousands') before any customer logo has even loaded.

MECHANISM: Trains the visitor's eye to expect quantified ROI in the first screen — fragment format (no verbs conjugated as full claims) reads as a proof-artifact list, not a sentence a marketer wrote, which lowers skepticism.
PLACEMENT: Homepage hero substrip, but content must be build-fact stats (module count, bundle count, license type, real infra facts — e.g. '22 modules · 6 bundles · Apache-2.0 base · WORM-anchored storage') never customer-outcome numbers, since caisson has no customers to cite and the copy law bans invented metrics.
EFFORT: copy tweak · BRAND: Fit only if every number is a verifiable build fact — the moment one figure implies a customer outcome caisson hasn't measured, it violates the honest-artifact law. Use with restraint.

## PATTERN: 'Built for you' segmentation section: three cards (Startups / Mid-market / Enterprise), each with a distinct pain-point pitch tuned to that buyer's actual situation (founder needing SOC 2 'yesterday' vs. a security leader scaling without headcount vs. a CISO wanting one platform).

MECHANISM: Lets a visitor self-select the paragraph written for their actual job, instead of reading one generic pitch and guessing whether the product is 'for them' — cuts bounce from mis-fit visitors.
PLACEMENT: Homepage or a bundle-picker page: segment by buyer type (solo dev shipping fast / small team needing a production base / regulated org needing the Compliance bundle) mapped onto the six-bundle catalog, each with its own one-paragraph pain framing instead of one generic hero pitch.
EFFORT: one section · BRAND: Good fit — helps the six-bundle catalog (ADR-0257) read as buyer-need-driven rather than a flat SKU list, and needs no fabricated proof to work.

## PATTERN: Trust Center product page reframes compliance as a revenue lever, not a cost center: feature is literally named 'ROI reporting — connect activity to influenced revenue', backed by a quote ('Our big opportunity as a compliance team is looking at every compliance activity as a sales activity').

MECHANISM: Reframes the entire buyer motivation from risk-avoidance ('don't get breached') to deal-velocity ('unblock the security review that's stalling your close') — a much stronger internal-champion pitch to bring to a CFO/CEO.
PLACEMENT: Compliance bundle depth-page copy: reframe module descriptions (WORM audit storage, OSCAL conformance) around 'what your buyer's security review will actually ask for' rather than pure risk-mitigation language — a copy-only change, no new numbers invented.
EFFORT: copy tweak · BRAND: Strong fit, zero copy-law risk — it's a framing shift in existing true copy, not a new claim.

## PATTERN: Trust Center product itself: a public page showing live/continuous evidence of a company's actual controls ('real-time evidence... beyond a one-time compliance snapshot') rather than a claims page.

MECHANISM: Substitutes 'look at our real live artifact' for 'trust our marketing claim' — the strongest possible proof device because it's unfalsifiable by construction.
PLACEMENT: A public example/demo page showing genuine caisson build output — e.g. a live OSCAL conformance report or a sample WORM audit-anchor viewer from the compliance module's own CI — so the proof is the actual shipped artifact, not a customer testimonial caisson doesn't have yet.
EFFORT: one section · BRAND: Excellent fit — this is the honest-artifact law's ideal expression: show the real output instead of describing it, sidesteps the no-invented-metrics constraint entirely.

## PATTERN: Persistent dark-purple announcement bar pinned above the main nav, carrying the current campaign message with a 'Learn more →' link ('Vanta Delivers: AI is moving fast. See how Vanta helps you stay ahead of risk.').

MECHANISM: Gives the marketing team a slot to push whatever the current narrative push is without touching the hero — cheap to rotate, always visible above the fold.
PLACEMENT: Homepage global bar linking to /updates' latest entry (e.g. 'Six bundles now live' or the newest module ship) — a near-zero-effort component if not already present.
EFFORT: copy tweak · BRAND: Good fit, low risk — content is just a pointer to real shipped /updates entries.

## PATTERN: Pricing page has NO dollar figures publicly — every tier resolves to 'Get personalized pricing' / demo request, and the feature-comparison matrix (10 categories, 5 tiers, checkmark/blank/'Add-on' cells) does the entire selling job instead of a price ladder.

MECHANISM: Standard enterprise-SaaS device: hides price to force a sales conversation and avoid anchoring against competitors, while the matrix still lets a self-serve evaluator do feature diligence.
PLACEMENT: Anti-pattern for caisson, not to adopt — caisson's locked posture (ADR-0082/ADR-0237) is the opposite: committed visible prices, live self-serve checkout, no waitlist/demo framing. Worth keeping only as a documented contrast, and possibly borrowing just the MATRIX MECHANIC (not the price-hiding) for a bundle-vs-bundle 'what's in each bundle' compare table on /marketplace, since caisson already sells 6 bundles + 22 à-la-carte modules and a compare grid would help buyers self-select without hiding any price.
EFFORT: one component · BRAND: Conflicts directly on price-transparency (do not adopt the gate); the underlying comparison-matrix component is neutral/reusable if prices stay visible in every cell.

NOTES: Vanta's IA is fully demo-gated: nav is Platform / Solutions / Partners / Resources / Plans (note "Plans" as its own top-level item, not buried under a dropdown) + Log in / Get a demo — no self-serve buy button anywhere. The /pricing page shows zero dollar figures; every tier ("Essentials/Plus/Professional/Pro/Enterprise") resolves to "Get personalized pricing" and a giant feature-comparison matrix (10 categories × 5 tiers, cells are checkmark/blank/"Add-on") substitutes for a price ladder. This is a direct structural contrast to caisson's locked posture (ADR-0082/ADR-0237): committed, visible prices, live self-serve checkout, no waitlist/demo-gate framing — worth keeping as a documented anti-pattern rather than an import. A persistent dark-purple announcement bar above the hero carries their current campaign ("Vanta Delivers: AI is moving fast"), which is a cheap, reusable component for caisson's own /updates surfacing. Testimonials, the Forrester Wave / IDC "526% ROI, 3-month payback" citations, and named-customer logos are all copy-law-blocked for caisson today (no invented metrics/logos/testimonials) — the mechanism is worth recording for later (once real buyers exist) but none of the specific numbers or quote format should be echoed.

===== LEG: drata =====

## PATTERN: Framework coverage grid: a dedicated /frameworks index with ~30 tiles (SOC 2, ISO 27001, HIPAA, PCI DSS, GDPR, FedRAMP, NIST CSF, DORA, ISO 42001…), each just a name + one-sentence outcome, linking to a full dedicated landing page per framework.

MECHANISM: Lets a visitor self-qualify against their own named compliance requirement in one glance, and turns each tile into a long-tail SEO landing page ('how do I get SOC 2 ready') instead of one generic pitch trying to cover every buyer.
PLACEMENT: A new /compliance/frameworks (or a section on the Compliance bundle depth page) with one tile per standard caisson's audit-worm/field-crypto/compliance modules actually map to (SOC 2, HIPAA, ISO 27001, OSCAL) — only ship tiles for frameworks the module set genuinely covers, not the full 30.
EFFORT: one section · BRAND: reinforces — pure IA/coverage disclosure, no invented numbers; the honesty floor just means the tile list must equal real control mappings, not aspirational ones.

## PATTERN: Per-framework landing page template: hero (name + 2-sentence definition + primary/secondary CTA) → 4 outcome bullets → 3-4 'Why Drata' capability blocks → an 'Additional Capabilities' mini-grid → cross-sell blocks to adjacent products → a customer quote scoped to that framework → related resources → closing CTA.

MECHANISM: One repeatable skeleton turns every framework/module into a complete, indexable sales page instead of a stub, without designing N bespoke layouts.
PLACEMENT: Promote caisson's module depth pages (currently closer to a catalog card) to this fuller template for the highest-intent modules — e.g. the OSCAL and audit-worm pages under the Compliance bundle — reusing the same component for every module page.
EFFORT: one component · BRAND: reinforces — structural reuse only; drop the customer-quote slot until caisson has a real one rather than filling it.

## PATTERN: '[PROBLEM] DISCONNECTED SYSTEMS LEAVE GAPS' — an all-caps problem-naming eyebrow directly above each capability section's headline, before pivoting to the solution.

MECHANISM: Names the buyer's felt pain in their own frame before claiming the fix, raising perceived relevance per section without adding length.
PLACEMENT: Bundle/module depth pages' feature sections — e.g. '[PROBLEM] AUDIT EVIDENCE SCATTERED ACROSS TOOLS' above the WORM-storage section, '[PROBLEM] LICENSE SPRAWL ACROSS ENVIRONMENTS' above the license/entitlement module.
EFFORT: copy tweak · BRAND: reinforces — a copy device, not a claim; costs nothing against the honesty law.

## PATTERN: Segmented 'stage of flight' cards: Startup / Growth / Enterprise, each a bold one-line promise plus 3 sub-bullets tailored to that stage's actual concern (launch fast vs. standardize vs. govern at scale).

MECHANISM: Lets a visitor self-select by company stage inline, personalizing the pitch without a nav decision or a pricing-tier commitment.
PLACEMENT: Below caisson's six-bundle grid on the homepage — a Solo builder / Growing team / Compliance-buyer segmentation, each pointing at the bundle that fits (Agentic-Dev → solo, Local-first/AI-Production → growing team, Compliance/Everything → buyer with an auditor).
EFFORT: one section · BRAND: reinforces — bullets are capability statements caisson can back with real modules, no stat needed.

## PATTERN: Fixed trust strip under every hero — 'Trusted by 8,500+ Global Customers' + '4.8/5.0 G2 Reviews' — repeated verbatim on home, every product page, and the customers index.

MECHANISM: Constant repetition of the single strongest proof point anchors credibility before the visitor scrolls, on every entry page regardless of source.
PLACEMENT: Structurally adoptable as an empty slot under every hero, but the CONTENT (customer count, review score) is exactly what caisson's copy law forbids inventing — hold this pattern until there's a real number to put in it (GitHub stars, npm weekly downloads, or a real buyer count once launch has traction).
EFFORT: one component (content gated) · BRAND: fights the honest-artifact law as literally executed — do not fill with invented figures; keep the slot dark until real data exists.

## PATTERN: Dated, segment-tagged 'customer wins' micro-story feed — short single-page stories like 'One Audit Cycle Away From Doing It Right — JULY 5, 2026 • GROWTH', published near-daily, distinct from the full long-form customer-story pages.

MECHANISM: Cheap-to-produce proof content on a visible, frequent publishing cadence reads as an active, growing business and gives search engines fresh dated pages.
PLACEMENT: Not a fit for /updates (that's the changelog surface) — would need a genuinely new proof feed fed only by real early-adopter usage; premature pre-launch.
EFFORT: program · BRAND: fights the law if faked — flag as future-only, gated on real customers existing to write about.

## PATTERN: Closing CTA banner ('Chart Your Course / Navigate to new worlds of trust with Drata. [Get a Demo]') reused verbatim at the bottom of every page type — home, frameworks, product, customers.

MECHANISM: One predictable, low-friction exit point regardless of which page the visitor entered on reduces decision cost and unifies the site's rhythm.
PLACEMENT: A single closing-CTA component reused at the bottom of caisson's homepage, /marketplace, module depth pages, and /updates — same headline/CTA pattern, swap only the destination (checkout vs docs vs contact).
EFFORT: one component · BRAND: reinforces — pure structural reuse, zero content risk.

## PATTERN: Nav splits 'Solutions' (audience/segment entry) from 'Products' (capability entry), with 'Customers' and 'Partners' promoted to top-level nav items rather than buried in a footer.

MECHANISM: Two parallel taxonomies — what you sell vs. who's buying — let a compliance officer and a platform engineer each find their own path in without forcing one IA on both.
PLACEMENT: Lower priority given caisson's smaller catalog (six bundles, 22 modules) — worth revisiting only if the compliance-buyer vs. solo-developer audiences diverge enough to need separate nav entry points; for now the six-bundle grid already does audience-segmentation work.
EFFORT: one component · BRAND: reinforces if genuinely needed, but adds IA surface caisson doesn't yet have the catalog breadth to justify — defer.

NOTES: Drata is enterprise-sales-gated, not self-serve: nav is Products / Solutions / Customers / Partners / Resources / Company, "Sign In" + "Get Started", and the /pricing URL just re-renders the homepage — there's no public price list, everything routes to /demo. That's the opposite of caisson's self-serve checkout, so pricing-page mechanics don't transfer; what transfers is IA and proof structure. Full-page screenshot only rendered the 1080x600 viewport (lazy-loaded sections below didn't paint), so the visual read is hero-only; body content came from markdown crawls of home, /frameworks, /products/enterprise-grc, and /customers. The single most reusable structural idea is the framework-as-landing-page grid (below) — everything else is proof-density scaffolding that caisson's honest-artifact copy law mostly blocks until real numbers exist.

===== LEG: secureframe =====

## PATTERN: Pricing page shows 3 tier cards (Fundamentals/Complete/Defense) with feature bullet lists but ZERO prices — every card's only CTA is "Get a quote"

MECHANISM: High-variance enterprise ACV (seat count, framework count, audit-partner bundling) makes a single sticker price misleading; gating behind a quote also captures the lead and starts a sales-assisted upsell conversation instead of losing the deal to a self-serve competitor's calculator
PLACEMENT: Do NOT adopt wholesale — Caisson's committed self-serve pricing is a locked differentiator (ADR-0082/ADR-0237 rider 2, no waitlist/no quote-gating). Only usable as a secondary path: an optional "Need a BAA / custom SLA / on-prem deploy? Talk to us" link next to the committed price on the Compliance bundle depth page, never replacing the shown number.
EFFORT: copy tweak · BRAND: fights the brand if copied as the primary pattern — Caisson's whole go-live posture is anti-quote-gating; fine only as a small secondary escape hatch

## PATTERN: Below the 3 pricing cards, a full feature-comparison matrix grouped into named collapsible categories (Compliance Automation, Questionnaires, Trust Center, Risk Management, Third-Party Risk Management, Admin and Security, Defense) with a checkmark/dash grid across tiers

MECHANISM: Lets a buyer self-verify exactly what's in each tier without a sales call, killing the #1 pricing-page support question ("what's actually included") before it's asked
PLACEMENT: /marketplace or a new /compare page: turn the existing 22-module × 6-bundle entitlement data (already tracked in docs/build-state.md + the registry index) into a collapsible-by-category checkmark grid — this is real, already-true data, zero new claims needed
EFFORT: one section · BRAND: reinforces — purely a rendering of already-true build-state data, matches the honest-artifacts law exactly

## PATTERN: Mega-nav's "Products" dropdown is organized into 5 outcome clusters (Artificial Intelligence / Trust / Efficiency / Visibility / Security), each a one-line benefit headline + 2-4 deep links to specific features — not a flat alphabetical product list

MECHANISM: Visitors navigate by their goal ("I need to reduce risk") rather than needing to already know Secureframe's internal product names; the dropdown doubles as an IA'd feature index/sitemap
PLACEMENT: Layer a secondary "by job" facet over the existing six-bundle homepage grid/nav — e.g. "Ship compliant AI" (ai-config, mcp-server, risk modules), "Own your data" (local-first modules), "Automate agent workflows" (agentic-dev modules) — helps the 22-module catalog stay navigable as job-to-be-done groupings distinct from the bundle SKU taxonomy
EFFORT: one component · BRAND: reinforces — adds a navigation lens without inventing content, fits a technical dark-brand IA

## PATTERN: Homepage mid-page grid of named-framework tiles (SOC 2, ISO 27001, HIPAA, CMMC + "All frameworks" catch-all), each linking to a dedicated per-framework landing page

MECHANISM: Each tile does double duty: a breadth/trust signal on the homepage AND a standalone SEO/AEO landing page targeting that framework's search intent (e.g. "SOC 2 automation")
PLACEMENT: Compliance bundle depth page: add a framework-tile grid (OSCAL, FedRAMP, HIPAA — the ones the compliance module actually targets per specs) each linking to a dedicated landing/doc page reusing existing shipped claims, no new metrics required
EFFORT: one section per framework (start with the 2-3 Caisson actually supports) · BRAND: reinforces — reuses real, already-built module capability as SEO surface

## PATTERN: Persistent, dismissible top announcement bar promoting one vertical sub-product ("Secureframe Defense: One Platform. Complete CMMC Readiness. Learn more") with an X to close, linking to a dedicated blog post

MECHANISM: Merchandises a specific high-intent wedge (CMMC/defense contractors) without permanently cluttering primary nav, and is dismissible so it doesn't nag return visitors every session
PLACEMENT: A dismissible top bar on caisson.sh promoting the Compliance bundle specifically ("Compliance bundle: WORM audit storage + field-crypto + OSCAL, live today") linking to /marketplace or the bundle depth page — reuses already-shipped, true claims
EFFORT: one component · BRAND: reinforces — cheap, honest, no fabricated claim needed, and gives the compliance hero wedge (ADR-0040) a literal top-of-page slot

## PATTERN: Immediately under the hero CTA, before any feature content, a single-line scale-proof strip ("6000+ customers have saved millions of hours with Secureframe")

MECHANISM: Pure social-proof-by-scale placed at the very top of the scroll so it does trust-building work before the visitor reads a single feature
PLACEMENT: Same SLOT, different FILL: a first-scroll credibility strip under Caisson's hero CTA built from real, non-fabricated facts — e.g. "Apache-2.0 base + 22 commercial modules, six bundles, live self-serve checkout" or real GitHub/npm numbers once they exist — never an invented customer count
EFFORT: copy tweak · BRAND: fights the brand if the literal customer-count claim is copied (violates the no-invented-metrics copy law); reinforces if only the PLACEMENT (proof strip right after the fold) is reused with honest content

NOTES: Secureframe hides ALL pricing — every one of the 3 tiers (Fundamentals / Complete / Defense) on /pricing shows only a "Get a quote" CTA, no numbers, no seat/framework calculator. This is a sales-assisted, enterprise-ACV genre departure from Caisson's locked committed-self-serve-price posture (ADR-0082, ADR-0237 rider 2) — worth citing as the explicit contrast when explaining why Caisson shows real numbers at checkout. The pricing page's actual selling content is a long feature-comparison matrix below the 3 cards, not the price — the page's job is "here's exactly what you get," which is the part worth stealing. Top nav is a mega-menu with 5 outcome-based clusters (AI / Trust / Efficiency / Visibility / Security) rather than a flat product list, each cluster pairing a one-line benefit with 2-4 deep links — doubles as a sitemap. A vertical sub-brand (Secureframe Defense, CMMC-specific) gets its own pricing tier, its own persistent dismissible top banner, and its own landing page — a pattern for launching a narrower wedge without touching primary IA. Homepage proof is scale-only ("6000+ customers," "saved millions of hours") placed immediately under the hero CTA, before any feature copy — pure social-proof-by-number as the very first thing after the fold.

===== LEG: shipfast =====

## PATTERN: Hidden-cost-of-DIY itemized math stack: a bulleted list of named tasks each tagged with an hour cost ("4 hrs to set up emails + 6 hrs designing a landing page + 4 hrs Stripe webhooks + ... = 22+ hours of headaches"), immediately followed by "There's an easier way" and a mock terminal line (`const launch_time = "04:10 AM";`).

MECHANISM: Makes an abstract time-saved value prop visceral by naming the exact tedious tasks a developer already recognizes, then anchors the price against a summed real-hours total instead of an abstract percentage; the fake code snippet signals dev-to-dev authenticity.
PLACEMENT: Compliance bundle depth page ($1,049): replace a generic bullet list with an itemized build-cost stack specific to what Compliance replaces (WORM S3 object-lock provisioning, OSCAL control-mapping schema, field-crypto key rotation, tamper-evident audit log design, RLS tenancy) — could anchor the homepage bundle card too.
EFFORT: one section · BRAND: strong only if every hour figure is a defensible engineering estimate tied to a real module, not a round invented number — the device itself fights the honest-artifact law the moment a figure isn't grounded.

## PATTERN: Feature-category tab switcher (Emails / Payments / Login / Database / SEO / Style / More) — click a tab, get a short bullet list plus the actual integration logos (e.g. "with Mailgun OR with Resend") for that category.

MECHANISM: Compresses a full "what's inside" feature wall into a scannable, self-serve module browser so a technical buyer jumps straight to the piece they care about instead of scrolling past 20 irrelevant bullets.
PLACEMENT: Homepage six-bundle grid or a bundle depth page: a tab switcher across real bundle contents (Compliance: WORM / OSCAL / field-crypto / RLS-tenancy) — mirrors the module-preview component already shipped in site-design-3; also fits as a /marketplace filter.
EFFORT: one component · BRAND: high — matches Caisson's modular, self-serve, technical posture; no fabricated content needed since bundle contents are already real.

## PATTERN: Founder-voice origin/rationale block ("Hey, it's Marc") sitting mid-page between the feature section and pricing: a first-person story of why the product was built, paired with one named credibility stat (Product Hunt Maker of the Year, 135k followers).

MECHANISM: Breaks up feature-speak with a personal trust signal — the buyer isn't just evaluating code, they're evaluating whether a real person stands behind it and will keep updating it.
PLACEMENT: An "engineering rationale" block on the homepage or /updates: why rebuilt-clean-not-ported, who maintains it, real update cadence — every claim must point at a checkable artifact (a real /updates link, a real commit/ADR count) rather than hype phrasing.
EFFORT: one section · BRAND: moderate — only works with restraint; Caisson's copy law bans invented credibility stats, so this is a rewrite of the device's honesty floor, not a straight port.

## PATTERN: Three-tier pricing with strikethrough anchor→discount price, a persistent reassurance line under every CTA ("Pay once. Build unlimited projects!"), and a top cross-sell tier that bundles a second product with its own tiny proof unit.

MECHANISM: The reassurance line kills the #1 objection (recurring fees?) at the exact decision point without needing proof; the bundle tier upsells via a second, self-contained trust unit instead of a generic "save more" banner.
PLACEMENT: caisson.sh homepage bundle cards / checkout: reuse the reassurance-line device for Caisson's real one-time-purchase framing ("one-time purchase, source you own, no seat tax"), and the cross-sell-tier logic naturally maps to Everything ($2,059) as the "stack all six bundles" tier.
EFFORT: copy tweak · BRAND: strong for the reassurance line (a true, provable claim); the strikethrough-discount half only fits if Caisson runs a real time-boxed promo — otherwise drop it, per copy law.

## PATTERN: Objection-handling FAQ that names real alternatives directly ("Is ShipFast better than AI tools like Lovable or Bolt?", "Is it better than other boilerplates?") and answers with a structural distinction rather than a trash-talk comparison.

MECHANISM: Pre-empts the buyer's actual next browser tab (a competitor's site) inside your own FAQ, framed as "here's the structural difference," which keeps the objection-handling factual and specific instead of a bare superiority claim.
PLACEMENT: /pricing or bundle depth-page FAQ: answer "why not just use [an official vendor SDK / a free compliance template / build in-house]" with the same structural framing Caisson already has real grounds for (composable packages vs. a monolith fork, source ownership vs. subscription lock-in).
EFFORT: copy tweak · BRAND: very high — stays on defensible structural claims, needs no invented number or logo, cleanly satisfies the honest-artifacts law.

## PATTERN: A blunt, no-hedging refund-policy statement ("ShipFast is yours forever, so it can't be refunded... users ship in 7 days on average") — states an unfavorable policy plainly, paired with exactly one grounded stat.

MECHANISM: Confidently stating a customer-unfriendly policy without apologizing reads as more trustworthy than legal-hedge phrasing; the one real stat softens it without contradicting the blunt claim.
PLACEMENT: Checkout / EULA summary: restate Caisson's actual refund and license terms in the same blunt-declarative voice ("source is yours on purchase — see EULA") instead of legalese hedging; drop the second clause entirely if there's no real stat to pair with it.
EFFORT: copy tweak · BRAND: high — the voice already matches Caisson's honest tone; the only risk is quoting an ungrounded number to fill the second half.

## PATTERN: "Featured on" press-badge row directly under the hero CTA (small linked HN/Product Hunt/X/Reddit icons) plus a "Product of the day 2nd" laurel badge on the headline itself.

MECHANISM: Third-party press badges are the cheapest, least-refutable proof unit — a reader can click through and verify instantly, unlike a quote or a number which requires trust.
PLACEMENT: Homepage hero: if/when Caisson earns a real HN front-page hit or Product Hunt launch, a same-style small clickable badge row is a safer proof unit than a testimonial quote — every badge links to a real, checkable post, satisfying the honest-artifact law by construction.
EFFORT: copy tweak · BRAND: high once earned — verifiable and cheap; must not be added preemptively for a launch that hasn't happened.

## PATTERN: DO NOT COPY: decrementing scarcity counter ("$100 off for the first 8360 customers (6 left)") planted in both the hero and the pricing section, plus a dense wall-of-love testimonial grid with embedded personal MRR/revenue screenshots and a public revenue-verified leaderboard.

MECHANISM: Classic urgency + social-proof-at-volume mechanics built for a $199-$349 impulse purchase by solo indie hackers who do zero procurement diligence and treat peer MRR screenshots as validation.
PLACEMENT: Explicitly keep OFF caisson.sh entirely: a $1,049-$2,059 B2B/compliance buyer is doing due-diligence-style evaluation, not impulse-buying off a countdown — a fake "X left" counter or an uncurated tweet wall reads as manipulative and directly violates the no-invented-metrics/logos/testimonials copy law. If real, permissioned adoption proof exists someday, it belongs in a sober "who's using this" strip, never a countdown or leaderboard gimmick.
EFFORT: copy tweak (to explicitly NOT build) · BRAND: actively fights the brand — the clearest anti-pattern on the page.

## PATTERN: Partner-discount value stack ("$1,210 worth of discounts" — Vercel, Resend, DataFast, etc. bundled free with purchase), itemized as a bulleted FAQ answer.

MECHANISM: Increases perceived deal value after the purchase decision by bundling real third-party perks the buyer needs anyway, without discounting the core product price itself.
PLACEMENT: Developer subscription or bundle purchase confirmation page: if Caisson lands real infra-partner deals (hosting credits, KMS/observability discounts), list them the same itemized way — only ship if every deal is real and currently valid; skip the section entirely rather than pad it.
EFFORT: one section, contingent on real partnerships existing · BRAND: neutral-to-good only if fully grounded; inventing a placeholder deal to fill space is a copy-law violation.

NOTES: ShipFast is a single long-scroll homepage with no separate pricing page — nav (Pricing/Demo/Wall of love) just anchors to in-page hashes, plus a maker-culture easter egg ("Press L to see the Leaderboards"). The scarcity counter ("$100 off for the first 8360 customers (6 left)") is planted twice — hero and pricing — reinforcing itself. Every mechanic on the page (decrementing counter, dense tweet/testimonial wall with embedded MRR screenshots, public revenue-verified leaderboard, no-refund-but-confident tone, partner-discount stack) is built for a solo indie-hacker making a $199-$349 impulse decision in one sitting with zero procurement process. That's the opposite of Caisson's buyer motion (a $1k-$2k B2B/compliance purchase with real diligence) and directly collides with Caisson's "honest artifacts only, no invented metrics/logos/testimonials" copy law — so the urgency+social-proof-at-volume cluster is this site's clearest "do not copy" lesson, while the structural devices underneath (tab-switcher for module contents, comparison-framed FAQ, reassurance line under the CTA, blunt policy statements) survive the translation to a serious buyer cleanly.

===== LEG: makerkit =====

## PATTERN: "Skip months of infrastructure work" section: a 14-row build-vs-buy table (Component | Build Yourself [time estimate] | With MakerKit [Pre-built]) followed by a 3-stat summary row: "Build from scratch: 3-6 months / 500+ hours" vs "With MakerKit: Day 1" vs "Estimated savings: $15,000-$50,000".

MECHANISM: Converts an abstract quality claim ("production-ready") into a legible cost-avoidance number the buyer can defend to a boss or a co-founder — it answers 'why not just build this myself' before the visitor asks it.
PLACEMENT: A dedicated section on the Compliance bundle depth page (the hero wedge) and on /marketplace: rows for WORM audit storage, OSCAL conformance mapping, field-crypto, license-keyed registry gating — each with a real build-time estimate and 'Included in bundle' — closing with the same 3-stat summary row scaled to caisson's own price points.
EFFORT: one section · BRAND: reinforces — as long as the time estimates are defensible, not invented; caisson's honest-artifact law means these need real internal estimates, not marketing-department guesses

## PATTERN: "How MakerKit Compares" — four terse problem/solution sentence pairs with no table chrome at all, just a struck-through pain statement next to the resolving statement ("Building auth from scratch takes 2-4 weeks" / "MakerKit includes complete auth with MFA in minutes").

MECHANISM: Cheapest possible objection-handling device — no design system needed, just two sentences in visual contrast; reads fast while scrolling past on mobile.
PLACEMENT: Module depth pages, one pair per module, directly under the module's feature list: e.g. "Rolling your own field-level encryption means weeks of NIST-aligned crypto review" / "field-crypto ships pre-audited AES-256-GCM with key rotation built in."
EFFORT: copy tweak · BRAND: reinforces — pure text device, no invented numbers needed if phrased as capability contrast rather than a specific time claim

## PATTERN: Hero reframes the buyer as an AI agent's operator, not a solo coder: "The production foundation your AI agent builds on" / "AI scaffolds a prototype. It can't give you secure multi-tenancy, real billing, or an upgrade path that lasts" — with MCP server + agent rules named as concrete shipped artifacts, not vague AI-washing.

MECHANISM: Reframes the entire competitive set (from 'other boilerplates' to 'what your AI agent generates unassisted') which is a wedge nobody else in the SaaS-starter-kit category was running when this was captured — it makes the kit's existence feel newly necessary rather than merely nice-to-have.
PLACEMENT: Homepage hero or Agentic-Dev bundle page: 'Claude/Cursor can scaffold a compliant-looking audit log. It can't give you a WORM-anchored, OSCAL-mapped one with a real license.' Ties directly to caisson's actual differentiator (agents can write code, they can't manufacture provenance/attestation).
EFFORT: copy tweak · BRAND: reinforces strongly — matches caisson's honest-artifact stance (the claim is falsifiable and true: agents genuinely can't generate a signed audit chain) and its actual buyer (teams shipping AI-adjacent products who need the compliance floor)

## PATTERN: A 3-way segmented control ("Choose your Stack: Supabase / Drizzle / Prisma") sits directly above the pricing tiers and swaps out both the tier cards AND the feature-checklist matrix beneath them per selection — including a free Open Source tier only under the Supabase stack.

MECHANISM: Lets one pricing section serve three genuinely different products without three separate pricing pages, and the picker itself signals 'we support real architectural choice' before the visitor reads a single feature row.
PLACEMENT: /marketplace or the bundle-grid page: a lightweight tab control ('Choose your provider: AWS / Azure / GCP' for the Compliance bundle, or 'Choose your model lane: Bedrock / Azure OpenAI / Ollama') that reshapes the visible feature matrix beneath the six-bundle grid instead of adding new pages per combination.
EFFORT: one component · BRAND: reinforces — caisson already has multi-provider drivers (Bedrock/Azure/Ollama per the edition-hardening work); surfacing that choice visually on the pricing surface is honest and currently invisible

## PATTERN: The feature-checklist matrix under each tier groups rows under explicit subheaders ("License Details" then "Features") rather than one long flat checklist, and uses a bare dash for 'not included' instead of an X icon or omitted row.

MECHANISM: Subheaders let the eye chunk 40+ feature rows into two decisions (what am I licensed to do vs. what do I get) instead of one long scroll; the dash (not a red X) keeps the missing-feature rows from reading as a rejection, which softens the free/entry tier's comparison.
PLACEMENT: The homepage six-bundle grid or a dedicated /pricing comparison table: split into 'License Details' (seats, projects, updates window, renewal terms) and 'Modules Included' sections rather than one long module checklist per bundle card.
EFFORT: copy tweak · BRAND: reinforces — caisson's licensing terms (updates window, renewal SKUs, entitlement scope) are exactly the kind of thing that gets lost in a flat module checklist today

## PATTERN: A genuinely free, functional "Open Source" tier sits as the leftmost column beside the paid Pro/Teams tiers on the pricing page itself (not just mentioned in prose) — with its own real feature list (Next.js, Supabase stack, basic functionality) and honest limitations ("Limited updates", "No support").

MECHANISM: A visible $0 column next to paid ones builds credibility for the paid tiers by proving there's no bait-and-switch — visitors can literally see what they'd be giving up by not paying, which is a stronger anchor than a vague 'open source available' footnote.
PLACEMENT: The homepage six-bundle grid or /marketplace: add the Apache-2.0 base substrate as a real $0 column beside the six paid bundles, with its own honest limitations listed (no compliance modules, no WORM storage, community support only) instead of only mentioning open-core in body copy.
EFFORT: one section · BRAND: reinforces directly — caisson's base is already genuinely Apache-2.0 (ADR-0094); this pattern would just make that visible on the pricing surface instead of leaving it implicit

## PATTERN: "Some of the projects built with Makerkit" — a large grid of ~28 real live customer products, each a clickable outbound link with a one-line description and a `?utm_source=makerkit.dev` query param, ending with an open invitation ("Have you published your Makerkit SaaS? Let me know, and I will post it here!").

MECHANISM: Every proof point is independently verifiable by clicking through to a live product — the strongest possible social proof because it can't be faked, and the UTM tag doubles as the vendor's own attribution/referral tracking.
PLACEMENT: A '/built-with' or homepage section once real paying customers exist: live outbound links to real customer products with utm_source=caisson.sh, plus a standing submission invite. Directly satisfies caisson's own no-invented-logos copy law by using only verifiable, clickable proof.
EFFORT: one section · BRAND: reinforces perfectly — this is the honest-artifact proof strategy caisson's copy law already demands; just needs real customers to populate it (don't fake it early)

NOTES: Homepage and /pricing render identical content — pricing isn't gated behind its own page, it's the tail of the homepage scroll with a matching URL for direct-link/SEO purposes. Nav is minimal: a single eyebrow badge at the very top ("Built for Claude Code, Cursor, Codex & Gemini — MCP server included") links out to /changelog instead of living in a nav bar, and the hero CTA scrolls to `#pricing` on the same page rather than routing to checkout. Trust-building runs on repetition, not one hero claim: "battle-tested... real business since 2022" appears three separate times (About block, mid-page feature intro, footer founder bio) in slightly different words, plus documentation depth is quantified ("400+ pages") as its own bulleted feature rather than a vague claim. The whole page has zero screenshots of the actual product UI — every trust signal is either a stat, a comparison table, or a live outbound link to a real shipped customer site, which lines up well with caisson's own no-invented-proof copy law.

===== LEG: supastarter =====

## PATTERN: Hero-top pill picker (Next.js / Nuxt / TanStack Start) that re-renders everything below it — the code sample, the pricing tiers, and every 'Learn more' doc link — for the selected stack, all on one persistent control at the very top of the page.

MECHANISM: Turns 'which variant am I' into a single decision made once, up front, then forgotten — the visitor never has to mentally re-filter bundle-specific content on every subsequent section because the page already picked it for them.
PLACEMENT: Adapt the axis from framework to bundle: a small picker pinned near the top of /marketplace (and repeated on module depth pages) toggling 'shown as: à la carte / in Compliance / in Everything' that re-renders the price and the 'included in' badge on every module card below it — same one-control-reruns-the-page mechanic, applied to caisson's actual bundle axis instead of a framework axis.
EFFORT: one component · BRAND: Strong fit — no invented numbers, just re-slicing real bundle/price data caisson already has; reinforces the six-bundle IA rather than fighting it.

## PATTERN: An interactive monorepo file/folder tree rendered directly under the hero (apps/, packages/, tooling/ …) where each package name is a live link that jumps straight to that feature's explainer section further down the page — the real repo structure doubles as the page's table of contents.

MECHANISM: Converts 'trust me, it's well-organized' into a literal, inspectable artifact — the IA of the marketing page and the IA of the actual codebase are the same object, so skepticism about vaporware evaporates before any prose is read.
PLACEMENT: Homepage, right below the hero and above (or in place of) the six-bundle grid: render caisson's real top-level tree (packages/compliance, packages/audit-worm, packages/field-crypto, apps/admin, apps/site …) with each folder linking to its module depth page or bundle card — literally the honest-artifact law made visual.
EFFORT: one section · BRAND: Excellent fit — it IS an honest artifact by construction (real paths, real links), the strongest way to satisfy the no-invented-anything copy law while still being a flashy above-the-fold device.

## PATTERN: Feature tour built as an alternating 2-column bento grid where every card pairs a small LIVE mock of that exact feature (a fake login form for Auth, a fake pricing-tier selector for Payments, a team-members list for Organizations, a schema.prisma code block for Database, a REST request/response tester for API, a chat panel for AI agents) with a short headline + bullet-chip list + 'Learn more' deep link — density and mockup richness taper off for lower-priority features (Blog, SEO, Monitoring get plain bullet cards, no mockup).

MECHANISM: Show-don't-tell at the level of individual features, not just the hero — each card answers 'what does this actually look like' in under a second, and the graceful degradation (rich mockup for core features, plain bullets for minor ones) keeps the page from feeling padded even with 20+ features listed.
PLACEMENT: Module depth pages and the /marketplace grid: swap prose-only module cards for a real cropped screenshot or terminal/log snippet per module (a redacted WORM audit-log line for audit-worm, a `license-verify` CLI output for license, the admin /ops Grafana panel for observability) paired with the existing bullet list — start with the 6-8 highest-traffic modules, let the rest stay bullet-only like supastarter's tail features.
EFFORT: one section · BRAND: Strong fit if screenshots are real crops of caisson's actual admin/CLI/logs (satisfies honest-artifact law); would be a violation if any mockup were staged/fabricated data.

## PATTERN: Inside relevant feature cards, the pluggable-provider choice is shown via real vendor logos rather than a bullet list — Payments shows Lemonsqueezy/Stripe/Polar/Creem/Dodo Payments logos; Database shows Prisma/Drizzle logos — the 'you're not locked in' claim is made visually, not asserted in prose.

MECHANISM: A row of recognizable logos reads as concrete and checkable in under a second, versus a sentence like 'supports multiple providers' which the visitor has to take on faith.
PLACEMENT: Module cards for provider-swappable modules: ai-config (Bedrock / Azure / Ollama logos), billing (Paddle logo + whatever else), storage (GCS / R2 logos) — drop real vendor marks into the existing card instead of a text bullet naming them.
EFFORT: copy tweak · BRAND: Good fit — uses real, currently-integrated vendor names/logos only; must not add a logo for a provider not actually wired, per the no-invented-anything law.

## PATTERN: Pricing tiers are strictly cumulative and narrated that way in the copy itself ('Everything in Solo' / 'Everything in Startup') rather than a feature-matrix table, with exactly one tier singled out via a small 'Popular' badge and the differentiator kept to one obvious axis (seat count) instead of feature-gating.

MECHANISM: Cumulative narration lets a visitor evaluate only the delta on their tier instead of parsing a whole matrix, and one lone 'Popular' badge does the anchoring work of a matrix in a single word.
PLACEMENT: The six-bundle cards on /marketplace and homepage: confirm/adopt 'everything in [smaller bundle] plus…' phrasing where bundles nest (e.g. Everything bundle copy explicitly says 'everything in the other five'), and keep exactly one bundle (Compliance, the hero wedge) badge-marked rather than marking several.
EFFORT: copy tweak · BRAND: Strong fit — pure copy restructuring of real, already-locked bundle contents; zero new claims.

## PATTERN: Directly below the pricing tiers, two separate paid upsell blocks target the same buyer at a higher price point without touching the core price ladder: a flat-fee 1:1 architecture-consulting call ($149, 60 min) and a 'done-for-you' build partner (an outside agency that builds ON the product) with its own explainer tiles and a named partner link.

MECHANISM: Captures buyers who want more than self-serve software but aren't ready for a bespoke engagement, monetizing a second job-to-be-done (guidance, or someone else builds it) without complicating the primary SKU pricing.
PLACEMENT: A section under the six-bundle grid (or on the buyer dashboard post-purchase): a paid 'architecture/licensing consult call' SKU for buyers picking between bundles or wiring a compliance deployment, plus a pointer to a build-partner/agency if one exists or gets recruited — new revenue lever that doesn't touch the locked bundle price ladder.
EFFORT: one section · BRAND: Neutral-to-good — additive revenue surface, but only ship the consulting SKU if the operator will actually staff it; don't publish a partner-agency block without a real named partner (honest-artifact law).

## PATTERN: A closing 'Why choose a SaaS boilerplate' 6-tile reason recap (icon + headline + one-line rationale: Save months, Battle-tested architecture, AI-agent optimized, Ship before competitors, Full source access, Continuously maintained) placed AFTER the full feature tour and testimonial wall, immediately before the final pricing/CTA push.

MECHANISM: Re-frames everything the visitor just scrolled through as a short, scannable rational recap right before the ask — functions as a memory aid and last objection-handler, not new information.
PLACEMENT: Homepage, between the module/bundle grid and the final footer CTA: a 6-tile 'why a licensed module library beats building it yourself' recap (e.g. Own the source, WORM-audited by default, No re-derived compliance work, Composable not forked, Apache base + commercial modules, License-gated updates) as the last beat before checkout.
EFFORT: one section · BRAND: Strong fit as long as each tile states a real, already-true property (source ownership, real module list) rather than a projected benefit — keep it factual, not aspirational.

NOTES: Nav is thin and CTA-forward: Pricing / Changelog / Showcase / Blog / "SaaS ideas" / Docs + a "See Demo" outbound-link button (not just Sign-in) + a light/dark toggle inline in the nav bar + a floating always-on "FAQ" pill anchored bottom-right (persists on scroll, not buried in footer). "SaaS ideas" as its own top-nav content hub (distinct from Blog) is a lead-gen surface caisson doesn't have an analog for. Pricing lives at /pricing but is identical content to the homepage's bottom pricing section (framework picker + 3 tiers) — the standalone page 500'd on crawl (likely client-only render keyed off a query/localStorage framework param), so treat their separate /pricing route as fragile, not a pattern to copy. Whole page is extremely testimonial-heavy (40+ quotes, twice) — not adaptable given caisson's honest-artifact copy law (no invented/uncredited testimonials), but the _mechanism_ (real outbound links to live things built on the product) is: reframe as caisson linking to its own real deployed surfaces. Overall the page's single organizing idea is "prove it by showing the actual repo/product running," not by claiming benefits — that ethos matches caisson's copy law well even though the specific device (customer testimonial wall) doesn't transfer.

===== LEG: saaspegasus =====

## PATTERN: "How it works" 3-step strip directly under the hero: Configure (online codebase creator picks settings/features/backing tech) → Install (download + one command) → Customize (docs + Slack community). Plain numbered text blocks, no illustration needed.

MECHANISM: Answers 'what do I actually get and how fast' before the visitor has scrolled past the fold — turns an abstract 'boilerplate' claim into a concrete 3-verb process the buyer can picture themselves doing, which lowers perceived setup risk for a dev-tool purchase.
PLACEMENT: Homepage, inserted between the hero and the six-bundle grid: Configure (create-caisson generator picks modules/bundle/stack) → Install (bunx create-caisson, one command) → Customize (Fumadocs + module depth pages). Sets the mental model 'this is a generator, not a static template' before the bundle grid even loads.
EFFORT: one section · BRAND: Strong fit — caisson already has create-caisson as the literal mechanism; this just surfaces it as a named 3-step device instead of leaving it implicit in the generator flow.

## PATTERN: Trust triad below the feature grid — three cards titled Community / Documentation / Updates, each with one sentence + a link to a REAL artifact (Slack via Trustpilot reviews, live docs site, and a release-history page: "Regular Continuous Releases... updated monthly... delivered as pull requests").

MECHANISM: Reframes 'we maintain this' from a footer afterthought into a homepage-level proof-of-longevity claim, and grounds it immediately with a clickable link to the actual release notes rather than asking the visitor to trust the adjective.
PLACEMENT: Homepage, same slot (after the module/bundle grid, before pricing): Community (Linear-triaged support / Discord if one exists) / Documentation (Fumadocs docs) / Updates (link straight to the existing /updates surface with real cadence language, not "regularly maintained").
EFFORT: one section · BRAND: Directly reinforces the brand — /updates already exists and is real; this pattern just gives it a homepage-level promotional slot instead of leaving it to be discovered via nav.

## PATTERN: Pricing cards use a project-scope ladder, not feature-gating: Open Source (free, 1 basic project) → Professional ($449, 1 project) → Unlimited (struck-through $999 → $499, unlimited projects + lifetime community + priority support). The scarce resource being sold in the top tier is SCOPE (how many projects/sites you may build), not extra features.

MECHANISM: Makes the top tier's value legible in one word ("Unlimited") instead of a longer feature list, and the struck-through anchor price plus visible savings math does the tier-anchoring work that a feature-comparison table can't do at a glance.
PLACEMENT: The existing Everything bundle ($2,059) already plays the 'Unlimited' role versus per-module purchase; adapt the surface pattern — show per-module total struck through against the bundle price on the bundle card itself (not just in a separate comparison table), and reserve any future site-license/multi-project scope claim for a genuinely new tier rather than restating existing bundle math.
EFFORT: copy tweak · BRAND: Needs care — the strikethrough-anchor device is fine (it's real math, not an invented stat), but caisson's copy law bars 'sale' framing implying an artificial discount; frame any shown savings as 'buying à la carte costs $X vs the bundle's $Y', which is already true and provable.

## PATTERN: FAQ answers the upgrade path with a literal worked formula: "upgrading a license... for the difference in price... plus $49. So, upgrading Professional to Unlimited is $999 - $449 + $49 = $299."

MECHANISM: Removes the single biggest hesitation for a one-time-purchase dev tool — 'what if I outgrow this tier' — by showing the exact arithmetic instead of a vague 'contact us for upgrade pricing', which reads as more honest and cheaper to reason about.
PLACEMENT: FAQ on /marketplace or checkout: spell out the actual credit math for module→bundle upgrades and Developer-subscription tier changes (caisson already has an entitlement/credit system that computes this — just surface the formula in prose, not just at checkout time).
EFFORT: copy tweak · BRAND: Strong fit — matches the honest-artifact law exactly: a real formula against real prices, no vague 'contact sales'.

## PATTERN: Testimonials are quote + first/last name + role + the company name hyperlinked straight to the real, live customer product (PhotoRoom, Ritza, pyimagesearch, etc.) — no logo wall, no headshots, just clickable proof.

MECHANISM: Gives the skeptical-developer reader a one-click way to verify the testimonial is real by landing on an actual shipped product, which is stronger proof than a logo (easily faked) and cheaper to produce than a video testimonial.
PLACEMENT: Wherever caisson eventually adds testimonials (currently none per the copy law against invented ones) — if/when real buyers consent, use this exact device: quote + name + role + link straight to their live deployed product, never a logo grid.
EFFORT: copy tweak · BRAND: Exact match for the 'honest artifacts only, no invented logos/testimonials' law — this is the compliant way to eventually add social proof once real customers exist and consent.

## PATTERN: Plain social-proof line directly under the hero CTA: "Join 1886 developers and businesses using Pegasus today" — an exact, oddly-specific integer, not a rounded vanity number.

MECHANISM: An exact non-round number (1886, not "1,900+") reads as a real counter pulled from a database rather than marketing copy, which builds more credibility per word than a rounded claim would.
PLACEMENT: Only if/when caisson has a real countable metric to show honestly (e.g. registry installs, GitHub stars, or licensed seats) — surface it as an exact integer under the hero CTA, never rounded or estimated.
EFFORT: copy tweak · BRAND: Directly on-brand for the no-invented-numbers law, but gated on caisson actually having a real count worth surfacing yet — do not add this until the number exists and is accurate.

## PATTERN: 7-day no-questions-asked refund policy stated plainly inside the FAQ ("you can email us within 7 days for a full refund — no questions asked"), paired with a named, personal-email FAQ closer ("Email me at cory@saaspegasus.com").

MECHANISM: For a one-time, non-trivial-priced dev-tool purchase, an explicit risk-reversal policy plus a named accountable human (not "our support team") reduces purchase anxiety more than a generic satisfaction-guarantee badge would.
PLACEMENT: Checkout/FAQ page: state caisson's actual refund policy in plain prose with a real timeframe, and sign FAQ answers with a real name/email rather than a faceless 'the Caisson team' — matches the operator-run, single-founder feel of the brand.
EFFORT: copy tweak · BRAND: Strong fit for the honest, technical, no-invented-anything brand — a named human owning the FAQ is more credible than corporate voice, provided it's true to how caisson is actually run.

## PATTERN: Full feature-comparison table (24+ rows × 3 tiers) is present but demoted below the pricing cards behind a "Compare all features" link/toggle, rather than being the primary pricing UI.

MECHANISM: Lets the pricing cards do the fast decision (3 options, one sentence each) while still giving power-users/skeptics the exhaustive row-by-row proof they want, without forcing every visitor to scroll a 24-row table to reach the buy button.
PLACEMENT: /marketplace: keep the six-bundle grid as the primary decision UI, and move any full 22-module × 6-bundle matrix behind a 'compare all modules' expand/link rather than inlining it on the main grid page — avoids the grid page becoming a dense spreadsheet.
EFFORT: one component · BRAND: Good structural fit — caisson's module count (22 across 6 bundles) is exactly the kind of surface that needs a collapsed detail view to keep the primary page scannable.

NOTES: Single dense one-pager, no separate pricing route content beyond what's embedded on `/pricing/` (same body as homepage plus the pricing cards + comparison table + FAQ). IA is flat: hero → social proof line → "how it works" 3-step → feature grid (24 tiles) → trust triad (Community/Docs/Updates) → pricing cards → full feature-comparison table (collapsed) → testimonials wall → FAQ → footer. No nav mega-menu, no bundle/module marketplace — Pegasus sells ONE configurable codebase at 3 license tiers (Open Source/Professional/Unlimited), not a multi-bundle catalog like caisson, so most patterns transplant as devices/sections rather than IA structure. Every proof point is either a real, clickable customer link or a plain-stated number ("1886 developers") — no logo wall, no fabricated stats — a good structural match for caisson's honest-artifact copy law. The "team licensing" angle is really a project-scope license ladder (1 project vs unlimited projects) plus an in-product per-seat billing FEATURE, not a purchase-side seat count — worth noting so it isn't over-mapped to caisson's per-module/bundle structure.

===== LEG: clerk =====

## PATTERN: Hero replaces a screenshot/CTA with a tabbed 'Agent / CLI / Skills' widget whose default tab shows one copyable command: `Add Clerk auth to my app: clerk.com/SKILL.md`, with a secondary link to the human Quickstart guide below it.

MECHANISM: Converts the hero's primary action into a literal first step for an AI-coding-agent user (paste this into your agent) instead of a passive screenshot — collapses 'read about the product' and 'start integrating' into one artifact, and signals the vendor is built for the agent-driven dev workflow that's now a major buyer segment.
PLACEMENT: Homepage hero, as a secondary widget beside/below the headline: a copyable line pointing at caisson's real llms.txt/SKILL.md (gw-aeo-strategist already owns this file) — e.g. `Add Caisson compliance module to my app: caisson.sh/SKILL.md`. Only ship if the target file is real and current; the copy law bans anything that reads as a claim without an artifact behind it.
EFFORT: one component · BRAND: Strong fit if backed by a real file — reinforces the honest-artifact, technical-buyer posture; would fight the brand if the SKILL.md doesn't actually work yet.

## PATTERN: The 'Clerk Components' section doesn't screenshot the product — it embeds the actual live SignUp/SignIn/UserButton/OrganizationSwitcher/PricingTable/Checkout widgets inline, grouped into three tabs (User Authentication / B2B Authentication / Billing), each carrying real product chrome like a 'Secured by Clerk' badge and working dropdowns.

MECHANISM: Proves 'drop-in' by letting the visitor interact with the literal shipped output, not a mockup — zero gap between marketing claim and product reality, which is the strongest form of proof a dev-tool can offer.
PLACEMENT: Module depth pages or a homepage 'see it work' strip rendering real `@caisson/ui` components already built for the platform — e.g. a live WORM-locked audit-log row, a credit-ledger widget, a compliance report table — clearly labeled as the actual shipped component, not a mockup.
EFFORT: one section · BRAND: Excellent — this is the safest possible proof device under the honest-artifacts law since it IS the real code, not a claim about it.

## PATTERN: Feature cards for abstract claims (fraud prevention, session management) are paired with a concrete mock artifact instead of a bullet list — e.g. the Fraud & Abuse Prevention card shows a live-looking blocked-signups table with timestamps and emails; the Session Management card shows an actual device/browser/location row with a 'Sign out of device' button.

MECHANISM: Turns an abstract security claim into something that looks operational and inspectable, closing the credibility gap that plain prose claims leave open.
PLACEMENT: Compliance bundle depth page: replace static bullets ('WORM-locked audit trail', 'OSCAL control mapping') with a labeled sample-output table showing the real schema/field names from the shipped audit-worm package — explicitly marked 'sample output' so it stays inside the no-invented-numbers copy law.
EFFORT: one component · BRAND: Needs care — must use real schema/sample data, never invented counts or dates, but the device itself (concrete artifact over abstract bullet) is directly compatible with caisson's honest-artifact rule.

## PATTERN: Pricing page runs cards → a separate 'Add-ons: More than authentication' section selling optional capabilities (B2B Auth, Administration, Billing) as their own mini-products with free/enhanced tiers and inline per-unit volume-discount tables → one exhaustive full feature-comparison table → an FAQ that names competitors directly ('Is Clerk cheaper than Auth0?') and explicitly tells some visitors NOT to buy ('if you're building a free, ad-supported... consumer app... alternatives like Supabase Auth... may be cheaper').

MECHANISM: Radical transparency removes the #1 dev-tool purchase objection (fear of hidden usage fees), and a self-undermining FAQ that argues against the product in some cases reads as far more trustworthy than pure hype — it converts skeptical technical buyers precisely because it isn't only trying to sell them.
PLACEMENT: /pricing or the bundle checkout page: add an FAQ block doing real math ('is the Compliance bundle cheaper than buying WORM storage + field-crypto + OSCAL separately, or than building it in-house') and an explicit 'don't buy the bundle if you only need one module — buy that module' line.
EFFORT: one section (copy-only) · BRAND: Very strong — this is caisson's honest-artifact law taken to its logical, converting extreme.

## PATTERN: 'Build with SDKs for modern frameworks' and 'Integrations' render as a horizontal row of clickable name-pills/logos (Next.js, React, Astro, TanStack / Supabase, Convex, Vercel), each linking straight to that specific quickstart or integration doc rather than a generic docs homepage.

MECHANISM: Turns the marketing page into a docs router — a visiting developer self-selects their exact stack and lands one click from working code, collapsing 'marketing site' and 'docs site' into a single page and shortening time-to-first-line-of-code.
PLACEMENT: Under each bundle on the homepage grid or on the module depth pages: a 'works with' pill row for the real runtime targets caisson already supports (Next.js / Bun / Postgres / S3 / GCS / Bedrock / Azure / Ollama per the shipped edition depth), each pill linking to the matching docs page.
EFFORT: one component · BRAND: Strong, purely factual — reuses docs targets that already exist, no new claims invented.

## PATTERN: Optional capabilities (B2B Authentication, Administration, Billing) are sold as their own named product tier ('Add-ons') visually equal in weight to the core Hobby/Pro/Business plans, each with its own included-free tier and paid overage — not buried as a footnote under the main plan cards.

MECHANISM: Reframes optional modules as first-class purchasable products rather than upsell fine print, which both clarifies what's actually being sold and raises average deal size by giving each add-on its own pitch.
PLACEMENT: Homepage/marketplace: give the 22 à-la-carte modules the same first-class 'Add-ons' card treatment alongside the six bundles, instead of only a flat uniform grid — mirrors caisson's actual commercial shape (bundles + standalone modules) more honestly than a single grid does.
EFFORT: one section · BRAND: Strong — matches the existing bundle-plus-à-la-carte-module commercial model exactly.

## PATTERN: A thin, low-commitment trust strip ('Trusted by fast-growing companies around the world') appears twice: once right under the hero fold before any feature content, and again immediately before the final bottom-of-page CTA — bookending the whole page rather than appearing once.

MECHANISM: Repeats reassurance at both the entry point (before the visitor has invested any reading) and the exit point (right before the conversion ask), rather than spending trust-signal real estate only once.
PLACEMENT: Caisson has no customer logos to show yet, so adapt rather than copy: bookend the homepage with a factual capability/proof strip instead of logos — e.g. 'Apache-2.0 base substrate · 22 audited modules · OSCAL-mapped compliance runtime' — once at the top, once right above the final CTA.
EFFORT: copy tweak · BRAND: Good once reworded away from social proof (which caisson doesn't have) toward factual, artifact-backed claims (which it does).

## PATTERN: Testimonials run two-tier: named CEO quotes from recognizable companies (Vercel's Guillermo Rauch, Stripe's Patrick Collison, Supabase's Paul Copplestone) for authority, followed by ~11 embedded real X/Twitter posts from ordinary developers (handle, avatar, link-out to the live tweet) praising specific technical details like CLI quality or docs quality.

MECHANISM: Executive quotes buy authority; unpolished, linkable dev tweets buy authenticity — nobody fakes a typo-laden hot take, and the fact the link is clickable and verifiable is itself part of the credibility device.
PLACEMENT: Not adoptable today — caisson's copy law bans invented testimonials and there's no real customer base yet to draw from. Flag as a forward pattern: once real unsolicited mentions exist (GitHub discussions, Linear community threads, a dev's public post), adopt the same 'embedded card + link to the real source' treatment rather than a pull-quote with no receipt.
EFFORT: program · BRAND: Perfect fit in principle (real, linkable, verifiable) but currently blocked on not having real usage to draw proof from — don't fake it to fill the section early.

NOTES: Nav is a flat single row: Products▾ Docs▾ Changelog▾ Company▾ | Pricing standalone | Sign in | Start building (solid CTA button). Changelog lives in primary nav, not buried — same slot caisson's /updates already occupies. Notably homepage renders in a clean light theme (white/off-white, black type) while /pricing renders fully dark (near-black bg, gradient-bordered cards, purple gradient CTA) — a deliberate light-marketing / dark-product-page split; caisson is dark-brand everywhere already so no fork needed, just confirms dark-with-gradient-cards is a proven register for a pricing page specifically.

Pricing page IA is a clean progressive-disclosure funnel worth copying wholesale for the six-bundle/22-module catalog: (1) tier cards for the 80%-case fast decision, (2) a distinct "Add-ons" section selling optional capabilities as their own mini-products, (3) one exhaustive "Full price breakdown" comparison table below the fold for people doing a real bake-off, further split into per-feature-area subtables (B2B Authentication features / Administration feature) rather than one giant undifferentiated grid, (4) a Q&A block that closes objections including competitor-name comparisons and actively talks buyers OUT of the product when it's the wrong fit. That last move is the standout: it reads as more trustworthy specifically because it argues against itself in places.

===== LEG: resend =====

## PATTERN: Hero is pure restraint: full-black background, one huge single-idea headline ('Email for developers') with a white-to-gray vertical gradient fade on the text, a one-line gray subhead, and a two-tier CTA — one solid white button ('Get started') plus a plain unstyled text link ('Documentation') beside it, no secondary ghost-button. A small pill-shaped announcement badge ('Announcing Resend Forward →') sits above the headline. No illustration, mockup, or graphic anywhere in the hero.

MECHANISM: Zero visual noise competing with the one claim; the gradient fade and generous whitespace do the 'craft' work that an illustration would otherwise carry, so the headline reads as confident rather than empty. The pill above the headline gives repeat visitors a reason to look twice without stealing hero real estate.
PLACEMENT: Homepage hero: tighten to one giant headline + one gray subhead + solid-button-plus-text-link CTA pair (drop any bordered secondary button); add a small pill above the headline linking to the latest /updates entry (e.g. 'Six bundles live →' or the newest bundle/module ship).
EFFORT: one component · BRAND: reinforces the dark technical brand directly — no invented numbers or logos required, it's a pure typography/layout device.

## PATTERN: 'Integrate this morning' section: immediately below the hero, a real tabbed code snippet (Node.js/Serverless/Python/Elixir) shows the actual SDK call a developer would type and run — this IS the product screenshot, not a picture of a UI.

MECHANISM: For a developer audience, real runnable code is more convincing proof than a dashboard screenshot — it's falsifiable (a dev can paste and run it) and skips the trust gap of a designed mockup.
PLACEMENT: Homepage, directly beneath the hero (or as the first block on each module depth page): show real `npx create-caisson` output or a real module import/call (e.g. a compliance module's WORM-anchor call) with language/package-manager tabs, pulled from the actual generator/docs — never a fabricated example.
EFFORT: one section · BRAND: the single strongest match to the honest-artifact copy law — real code beats any invented metric or logo.

## PATTERN: Every feature block ends with a 'Learn more →' link straight to the relevant docs page — proof claims are never left standalone, they're always falsifiable one click away.

MECHANISM: Converts a marketing assertion into an inspectable fact; technical buyers self-verify instead of having to trust copy.
PLACEMENT: Bundle/module feature bullets on the homepage six-bundle grid and each module depth page: attach a 'Learn more' link to the matching Fumadocs page on every bullet that currently has none.
EFFORT: copy tweak · BRAND: directly enforces the existing honest-artifacts law — nothing invented, just wiring.

## PATTERN: Feature descriptions are named mechanisms, not adjective stacks — headings like 'Proactive blocklist tracking', 'Build confidence with BIMI', 'Prevent spoofing with DMARC' each followed by one concrete sentence, no filler adverbs.

MECHANISM: Naming the actual mechanism (a protocol, a specific safeguard) reads as domain-expert-written, which builds more credibility with a technical buyer than generic benefit language.
PLACEMENT: Bundle summaries and module depth-page feature lists: replace any generic bullet ('robust security', 'enterprise-grade') with the actual named primitive caisson ships (WORM Object-Lock retention, OSCAL conformance, Ed25519 license signing, RLS tenancy isolation).
EFFORT: copy tweak · BRAND: strong — matches the technical, no-fluff voice caisson already aims for.

## PATTERN: Closing section is a one-line bookend that echoes the hero's exact register and length ('Email reimagined. Available today.') plus a single CTA — no repeated pricing table, no feature recap.

MECHANISM: A closing line that rhymes with the opener gives the page a sense of narrative closure without re-litigating content already shown; it signals confidence ('we said it once, that's enough').
PLACEMENT: Homepage footer-CTA band: replace any generic 'Get started today' block with a short line that echoes caisson's hero copy (e.g. hero: 'Production infrastructure, owned outright' → closer: 'Own it outright. Ship today.') plus one CTA.
EFFORT: copy tweak · BRAND: strong, purely a copy-craft device.

## PATTERN: Pricing page leads with a single interactive volume slider (3K…3M+ emails) plus a Transactional/Marketing toggle that recalculates all tier prices live, rather than four static cards.

MECHANISM: Turns 'which tier do I need' from a manual lookup into a direct-manipulation answer — the visitor drags once and sees their real cost, reducing the comparison workload across many tiers.
PLACEMENT: Adapt the mechanic, not the literal slider: on /marketplace or the homepage bundle grid, add a lightweight 'what do you need' toggle/selector (by use case: compliance / AI-production / local-first / agentic-dev / provenance) that highlights the one recommended bundle and its price — same job (cut decision paralysis across a 6-way catalog) via a different control.
EFFORT: one component · BRAND: good fit for caisson's six-bundle catalog complexity; must stay label-honest (recommend based on stated use-case tags, never invented usage data).

## PATTERN: Below the pricing cards, a full feature-comparison matrix is split into labeled category tables (Sending & receiving / Deliverability & reliability / Security & privacy / Customer support / AI credits) rather than one giant flat grid.

MECHANISM: Chunking a wide comparison by category keeps each table scannable and mirrors how a technical buyer actually evaluates (security checklist separate from support checklist) — it doubles as an implicit spec sheet for procurement diligence.
PLACEMENT: A bundle-comparison section on /marketplace (or a dedicated compare view): group the 22 modules by category (Compliance primitives / AI primitives / Local-first / Dev-tooling / Provenance) in stacked tables under the six-bundle cards instead of one dense matrix.
EFFORT: one section · BRAND: excellent — directly serves caisson's actual hard problem (explaining six overlapping bundles across 22 modules) to a compliance/tech-lead buyer.

## PATTERN: Pay-as-you-go and add-on pricing (overage, dedicated IPs) each get a short explanatory paragraph next to the number — not just a price, but the mechanism and eligibility constraint spelled out in prose ('Available to customers exceeding 3,000 emails/day on Scale').

MECHANISM: Makes non-obvious commercial mechanics legible before checkout, preventing surprise-fee frustration and building pricing trust.
PLACEMENT: Checkout/pricing page: add short prose blurbs next to caisson's own non-obvious mechanics — the 40%-renewal SKU, per-entitlement updates-window, and credit FIFO expiry — each explained in one sentence next to its price, the way Resend explains overage and dedicated IPs.
EFFORT: copy tweak · BRAND: strong — caisson has genuinely complex commercial mechanics (renewals, credits, updates windows) that benefit from this exact treatment.

## PATTERN: Top nav collapses everything into a handful of dropdown groups (Features/Company/Resources/Help/Docs/AI) plus three bare top-level items (Pricing, Log in, Get started as a solid button) — no flat wall of links.

MECHANISM: Keeps the nav visually quiet (matches the black-background restraint) while still surfacing a large surface area (docs, blog, changelog, integrations) one click down instead of cluttering the bar.
PLACEMENT: Confirms caisson's in-progress nav rework direction: collapse secondary surfaces (docs, /updates, company/about) into 2-3 dropdown groups, keep only Marketplace/Pricing, Docs, Log in, and a solid 'Get started' button bare at top level.
EFFORT: one component · BRAND: good direct match — same IA problem (a dev tool with many surfaces: docs, marketplace, dashboard, admin).

## PATTERN: Closing testimonial wall: ~12 short, specific, varied quotes (deliverability improvement, migration ease, support quality, DX) each with real name+title+company, no photos, packed dense right before the final CTA — plus one larger named pull-quote (a recognizable dev-tool CEO) placed higher up as a credibility spike.

MECHANISM: Volume + specificity of many small quotes reads as pulled-from-reality rather than written-for-marketing; the single high-authority quote up top does the 'is this legit' job before the wall does the 'lots of people like it' job.
PLACEMENT: Bank for post-launch only: once caisson has real named customers, add a dense quote-wall before the closing CTA and one larger pull-quote after the feature section. Do NOT build this now — caisson's copy law explicitly forbids invented testimonials and there are no customers yet.
EFFORT: program · BRAND: conditional — only usable once real customer quotes exist; fabricating any of this violates the honest-artifacts law.

NOTES: Resend's homepage is short (~9 sections) and pricing is one page with a persistent interactive control — there's no separate deep marketing IA to study, which itself is the lesson: a dev-tool site with a technical audience can ship far fewer pages than caisson currently has (homepage grid, /marketplace, module depth pages, /updates, docs, checkout, dashboard) IF each page pulls its weight with real artifacts. Nav is 6 dropdown groups + Pricing/Log in/Get started — flat, no mega-menu clutter, matching caisson's stated nav-rework direction. Full-page screenshot capture only returned a 600px viewport (crawl4ai tool limitation, not a page issue) so visual analysis below the fold leaned on the markdown crawl; the hero crop confirms pure-black background, gradient-fade headline text, and a two-tier CTA (solid button + plain text link, no secondary ghost-button). One hard constraint for adoption: Resend leans heavily on named customer testimonials (12+ quotes, one CEO pull-quote) which caisson's copy law (no invented testimonials) currently blocks entirely — that mechanic is banked for post-launch, not adoptable today.

===== LEG: workos =====

## PATTERN: Hero visual is a vertical stack of feature cards, each with a literal on/off toggle switch (Bot Blocking, Agent Auth, Audit Logs, Enterprise SSO switched ON with a green Enable badge, SCIM, RBAC, Connectors), glowing/receding off the right edge of the hero next to Your app, Enterprise Ready.

MECHANISM: Shows the product's mental model instead of describing it - a visitor grasps these are independently addressable capabilities I flip on in one glance, no copy required, and the single toggled-ON card demonstrates the exact moment of purchase/activation.
PLACEMENT: Homepage hero, as a companion visual to the six-bundle grid, or shrunk onto each bundle/module depth page: a mini toggle-stack of the real modules in that bundle (WORM audit storage, field-crypto, OSCAL, MCP rate-limit, etc.) with included ones shown ON/green and excluded ones grayed OFF - makes the a-la-carte model visually self-evident instead of requiring the visitor to read the module list.
EFFORT: one component · BRAND: Strong fit - dark/technical, and every label is a real caisson module name, no invented content required.

## PATTERN: Live per-product pricing calculator: a slider/stepper sets volume (e.g. connections), a tiered per-unit price table applies automatic volume discounts (1-15 at $125/ea up to 101-200 at $50/ea, 60% off), and a running dollar total updates live under each product section.

MECHANISM: Turns is this expensive into here is my exact number - self-serve legibility beats a static tier table, and visible volume discounts reward growth transparently instead of requiring a sales call to learn the real price.
PLACEMENT: Adapt the mechanism, not the metering: build a bundle-builder calculator on /marketplace - visitor checks off individual modules a-la-carte, sees a running total from real committed prices, and watches it exceed the corresponding bundle price live, proving the bundle discount mathematically instead of asserting save X% in prose.
EFFORT: one section · BRAND: Excellent - built entirely from real, committed prices already locked (ADR-0082/0137), no invented numbers, and it's an honest artifact by construction since the visitor's own selection drives the math.

## PATTERN: Batteries included - a dense 10-tile grid of small free features (Social Auth, Magic Auth, MFA, Passkey, RBAC, CLI Auth, etc.) labeled Available for all accounts, placed directly beneath the paid calculators on the pricing page.

MECHANISM: Placed at the exact moment price-anxiety peaks (right after showing paid line items), it proves the core product is generous and complete, not nickel-and-dimed - reframing another vendor to integrate into most of what I need is already free.
PLACEMENT: Pricing page: a the Apache-2.0 base includes grid directly under/beside the six bundle-price cards, listing the real free-forever base packages (kernel, auth, tenancy-rls, ui, billing, credits, jobs, email, ai-config, mcp-server) as ten dense tiles - reinforces the open-core story (ADR-0094) exactly where a buyer is comparing bundle prices.
EFFORT: one section · BRAND: Excellent - literally true from the existing package list, directly supports a locked ADR, zero invention.

## PATTERN: A real, runnable multi-language code-tab block (workos.sso.getProfileAndToken(...) in Node/Ruby/Python/Go/PHP/Java/C#/cURL, plus the JSON response) embedded mid-scroll on the marketing homepage itself, not confined to docs.

MECHANISM: Converts developer-visitors by proving the API is small, typed, and real right where trust is being built - answers will this fit my stack without forcing a docs click, at the exact point skepticism would otherwise stall the scroll.
PLACEMENT: Homepage or each of the 22 module depth pages: one real snippet pulled straight from the actual package (TS-only, so single-block not multi-tab) showing the smallest real usage - e.g. field-crypto's encrypt call or the WORM writer - reusing the existing docs codeblock renderer.
EFFORT: one component · BRAND: Strong, provided every snippet is copy-pasted from real source (never illustrative pseudocode) - matches the honest-artifact copy law exactly.

## PATTERN: Pricing intro frames two purchase MODES (Pay as you go vs Annual Credits) with an identical feature set - the difference is payment cadence plus support SLA, not gated capabilities - instead of the usual 3-4 confusing feature-ladder tiers.

MECHANISM: Avoids the classic SaaS anti-pattern of hunting across tiers for which one has the feature you need; the buyer picks a payment mode, not a feature tier, so the pricing page never has to explain what's different about Pro vs Business.
PLACEMENT: Frame the Developer subscription plus 40%-renewal SKUs as a payment-mode choice orthogonal to bundle selection (same six bundles, choose one-time or subscription+renewal) rather than layering it as a second feature ladder on top of the bundles - keeps bundle-choice as the only feature axis.
EFFORT: copy tweak · BRAND: Good - clarifies caisson's two independent axes (which bundle vs which payment mode) that could otherwise blur together.

## PATTERN: Under each metered price line, a small comparator note: vs $100 to build it yourself.

MECHANISM: Reframes the purchase decision from sticker-shock to buy-vs-build math - developer buyers already price their own engineering hours, so anchoring against that number (rather than a competitor's price) makes the price feel cheap by the buyer's own logic.
PLACEMENT: Module/bundle price lines: a grounded, non-invented version - replaces ~N files / M LOC you'd otherwise write sourced from the real package's actual line count or file count, never a fabricated dollar figure (caisson's copy law bans invented metrics, so skip WorkOS's specific $100 framing and keep only the engineering-effort framing that's independently verifiable from the repo).
EFFORT: copy tweak · BRAND: Needs adaptation - the dollar-comparator itself would violate the no-invented-numbers rule; the LOC/file-count framing is the honest substitute.

## PATTERN: Dozens of short, attributed customer pull-quotes (name, title, company) in a dense repeating wall, each deep-linking to a full /customers/<slug> case-study page.

MECHANISM: Quote density signals category leadership by sheer volume, and the deep-link to a real case study lets a skeptical buyer verify the quote is attached to a checkable story rather than a drive-by testimonial - the verifiability is what makes high density read as credible rather than spammy.
PLACEMENT: Not usable today - caisson's copy law explicitly bans invented testimonials/logos and there are no real customers yet. Flag as the template to build the moment there are 3-5 real buyers willing to be named: a /customers wall plus deep-linked case studies, structured exactly like this, never faked before then.
EFFORT: program · BRAND: Pattern-only reuse - content must wait for real customers; faking any part of it would break the honest-artifact law outright.

## PATTERN: A single reusable why this category matters narrative section (Expand your market plus a linked thesis video) appears verbatim on both the homepage and the pricing page, rather than re-arguing the case on every page.

MECHANISM: Gives the why do I need this at all objection one authoritative, deep answer instead of a shallow restatement wherever it comes up - visitors who need convincing get routed to one canonical artifact, keeping every other page's copy short.
PLACEMENT: One why compliance-grade infra is the AI-production wedge anchor section, written once, linked identically from the homepage hero and the Compliance-bundle depth page - replacing any duplicated re-explanation of the hero wedge argument across pages.
EFFORT: one section · BRAND: Good, as long as grounded in caisson's real architecture/positioning rather than invented industry stats.

NOTES: Nav: Products / Developers / Resources / Pricing / Sign in - a slim top bar (mega-menu dropdowns implied) that stays out of the way while the hero visual carries the whole pitch. Pricing page order is deliberate and reusable as a template: (1) two payment-mode cards (Pay-as-you-go vs Annual Credits, NOT feature tiers) then (2) per-product interactive cost calculators then (3) a dense free "batteries included" grid placed right after the paid calculators (anxiety-relief beat) then (4) a support-SLA comparison table (a third axis, orthogonal to price) then (5) FAQ then (6) a "why WorkOS" close reused verbatim from the homepage. The whole site's mental model is "enterprise-readiness is a checklist of togglable capabilities," which is unusually close to caisson's own "22 modules, six bundles" model - closer than any other site in this research set. Caveat for reuse: WorkOS prices are usage-metered (connections/MAUs), caisson is one-time-purchase-per-module - patterns about live calculators and toggle visuals transfer as mechanisms, not as literal metered-pricing UI.
