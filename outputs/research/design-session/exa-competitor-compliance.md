# Competitor Teardown — The Compliance Lane (Caisson brand/SEO/site session)

**Surface:** visual · brand · seo · copy
**Date:** 2026-06-27
**Researcher:** grounded-research (exa web + refero styles)
**Scope:** Vanta · Drata · Secureframe · Oneleet · Delve · Thoropass · compliance.tf · the dev-kit / starter-kit lane (Clynova, Already, AuditKit, TamperTrail, Boilerlykit, StarterPick aggregators)
**Anchor decisions (do not relitigate):** ADR-0040 (compliance-wedge hero, dev-kit not platform, SERP owned by finished platforms), ADR-0041 (name Caisson, lowercase monospace-adjacent wordmark, no mascot), ADR-0042 (cold-steel teal hue~205 + Hubot Sans + Martian Mono — **may be widened** this session), ADR-0045 (static Next 16 + Fumadocs + CF Pages), ADR-0048 (SKU structure, no hard prices, waitlist).

---

## 0. The one-paragraph finding

The compliance SERP is owned by **finished platforms** that all converge on the same play: the word **"platform"** + the verb **"automate compliance"** + **agentic-AI** framing + **demo-gated pricing with zero numbers** + **customer-count/logo proof**. ADR-0040's "picks-and-shovels gap" is real and confirmed: the head terms ("SOC 2 compliance," "HIPAA compliance") are lost to Vanta/Drata/Secureframe/Thoropass/Delve/Oneleet, but the **dev-kit long-tail** ("SOC 2 compliance starter kit," "HIPAA boilerplate Next.js," "self-hosted audit log," "multi-tenant RLS compliance template") is **fragmented and under-branded**. compliance.tf owns the _infrastructure/Terraform_ slice with a sharp picks-and-shovels play (and already ships branded "starter kits"); Clynova owns the _HIPAA-healthcare-AI boilerplate_ niche at a hard $999+ price; generic SaaS boilerplates (Already, Supastarter, Makerkit) bolt compliance on as a _feature_, not as the spine. **Nobody owns the full-stack, app-layer, composable "compliance dev-kit" (RLS + WORM + field-crypto + audit chain + evidence) as a branded library.** That is Caisson's lane. The brand and SEO job is to look and read like the **dev-tool register** (Warp / Supabase / Depot / compliance.tf — dark, terminal-native, code-as-proof), **not** like the **compliance-platform register** (Vanta lavender-serif, Delve playful-YC, Secureframe light-blue), while still showing the framework badges so the category reads instantly.

---

## 1. Per-competitor teardown

### 1.1 Vanta — the category king (finished platform)

- **URL:** https://www.vanta.com · **Title tag:** `SOC 2, HIPAA, ISO 27001, PCI, and GDPR Compliance` (pure head-keyword stack, no brand in title)
- **Hero H1 (on-page):** _"It's all here. Compliance, risk, and proof. All in the #1 Agentic Trust Platform."_
- **Lead:** "Agentic Trust Platform" — pivoted hard to AI agents ("The Vanta Agent: your 24/7 GRC engineering team").
- **Proof strategy:** scale + analyst + outcome tiles. "Trusted by 16,000+ customers"; stat tiles ("2,000 hrs saved annually," "20% faster deal cycles," "Automated 93% of questionnaires"); **Forrester Wave Leader Q2 2026**; named-title testimonials (CISO/CIO).
- **IA/nav:** Product (Compliance/Risk/TPRM/Audit/Trust Center/Questionnaire) · Frameworks (SOC2/ISO/HIPAA/GDPR/NIST AI/ISO 42001/HITRUST/FedRAMP) · By-size (Startups/Mid-market/Enterprise) · Resources.
- **Pricing display:** **No numbers.** 4 named tiers (Essentials / Plus / Professional / Enterprise) with feature lists; CTA "Get personalized pricing" / "Request a free demo." https://www.vanta.com/pricing
- **Visual register (refero-confirmed):** **LIGHT.** "Regal, trust-focused… expansive white space and soft lavender washes… large serif headlines… purple accents… rounded pill buttons… friendly." Airy, low density, premium-corporate. (refero style `79fffe1c-8b81-4ec9-917a-d34760e75850`)

### 1.2 Drata — the closest scale rival (finished platform, dark)

- **URL:** https://drata.com · **Title tag:** `The Agentic Trust Management Platform | Drata`
- **Hero H1:** _"Explore the World of Agentic Trust."_ CTA "Get Started."
- **Lead:** "Agentic Trust Management Platform" + AI agents.
- **Distinctive copy device:** an extended **space-mission metaphor** running the whole page — "Command the Mission," "INITIATE LAUNCH," "Open the Airlock," "Transmit Trust," "Scan the Horizon." Section verbs are all mission-control.
- **Proof:** "Trusted by 8,500+ Global Customers · 4.8/5.0 G2"; outcome stats ("75% reduced SOC 2 audit duration," "10x faster trust docs," "375+ hrs saved"); new "AI Agent Governance" product.
- **Pricing display:** **No numbers** (demo-gated). https://drata.com/pricing redirects to the same agentic narrative.
- **Visual register:** **DARK**, mission/space theme, Inter font (loaded from the markup), instrument-panel feel. Density medium.

### 1.3 Secureframe — automate-verb classic (finished platform, light)

- **URL:** https://secureframe.com · **Title tag:** `Secureframe: Build trust. Unlock growth.`
- **Hero H1:** _"Automate compliance. Improve security. Reduce risk."_ (the canonical platform triad)
- **Proof:** "6000+ customers… saved millions of hours"; case-study wall (Coda, Stream, PerkUp, Kinectify); **"30+ in-house compliance experts and former auditors."** A CMMC/Defense vertical ("Secureframe Defense" for CUI/defense contractors).
- **Pricing display:** **No numbers.** 3 packages (Fundamentals / Complete / Defense), "Get a quote." Detailed feature matrix. https://secureframe.com/pricing
- **Visual register:** **LIGHT**, blue/teal, conventional SaaS, expert-led trust signals.

### 1.4 Oneleet — the dev-leaning challenger (finished platform, dark, anti-theatre)

- **URL:** https://www.oneleet.com · **Title tag:** `Oneleet | Security-First Compliance (SOC 2, ISO 27001 & More)`
- **Hero H1:** _"Compliance done fast and secure. Get back to building."_ Sub: "Faster than legacy platforms, with real security baked in."
- **Distinctive anti-positioning:** **"without security theatre"** / "real security baked in" — explicitly attacks checkbox compliance. The same instinct as Caisson's "happy-path boilerplate" enemy, aimed one layer up.
- **Proof:** "$33M Series A · 4.9/5 · #1 in compliance"; a _very_ long founder-testimonial wall (LayerUp, AviaryAI, Sero, AccessOwl…) emphasizing "fastest out of drata, vanta"; "they manage all auditor interactions."
- **Pricing display:** **No numbers** — "Book a Demo to Get Custom Quote." https://www.oneleet.com/pricing
- **Visual register:** **DARK**, modern, developer-credible. Density medium.

### 1.5 Delve — the AI-native YC darling (finished platform, light, playful)

- **URL:** https://www.delve.co · **Title tag:** keyword-stuffed mega-title: `Delve | SOC 2 Compliance, HIPAA | Automated Compliance for AI, Startups | Get GDPR, ISO 27001, Cybersecurity Compliant & More | Delve Automated Compliance`
- **Hero H1:** _"Compliance busywork kills momentum."_ (pain-first, not product-first)
- **Distinctive copy device:** a **fake "Sam Altman" rejection email** ("your company is not SOC 2 or GDPR compliant… we will not be able to move forward") — fear-of-lost-deal as the hook. Playful animated to-do cards ("Install electronic door lock for SOC 2 audit").
- **Positioning line:** _"We're a compliance partner, not a platform."_ (note: they reject "platform" to mean _more_ service, not less).
- **Proof:** stat tiles ("43k hours eliminated," "$2.3B revenue unlocked," "8.7x faster"); YC + **$32M Series A at $300M (21-yo MIT dropouts, Insight Partners)**, 1,500+ customers, ~331k monthly visits, customers Lovable/Bland/Wispr. (TechCrunch 2025-07-22; PRNewswire; Insight Partners blog.)
- **Pricing display:** **No numbers** — book demo; add-on services listed as "FREE" (white-glove, Slack, expert, trust report, questionnaire autofill).
- **Visual register:** **LIGHT**, playful/animated, YC-startup energy. Lower density, conversational.

### 1.6 Thoropass — the auditor-as-product (finished platform, light, professional)

- **URL:** https://thoropass.com · **Title tag:** `Compliance with confidence - Thoropass`
- **Hero H1:** _"The End-to-End Cybersecurity Auditor."_ Sub: "In-house audit experts for every framework, powered by AI-driven evidence collection." CTA "Start Your Audit."
- **Distinctive position:** **they are the auditor** — collapses the platform + audit firm into one. Heavy named-human proof: bios of Big-4/Coalfire alumni (Leith Khanafseh ex-KPMG/EY/Coalfire; co-founders ex-Citigroup, HBS/Bain).
- **Proof:** "1,000+ organizations"; expert credibility over scale.
- **Pricing display:** **No numbers.**
- **Visual register:** **LIGHT/professional**, navy, auditor-trustworthy, conservative density.

### 1.7 compliance.tf — THE direct picks-and-shovels analogue (dev-kit, dark, code-forward)

- **URL:** https://compliance.tf · **Title tag:** `Compliance.tf - Terraform Compliance for Cloud-Native Enterprise`
- **Hero H1:** _"Terraform Modules That Prevent Infrastructure Audit Findings."_ Sub: "One-line drop-in from terraform-aws-modules. Compliance controls enforced at the module source — before `terraform apply`, not discovered missing after."
- **Lead:** a **code diff in the hero** (`- source = "registry.terraform.io/..."` → `+ source = "soc2.compliance.tf/..."`). Code IS the hero object.
- **Proof:** **maintainer credibility** ("By Anton Babenko · Maintainer of terraform-aws-modules · 2B+ provisions worldwide"); coverage tiles ("S3, VPC, EKS, RDS & 30 more · 35+ Frameworks · 300+ Controls"); **"SOC 2 Type II Certified · Available on AWS Marketplace"**; aspirational testimonials ("Companies want to pay for a compliance accelerator"; "We spent 6 months building custom wrappers… does what we built, maintained by someone else").
- **IA:** For-Engineering/Platform/SRE · For-CISOs/GRC · Docs/guides/**starter-kits** · Trust Center.
- **Ships BRANDED starter kits** (this is the key signal): `starter-kit-healthtech-hipaa` (HIPAA+SOC2), `starter-kit-b2b-saas-soc2`, `starter-kit-fintech-pcidss` — each a public GitHub repo + docs page mapping controls to clauses (e.g. HIPAA §164.312(b) → VPC flow logs). https://github.com/compliancetf/starter-kit-healthtech-hipaa
- **Pricing display:** **"Start Free Trial · No credit card or AWS account needed."** PLG, not demo-gated. (Pricing page is the same hero — soft on numbers but trial-first.)
- **Visual register:** **DARK, technical, code-block-forward.** This is the register Caisson should rhyme with.
- **Boundary note:** compliance.tf is the **infrastructure layer** (Terraform modules / cloud config). Caisson is the **application layer** (TS/Next.js packages — auth, RLS, field-crypto, audit-WORM, evidence). **Adjacent, not overlapping** — a partner-shaped gap, not a head-on collision. Caisson can even cite the same control clauses (§164.312, CC6.1) at the app layer that compliance.tf cites at the infra layer.

### 1.8 The dev-kit / starter-kit lane (the actual SERP Caisson competes in)

| Product                      | What it is                                                                                                                                                                                                                            | Pricing **display**                                                                                               | Register                         | URL                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| **Clynova** (ByteWorthy)     | HIPAA healthcare-AI boilerplate (Next.js 15 + Supabase, PHI envelope-crypto, append-only audit chain, BAA workflow, FHIR/HL7/X12, clinical agents). Commercial license.                                                               | **HARD prices:** Practice **$999 one-time**, higher RCM/scale tiers w/ "60-min compliance review." "Buy Clynova." | DARK dashboard mockup + terminal | https://byteworthy.io/blueprints/clynova · https://github.com/ByteWorthyLLC/clynova |
| **Already** (alreadykit.com) | Next.js 15 SaaS starter, 16 modules, RLS, append-only audit trail, anomaly detection, AES-256-GCM secrets, SCIM add-on, "SOC 2-aligned audit log retention guide."                                                                    | **HARD prices:** **$199 Solo / $399 Team / +$299 Enterprise** (SCIM).                                             | dev-tool                         | https://alreadykit.com                                                              |
| **AuditKit**                 | Open-source tamper-evident audit logging; SHA-256 hash chain + Merkle proofs, tenant-scoped, embeddable React viewer, multi-lang SDK, self-hostable. AGPLv3 + commercial. "5-minute setup vs 2-4 weeks."                              | OSS + commercial                                                                                                  | dev-tool                         | https://github.com/AuditKitDev/auditkit · https://auditkit.dev                      |
| **TamperTrail**              | Self-hosted tamper-proof audit log (FastAPI/Docker), SHA-256 chain, RLS, compliance whitepapers mapping SOC2/HIPAA/GDPR/ISO/PCI. Closed-source via containers.                                                                        | self-host                                                                                                         | dev-tool                         | https://github.com/sthakur369/TamperTrail                                           |
| **Boilerlykit / SaaSForge**  | Next.js multi-tenant RLS, audit rows, SAML/SCIM, "the boring enterprise features that close deals."                                                                                                                                   | template                                                                                                          | dev-tool                         | https://boilerlykit.com/saasforge-core                                              |
| **StarterPick** (aggregator) | SEO directory: _"HIPAA-Compliant SaaS Boilerplates 2026"_, _"Best Boilerplates for Healthcare Apps 2026."_ Ranks for the long-tail; honest framing: _"No boilerplate ships as HIPAA certified — HIPAA is a process, not a checkbox."_ | n/a                                                                                                               | content                          | https://starterpick.com/guides/hipaa-compliant-saas-boilerplates-2026               |

**The long-tail SERP is real and winnable:** developer HIPAA/SOC2 guides rank today (oktopeak, quantlabusa, afterbuildlabs, accountablehq, gautamkhorana) on exactly the queries Caisson's docs should own — "HIPAA audit logging architecture," "multi-tenant RLS deny-by-default," "S3 Object Lock 7-year retention," "field-level PHI encryption." These are info-intent pages with weak commercial competition — the unowned ground.

---

## 2. The lane's shared patterns (what "everybody does" → the convergence baseline)

1. **The word "platform"** (Vanta, Drata, Secureframe, Oneleet, Delve all say it; Delve even argues _about_ it).
2. **The verb "automate compliance"** + the triad "compliance / risk / trust."
3. **"Agentic" everywhere** (Vanta "Agentic Trust," Drata "Agentic Trust," Delve "agentic compliance experience").
4. **Demo-gated pricing, zero numbers** — every finished platform. The **dev-kits invert this** (hard prices or free trial).
5. **Proof = scale** (customer counts, logo walls, analyst awards) + **expert humans** (Secureframe/Thoropass/Oneleet).
6. **Framework-badge grid** (SOC2/ISO/HIPAA/PCI/GDPR) on every single homepage — the category-recognition tax.
7. **Pain-first hooks** about busywork/screenshots/lost deals (Delve, Vanta, Secureframe).
8. **"Trust Center / trust report"** as a product surface (Vanta, Drata, Delve, Oneleet).

---

## 3. Forks — open design decisions (surface · question · options · recommendation · confidence · evidence)

> A fork = an open decision with 2–4 options. Brand-expansion, name, and hero-adjacent forks are flagged **[INDIVIDUAL]** — present these to the operator one at a time, not batched.

### COPY

**C1 — Hero H1 register: platform-verb vs dev-kit-noun.** [INDIVIDUAL — hero]

- _Options:_ (a) Platform-verb "Automate compliance…" — mirrors the lane, instant category, but reads as a Vanta clone and a category lie (Caisson isn't a platform). (b) **Dev-kit-noun "The compliance codebase / load-bearing infrastructure for regulated SaaS"** — true to ADR-0040 umbrella, differentiates, but lower head-keyword match. (c) Outcome-noun "Ship audit-ready from commit one." (d) Code-promise "RLS, WORM, field-crypto, audit-chain — already written."
- _Recommendation:_ **(b)+(d) blended** — a noun-led promise ("the load-bearing parts cheap boilerplate skips") with the four primitives named as proof. Never "automate compliance."
- _Confidence:_ high · _Evidence:_ ADR-0040 ("dev-kit not platform; generic base = one-line footnote"); compliance.tf hero is noun+code, not verb; Secureframe owns "Automate compliance" verbatim (https://secureframe.com).

**C2 — Banish "platform" from the brand vocabulary.**

- _Options:_ (a) Use "platform" for category familiarity. (b) **Use "library / codebase / substrate / kit"** and never "platform." (c) Coin a term ("the compliance substrate").
- _Recommendation:_ **(b)** — "platform" is the lane's owned word and a category-collision; "library/substrate" signals picks-and-shovels.
- _Confidence:_ high · _Evidence:_ 5/6 platforms say "platform" (Vanta/Drata/Secureframe/Oneleet/Delve); Delve fights over it ("a partner, not a platform").

**C3 — The enemy: keep "happy-path boilerplate" pure, or borrow the lane's "busywork"?**

- _Options:_ (a) **Keep ADR-0040's enemy pure** (boilerplate that ships auth+Stripe+landing but skips the load-bearing parts). (b) Add a secondary "retrofit-compliance-later = months of rework" pain (the lane's busywork pain, re-aimed at developers). (c) Adopt the lost-deal fear (Delve's Sam-Altman gag).
- _Recommendation:_ **(a) primary + (b) secondary.** The boilerplate enemy is the differentiator; the "retrofit later" pain is the credible developer translation of the lane's busywork hook. Skip (c) — fear-gag is off-brand for a watertight-foundation metaphor.
- _Confidence:_ high · _Evidence:_ ADR-0040 enemy = happy-path boilerplate; StarterPick/Afterbuild quantify the retrofit pain ("budget 2–4 weeks of infra work," "$3,999+ fix"); Delve's email gag (https://www.delve.co).

**C4 — Proof strategy with zero customers.**

- _Options:_ (a) Borrow scale proof (impossible — no customers). (b) **Code-as-proof** (the diff, the failing→passing golden test, the control→clause mapping, the verifyChain output). (c) Founder/maintainer credibility (the compliance.tf move — but Caisson has no Babenko-scale name yet). (d) Coverage tiles (frameworks/controls/packages/tests).
- _Recommendation:_ **(b)+(d).** Code + coverage tiles are the only honest proof pre-launch and they match the dev-kit register.
- _Confidence:_ high · _Evidence:_ compliance.tf proof = code diff + "35+ frameworks · 300+ controls" + maintainer; Caisson has real artifacts (verifyChain, AAD-scoped field-crypto, golden-file gate per wave-0 memory).

**C5 — Adopt the honesty line: "we ship the technical safeguards; the program is yours."**

- _Options:_ (a) Imply Caisson "makes you compliant" (the platform implication; legally fraught, false for a code library). (b) **State plainly that Caisson ships the technical safeguards (encryption, RLS, audit, integrity) and the administrative/physical safeguards + audit are the buyer's.** (c) Stay silent on the boundary.
- _Recommendation:_ **(b)** — it's a trust signal, legally defensible, and a _differentiator_ (platforms blur this). Clynova does exactly this and it reads as competence, not weakness.
- _Confidence:_ high · _Evidence:_ Clynova: "Clynova ships the technical safeguards… Compliance is a property of your deployed product plus its administrative + physical safeguards"; StarterPick: "HIPAA is a process, not a checkbox."

**C6 — Name the framework in the H1, or stay framework-agnostic?**

- _Options:_ (a) Name SOC2/HIPAA in the H1 (head-keyword, lane-standard). (b) **Framework-agnostic in the H1 ("regulated SaaS"), frameworks named in the badge row + programmatic pages.** (c) Lead with the strongest single wedge framework (SOC 2).
- _Recommendation:_ **(b)** for the H1 (the umbrella promise), with frameworks carried by the badge row and per-framework MDX pages for SEO. Avoid stuffing.
- _Confidence:_ medium · _Evidence:_ Vanta's title is pure framework-stack; Delve's is a keyword-stuffed mega-title (anti-pattern); compliance.tf H1 is product-noun, frameworks in the tile row.

**C7 — CTA verb under ADR-0048 (waitlist, no checkout).**

- _Options:_ (a) "Book a demo" (lane-standard, sales-gated — wrong for a self-serve dev-kit). (b) **"Join the waitlist" + "Star on GitHub" / "Read the docs"** (PLG, dev-native). (c) "Start free" (implies a product that isn't shipping yet).
- _Recommendation:_ **(b)** — waitlist primary + a developer secondary (docs/GitHub) that delivers value pre-launch and matches compliance.tf's "no credit card needed" PLG energy.
- _Confidence:_ high · _Evidence:_ ADR-0048 (waitlist not checkout); every platform CTA is "Book a Demo / Get a Quote"; compliance.tf = "Start Free Trial, no card."

**C8 — Lean on the "caisson" pressure/load-bearing metaphor in copy (without explaining the word).**

- _Options:_ (a) Never touch the metaphor (safest, but wastes a strong asset). (b) **Use the _sensation_ of the metaphor — "holds under load," "watertight," "load-bearing," "doesn't leak under pressure" — without ever defining "caisson."** (c) Explain the word (banned by ADR-0041).
- _Recommendation:_ **(b)** — "load-bearing infrastructure" / "watertight under audit" is on-spec language that earns the name implicitly. Drata proves an extended metaphor can carry a whole site (space-mission); Caisson's is more apt (engineering-under-pressure).
- _Confidence:_ high · _Evidence:_ ADR-0041 ("name = metaphor, never explain the word"); ADR-0040 already uses "load-bearing"; Drata's mission metaphor (https://drata.com).

**C9 — Audience naming in copy.**

- _Options:_ (a) "founders / startups / security leaders" (lane-standard). (b) **"developers / engineers building regulated SaaS"** (ICP-1, dev-kit-true). (c) Both, split by section.
- _Recommendation:_ **(b) primary** (the buyer is the builder), with a CISO/founder secondary section for the budget-holder. The lane addresses security leaders; Caisson must address the _engineer_ first.
- _Confidence:_ medium · _Evidence:_ ADR-0040 ICP-1 = "the Compliance Builder — dev/founder/agency"; lane addresses "security leaders / CISOs" (Vanta by-size pages, Thoropass auditor bios).

**C10 — Anti-theatre line (the Oneleet move).**

- _Options:_ (a) Skip it. (b) **A parallel anti-slop line — "compliance you can read, not compliance theatre" / "controls in code, not checkboxes in a dashboard."** (c) Go negative on platforms by name (risky, category-error bait).
- _Recommendation:_ **(b)** — it rhymes with Caisson's anti-AI-slop / "load-bearing not happy-path" stance and with Oneleet's proven "without security theatre," without naming competitors.
- _Confidence:_ medium · _Evidence:_ Oneleet "Cybersecurity compliance without security theatre" (https://www.oneleet.com); ADR-0040 enemy framing.

### BRAND

**B1 — Visual camp allegiance: confirm the dark-technical dev-tool register (diverge from the platform-light register).** [INDIVIDUAL — brand/hero]

- _Options:_ (a) **Dark, terminal-native dev-tool register** (Warp/Supabase/Depot/Checkly/compliance.tf) — diverges from the dominant platform-light look, converges with where developers expect infra tools to live; this is already ADR-0042's direction. (b) Platform-light (Vanta lavender / Secureframe blue) — instant "compliance" recognition but reads as a me-too platform and fights Caisson's dev-kit truth. (c) Hybrid (dark hero, light docs).
- _Recommendation:_ **(a)** — confirm and double-down on dark-technical. It is the single clearest visual differentiator from the platform lane and the correct register for a picks-and-shovels library.
- _Confidence:_ high · _Evidence:_ platform-light cluster = Vanta (refero `79fffe1c`), Delve, Secureframe, Thoropass; dev-tool-dark cluster = Supabase (`28aeb534`), Depot (`707c2922`), Checkly (`0a2ad49e`), Warp (`40a9c295`), compliance.tf; ADR-0042 already dark cold-steel teal.

**B2 — Accent color: keep teal hue~205, or shift for ownability?** [INDIVIDUAL — brand expansion, may supersede ADR-0042]

- _Options:_ (a) **Keep cold-steel teal (~205)** — already locked, cold/engineering-correct. Risk: collides with Checkly electric-blue and the generic dev-tool blue/teal band. (b) Shift to a more ownable hue (the dev-tool dark camp is crowded with green [Supabase/Depot/Doppler] and violet [Doppler/LaunchDarkly/Twingate] — a colder cyan-steel or a distinctive non-green/non-violet could own a gap). (c) Keep teal as primary + add a **semantic secondary** (amber/red for "risk/control-failure," green for "control-pass") — a compliance-native two-color system the pure dev-tools don't have.
- _Recommendation:_ **(c)** — keep teal, add a control-state semantic pair (pass/fail). It's ownable _because_ it's compliance-semantic, not just decorative, and no competitor does it.
- _Confidence:_ medium · _Evidence:_ dev-tool accent crowding — green (Supabase `28aeb534`, Depot `707c2922`), violet (Doppler `38dc3537`, LaunchDarkly `2ca53e3f`, Twingate `f8c28758`), blue (Checkly `0a2ad49e`); compliance.tf renders control IDs (CC6.1, CC7.2) as colored status chips — the semantic-color precedent.

**B3 — Logomark/wordmark direction (the brand-book expansion this session must produce).** [INDIVIDUAL — name/hero-adjacent, brand expansion]

- _Options:_ (a) **Pure lowercase monospace-adjacent wordmark, no mark** (ADR-0041 locked direction; clean, dev-native — Vercel/Supabase-class). (b) Wordmark + a geometric **caisson/keystone/watertight-seal glyph** (a sunk-foundation or pressure-vessel abstraction — earns the metaphor visually without a mascot). (c) Wordmark + a **monospace-bracket / cursor motif** (`caisson█` or `[caisson]`) tying to the terminal register.
- _Recommendation:_ **(a) as the locked floor, with (b) explored as an optional standalone glyph for favicon/app-icon/social** (where a wordmark fails at small sizes). Do not introduce a mascot (ADR-0041).
- _Confidence:_ medium · _Evidence:_ ADR-0041 (lowercase, monospace-adjacent, dark surface, NO icon-mascot); dev-tool wordmark norm (Warp/Supabase/Depot are wordmark-forward); favicon constraint is real (a wordmark alone fails at 16px).

**B4 — Iconography system.** [INDIVIDUAL — brand expansion]

- _Options:_ (a) Generic outline-monochrome icons (the dev-tool default — Supabase/Depot). (b) **A distinctive engineering/blueprint line-icon language** (schematic, technical-drawing feel — matches the caisson engineering metaphor and the "controls as diagrams" job). (c) Framework/control-badge iconography (SOC2/HIPAA glyphs) as a parallel set.
- _Recommendation:_ **(b) for product/feature icons + (c) for the framework row.** Blueprint-technical icons differentiate from the generic outline set and reinforce the engineering metaphor.
- _Confidence:_ medium · _Evidence:_ refero dev-tool icon norm = "minimal monochrome icons" (Warp `40a9c295`), "outlined icons / line-based illustration" (Supabase); Trunk's "blueprint-inspired… schematic curves" (`09af2984`) is the differentiated direction.

**B5 — Illustration / graphic language.** [INDIVIDUAL — brand expansion]

- _Options:_ (a) Abstract network/security viz (Twingate/Trunk — generic security-tool look). (b) **Code-native artifacts** (real diffs, RLS policies, audit-chain output, control→clause maps) as the primary "imagery." (c) Schematic blueprint diagrams of the architecture (the caisson cross-section as a recurring motif). (d) Dark dashboard/product mockups (Clynova/Doppler).
- _Recommendation:_ **(b) primary + (c) secondary.** Code artifacts are the honest, dev-native proof; a recurring blueprint/cross-section motif carries the brand metaphor. Avoid generic network-viz.
- _Confidence:_ medium · _Evidence:_ compliance.tf uses code diffs + control chips as hero imagery; Warp blurs "marketing and product into one visual object" with real terminal screenshots (`40a9c295`); Trunk's blueprint overlays (`09af2984`).

**B6 — Typography: keep Hubot Sans + Martian Mono, and how much mono?** [INDIVIDUAL — brand expansion, may supersede ADR-0042 type]

- _Options:_ (a) **Keep ADR-0042 (Hubot Sans display + Martian Mono)** — distinctive, slightly quirky-technical. (b) Revert to a neutral known pairing (Inter/Geist — safer, but indistinct, what Drata/Linear use). (c) Keep Hubot Sans but **lean harder on Martian Mono** for headers/labels (terminal-native, compliance.tf/Warp do this) — mono as a brand signal, not just code.
- _Recommendation:_ **(c)** — keep the pairing, but push mono into eyebrow labels, control IDs, stat tiles, and nav for a terminal-native signature. Martian Mono on control clauses (CC6.1, §164.312) is on-brand and functional.
- _Confidence:_ medium · _Evidence:_ ADR-0042 (Hubot Sans + Martian Mono); Warp/compliance.tf lean heavily mono; Drata/Linear use Inter (the indistinct default to avoid); refero: "typography is the dominant visual voice" in the dev-tool camp (Warp `40a9c295`).

**B7 — Motion language.** [INDIVIDUAL — brand expansion]

- _Options:_ (a) Near-static / restrained (the dev-tool norm — "subtle surface shifts, faint glow"). (b) **Functional micro-motion that dramatizes the product** — control checks ticking green, a hash-chain linking, a failing test going green, terminal typing. (c) Heavy cinematic gradients (Doppler/LaunchDarkly violet haze).
- _Recommendation:_ **(b)** — motion that _demonstrates_ (control-pass animation, verifyChain linking) is proof and delight at once; avoid (c) cinematic glow (off-brand for cold-steel engineering).
- _Confidence:_ low · _Evidence:_ dev-tool motion is restrained (Linear `11d3e58a`, Warp); compliance.tf animates the control-enforced checklist; this is a craft direction, not a hard precedent.

**B8 — Wordmark casing enforcement.** [INDIVIDUAL — name-adjacent]

- _Options:_ (a) **Lowercase 'caisson' everywhere** (logo, prose, titles) — strict, Vercel/stripe-lowercase discipline. (b) Lowercase logo, sentence-case "Caisson" in prose/SEO titles (readability + title-tag convention). (c) Mixed by surface.
- _Recommendation:_ **(b)** — lowercase wordmark as the locked logotype, but allow "Caisson" capitalized in prose and `<title>` tags (search snippets and sentences read better; the _logo_ carries the lowercase identity). Flag to operator — ADR-0041 locked the _wordmark_ lowercase, not necessarily prose.
- _Confidence:_ medium · _Evidence:_ ADR-0041 (wordmark lowercase); practical SEO/readability (title tags and body copy capitalize brand names by convention).

### SEO

**S1 — Head-term vs long-tail strategy.**

- _Options:_ (a) Compete for "[framework] compliance" head terms (high KD, owned by platforms — unwinnable for a dev-kit). (b) **Own the dev-kit long-tail** ("SOC 2 compliance starter kit," "HIPAA boilerplate Next.js," "self-hosted audit log SOC 2," "multi-tenant RLS compliance template," "compliance for developers"). (c) Both, weighted to long-tail.
- _Recommendation:_ **(b)** — the head terms are lost; the long-tail is fragmented, lower-KD, and matches buyer-intent for a code library.
- _Confidence:_ high · _Evidence:_ ADR-0040 ("compliance CPC 10–50× at low KD… SERP owned by finished platforms"); StarterPick aggregators rank for the long-tail (https://starterpick.com/guides/hipaa-compliant-saas-boilerplates-2026); compliance.tf owns "terraform compliance."

**S2 — Title-tag pattern.**

- _Options:_ (a) Keyword-stuffed mega-title (Delve-style — anti-pattern, dilutes). (b) **Clean `Caisson — the compliance codebase for regulated SaaS` (brand + wedge)** (Drata/Thoropass style). (c) Framework-stack title (Vanta style — pure keywords, no brand).
- _Recommendation:_ **(b)** for the homepage; per-page templated titles (`SOC 2 CC6.1 in code — Caisson docs`) for the programmatic long-tail.
- _Confidence:_ high · _Evidence:_ Delve's stuffed title (anti-pattern); Drata `The Agentic Trust Management Platform | Drata`; compliance.tf `Compliance.tf - Terraform Compliance for Cloud-Native Enterprise`.

**S3 — Programmatic framework × control pages (the unowned long-tail).**

- _Options:_ (a) A few hand-written framework pages (/soc-2, /hipaa) like the lane. (b) **A programmatic matrix: per-framework AND per-control MDX pages** ("HIPAA §164.312(b) audit controls in Next.js," "SOC 2 CC6.1 encryption in code," "RLS deny-by-default for multi-tenant PHI"), each mapping a control to the Caisson code that satisfies it. (c) Docs-only, no marketing framework pages.
- _Recommendation:_ **(b)** — this is the single biggest SEO opportunity. The developer-HIPAA/SOC2 guides that rank today (oktopeak, quantlabusa, afterbuildlabs, accountablehq) are info-intent with weak commercial competition; Caisson can out-rank them with _code that implements the control_ + Fumadocs. compliance.tf already does this at the infra layer (control→clause docs pages).
- _Confidence:_ high · _Evidence:_ compliance.tf `/docs/guides/starter-kits/healthtech/` maps §164.312 → modules; ranking dev guides (oktopeak.com, quantlabusa.dev, afterbuildlabs.com, accountablehq.com) prove the intent + weak SERP; ADR-0045 Fumadocs MDX makes this near-free.

**S4 — "Alternative / vs" pages.**

- _Options:_ (a) Build "Vanta alternative" / "Drata alternative" SEO pages (lane-standard, but a **category error** — Caisson is not a platform substitute; ADR-0040 forbids the comparison-table framing). (b) **Build "build vs buy: compliance starter kit vs compliance platform" educational pages** that capture the comparison intent without claiming to be a platform replacement. (c) None.
- _Recommendation:_ **(b)** — capture the high-intent comparison traffic honestly ("when a dev-kit is right vs when you need a platform"), positioning Caisson as the _earlier/complementary_ layer. Never a head-to-head "Vanta alternative" table.
- _Confidence:_ medium · _Evidence:_ ADR-0040 ("generic base = one-line footnote, NEVER a comparison table"); Afterbuild's "DIY vs rescue vs consultant" table is the honest model (afterbuildlabs.com).

**S5 — Ride "agentic," or avoid it?**

- _Options:_ (a) **Lean into "agentic"** — Caisson has the Agentic-Dev edition + AI-Kit; the term has SEO momentum. (b) Avoid it (overused, platform-coded, dilutes the compliance-spine message). (c) Use it only on the Agentic-Dev / AI-Kit edition pages, not the compliance hero.
- _Recommendation:_ **(c)** — keep "agentic" scoped to the AI/Agentic editions; the compliance hero stays code/control-first. Riding "agentic" on the compliance hero would camouflage Caisson into the Vanta/Drata/Delve "agentic trust" pack it's trying to differentiate from.
- _Confidence:_ medium · _Evidence:_ Vanta "#1 Agentic Trust Platform," Drata "Agentic Trust," Delve "agentic compliance" — the term is saturated at the platform layer; ADR-0040 sequences AI-Kit/Agentic-Dev as later waves.

**S6 — Branded-term defense (dictionary collision).**

- _Options:_ (a) Assume "caisson" ranks for us by default (it won't — civil-engineering term + other software uses). (b) **Actively build "caisson compliance," "caisson dev kit," "@caisson" entity SEO** (GitHub org, npm scope, consistent `caisson.sh` canonical, structured data) to disambiguate. (c) Ignore.
- _Recommendation:_ **(b)** — own the _modified_ brand terms early; the bare word "caisson" is a battle not worth fighting.
- _Confidence:_ medium · _Evidence:_ ADR-0041 (name = a real engineering word with prior meanings); standard brand-disambiguation SEO practice.

**S7 — Docs-as-SEO IA.**

- _Options:_ (a) Pure reference docs (low search surface). (b) **Guide-shaped docs optimized for the long-tail** (per-framework starter-kit guides, per-control how-tos) under the Fumadocs tree, mirroring compliance.tf's `/docs/guides/starter-kits/`. (c) Split marketing pages from docs entirely.
- _Recommendation:_ **(b)** — the docs ARE the SEO engine for a dev-kit; structure them as rankable guides, not just an API reference.
- _Confidence:_ high · _Evidence:_ compliance.tf's starter-kit docs pages rank (indexed by exa); ADR-0045 Fumadocs MDX in `apps/site` is built for this.

**S8 — Structured data / schema type.**

- _Options:_ (a) `SoftwareApplication` schema. (b) `Product` schema (with SKU structure, no price under ADR-0048). (c) `TechArticle` on the programmatic control pages. (d) All, per page type.
- _Recommendation:_ **(d)** — `SoftwareApplication`/`Product` on the homepage/SKU pages (omit `price`, use `offers` with availability=PreOrder/waitlist), `TechArticle` on the control how-tos.
- _Confidence:_ low · _Evidence:_ ADR-0048 (SKU structure, no hard price — so schema must omit price); standard schema.org practice. (Verify exact field handling against schema.org docs at build.)

### VISUAL (page/section composition — distinct from the brand system)

**V1 — Hero centerpiece visual object.** [INDIVIDUAL — hero]

- _Options:_ (a) **An annotated code artifact** (a real RLS policy / `verifyChain()` output / field-crypto call / a failing→passing golden test) — the compliance.tf move, proves substance with zero customers. (b) A control-coverage matrix (frameworks × controls grid). (c) A terminal/`create-caisson` install flow. (d) A product dashboard mockup (Clynova/Doppler style).
- _Recommendation:_ **(a) primary** — code-as-hero is the single strongest, most differentiated, most honest hero for a dev-kit. (c) as a secondary section (the `create-caisson` flow). Avoid (d) — a dashboard mockup makes Caisson look like a platform.
- _Confidence:_ high · _Evidence:_ compliance.tf hero = a code diff (https://compliance.tf); Clynova pairs a terminal block with the feature grid; the entire dev-tool camp foregrounds code/terminal screenshots (Warp, Supabase).

**V2 — Framework-badge grid: include it, and how to frame it?**

- _Options:_ (a) Omit it (avoid looking like a platform — but loses instant category recognition). (b) **Include the SOC2/ISO/HIPAA/PCI/GDPR badge row, but labeled "controls implemented in code," not "frameworks we certify you for."** (c) Replace badges with control-clause chips (CC6.1, §164.312) — more technical, less recognizable.
- _Recommendation:_ **(b)** — keep the badge row for the category-recognition tax every visitor expects, but reframe the _verb_ (implemented, not certified). Pair with (c) control chips on deeper sections.
- _Confidence:_ high · _Evidence:_ every competitor shows the badge grid (universal pattern); compliance.tf reframes as "35+ frameworks · 300+ controls" + clause chips (CC6.1, CC7.2).

**V3 — Proof section without customers.**

- _Options:_ (a) Empty logo wall / placeholder (looks pre-launch and weak). (b) **GitHub stars + "controls covered" + golden-file test-pass + "audited by" (once true) + design-partner slots.** (c) Maintainer/founder credibility block (compliance.tf's Babenko move, scaled to Caisson's provenance).
- _Recommendation:_ **(b)** — substitute code/coverage proof for social proof until customers exist; reserve a logo wall for after design partners land.
- _Confidence:_ high · _Evidence:_ compliance.tf substitutes maintainer + coverage tiles for a logo wall; AuditKit leads with "5-minute setup vs 2-4 weeks" + architecture, not logos.

**V4 — Pricing/SKU section rendering (ADR-0048: structure, no hard prices, waitlist).**

- _Options:_ (a) Named tier cards with "pricing TBD / join waitlist" (mirrors the platform "Get a quote" pattern — familiar, but invites "vaporware" read). (b) **A feature/SKU matrix showing what each edition+subscription includes, with a single waitlist CTA and NO price fields** (shows the shape of the offer honestly). (c) Anchored "from $X" ranges (violates ADR-0048 — pricing is the open operator fork).
- _Recommendation:_ **(b)** — render the SKU _structure_ (editions, subscriptions, à-la-carte modules) as a feature matrix with availability/waitlist, zero price numbers. This is exactly ADR-0048 and avoids both the demo-gate and the premature-price traps.
- _Confidence:_ high · _Evidence:_ ADR-0048 (SKU structure, no hard prices, waitlist); the platforms prove "named tiers, no numbers" is an accepted pattern (Vanta/Secureframe/Drata pricing pages); dev-kits that show hard prices (Clynova $999, Already $199) are the contrast Caisson defers on.

**V5 — Page density.**

- _Options:_ (a) **Code-forward dense** (compliance.tf/Checkly — "information-dense but airy"). (b) Spacious editorial (Vanta/Warp — high whitespace, premium). (c) Hybrid: dense technical sections, spacious hero.
- _Recommendation:_ **(c)** — a spacious, confident hero (premium signal) opening into dense, code-rich proof sections (substance signal). The dev-tool camp does exactly this.
- _Confidence:_ medium · _Evidence:_ Supabase/Checkly are "dense but airy" (`28aeb534`, `0a2ad49e`); Warp is "spacious in a measured way" (`40a9c295`); compliance.tf is dense/code-forward.

**V6 — Repeating visual unit for feature sections.**

- _Options:_ (a) Dark product-UI cards (Doppler/Clynova). (b) **Code blocks + control-state chips** (compliance.tf). (c) Schematic blueprint diagrams (Trunk). (d) Mixed cadence.
- _Recommendation:_ **(d) anchored on (b)** — code blocks with pass/fail control chips as the dominant unit, blueprint diagrams for architecture sections, no faux dashboard cards.
- _Confidence:_ medium · _Evidence:_ compliance.tf's control-chip pattern (CC6.1 · Versioning Enabled…); Trunk blueprint motif (`09af2984`).

**V7 — Dogfood a live "trust page" as a visual proof artifact?**

- _Options:_ (a) No (the lane's Trust Center is a _product feature_, not a site element; ADR-0045 is a static site with no server routes). (b) **A static, dogfooded "this site's own posture / how Caisson's audit primitives work" page** — proof-by-example without a backend. (c) Skip until product ships.
- _Recommendation:_ **(b) deferred / low-priority** — a static "how the audit-chain works, demonstrated" page is on-brand proof, but it's post-hero polish, not launch-critical. Flag, don't block.
- _Confidence:_ low · _Evidence:_ Vanta/Drata/Delve/Oneleet all ship Trust Centers (the pattern's pull is real); ADR-0045 (static, no server routes — so any "trust page" must be static/illustrative).

---

## 4. Convergence / divergence summary (the craft table)

| Dimension        | The lane converges on                  | Caisson should…                                                                                              | Why                                                   |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Category word    | "platform"                             | **diverge** → library/substrate/kit                                                                          | "platform" is owned + a category lie (ADR-0040)       |
| Hero verb        | "automate compliance"                  | **diverge** → noun + load-bearing promise                                                                    | dev-kit not platform                                  |
| Visual register  | split: platform-light vs dev-tool-dark | **converge with dev-tool-dark** (Warp/Supabase/compliance.tf), **diverge from platform-light** (Vanta/Delve) | picks-and-shovels reads as infra, not SaaS            |
| Hero object      | logos / dashboards / framework grid    | **diverge** → code-as-hero                                                                                   | only honest proof pre-launch; compliance.tf precedent |
| Framework badges | universal grid                         | **converge** (but reframe verb)                                                                              | category-recognition tax is real                      |
| Pricing display  | demo-gated, no numbers                 | **partial-converge** → SKU structure + waitlist, no numbers (ADR-0048)                                       | avoids demo-gate AND premature price                  |
| Proof            | scale + logos + analysts               | **diverge** → code + coverage + maintainer credibility                                                       | no customers yet                                      |
| "Agentic"        | everyone, on the hero                  | **diverge** (scope to AI editions only)                                                                      | camouflages the differentiation                       |
| SEO target       | head terms (lost)                      | **diverge** → long-tail + programmatic control pages                                                         | the unowned, winnable ground (ADR-0040)               |
| Honesty boundary | implied "we make you compliant"        | **diverge** → "we ship the safeguards; the program is yours"                                                 | trust + legal defensibility (Clynova model)           |
| Accent color     | green/violet/blue (dev-tools)          | **differentiate** → teal + pass/fail control-state semantic                                                  | ownable because compliance-semantic                   |

---

## 5. Gaps / not-yet-verified

- **Exact KD/CPC numbers** for the specific long-tail queries were not re-pulled this session (ADR-0040 already establishes "10–50× CPC, low KD" — treat as the anchor; a fresh keyword-tool pull would sharpen S1/S3).
- **compliance.tf hard pricing numbers** are not public on the page (trial-first); only the dev-kits (Clynova $999, Already $199/399) expose hard prices.
- **Live Lighthouse / performance** of competitor sites not measured (out of scope for positioning teardown).
- **Refero screen-level** (not style-level) references for the specific sections (hero, pricing matrix, control-mapping page) were not pulled — recommended as the next research step when wireframing each section.

---

## References (cited)

- Vanta — https://www.vanta.com · https://www.vanta.com/pricing · refero style `79fffe1c-8b81-4ec9-917a-d34760e75850`
- Drata — https://drata.com · https://drata.com/pricing
- Secureframe — https://secureframe.com · https://secureframe.com/pricing
- Oneleet — https://www.oneleet.com · https://www.oneleet.com/pricing
- Delve — https://www.delve.co · TechCrunch (Series A, $300M, MIT dropouts) https://techcrunch.com/2025/07/22/21-year-old-mit-dropouts-raise-32m-at-300m-valuation-led-by-insight/ · Insight Partners https://www.insightpartners.com/ideas/scaling-ai-native-compliance-how-delve-is-saving-companies-time-and-money-on-compliance-busywork/
- Thoropass — https://thoropass.com · https://thoropass.com/pricing
- compliance.tf — https://compliance.tf · https://compliance.tf/pricing · starter kit https://github.com/compliancetf/starter-kit-healthtech-hipaa · docs https://compliance.tf/docs/guides/starter-kits/healthtech/
- Clynova — https://byteworthy.io/blueprints/clynova · https://github.com/ByteWorthyLLC/clynova
- Already — https://alreadykit.com
- AuditKit — https://github.com/AuditKitDev/auditkit · https://auditkit.dev
- TamperTrail — https://github.com/sthakur369/TamperTrail
- Boilerlykit/SaaSForge — https://boilerlykit.com/saasforge-core
- StarterPick (long-tail aggregator + "HIPAA is a process not a checkbox") — https://starterpick.com/guides/hipaa-compliant-saas-boilerplates-2026 · https://starterpick.com/guides/best-boilerplates-healthcare-apps-2026
- Dev HIPAA/SOC2 guides that rank the long-tail — https://oktopeak.com/blog/hipaa-saas-developers-guide/ · https://quantlabusa.dev/blog/hipaa-compliant-saas-architecture · https://afterbuildlabs.com/compliance/hipaa-for-ai-built-apps · https://www.accountablehq.com/post/next-js-hipaa-compliance-guide-requirements-best-practices-and-step-by-step-setup · https://gautamkhorana.com/blog/hipaa-compliant-supabase-vercel-2026/
- refero dev-tool-dark styles — Warp `40a9c295` · Supabase `28aeb534` · Checkly `0a2ad49e` · Trunk `09af2984` · Depot `707c2922` · Doppler `38dc3537` · LaunchDarkly `2ca53e3f` · Twingate `f8c28758` · Linear changelog `11d3e58a`
