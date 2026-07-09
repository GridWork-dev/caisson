# Current-State COPY Audit — Caisson marketing site

**Session:** Design · Brand · SEO · Copy scope (`design/brand-site-seo`)
**Surface:** COPY (with seo/brand crossover flagged per-fork)
**Scope audited:** 6 marketing pages + `site-nav` · `site-footer` · `waitlist-form` · `app/layout` (metadata) · `(marketing)/layout` (JSON-LD) · `opengraph-image`
**Graded against:** `specs/04-voice-and-brand.md` (voice floor) · ADR-0040 (positioning) · ADR-0041 (name) · ADR-0048 (no hard prices)
**Date:** 2026-06-27

---

## 0. Verdict / scorecard

The copy is **already disciplined and well above SaaS baseline.** Zero literal banned-word hits across every page (`grep` of the full banned list — clean). Evidence-over-adjectives is genuinely practiced: **every** section pairs its claim with a real terminal transcript, policy, or config block, not a stock illustration. The compliance page cites named controls + clauses (SOC 2 CC6.1, HIPAA §164.312(a)(1)/(c)(1)/(b), CC7.2) — exactly the spec §3/§9 ask. The generic-base footnote appears **exactly once** (pricing:357), never as a table — ADR-0048 compliant. Per-edition voice is correctly differentiated (compliance=trust+evidence; ai-kit=rigor/control, never "AI-powered"; local-first=sovereignty; agentic=governance).

**Where it falls short of its own spec** is the _human and figure_ layer of proof, not the artifact layer:

| Dimension                                     | State                                | Gap                                              |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Banned words                                  | ✅ clean                             | —                                                |
| Artifact proof (code/transcript)              | ✅ strong, every section             | borderline monotonous (proof-fatigue)            |
| Control + clause citation                     | ✅ compliance page                   | ❌ absent on home evidence cards                 |
| **Retrofit-cost FIGURES** (`$80k · 6–9 mo`)   | ❌ asserts "months" only             | spec §8 models the figure version                |
| **CI badge / green-checks** (ADR-0016 6 jobs) | ❌ none                              | spec §3 names "the CI badge" explicitly          |
| **Named-engineer / founder social proof**     | ❌ none                              | spec §5 names it as the cadence                  |
| Hero ≤7-word cadence                          | ⚠️ AI-kit H1 = 8 words               | over the line                                    |
| Section headers = terse noun-phrases (§5)     | ⚠️ mostly full sentences             | eyebrows carry the terse label (2-tier)          |
| "[future]. Available today." closer           | ❌ unused                            | pre-launch tension (honest to omit)              |
| Local-first availability framing              | ⚠️ self-contradictory                | "fork it today / star on GitHub" + waitlist gate |
| Agentic-dev hero CTA                          | ❌ missing                           | only page with no hero button                    |
| Terminology consistency                       | ⚠️ "Local-first" vs "Local-first AI" | nav vs pages/footer                              |

**Bottom line:** the copy nails _artifact_ evidence and avoids slop. The unclaimed wins are (1) the retrofit-cost math line with real figures, (2) a CI-status proof strip, (3) a pre-launch social-proof strategy, and (4) resolving the local-first "free-now vs waitlist" contradiction. These are the highest-leverage copy upgrades.

---

## 1. Competitive grounding (evidence base for the forks)

| Reference                              | What they do (verified)                                                                                                                                                                                                                       | Implication for Caisson                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Resend** (resend.com/home)           | Hero _is_ the API-call code block. Social proof = named senior engineers w/ title + craft quote (Guillermo Rauch "CEO at Vercel / Creator of Next.js"; "Node.js TSC member"; "VP Dev Education at Cursor"). No star ratings.                  | Caisson already leads with code blocks ✅. Missing the named-engineer layer ❌.                                                                                                                  |
| **Vercel** (saaspattern.com breakdown) | Pairs every claim with a **time-based figure** ("build times 7m→40s", "95% reduction"); **dual CTA** mapping two intents ("Start Deploying" self-serve / "Get a Demo" enterprise); dated developer-real detail ("Top models on Mar 2, 2026"). | Validates the dual-CTA pattern Caisson uses; validates showing **figures** — which Caisson omits on the retrofit line.                                                                           |
| **Vanta** (vanta.com)                  | "Audit prep with ease, no spreadsheets"; "Proof? We've got proof"; "1,200+ tests hourly, no screenshots". Platform that monitors _on top of_ your stack. Uses "unlock/leverage" freely.                                                       | Caisson's differentiator: it ships the controls _in_ the stack (prevention at the app layer) vs Vanta's monitoring layer. Sharpen this contrast — it's the picks-and-shovels gap ADR-0040 names. |
| **Drata** (drata.com)                  | "Map once, reuse everywhere, continuously audit-ready"; named-customer stat "reduced SOC 2 audit duration by 75%".                                                                                                                            | Confirms the named-customer-stat pattern. Caisson has none (pre-launch) → pre-launch social-proof fork.                                                                                          |

The compliance incumbents (Vanta/Drata) own the "finished-platform" SERP and write in GRC-buyer voice (continuous monitoring, evidence collection, "no spreadsheets"). Caisson's copy correctly speaks **engineer-peer**, not GRC-buyer — the right wedge. The single sharpest unclaimed line is the **smoke-detector vs construction** contrast (spec §8, from compliance.tf) which the copy gestures at ("Prevention at the application layer") but never states as a memorable one-liner.

---

## 2. Per-page deep audit

### 2.1 Home — `app/(marketing)/page.tsx`

**Strengths:** Hero is the locked H1 + locked subhead, verbatim ✅. The hero `<pre>` (page.tsx:105) shows a real RLS denial — best possible proof element. Named enemy section ("happy-path starter kits get you a login screen… do not get you through an audit") is exactly spec §2. Editions grid correctly heroes Compliance (accent card) and footnotes the others.

**Findings:**

- **H-1 (proof, high):** The three evidence cards (EVIDENCE, page.tsx:12–28) describe RLS/WORM/audit-chain but carry **no control+clause tag** — the compliance page does this well (`g.proves`), home does not. A one-line `SOC 2 CC6.1 · HIPAA §164.312(a)(1)` tag under each card would carry the clause-citation proof up to the front door.
- **H-2 (proof, high):** No CI-status strip anywhere on the page. ADR-0016 ships 6 required green jobs (build·lint·unit·integration·standards-gate·golden-file). Spec §3 explicitly lists "the CI badge" as a hero-class proof element. A `6/6 checks green` row near the hero or evidence section is the single most on-voice missing asset.
- **H-3 (copy, med):** The "How it's sold" footnote (page.tsx:236–243) front-loads **EU AI Act Annex IV** — a deep compliance-edition detail — on the umbrella-level home page. Reads as out-of-altitude; the EU AI Act belongs on /compliance and /pricing (where it already lives). Recommend cutting it from home, leaving only the "pricing set at early access → see the full lineup" link.
- **H-4 (copy, med):** The retrofit line ("costs months. Start with them.") appears here (page.tsx:124) **verbatim** identical to /compliance:268. Cross-page verbatim repetition. Differentiate: home = umbrella framing; compliance = the figure-bearing version (see C-1).
- **H-5 (copy, low):** Hero eyebrow (page.tsx:63) = the full tagline "Compliance-grade infrastructure for regulated SaaS" — and /compliance uses the **same** eyebrow. Two pages, identical hero eyebrow. The eyebrow should be a section/page label, not a repeat of the persistent tagline (which already lives in nav/footer/OG).

### 2.2 Compliance — `app/(marketing)/compliance/page.tsx`

**Strengths:** The best page on the site. Three guarantees each with a runnable artifact + a `proves:` control/clause map (CC6.1, §164.312(a)(1), §164.312(c)(1), CC7.2, §164.312(b)) — textbook spec §9 compliance voice. Field-crypto HKDF block and evidence-pack generator transcript are concrete and exact. The retrofit callout is the accented "why now" beat.

**Findings:**

- **C-1 (proof, HIGH — top pick):** The retrofit callout (compliance:268) asserts "costs months. Start with them." but **shows no figure.** The voice spec's own §8 "Do" example models the ideal: *"SOC 2 from scratch: $80k, 6–9 months. RLS+WORM+audit-chain retrofit into a live DB: months more. Both, wired on day one."* This is Caisson's **unclaimed lane** (spec §6: "no competitor prices the live-DB rip-out"). Adding the `$80k · 6–9 months` figures converts the strongest section from assertion → evidence. Highest-value single copy edit on the site.
- **C-2 (copy, med):** Two section H2s exceed the terse-header guidance and run as full sentences with em-dashes: "Prevention at the application layer — with the receipts." (8 words) and "Map a framework to the running system — not a spreadsheet." (10). Per spec §5 section headers should be terse noun-phrases; the eyebrows already carry the label. (See cross-cutting X-1.)
- **C-3 (copy, low):** "with the receipts" is the one slightly-casual register slip on an otherwise exact page — borderline for the "calm/exact" adjective set. Low-stakes; defensible as engineer-peer voice.
- **C-4 (proof, med):** The evidence-pack transcript names SOC 2 controls but the page never states the **smoke-detector vs construction** one-liner (spec §8 "Do": "A scanner is a smoke detector. Caisson is the fail-closed construction."). This is the sharpest available differentiator vs Vanta/Drata's monitoring layer and is currently unstated.
- **C-5 (copy, low):** Waitlist closer "Start fail-closed." (2 words) — strong, on-voice ✅.

### 2.3 AI Production Kit — `app/(marketing)/ai-kit/page.tsx`

**Strengths:** Correctly leads with the capped spike, never "AI-powered" (spec §9). The hero `caisson ai spend --watch` transcript showing `BREAKER OPEN → HTTP 402` is the strongest single proof block on the site after compliance. The `caisson.ai.toml` config block backs the claims with checked-in policy.

**Findings:**

- **A-1 (copy, HIGH — cadence violation):** Hero H1 "The spike hits a cap, not your invoice." is **8 words** — over the spec §5 ≤7-word hero rule. It's a _good_ line but breaks the locked cadence. Tighten to ≤7, e.g. "Your spike hits a cap, not your invoice." is still 8; "The spike hits a cap." (5) / "A cap, not an invoice." (5) / "Spikes hit a cap, not your bill." (7). individual=true (hero-adjacent).
- **A-2 (copy, med):** Three section H2s are full sentences over 7 words ("Cheap AI boilerplate ships the demo, not the controls." 9; "Six controls between your model and an incident." 8; "Every claim here is a control you can point at." 10). Same X-1 pattern.
- **A-3 (proof, med):** The eval-gate is described ("a score drop past tolerance fails the check") but no **CI check artifact** is shown (a red PR check, `eval gate FAILED: score 0.71 < 0.73 tolerance`). The kit's whole pitch is "tested in CI" — show the failing check, per spec §3.
- **A-4 (copy, low):** "Six controls between your model and an incident" — but the MODULES array has **6** entries ✅ (metering, caps+breaker, eval, registry, guardrails, agent-setup). Count is honest. Keep.

### 2.4 Local-first AI — `app/(marketing)/local-first/page.tsx`

**Strengths:** Locked H1 "Your data never leaves the device." (spec §9) ✅. `caisson where-compute → egress none · 0 outbound connections` is a perfect sovereignty proof. AGPL license-metadata block is concrete. Correctly leads with GitHub + docs CTAs (the free flank), not a paid push.

**Findings:**

- **L-1 (copy, HIGH — internal contradiction):** The page frames local-first as **available now and free** ("read it, fork it, run it air-gapped", "Star on GitHub", AGPL-3.0 "free · forever") — yet the bottom waitlist section says "**Run it before anyone else.** Join the early-access list. We'll reach out as the local-first flank opens." If it's AGPL-on-GitHub today, there is nothing to wait for; if it's _not_ live yet, "fork it / star on GitHub" writes a check the repo can't cash. This violates voice principle §6 (trustworthy claims / flag-never-guess). **Decide:** is the AGPL flank live now (→ kill the waitlist on this page, lead 100% to GitHub) or still pre-release (→ soften "fork it today" to "AGPL at launch")? High-value coherence fix.
- **L-2 (copy, med):** Both CTAs ("Read the docs" → /docs/local-first, "Star on GitHub" → repo) depend on those targets existing. If the repo is private / docs are stubs, the CTAs are dead. Confirm targets before launch (honesty).
- **L-3 (copy, low):** "Five pieces, all on the device." (6) — good terse-ish header ✅. The PIECES array has 5 entries ✅, count honest.
- **L-4 (brand/visual, low):** Glyph ▣ here = "Compute seam"; on home ▣ = "Fail-closed RLS"; on ai-kit ▣ = "Eval harness". The geometric glyphs are **semantically arbitrary** and reused with different meanings across pages — they read as decoration, not a system. (See X-3.)

### 2.5 Agentic-Dev — `app/(marketing)/agentic-dev/page.tsx`

**Strengths:** Correctly framed as roadmap/post-wedge with a status pill, not co-heroed (ADR-0040). "A governed kernel, not autonomous magic." is exactly spec §9. The typed-agent YAML and dispatch blocks are strong governance artifacts.

**Findings:**

- **G-1 (copy, HIGH):** The hero is the **only page with no CTA buttons** — status pill + H1 + subhead + code block, then nothing actionable until the footer waitlist. Every other hero has primary+secondary buttons. Add at least one ("Join the list" / "Read the architecture"). Conversion + consistency gap.
- **G-2 (copy, med):** H1 "A governed-agent kernel." (3 words) is a clean noun-phrase but **descriptive, not magnetic** — it states the category without a hook. Alternatives that keep the governance voice: "Agents that can't deploy themselves." / "The agent boundary, written down." / "Governed agents, not autonomous magic." individual=true (hero-adjacent).
- **G-3 (copy, low):** Subhead "The boundary is written down, not assumed." — strong closer line, on-voice ✅.

### 2.6 Pricing — `app/(marketing)/pricing/page.tsx`

**Strengths:** ADR-0048-perfect: shows SKU _structure_, zero numbers, every slot reads "Early access — join the waitlist." The `caisson entitlements` transcript is a clever way to show structure as a real entitlement set. The generic-base footnote ("better base than the $199 kits") lands here, exactly once. Subscription audience lines ("For the team that has to pass the audit again next year.") are sharp.

**Findings:**

- **P-1 (copy, med):** The generic-base footnote (pricing:357) is the **ICP buyer-firewall line** (ADR-0040). It currently lives only on /pricing — but the anti-ICP ("just want a starter kit" buyer) is most likely to bounce off the **home** hero, not reach pricing. Fork on placement: pricing (current) vs home vs a deliberate one-shot on whichever page the anti-ICP first hits. (ADR-0048 says "once, as a footnote" — placement is open.)
- **P-2 (copy, low):** "Four ways to buy. No lock-in." (6) — strong ✅. "Numbers land with the invite." (5) waitlist header — excellent, honest about deferred pricing ✅.
- **P-3 (seo/copy, low):** The EU AI Act add-on section copy ("The Act binds the buyer's regulator, not the buyer's geography, so it sells everywhere") is precise and on-message (ADR-0040). Keep.
- **P-4 (copy, low):** `EarlyAccess()` glyph is `○` here but `◷` on compliance SKUs and `◷` on agentic — three different "pending" glyphs for the same state. Minor inconsistency (see X-3).

### 2.7 Nav / Footer / Waitlist / Layout / OG

- **N-1 (copy, med — terminology):** Nav label is "**Local-first**" (site-nav.tsx:11); footer and all pages say "**Local-first AI**" (5×). Pick one. Recommend "Local-first" in nav (space) but the canonical edition name is "Local-first AI" — align footer/nav or accept nav-shorthand explicitly.
- **N-2 (copy, low):** Nav omits **Agentic-Dev** (only Compliance/AI-Kit/Local-first/Pricing/Docs) while the footer includes it. Defensible (roadmap edition, de-emphasized) but worth a deliberate decision, not an accident.
- **F-1 (copy, low):** Footer tagline repeats the persistent tagline verbatim — correct (footer is the right home for it).
- **W-1 (microcopy, med):** Waitlist success "You're on the early-access list. We'll be in touch." — generic. Could be edition-specific via the `source` prop already passed ("We'll email when the Compliance edition opens."). Higher-signal, uses data already in hand.
- **W-2 (microcopy, low):** Error "Something went wrong. Try again in a moment." — fine, calm, on-voice ✅.
- **W-3 (microcopy, low):** Placeholder "you@company.com" signals B2B work-email (correct for ICP-1) ✅. Hidden label "Work email" ✅.
- **W-4 (microcopy, low):** Button "Request early access" / loading "Joining…" — consistent with hero CTAs ✅.
- **OG-1 (seo/copy, low):** OG image copy = "Fail-closed by construction." + "Fail-closed RLS · S3 WORM · append-only audit chain" + "caisson.sh" — on-brand, terse ✅. OG `description` in layout = just "Fail-closed by construction." (the hero), which is punchy but thin for social unfurl; consider the fuller subhead for link-preview context.
- **M-1 (seo/copy, med):** Home `<title>` resolves to "Compliance-grade infrastructure for regulated SaaS · Caisson" (keyword-first, brand-last via template). Brand-first vs keyword-first is an SEO-copy fork (keyword-first is generally better for a new domain; current choice is defensible).
- **M-2 (seo/copy, low):** Per-page meta descriptions are strong and specific (each names the concrete controls). No generic boilerplate. Keep.
- **JL-1 (seo/copy, low):** JSON-LD `offers.availability = PreOrder` correctly signals pre-launch with no price (ADR-0048-coherent) ✅.

---

## 3. Cross-cutting findings

- **X-1 (copy, med):** **Section headers are full sentences, not terse noun-phrases** (spec §5: "verbs or terse noun-phrases (Intake / Plan / Build), never marketing sentences"). The site runs a 2-tier pattern instead: eyebrow = terse label ("The umbrella", "What ships in the box", "The three guarantees") + H2 = full sentence. This is a defensible deviation (the eyebrow _is_ the terse header) but it's a deviation from the literal spec, applied site-wide. Decide: ratify the 2-tier pattern in spec §5, or tighten H2s toward noun-phrases.
- **X-2 (copy, med):** **The "[future]. Available today." closer signature (spec §5/§6) is unused** on every page. Correct for a pre-launch site (claiming "available today" would be dishonest), but it leaves the spec's signature beat unrealized. Decide: adapt the closer for pre-launch ("Fail-closed by construction. Shipping to early access.") or formally defer the signature to GA.
- **X-3 (brand/visual, med):** **The geometric glyph set (▣▤▥▦▧⊘◷○) is semantically arbitrary** — the same glyph carries different meanings on different pages, and the "pending" state uses ◷/○ inconsistently. They read as texture, not a system. Either assign stable glyph→concept mappings (one icon per concept across pages) or treat them as pure decoration and stop implying meaning. (Brand surface — flag for the iconography ADR.)
- **X-4 (proof, med):** **Proof-fatigue risk** — _every_ section on _every_ page ends in a `<pre>` code block. Density is on-brand ("dense" adjective) but the monotony flattens hierarchy: when everything is a terminal transcript, none stands out. Consider varying proof types (a CI badge strip, a control-map table, the retrofit-figure callout, one named quote) so the artifacts don't blur. This is the copy-side of a visual-hierarchy concern.
- **X-5 (copy, low):** **CTA verb consistency** — "Request early access" (hero/waitlist) vs "join the early-access list" (subheads) vs "join the waitlist" (SKU slots). Three phrasings for one action. Standardize the verb (recommend "Request early access" as the button, "join the early-access list" as prose — already mostly consistent; the SKU "join the waitlist" is the odd one).

---

## 4. The fork board (decision table)

Confidence + evidence per the one-operator rule. `surface ∈ {copy, brand, seo, visual}`. `ind` = present individually (hero/name/brand-expansion-adjacent).

| #   | Surface | Fork                                                                                                        | Recommendation                                                             | Conf | Evidence                                 | ind |
| --- | ------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---- | ---------------------------------------- | --- |
| F1  | copy    | Retrofit callout: assert "months" vs **show `$80k · 6–9 mo` figures**                                       | Add figures (spec §8 ideal)                                                | high | spec/04 §8 Do; compliance:268            | –   |
| F2  | copy    | Add a **CI green-checks proof strip** (ADR-0016 6 jobs)?                                                    | Add near hero/evidence                                                     | high | spec/04 §3 "CI badge"; ADR-0016          | –   |
| F3  | copy    | **Pre-launch social-proof** strategy (none / founder-voice / design-partner / "built by the team behind X") | Founder/engineer attributed note now; design-partner quotes at beta        | med  | spec/04 §5; resend.com named-eng pattern | –   |
| F4  | copy    | AI-kit H1 = 8 words (over ≤7)                                                                               | Tighten to ≤7                                                              | high | spec/04 §5; ai-kit:72                    | ✅  |
| F5  | copy    | Local-first **free-now vs waitlist contradiction**                                                          | Pick one: live→GitHub-led, no waitlist; or pre-release→soften "fork today" | high | local-first:75–86 vs 214–219; spec §6    | –   |
| F6  | copy    | Agentic-dev hero has **no CTA**                                                                             | Add primary CTA                                                            | high | agentic-dev:37–80                        | –   |
| F7  | copy    | Home evidence cards lack **control+clause tags**                                                            | Add `CC6.1 · §164.312` tags                                                | high | home:12–28 vs compliance `proves`        | –   |
| F8  | copy    | State the **smoke-detector vs construction** one-liner                                                      | Add to /compliance                                                         | med  | spec/04 §8 Do                            | –   |
| F9  | copy    | Section headers: full sentences vs **terse noun-phrases**                                                   | Ratify 2-tier (eyebrow=label) in spec §5                                   | med  | spec/04 §5; site-wide                    | –   |
| F10 | copy    | "[future]. Available today." closer unused                                                                  | Adapt for pre-launch or defer to GA                                        | med  | spec/04 §5/§6                            | –   |
| F11 | copy    | **Terminology** "Local-first" (nav) vs "Local-first AI"                                                     | Align to "Local-first AI" (or ratify nav shorthand)                        | high | site-nav:11 vs footer/pages              | –   |
| F12 | copy    | Retrofit line **duplicated verbatim** home+compliance                                                       | Differentiate (home=umbrella, compliance=figures)                          | med  | home:124 == compliance:268               | –   |
| F13 | copy    | Hero **eyebrow = tagline** repeated home+compliance                                                         | Differentiate eyebrows (page label, not tagline)                           | low  | home:63, compliance:88                   | –   |
| F14 | copy    | Generic-base footnote **placement** (pricing vs home)                                                       | Keep on pricing; A/B a home one-shot                                       | med  | pricing:357; ADR-0048                    | –   |
| F15 | copy    | Home "How it's sold" footnote front-loads **EU AI Act**                                                     | Cut from home (umbrella altitude)                                          | med  | home:236–243                             | –   |
| F16 | copy    | AI-kit: show a **failing CI eval check** artifact                                                           | Add red-check transcript                                                   | med  | ai-kit eval claim; spec §3               | –   |
| F17 | copy    | Waitlist **success** message generic                                                                        | Make edition-specific via `source`                                         | med  | waitlist-form:39–45                      | –   |
| F18 | copy    | Primary **CTA verb** consistency (3 phrasings)                                                              | Standardize button="Request early access"                                  | med  | X-5; SKU "join the waitlist"             | –   |
| F19 | copy    | **Proof-fatigue**: every section ends in a `<pre>`                                                          | Vary proof types for hierarchy                                             | med  | X-4; all pages                           | –   |
| F20 | copy    | Compliance H1 alternate ("Audit-ready from the first commit") — keep vs swap                                | Keep (approved alternate, spec §6)                                         | med  | spec/04 §6; compliance:101               | ✅  |
| F21 | copy    | Agentic-dev H1 "A governed-agent kernel" descriptive not magnetic                                           | Sharpen toward governance hook                                             | med  | agentic-dev:57; spec §9                  | ✅  |
| F22 | copy    | Pricing H1 "Own the code, or subscribe."                                                                    | Keep (clear, on-voice)                                                     | high | pricing:178                              | ✅  |
| F23 | copy    | Home umbrella H2 "load-bearing infrastructure cheap boilerplates skip"                                      | Keep (spec §1 verbatim)                                                    | high | spec/04 §1; home:117                     | –   |
| F24 | brand   | Glyph set **semantically arbitrary** across pages                                                           | Stable glyph→concept map, or pure decoration                               | med  | X-3; all pages                           | –   |
| F25 | brand   | "Pending" glyph ◷ vs ○ inconsistent for same state                                                          | Pick one                                                                   | low  | pricing:115 (○) vs compliance:307 (◷)    | –   |
| F26 | seo     | Home `<title>` **keyword-first vs brand-first**                                                             | Keep keyword-first (new domain)                                            | med  | layout template; home:7                  | –   |
| F27 | seo     | OG `description` = bare "Fail-closed by construction."                                                      | Add fuller subhead for unfurl context                                      | low  | layout:25                                | –   |
| F28 | copy    | Nav **omits Agentic-Dev** (footer includes)                                                                 | Ratify as deliberate de-emphasis                                           | low  | site-nav:8–14; footer                    | –   |
| F29 | copy    | Local-first CTA targets (docs/repo) must exist at launch                                                    | Verify before launch (honesty)                                             | med  | local-first:75,79; spec §6               | –   |
| F30 | copy    | "with the receipts" register slip on exact page                                                             | Keep (engineer-peer) or tighten                                            | low  | compliance:143                           | –   |
| F31 | copy    | Vanta/Drata contrast (monitoring-layer vs **app-layer prevention**) understated                             | Sharpen the picks-and-shovels contrast                                     | med  | ADR-0040; vanta.com/drata.com            | –   |
| F32 | copy    | Dual-CTA secondary "Read the docs" — same on every page                                                     | Vary by intent (e.g. "See the architecture")                               | low  | Vercel dual-CTA pattern                  | –   |

---

## 5. Proof-element gap analysis (the spec §3 "show, don't assert" checklist)

| Proof type spec §3 names              | Present?    | Where / gap                                  |
| ------------------------------------- | ----------- | -------------------------------------------- |
| Code snippet / terminal transcript    | ✅ abundant | every section — strongest asset              |
| RLS test (cross-tenant isolation)     | ✅          | compliance RLS block + hero denial           |
| Audit artifact (signed evidence pack) | ✅          | compliance evidence-pack transcript          |
| **CI badge**                          | ❌          | **nowhere** — F2 (highest-value missing)     |
| **$ / weeks figure**                  | ❌          | retrofit says "months", no `$80k/6–9mo` — F1 |
| Control + clause citation             | ◑ partial   | compliance ✅; home ❌ — F7                  |
| Named senior-engineer quote           | ❌          | nowhere (pre-launch) — F3                    |
| Named-customer outcome stat           | ❌          | nowhere (pre-launch) — F3                    |

The site is **artifact-rich, figure-poor, and human-proof-absent.** F1+F2+F3 close the three missing rows and are the audit's headline recommendations.

---

## 6. Consistency / terminology ledger

| Term                       | Variants found                                                            | Canonical (recommend)                                         |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Local-first edition        | "Local-first" (nav), "Local-first AI" (footer/pages ×5)                   | "Local-first AI"                                              |
| Pending/early-access glyph | ◷ (compliance, agentic), ○ (pricing)                                      | one glyph                                                     |
| Early-access CTA verb      | "Request early access", "join the early-access list", "join the waitlist" | button=Request early access; prose=join the early-access list |
| Edition #2 label           | tag "#2" (cards), eyebrow "Edition #2" (ai-kit)                           | consistent enough; ratify                                     |
| Retrofit line              | identical home:124 / compliance:268                                       | differentiate per page                                        |
| Hero eyebrow               | tagline reused home+compliance                                            | page-specific label                                           |

---

## 7. What went un-audited (completeness note)

- **Docs surface** (`/docs`, Fumadocs MDX) — out of the 6-page marketing scope; flag for a separate docs-copy pass (getting-started, per-edition docs landing).
- **`llms.txt` / `llms-full.txt`** copy — present (`route.ts`) but not graded here; should mirror the marketing voice + claims for AI-crawler consistency (SEO leg).
- **404 / empty / loading states** — no copy audited (likely framework defaults; flag for the implementation session).
- **Email copy** (Resend confirmation after waitlist signup) — not in-repo; the success state promises "We'll be in touch" → the actual email must exist and match voice.
- **Deep SEO** (keyword clusters, internal-linking copy, sitemap labels) — a sibling research leg, not this copy audit.
