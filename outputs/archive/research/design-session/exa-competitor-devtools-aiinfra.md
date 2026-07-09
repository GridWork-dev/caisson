# Competitor Teardown — Dev-Boilerplate · AI-Infra/LLMOps · Local-first

**Session:** Design · Brand · SEO · Copy scope (`design/brand-site-seo`)
**Surface:** competitor teardown → forks across {visual, brand, seo, copy}
**Method:** exa `web_search_exa` live-fetch (2026-06-27), cross-read against the shipped
`apps/site` copy/SEO surface + locked ADR-0040/0041/0042/0047/0048 + `specs/04-voice-and-brand.md`.
**Mandate guardrails:** ADR-0040 (compliance-hero, anti-$199-boilerplate firewall — generic base is a
one-line footnote, never a comparison table), ADR-0041 (name **Caisson**, lowercase mono wordmark, no
icon-mascot), ADR-0048 (SKU structure shown, no hard prices) are **LOCKED**. ADR-0042
(palette A + type Structural) **MAY be widened** by a new append-only ADR.

Every claim cites a competitor URL or a `file:line` in the current site.

---

## 1. Cluster A — Dev boilerplate / starter-kit libraries

The Anti-ICP zone. ADR-0040 firewall: Caisson must **not** read as a $199 ShipFast clone. This
teardown is the negative reference — what to deliberately _not_ look like, and the one OSS-generator
pattern worth stealing (`create-caisson` ≈ create-t3-app / Divjoy).

| Product                              | Positioning lead                                                                                                               | Visual register                                                                                                                                               | IA                                                                                                                          | Pricing **display**                                                                                                                                                                   | SEO posture                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **ShipFast** (shipfa.st)             | "Launch your startup in days, not weeks." Hype + indie-revenue. "Make your first $ online fast." Marc Lou personal brand.      | Light, rounded, emoji, yellow/colorful, conversion-optimized hero+FAQ+testimonials. Revenue-screenshot energy.                                                | Single long landing → checkout.                                                                                             | **Hard prices front-and-center:** $199 / $249 / $299 one-time, strike-through "$100 off for the first 8350 customers (12 left)" scarcity timer. "Pay once. Build unlimited projects." | Ranks "nextjs boilerplate"; review-farm backlinks (dupple, mystarterstack).                                                 |
| **MakerKit** (makerkit.dev)          | "Built for SaaS (not generic boilerplate)." B2B: multi-tenancy/RBAC/admin.                                                     | Cleaner SaaS, still light/marketing. **Leads with a comparison table** (vs Supastarter/Achromatic/ShipFast/IndieKit) incl. "UI: Confusing/Average/Intuitive." | Hub-and-spoke: `/nextjs-saas-boilerplate`, feature pages, blog, docs, changelog.                                            | $349 **strikethrough → $299** (Supabase) / $649→$599 (Team); Drizzle $349/$699. One-time, "lifetime."                                                                                 | Heavy: blog + Markdoc + auto-sitemap + structured data; "rank higher, drive organic traffic." Comparison/alternative pages. |
| **Supastarter** (supastarter.dev)    | "The SaaS starter kit for **serious founders**." "Most complete."                                                              | Light marketing, framework toggle (Next/Nuxt/TanStack).                                                                                                       | Landing + per-stack pages + docs.                                                                                           | €349 / €799 / €1,499 one-time, **coupon codes** ("$261.75 with code 3UYXRYEO"). "One-time purchase. Lifetime access."                                                                 | "Trusted by 1422 developers" counter; "best SaaS boilerplate 2026" content.                                                 |
| **create-t3-app** (create.t3.gg)     | "The best way to start a full-stack, **typesafe** Next.js app." Opinion-forward.                                               | **Docs-site aesthetic** (Nextra-class), command as hero. No marketing fluff.                                                                                  | `npm create t3-app@latest` hero → "T3 Axioms" (Solve Problems / Bleed Responsibly / Typesafety Isn't Optional) → community. | **Free / MIT.** No pricing. Community = Discord/GitHub/Twitter.                                                                                                                       | Ranks "t3 stack"/"typesafe nextjs"; docs + npm authority.                                                                   |
| **Divjoy** (divjoy.com)              | "The React **Codebase Generator**." Visual builder + export. **Closest analogue to `create-caisson`.**                         | Light app-builder UI; built-in editor, drag-in sections, export to CodeSandbox.                                                                               | Pick stack/template → visual editor → download/export.                                                                      | **$199 one-time, lifetime, unlimited export.**                                                                                                                                        | Modest; "react codebase generator."                                                                                         |
| **Bedrock** (bedrock.mxstbr.com)     | "The modern full-stack Next.js & GraphQL boilerplate." **Creator-brand** (Max Stoiber, styled-components). Premium/enterprise. | Dark-ish, technical, founder-photo credibility.                                                                                                               | Single landing, creator bio block, 14-day guarantee.                                                                        | **$450 → $396 (12% off)**, highest in market (team ~$1,500). "Use for the entire lifetime of your product."                                                                           | Creator authority + indiehackers.                                                                                           |
| **boxyhq/saas-starter-kit** (GitHub) | "Enterprise SaaS Starter Kit" — SAML/SCIM/audit-logs, **open source** (Apache).                                                | GitHub README.                                                                                                                                                | Repo + docs.                                                                                                                | **Free OSS**, enterprise via BoxyHQ.                                                                                                                                                  | 4.8k stars; "enterprise saas starter kit."                                                                                  |

**Cluster-A takeaways for Caisson:**

- The entire cluster signals cheapness through: **light backgrounds, emoji, strike-through prices,
  scarcity timers, "make $", "lifetime updates," conversion-template hero rhythm, creator-revenue
  flexing.** Caisson's anti-boilerplate brand is defined by _negating each of these_ (voice spec §7
  "is not: hypey · emoji-playful · gradient-hero-SaaS · screenshot-flexing").
- **The one pattern to steal:** OSS dev tools lead with the _install command as the hero element_
  (create-t3-app `npm create t3-app@latest`; Ollama `curl … | sh`). `create-caisson` is real and
  absent from the current hero (`apps/site/app/(marketing)/page.tsx`). This is a high-value visual+copy fork.
- **The generator framing** (Divjoy "codebase generator") is the honest category for `create-caisson`
  — more differentiated than "boilerplate," and it sidesteps the $199 comparison.
- compliance.tf already proves the **private-registry + framework-mapping + AWS-Marketplace** GTM that
  Caisson's Compliance Updates SKU mirrors; its "**smoke detector vs fireproof construction**" line and
  "Plan. Apply. Comply." cadence are the direct copy foil the voice spec calls out (compliance.tf/).

---

## 2. Cluster B — AI-infra / LLMOps

The AI-Kit edition reference ("same rigor, AI infra"). These are dark, technical, evidence-forward,
open-core, and lead with **reliability / observability / governance** — exactly the register ADR-0040
wants for AI-Kit. They are the _positive_ visual reference where boilerplate is the negative one.

| Product                                     | Positioning lead (H1)                                                                                                               | Visual register                                                            | Pricing **display**                                                                                         | Open-source / trust                                                                                            | SEO / IA                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Helicone** (helicone.ai)                  | "Build **Reliable** AI Apps" — AI Gateway & LLM Observability. YC W23.                                                              | Dark, product-screenshot hero, "world's fastest-growing AI companies."     | **Free (10k req, no CC) → $79 Pro → $799 Team → Enterprise.** Pricing **calculator**; "0% markup."          | **Apache-2.0**, self-host Docker/K8s; SOC2/HIPAA; startup/OSS/student discounts.                               | Comparison table (vs LangSmith/Braintrust/Arize/Langfuse) with UI ratings; "Helicone or LangSmith?" pages; `llm-cost` open DB (300+ models) = programmatic SEO. |
| **Langfuse** (langfuse.com)                 | "**Open Source** AI Engineering Platform." "Debug LLM apps & agents in minutes." OTel-based.                                        | Dark, **interactive diagram hero** (hover the pipeline). Dense, technical. | **Hobby free (50k obs) → Core $29 → Pro $199 → Enterprise $2,499**; **self-host free (MIT, all features).** | MIT, "largest OSS community"; SOC2 Type II + ISO 27001 + HIPAA/GDPR; "2,300+ companies, billions of events."   | Handbook ("Why Langfuse"), self-host docs, OTel content; FAQ-rich; switch OSS↔Cloud↔Enterprise messaging.                                                       |
| **Portkey** (portkey.ai)                    | "**Production Stack** for Gen AI Builders" / "Enterprise-ready AI Platform." Gateway + Observability + Guardrails + **Governance**. | Dark, enterprise, governance-forward (RBAC, audit logs, budgets).          | **Free Forever → $49 Production (+$9/100k overage) → Enterprise (custom, "Book a demo").**                  | Open-source AI Gateway (50+ contributors); SOC2/ISO27001/GDPR/HIPAA, BAAs, VPC, data-residency.                | "Enterprise AI control panel"; open LLM-pricing dataset; G2 social proof; demo-led.                                                                             |
| **Braintrust** (braintrust.dev)             | "**Ship quality AI at scale**" — observability + evals. "AI fails differently than normal software."                                | Dark, product UI, "Brainstore" custom-DB flex.                             | **Starter $0 (no CC) → Pro $249 → Enterprise (custom).** Usage **calculator**; per-metric credits.          | SOC2 Type II, GDPR, HIPAA, SSO/RBAC, BYOC/self-host (Enterprise only); `docs/llms.txt`.                        | "AI observability platform" head term; docs-as-SEO; eval/quality content.                                                                                       |
| **Traceloop / OpenLLMetry** (traceloop.com) | "Open-source observability for LLMs with OpenTelemetry. **Start with just 2 lines of code.**"                                       | Dark, **code-snippet-as-hero** (Python/TS tabs). Minimal.                  | OSS free (Apache); platform = "Ship LLM apps 10× faster."                                                   | Apache-2.0, 7.2k stars; SOC2 + HIPAA + **air-gapped** deploy; "open standards, no lock-in."                    | `llms.txt`; OTel/Datadog/Honeycomb integration content; GitHub authority.                                                                                       |
| **LiteLLM** (litellm.ai)                    | "**Give Developers** [Azure/Gemini/Bedrock/OpenAI/Anthropic] Access." AI Gateway, 100+ LLMs, OpenAI format. YC.                     | Dark, provider-logo rotator, metric strip (240M+ pulls, 1B+ requests).     | **OSS $0 → Enterprise (custom, "Request Pricing," 30-day trial).** SSO free ≤5 users.                       | OSS (MIT core + commercial enterprise); SSO/SCIM/audit-logs/JWT; **Netflix testimonial** ("Day 0 LLM access"). | "AI gateway" / "litellm proxy"; docs + `llms.txt`; provider-name long-tail.                                                                                     |

**Cluster-B takeaways for Caisson:**

- **This is the register AI-Kit should match** — dark, terse, "name the failure" (Braintrust: "AI
  drifts and regresses silently"; Portkey: "mitigate critical errors at scale"). Voice spec §9 already
  says AI-Kit leads with the spike that gets capped, not "AI-powered." The competitor evidence
  _confirms_ the lane: every winner leads reliability/observability/governance, **none** lead "AI-powered."
- **Open-core trust theatre is a template:** Langfuse/Helicone/Traceloop foreground **SOC2 Type II +
  ISO 27001 + HIPAA + self-host + "no lock-in"** as the _primary_ credibility layer. A compliance product
  that _also_ ships these is uniquely entitled to that strip — and Caisson's local-first AGPL flank +
  "we publish OWASP/test results" gap (specs/03 §3) is the open-core analogue.
- **The free→usage→enterprise ladder with a calculator** (Helicone/Braintrust) is the AI-infra norm;
  Caisson defers prices (ADR-0048), so the _structure-not-numbers_ pricing page is the deliberate
  divergence — it must read as intentional, not unfinished (copy fork below).
- **"Book a demo"** is the enterprise CTA (Portkey/LiteLLM). Caisson's waitlist is the pre-launch
  equivalent; the dual "free flank (GitHub) + paid hero (waitlist)" CTA split mirrors the open-core ladder.

---

## 3. Cluster C — Local-first / privacy

The free AGPL flank reference. These do **top-of-funnel via the command line + sovereignty copy**, not
paid conversion. This is the proven playbook for Caisson's Local-first AI edition.

| Product                                  | Positioning lead                                                                             | Visual / hero                                                                                               | Pricing **display**                                                                          | Sovereignty copy                                                                                     | Distribution                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Ollama** (ollama.com)                  | "The easiest way to build with open models."                                                 | **`curl -fsSL https://ollama.com/install.sh \| sh` as the hero.** Dark, terminal-forward, MIT (174k stars). | **Free** + Cloud: **$20/mo Pro, $100/mo Max.** "Start local. Scale with cloud."              | "**Your data stays yours** · never trained on · run **entirely offline** for mission-critical work." | Download + curl + Docker; app integrations (Claude Code, Codex).         |
| **LM Studio** (lmstudio.ai)              | "Local AI on **your computer**."                                                             | Desktop-app screenshot + `curl … install.sh` for headless `llmster`. Dark.                                  | **Free** desktop app; Enterprise Solutions page; SDKs (npm/pip).                             | "**Nothing you enter leaves your device** · all processing local · works **offline**."               | Download (Mac/Win/Linux) + headless daemon + `llms.txt`/`llms-full.txt`. |
| **ElectricSQL / Electric** (electric.ax) | "**Agents on sync**" / "Real-time sync for Postgres." Pivoted to agent platform.             | Dark, "just HTTP," `npx @electric-sql/start` hero; composable-primitives diagram.                           | **OSS Apache-2.0** (10k stars) + **Electric Cloud (hosted, usage-based, turnkey).**          | "Open protocol · no siloes · no black boxes · your existing stack."                                  | npx + self-host + CDN-fanout story; PGlite (<3MB WASM Postgres).         |
| **Turso** (turso.tech)                   | "**Databases Everywhere.** Millions of Databases. One Architecture." SQLite rewrite in Rust. | Dark, "files not processes," metric-forward.                                                                | **Free (100 dbs, no CC) → $4.99 Developer → $24.92 Scaler → $416.58 Pro → Enterprise/BYOC.** | "Embedded = free · offline · on-device"; **BYOK encryption**; SOC2-ish Pro tier.                     | `Start for free` + `View on Github`; open-contribution; `docs/llms.txt`. |

**Cluster-C takeaways for Caisson:**

- **The CLI/curl command IS the hero** for local-first OSS, paired with one-line sovereignty copy.
  Caisson's local-first page should adopt the proven sentence shapes — "Your data never leaves the
  device" (already in `page.tsx:48`, the edition line) deserves to be the _page hero_, not a card line.
- **"Start local, scale with cloud"** (Ollama) and **"OSS free + hosted usage-based"** (Electric/Turso)
  are the exact open-core ladder ADR-0040 assigns the AGPL flank (free awareness → convert up). The
  flank copy should mirror this, not the compliance-hero register.
- **`llms.txt` + `Start free` + `View on GitHub` dual CTA** is universal here. Caisson already ships
  `llms.txt` + `llms-full.txt` (`apps/site/app/llms.txt/route.ts`) — ahead of most; the GitHub CTA for
  the free flank is missing from the marketing hero.
- **Dark + monospace + metric-strip** is the shared visual DNA across B and C — strongly validates
  ADR-0042's dark cold-steel + Martian Mono direction as _category-correct_, not a gamble.

---

## 4. Current Caisson site — state read (the baseline forks act on)

- **Hero** (`page.tsx:60`): eyebrow tagline → H1 "Fail-closed by construction." → lede → CTAs
  "Request early access" / "Read the docs" → **a real RLS-denial code block** as proof. Strong, on-brand,
  matches Traceloop/Resend "code-as-hero." **No install command, no GitHub CTA.**
- **Sections:** umbrella ("load-bearing infrastructure cheap boilerplates skip") · evidence row (3
  Unicode-glyph cards ▣▤▥) · editions (2-col, accent on Compliance) · SKU structure (4-col, no prices) ·
  waitlist.
- **Pricing** (`pricing/page.tsx`): structure only, entitlements CLI block, edition lineup, commerce
  model, 2 subscriptions, EU AI Act add-on, waitlist + footnote "And yes — it's a better base than the
  $199 kits." Every price slot = "Early access — join the waitlist" (ADR-0048).
- **SEO surface:** `metadata` title/desc/OG (no `twitter` card block); `SoftwareApplication` JSON-LD with
  `PreOrder` offer (`(marketing)/layout.tsx:6`); `sitemap.ts` (6 marketing + docs, priority 1/0.8/0.6);
  `robots.ts` allow-all; one static `opengraph-image.tsx` (satori, dark, accent bar, mono); `llms.txt` +
  `llms-full.txt`; Plausible (cookieless). **Gaps:** no per-page OG, no `FAQPage`/`Organization`/
  `BreadcrumbList` schema, fonts via render-blocking Google Fonts CDN stylesheet (not `next/font`), no
  framework-keyword landing pages, no canonical tags observed.
- **Brand:** wordmark-only "caisson" lowercase + accent bar (OG image); **no logomark**; single teal
  accent; Unicode-glyph icon system.

---

## 5. FORK BOARD

Format: **[surface] question — options (label — tradeoff) — RECOMMENDATION (confidence) — evidence.**
`✦` = brand-expansion or name/hero-adjacent → present **individually** to the operator (not batched).

### 5A. VISUAL

**V1. Hero proof artifact.** What single element carries the hero?

- A) Keep the static RLS-denial code block (current) — honest, on-brand, but static.
- B) Add the `create-caisson` install command above/beside it (Ollama/t3 pattern) — instantly legible
  category signal, real entry point.
- C) Animated terminal (RLS denial → audit-chain hash → evidence pack) — highest craft, build cost.
- D) Schematic "layers" diagram (Langfuse interactive) — explains the umbrella, less visceral.
- **REC: A + B** — keep the RLS denial as the proof, _add the install command_ as the action. (high) —
  evidence: ollama.com (curl hero), create.t3.gg (`npm create t3-app@latest`), traceloop.com (2-line
  code hero); current hero lacks any command (`page.tsx:60`).

**V2. ✦ Dark-only vs dark-default + light mirror on marketing.** Site ships a light theme toggle
(`layout.tsx` NO_FLASH, `data-theme`).

- A) Dark-only marketing (drop light on `apps/site`, keep light token set for dashboards) — maximum
  pro-tool/AI-infra signal; every Cluster-B/C winner is dark.
- B) Keep dark-default + light toggle — accessibility/preference breadth, but light marketing reads
  closer to compliance-SaaS (Vanta) and boilerplate (ShipFast).
- **REC: A for marketing surface** (medium) — evidence: helicone.ai / langfuse.com / portkey.ai /
  braintrust.dev / ollama.com / turso.tech all dark-first; light is the boilerplate/GRC tell. (ADR-0042
  keeps the light mirror as a token contract — this is a _marketing-surface_ choice, not a token change.)

**V3. The "show the product" slot with no product.** Competitors lead with dashboards; Caisson can't.

- A) Code/CLI artifacts only (current) — honest, evidence-forward.
- B) Add stylized "evidence" renders (signed evidence-pack JSON, audit-chain hash-break, CI badge,
  OWASP test output) — fills the visual slot with the specs/03 "nobody publishes test results, we do" gap.
- C) Schematic blueprint diagrams (engineering-drawing aesthetic, fits "caisson") — ownable, abstract.
- **REC: A + B**, with C as the section-break motif (high) — evidence: specs/03 §3 (publish test/OWASP
  results); compliance.tf "300+ controls" matrix; Braintrust trace UI flex.

**V4. Differentiation WITHOUT a comparison table.** ADR-0040 forbids the table MakerKit/Helicone lead with.

- A) A single "what we add" layer diagram (happy-path base → +RLS +WORM +audit chain) — shows the gap,
  no competitor named.
- B) A before/after "retrofit cost" panel (months-into-a-live-DB vs day-one) — the voice spec's unclaimed lane.
- C) Pure prose footnote only (current).
- **REC: A + B** (high) — evidence: ADR-0040 firewall (no comparison table); voice spec §6 retrofit-cost
  line; MakerKit/Helicone tables are exactly what to avoid (makerkit.dev/saas-starter-kit).

**V5. Iconography system.** Current: Unicode geometric glyphs (▣▤▥○).

- A) Keep Unicode glyphs — zero-asset, distinctive, but limited/janky cross-platform.
- B) Custom line-icon set (control/seal/lock/chain motifs) — ownable, craft cost.
- C) ✦ A "control/seal" icon language tied to the caisson metaphor (pressure/waterline/keystone).
- **REC: B**, evolving toward C in the brand-expansion ADR (medium) — evidence: glyph usage
  `page.tsx:14-27`; Cluster-B/C all use custom icon sets; Unicode glyphs are a scaffold tell.

**V6. Trust/credential strip (pre-launch).** No customers/logos.

- A) None until launch.
- B) A stat strip substitute — "SOC2 + HIPAA mappings · N frameworks · fail-closed by default · open-core
  AGPL flank" (compliance.tf "SOC2 Type II · 34 modules · 300+ controls" pattern).
- C) "Backed by / built by GridWork" + GitHub stars on the free flank.
- **REC: B + C** (high) — evidence: compliance.tf/docs ("SOC2 Type II Certified · 34 modules · 300+
  controls"); langfuse.com ("2,300+ companies"); litellm.ai ("Backed by YC", Netflix quote).

**V7. Per-page OG image system.** Current: one static OG (`opengraph-image.tsx`).

- A) Keep single OG.
- B) Per-page OG (home/compliance/ai-kit/local-first/pricing) via the satori route, each with the
  page H1 — better social CTR + per-edition share cards.
- **REC: B** (high) — evidence: MakerKit per-page OG metadata; single OG at `opengraph-image.tsx`;
  Next OG route supports per-segment images.

**V8. Edition-card visual hierarchy.** Current: 2-col grid, accent on Compliance, others equal.

- A) Keep equal-weight (clean, but under-heroes Compliance).
- B) Compliance as a full-width hero card + the other three as a subordinate row (ADR-0040 "compliance
  is the front door; others are 'same rigor, adjacent problem'").
- **REC: B** (medium) — evidence: ADR-0040 edition roles (hero/#2/flank/roadmap); current parity
  `page.tsx:30-52`.

**V9. Motion language.** Currently none.

- A) None (fast, calm).
- B) Micro-reveals on scroll + one signature interaction (audit-chain link "breaking" on hover; a
  "seal closing under load").
- **REC: B, restrained** (medium) — evidence: voice spec §7 "calm, dense"; Linear/Vercel subtle motion
  is the pro-tool norm; ShipFast's heavy animation is the anti-pattern.

### 5B. BRAND

**B1. ✦ Logomark introduction.** ADR-0041 locks lowercase wordmark + no icon-mascot; brand-expansion ADR
may add a _non-mascot_ mark.

- A) Stay wordmark-only (purest, matches Vercel/Resend wordmark restraint).
- B) Add a geometric **non-mascot mark** — a caisson/keystone/seal/cross-section glyph usable as
  favicon/app-icon/avatar (no face, no character → honors "no mascot").
- C) A monogram "C" in the engineered grotesk.
- **REC: B** (medium) — evidence: ADR-0041 ("no icon-mascot," lowercase mono wordmark); favicon/app-icon
  need a square mark a wordmark can't fill; Turso/Electric/Ollama all pair wordmark + abstract mark.
  **INDIVIDUAL.**

**B2. ✦ Wordmark + accent-bar device.** Current OG: "caisson" + a 64×4 accent bar.

- A) Lock the lowercase Martian-Mono-adjacent wordmark + accent-bar as the persistent lockup.
- B) Hubot Sans engineered-grotesk wordmark (more "designed," less terminal).
- C) Wordmark with the accent as an underline/waterline (ties the caisson metaphor).
- **REC: A, test C** (medium) — evidence: ADR-0041/0042 (mono-adjacent, dark); `opengraph-image.tsx`
  current lockup. **INDIVIDUAL.**

**B3. ✦ Caisson metaphor as a visual system.** Today the metaphor is purely verbal ("holds under load").

- A) Keep verbal-only (no literal water/depth imagery — risk of stock-photo cliché).
- B) An abstract engineering-drawing language (cross-sections, load arrows, waterline, pressure
  gradients) as section motifs + the illustration system.
- **REC: B, abstract/blueprint not literal** (medium) — evidence: ADR-0041 metaphor ("watertight
  foundation sunk under pressure, holds under load"); Turso/Electric use abstract metaphor systems;
  avoid literal harbor photography (voice spec §7 anti-stock). **INDIVIDUAL.**

**B4. ✦ Palette expansion — single accent vs per-edition coding.** ADR-0042 = one teal accent ≤10%.

- A) Single brand accent everywhere (max coherence; Helicone/Langfuse/Portkey each one-color).
- B) A reserved hue per edition (compliance teal / ai-kit / local-first / agentic) for wayfinding —
  widens recall but risks the "devtool rainbow."
- **REC: A, with at most a single muted secondary for the free AGPL flank** (medium) — evidence:
  ADR-0042 ("accent ≤10%, semantic-first"); Cluster-B winners are monochrome-plus-one; boilerplate is
  the rainbow tell. **INDIVIDUAL (brand-expansion).**

**B5. Codify the anti-boilerplate posture as brand law.** The core ADR-0040 ask.

- A) Implicit (rely on taste).
- B) An explicit "is / is not" brand-law block in the brand book banning the Cluster-A tells:
  strike-through prices, scarcity timers, emoji-bullets, "make $", revenue screenshots, gradient-hero,
  light marketing, exclamation hero.
- **REC: B** (high) — evidence: voice spec §7 already drafts "is not"; ShipFast/Supastarter scarcity +
  coupon tells (shipfa.st, supastarter.dev); ADR-0040 firewall.

**B6. ✦ Feature sub-brands (Attest / Provenance).** ADR-0041 names these as candidate evidence-pack
sub-brands.

- A) Plain feature names ("evidence pack," "audit chain") — no sub-brand overhead.
- B) Develop **Attest**/**Provenance** as named sub-brands with light lockups (reinforces the
  audit/evidence hero; both confirmed dead as company marks).
- **REC: A now, reserve B** (low) — evidence: ADR-0041 sub-brand note; sub-brands add surface a
  pre-launch solo product can't yet carry. **INDIVIDUAL.**

**B7. Creator-brand vs company-brand credibility.** ShipFast=Marc Lou, Bedrock=mxstbr (person);
Langfuse/Portkey=company.

- A) Pure product/company brand (Caisson / GridWork Digital).
- B) Lean on operator credibility ("built by the team behind [GridWork repos]") for trust.
- **REC: A primary, B as a thin credibility line** (medium) — evidence: bedrock.mxstbr.com
  (creator-led), langfuse.com (company-led); compliance buyers trust the _artifact_, not the maker
  (voice spec §3 "confidence through understatement").

### 5C. SEO

**S1. Primary head-term targets.** Where to compete.

- A) Compliance cluster — "SOC2 starter kit," "HIPAA SaaS boilerplate," "multi-tenant RLS,"
  "audit-ready SaaS," "compliance-grade infrastructure."
- B) Boilerplate cluster — "nextjs boilerplate" / "saas starter kit" (1.1K vol, $2.76 CPC) — high
  volume but Anti-ICP, owned by ShipFast/MakerKit, invites the $199 comparison.
- C) Both.
- **REC: A, deliberately cede most of B** (high) — evidence: ADR-0040 (compliance CPC 10–50× at low KD;
  SERP owned by Vanta/Drata not dev-kits → picks-and-shovels gap); dofollow.tools keyword data
  ("next.js saas boilerplate" 1.1K/$2.76 but ShipFast-owned + Anti-ICP).

**S2. Programmatic framework-pages surface.** compliance.tf ships one registry endpoint/page per
framework; the Compliance Updates SKU lists SOC2/HIPAA/EU-AI-Act/DORA/NIS2/state-privacy.

- A) Single compliance page.
- B) A page **per framework** (`/compliance/soc2`, `/hipaa`, `/eu-ai-act`, `/dora`, `/nis2`) — each an
  SEO landing mapping the framework to Caisson controls; mirrors the Compliance Updates product + the
  internal-link mesh.
- **REC: B** (high) — evidence: compliance.tf/docs (per-framework registry endpoints + "find my
  framework"); MakerKit hub-and-spoke feature pages; pricing page already lists the 6 frameworks
  (`pricing/page.tsx` SUBSCRIPTIONS).

**S3. "vs / alternative" pages — and against whom.** Helicone "vs LangSmith" ranks; ADR-0040 forbids
racing ShipFast.

- A) No comparison pages (purest firewall).
- B) "Build vs buy" / "Caisson vs retrofitting" pages (no competitor named) — captures intent without
  a $199 race.
- C) "vs Vanta/Drata" (build-the-controls vs buy-the-GRC) — different category, defensible.
- **REC: B, cautiously C** (medium) — evidence: helicone.ai comparison/alternative SEO; ADR-0040
  (generic base never a comparison table — but build-vs-buy framing is allowed); compliance.tf positions
  _alongside_ Vanta/Drata, not against ShipFast.

**S4. Structured-data depth.** Current: `SoftwareApplication` + `PreOrder` only.

- A) Keep minimal.
- B) Add `Organization` (GridWork), `FAQPage` (compliance Q&A → SERP feature capture),
  `BreadcrumbList`, and per-edition `SoftwareApplication`.
- **REC: B** (high) — evidence: `(marketing)/layout.tsx:6` (only SoftwareApplication); Langfuse/MakerKit
  FAQ-rich pages; FAQ schema is the cheapest SERP-feature win for a compliance Q&A surface.

**S5. AI-discoverability (llms.txt) depth.** Caisson already ships `llms.txt` + `llms-full.txt`.

- A) Keep the Fumadocs docs index (current).
- B) Extend `llms.txt` with the compliance claims + framework mappings + the SKU structure (agent-readable
  positioning), matching Braintrust/Turso/Traceloop/LM Studio who all expose curated llms.txt.
- **REC: B** (high) — evidence: `app/llms.txt/route.ts` (currently docs-only); braintrust.dev/docs/llms.txt,
  docs.turso.tech/llms.txt, traceloop docs llms.txt, lmstudio.ai llms-full.txt.

**S6. Concept/explainer docs as top-of-funnel SEO.** Turso "What is Turso," Langfuse handbook, Helicone
`llm-cost` rank via docs.

- A) Docs = setup guides only.
- B) Add concept pages — "What is fail-closed RLS," "SOC2 evidence pack," "WORM / S3 Object-Lock,"
  "append-only audit chain" — each an SEO landing + glossary node that internal-links to the editions.
- **REC: B** (high) — evidence: turso.tech/what-is-turso, langfuse.com/handbook; specs/03 §3 (docs as
  the setup-guide spine + AI-native).

**S7. Core Web Vitals / technical hardening (static CF Pages).** Gaps observed.

- A) Ship as-is.
- B) Fix: `next/font` self-host (drop render-blocking Google Fonts stylesheet in `layout.tsx`), add
  `<link rel=canonical>`, confirm per-route OG, audit LCP/CLS, keep Plausible deferred (already is).
- **REC: B** (high) — evidence: `layout.tsx` loads `fonts.googleapis.com` stylesheet render-blocking
  (LCP risk); ADR-0045 (static export, images unoptimized); CWV is a compliance-credibility signal.

**S8. Title/meta templates per edition page.** Home titles are strong; edition pages need keyword-bearing titles.

- A) Generic ("AI Production Kit · Caisson").
- B) Keyword-bearing ("AI Production Kit — token metering, spend caps, eval-in-CI · Caisson";
  "HIPAA & SOC2 infrastructure — fail-closed RLS, WORM, audit chain · Caisson").
- **REC: B** (medium) — evidence: home metadata pattern (`page.tsx:5`); MakerKit keyword-bearing
  page titles ("Next.js SaaS Boilerplate | Customizable Foundation").

### 5D. COPY

**C1. Hero claim + proof pairing.** Locked H1 "Fail-closed by construction." (not relitigated).

- A) H1 + lede + code block (current).
- B) Add a sub-proof figure beside the H1 (Vercel "claim + stat" pattern) using the retrofit-cost figure
  (no customer needed) — "SOC2 from scratch: $80k, 6–9 months. Retrofit into a live DB: months more."
- **REC: B** (high) — evidence: voice spec §5 ("Proof shown not asserted; Vercel pairs every claim
  with a stat") + §6 retrofit-cost line; current hero has no figure (`page.tsx:60`).

**C2. AI-Kit edition hero copy.** Must read "same rigor, AI infra," lead with the failure.

- A) Generic "production-rigor layer" (current edition line).
- B) Lead with the specific spike — pick one: token-bill spike / silent eval regression / missing
  guardrail — mirroring Braintrust ("AI drifts and regresses silently") and Portkey ("mitigate critical
  errors at scale").
- **REC: B, lead with the token-bill spike + eval regression** (high) — evidence: voice spec §9 (AI-Kit
  = rigor+control, name the spike); braintrust.dev / portkey.ai positioning; current line is generic
  (`page.tsx:38`).

**C3. Local-first / AGPL flank copy.** Adopt the proven sovereignty sentences.

- A) Keep as an edition card line.
- B) Make "**Your data never leaves the device**" the page hero + "free, forever, AGPL · run entirely
  offline" + a GitHub CTA, mirroring Ollama/LM Studio.
- **REC: B** (high) — evidence: ollama.com ("your data stays yours · run entirely offline"),
  lmstudio.ai ("nothing leaves your device"); current copy buries it (`page.tsx:48`); ADR-0040 (flank =
  top-of-funnel awareness, open-core ladder).

**C4. CTA verbs.** Current: "Request early access" / "Read the docs."

- A) Keep.
- B) Dual ladder — compliance hero → "Request early access" (waitlist); free flank → "Get it on GitHub";
  enterprise → (later) "Talk to us." Mirrors the open-core CTA split.
- C) Benefit-verb — "Get audit-ready" / "Start fail-closed."
- **REC: B for structure, test C on the hero** (medium) — evidence: turso.tech / langfuse.com
  ("Start for free" + "View on GitHub" dual CTA); portkey.ai ("Book a demo"); current single waitlist CTA
  (`page.tsx`).

**C5. Pricing-deferral framing.** ADR-0048: structure, no numbers. Risk: looks unfinished next to
number-grids.

- A) Keep "Early access — join the waitlist" (current).
- B) Add a one-line _why_ — "Pricing locks with the first invite; we won't print a number we'd change"
  — framing the deferral as deliberate/honest (ties the "flag, never guess" voice principle).
- **REC: B** (high) — evidence: ADR-0048 (deferred deliberately); voice spec §6 ("flag, never guess");
  every competitor shows numbers (helicone.ai, langfuse.com, turso.tech) → the absence must read intentional.

**C6. Own-vs-subscribe legibility.** Boilerplate = "pay once, lifetime updates"; SaaS = subscription.
Caisson splits _ownership_ from _updates_.

- A) Keep "Own the code, or subscribe." (current, good).
- B) Sharpen the _why-subscribe-if-you-own-it_ — "You own the code. Regulations don't hold still —
  Compliance Updates keeps the control mappings current." (the strongest recurring lever, ADR-0040).
- **REC: A + B** (high) — evidence: `pricing/page.tsx` ("Own the code, or subscribe"); ADR-0040
  (compliance-update subscription = single strongest recurring lever); boilerplate "lifetime updates"
  conflates the two (shipfa.st, makerkit.dev).

**C7. The anti-boilerplate contrast line.** compliance.tf owns "smoke detector vs fireproof
construction." ADR-0040 firewall: the $199 contrast appears once, as a footnote.

- A) Keep the single footnote "a better base than the $199 kits" (current `pricing/page.tsx`).
- B) Add ONE Caisson-owned structural analogy at the app tier (e.g., "A starter kit gets you a login
  screen. It doesn't get you through an audit." — already in `page.tsx` umbrella) — keep it once, never a table.
- **REC: A + B, both already present — lock them, add no more** (high) — evidence: voice spec §8
  (compliance.tf analogy adapted "at our tier"); ADR-0040 firewall (once, never a table); compliance.tf/
  ("a scanner is a smoke detector; compliance.tf is fireproof construction").

**C8. Credibility stat strip copy (logo substitute).** No customers.

- A) None.
- B) A claim strip — "Fail-closed by default · SOC2 + HIPAA mappings · append-only audit chain ·
  open-core AGPL flank · OWASP results published" — substituting verifiable artifacts for logos.
- **REC: B** (high) — evidence: compliance.tf "SOC2 Type II · 34 modules · 300+ controls"; specs/03 §3
  ("nobody publishes test results; Caisson does"); pre-launch = no logos to show.

**C9. Owned-vocabulary glossary + ban list.** Consistency across home/4 editions/pricing/docs.

- A) Rely on the voice spec banned-words list (exists).
- B) Add an _owned-term_ glossary — "fail-closed," "load-bearing," "audit-ready," "evidence pack,"
  "holds under load" — used consistently; ban competitor-coded terms ("scanner," "detective control,"
  "lifetime updates," "make $") except in explicit contrast.
- **REC: B** (medium) — evidence: voice spec §4 (banned list) + §7 (brand adjectives); compliance.tf
  "detective vs preventive control" is _their_ frame — Caisson should not borrow it un-attributed.

**C10. Section sequencing — compliance-hero vs umbrella-first.** Home leads compliance, then umbrella.

- A) Compliance-hero → umbrella (current).
- B) Umbrella-first → compliance wedge.
- **REC: A (keep)** (high) — evidence: ADR-0040 (compliance is the front door, umbrella is the house it
  opens into — _lead_ with the wedge); current order is correct (`page.tsx:60` hero → umbrella section).

---

## 6. Gaps / not covered (hand-off to sibling research agents)

- **Refero visual references** (real compliance-SaaS / dev-tool screens, brand systems, pricing-page
  layouts) — assigned to the refero-reference agent; this teardown is exa/web-only.
- **Vanta / Drata / Sprinto** GRC-platform visual + SERP teardown — named by ADR-0040 as the SERP
  owners but out of this dispatch's dev-tool/AI-infra/local-first scope; recommend a dedicated pull
  (they define the "finished platform" look Caisson must read _adjacent to, not as_).
- **tessera** (the harvestable "Pigment" design seed, specs/03 §1) — internal repo, not a public
  competitor; design-system reference, not a teardown target.
- **Impeccable craft audit** of the rendered `apps/site` — separate detector pass (kickoff Phase RESEARCH).
- **Exact CWV numbers** (LCP/CLS/INP) require a Lighthouse run against a built preview — flagged in S7,
  not measured here.
