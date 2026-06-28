# Voice & Brand — Concept Spec (Caisson)

**Status:** locked (positioning session 2026-06-27). Closes the `specs/03` §4 deferral.
**Decides:** ADR-0040 (positioning) · ADR-0041 (name). **Floor:** gridwork-core
`identity/voice.md` (evidence-forward, terse, no AI-slop) adapted from instruction-file voice to
product/marketing copy. **Design center:** `specs/03` §1 (dark, technical, pro-tool).

---

## 1. Positioning (locked)

- **Name:** Caisson. **Scope:** `@caisson/*`. **Domain:** `caisson.sh`.
- **Hero wedge:** Compliance. **Umbrella:** a production-grade codebase library — _the
  load-bearing infrastructure cheap boilerplates skip._
- **Enemy:** happy-path boilerplate (auth + Stripe + landing; nothing load-bearing under audit).
- **Tagline (persistent category line):** **"Compliance-grade infrastructure for regulated SaaS."**
- **Hero headline (landing H1):** **"Fail-closed by construction."**
- **Hero subhead:** "Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain —
  wired and tested before your first customer, not backfilled after your first audit."

## 2. The name

A caisson is the watertight foundation sunk under pressure so the structure above holds under load.
Wordmark direction: lowercase `caisson`, monospace-adjacent, dark surface, no icon-mascot. The name
is the metaphor — let copy lean on _foundation / load / pressure / holds_, never explain the word.

## 3. Voice principles

1. **Evidence over adjectives.** Show the CI badge, the RLS test, the audit artifact, the $/weeks
   figure. The artifact is the headline. Never "powerful / seamless / revolutionary."
2. **Name the load-bearing failure.** Lead with the specific thing that breaks — an RLS bypass, an
   ignored `invoice.payment_failed`, an AI bill spike, a missing audit trail — not generic
   "production-ready."
3. **Pro-tool register.** Linear / Resend / Vercel cadence (§5). Address the buyer as a peer
   engineer. Confidence through understatement and precision, not volume.
4. **No AI-slop.** Banned list, §4. No emoji. No exclamation marks in a hero.
5. **Honest urgency only.** Regulatory deadlines are real — cite the regulation + clause
   (SOC2 CC6.x, HIPAA §164.312, SEC 17a-4, EU AI Act Annex IV). Never manufacture scarcity.
6. **Trustworthy claims (compliance = trust).** "Flag, never guess" (ADR-0006) applies to copy:
   never market a framework Caisson only scaffolds as one it fully covers. Precise scope beats
   broad claims.

## 4. Banned words / phrases

`revolutionize` · `seamless` · `effortless` · `unlock` · `supercharge` · `game-changer` ·
`cutting-edge` · `next-generation` · `in today's fast-paced …` · `leverage` (as hype verb) ·
`empower` · `delight` · `robust` (as filler) · standalone `AI-powered` as a value claim ·
vague `production-ready` with no proof beside it · emoji-as-bullets · exclamation marks in the hero ·
revenue-screenshot energy. When tempted, show the artifact instead.

**Competitor-coded terms (ADR-0080) — banned except in explicit, attributed contrast:** `platform` (the
lane's owned word — use library / substrate / kit), `automate compliance` (Secureframe's), `scanner` /
`detective control` (compliance.tf's frame), `lifetime updates` (boilerplate's ownership-conflation),
`make $$$` / scarcity timers / strike-through prices (boilerplate tells). **Owned vocabulary to use
consistently:** fail-closed · load-bearing · audit-ready · evidence pack · holds under load · watertight
under audit.

## 5. Cadence (from the pro-tool messaging scan)

- **Headline:** a category claim in ≤7 words; a definite article is allowed ("The …"). Zero hype
  words.
- **Subhead:** one plain, concrete sentence doing measurable work — not a feature list.
- **Proof shown, not asserted:** a code snippet, a CI badge, or a real audit artifact _is_ the
  hero element (Resend's hero is its API call; Vercel pairs every claim with a named-customer stat).
- **Section headers (2-tier, ratified ADR-0080):** a **mono eyebrow** carries the terse label (Intake /
  Plan / Build — and the SEO head term, ADR-0079 S20); a **sentence H2** does the narrative work. The
  eyebrow is the terse-label home; the sentence-H2 is the site's de-facto sanctioned system, not a
  marketing line.
- **Social proof:** named senior engineers / founders with craft-focused quotes — not star ratings.
- **Closer:** the two-beat "[bold future claim]. Available today." signature.

## 6. Locked copy + approved alternates

**Tagline (locked):** "Compliance-grade infrastructure for regulated SaaS."

**Hero headline (locked):** "Fail-closed by construction." — the app-tier answer to compliance.tf's
infra-tier "fireproof construction"; differentiates by moving prevention to the application layer
where no competitor ships it.

**Approved alternate headlines** (campaign / A-B use): "Audit-ready from the first commit." ·
"Stop adding compliance later." · "Ship the proof, not just the product."

**Retrofit-cost line (our unclaimed lane — no competitor prices the live-DB rip-out):**
"Retrofitting RLS, WORM storage, and an audit chain into a _live_ multi-tenant database costs
months. Start with them."

**Generic-base footnote (the ICP firewall, in copy):** the better-than-a-$199-kit claim appears
**once, as a footnote** — "and yes, it's a better base than the $199 kits" — never as a comparison
table (ADR-0040 buyer firewall).

## 7. Brand adjectives

**Is:** load-bearing · fail-closed · evidence-forward · exact · calm · dense · pro-tool · dark.
**Is not:** hypey · emoji-playful · gradient-hero-SaaS · vague · breathless · screenshot-flexing.

## 8. Do / don't

- **Do** (compliance.tf, applied at our tier): "A scanner is a smoke detector. Caisson is the
  fail-closed construction." → concrete, structural, no hype.
- **Don't:** "Revolutionize your compliance workflow with our seamless AI-powered platform." →
  three banned words, zero evidence.
- **Do** (retrofit math, our lane): "SOC 2 from scratch: $80k, 6–9 months. RLS+WORM+audit-chain
  retrofit into a live DB: months more. Both, wired on day one." → cite the figures, name the pain.
- **Don't:** lead a non-compliance edition as a co-hero — AI-Kit/local-first/agentic copy reads as
  _"the same rigor, applied to <their problem>,"_ under the compliance-led umbrella (ADR-0040).

## 9. Per-edition voice (all under the umbrella register)

- **Compliance (hero):** trust + evidence. Cite the control + clause; show the signed evidence pack.
- **AI Production Kit:** rigor + control. Lead with the spike that gets capped (token bill, eval
  regression, guardrail), not "AI-powered."
- **Local-first AI (free flank):** sovereignty + privacy. "Your data never leaves the device."
- **Agentic-Dev:** governance. The governed kernel, not "autonomous magic."

---

## 10. Design kickoff — RESOLVED (Design·Brand·SEO·Copy session, 2026-06-27)

No longer deferred. Wordmark/logo art (waterline-over-chamber glyph), the icon + illustration system,
motion, and elevation are decided in **ADR-0078** (brand foundation expansion, supersedes ADR-0042);
the per-surface **copy & messaging laws** that extend this voice floor are **ADR-0080**. SEO →
ADR-0079; pricing display → **ADR-0081** (indicative placeholder prices, supersedes ADR-0087 — see §6).
The visual system + implementation backlog: `outputs/specs/design-brand-site-seo/SPEC.md`. This spec
remains the **voice floor**; ADR-0080 adds the surface-specific laws on top of it.

### Copy-law additions (ADR-0080, additive to §3–§9)

- **Register:** dev-kit-noun + code-promise; **never "platform" or "automate compliance"** (lane-owned,
  category collision). Use library / substrate / kit.
- **Honesty boundary:** state the technical-vs-administrative split plainly — Caisson ships the technical
  controls; the org program + the audit remain the buyer's; **never imply Caisson is certified**.
- **Persona:** developers primary + a **CISO/procurement** section and a contact route distinct from the
  dev waitlist.
- **Consistency:** an owned-vocabulary glossary + a competitor-term ban; answer-first/FAQ openings for GEO.
