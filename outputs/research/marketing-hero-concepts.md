# Marketing-site hero & "wow"-moment concepts

> **Provenance.** Design research for the ground-up marketing-site rebuild (2026-06-29), grounded in
> Refero styles/screens + Exa competitor study, constrained to the locked brand floor (DESIGN.md,
> ADR-0078/0080, specs/04 voice). Concept + reference lock only — no code. Feeds the design-track
> kickoff (`outputs/kickoffs/design-marketing-rebuild.md`).

## The decisive finding

Caisson sits between **dark dev-infra marketing** (Warp/Axiom/Trigger.dev/Trunk — these look like
_instruments_) and **compliance/trust** (Vanta/Drata — these look like _printed reports / "agentic
trust platforms"_). The wedge: render compliance as a **dev instrument, not a GRC dashboard**. So we
borrow almost entirely from the dev-infra column and inherit nothing from the compliance column except
its seriousness.

**Steal-list (each tied to a reference):** single accent used once above the fold (Trigger.dev holds
its accent to ~4 CTA-only occurrences; Axiom forbids accent on non-interactive) → ratifies our ≤10%
teal law · depth via surface steps + hairlines, never shadow-as-baseline (Warp/Vanta) · the product
reproduces itself as the hero (Warp terminal, Resend API call, Sentry "monitor in five lines") ·
monospace as the technical voice (Axiom mono headlines) · blueprint/schematic line-art as atmosphere
(Trunk) · two-beat closer (Resend/Linear "…Available today." → our pre-launch "…Shipping to early
access.") · homepage-as-discovery-hub (Vanta's clickable framework doorways → our credential strip
becomes navigational).

**Traps (do NOT inherit):** Vanta/Drata "agentic trust platform / automate compliance" register
(literally our banned list, ADR-0080) · generic white audit-log tables with colored badges (every
Refero "audit log" screen is this anti-pattern) · 3D glass blobs / mesh gradients · violet/lavender
(Vanta owns it — teal is the differentiation).

## Hero concepts (locked floor: Hubot display · Martian Mono eyebrow/labels/numerals · teal ≤10% · surface-ladder depth · H1 "Fail-closed by construction." · eyebrow "Compliance-grade infrastructure for regulated SaaS.")

- **Concept A — "The Denial" (framed instrument terminal) ★ RECOMMENDED HERO.** Asymmetric 55/45
  split; right column = one framed terminal carrying `--cs-glow-accent` (the single above-fold
  elevation moment) running the **real fail-closed `psql` RLS denial**, revealing line-by-line
  (the proven `home-hero-motion.tsx` motion); the `fail-closed` token ignites teal as the last line
  lands; credential strip = four _clickable_ framework doorways. Highest legibility (an engineer reads
  the denial and gets the whole value prop in 3s), most on-brand, **lowest risk — evolves shipped
  code**, and reserves the hash-chain for the scroll. Grounds in Warp + Axiom + Resend + Sentry.
- **Concept B — "The Hash-Chain Builds."** An append-only audit chain assembling itself, each block a
  Martian-Mono `sha256(prev ‖ payload)` tile, hairline links drawing block→block (Trunk vocabulary),
  terminating on `verifyChain() → OK`. More memorable than A but less instantly legible → deploy as
  the standout moment, not the fold.
- **Concept C — "The Cross-Section" (waterline blueprint).** A query enters at the waterline and
  descends through labelled control strata in the pressurized chamber (RLS → field-crypto → WORM →
  audit-chain → signed pack); depth darkens = audit pressure. Most brand-distinctive (the caisson
  metaphor is ours, ADR-0041) → **strongest as the signature diagram**, not the fold.
- **Concept D — "Code → Signed Proof."** A control→clause map (`SOC 2 CC6.1 → rls.policy.ts`) + the
  moment `caisson evidence pack` runs and a signed manifest materializes → best as a dedicated mid-page
  "what you hand an auditor" section.

**Narrative: four beats, each a real artifact — deny (A, hero) → chain (B, standout) → hold (C,
diagram) → sign (D, mid-page).**

## The standout / "wow" moment — "Break the chain" ★ RECOMMENDED

The audit chain builds in, then one historical block is edited; its hash recomputes and **every link
after it turns danger-red**, `verifyChain()` flips `OK → FAIL at block 4`, teal caption: _"Tampering
with any historical row breaks every link after it — detectable, provable, exportable."_ It makes an
invisible cryptographic guarantee physically visible in one gesture — the literal manifestation of
"fail-closed by construction," and an unforgeable category claim (only a code-owned product can _show
the break_). Tokenized motion (transform/opacity/color, `--cs-ease-reveal`), reduced-motion-gated
(static broken state), scroll-triggered once, never looping. _Supporting beats:_ "WORM lock engages"
(immutability) + "evidence pack seals" (output packaging).

## Signature diagram — the caisson cross-section (triple-duty)

One vertical blueprint shows (a) "controls live in the code path," (b) base→editions architecture, (c)
the evidence pipeline: **waterline** (request arriving) → **chamber** (your app repo, under audit
pressure) → **control strata** (RLS fail-closed · per-tenant field-crypto · WORM write · audit-chain
append · signed-pack emit — each a hairline band with its bespoke domain glyph + control→clause tag).
**Chamber walls + path = base substrate; the 4 editions = modules bolted into the same chamber**
(differ by icon+label only under one teal accent, never a per-edition rainbow — ADR-0078). Renders
"editions are compositions, not forks" (ADR-0003) + "same rigor on an adjacent problem" (ADR-0040)
structurally. Inline SVG on `--cs-surface-1`, scroll-revealed.

## Reference lock

| Reference           | Refero ID / URL                                | Borrow                                                                                                             | Trap                                                                                      |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Axiom**           | `6e9baa82…` axiom.co                           | Closest structural analog: pure-dark surface ladder, **mono headlines**, 2px radius, accent as precision spotlight | Orange accent → teal; its near-`#000` → our tinted wet-steel                              |
| **Warp**            | `40a9c295…` warp.dev                           | Terminal-as-hero, depth via surface steps, eyebrow-as-prompt, ~0.4s mechanical easing                              | The aurora-photo wash — no photography                                                    |
| **Trunk**           | `09af2984…` trunk.io                           | Blueprint/schematic line-art (precedent for the cross-section + hash-chain links)                                  | Tri-color accent → one teal; soft 18–24px radii → tighter                                 |
| **Trigger.dev**     | style `86541d12`                               | Single-accent discipline to the extreme + graph-paper hairline grid                                                | Syntax-rainbow code → restrained cold-steel Shiki                                         |
| **Vanta**           | style `6b4c8ca5`                               | Homepage-as-discovery-hub (navigational credential strip); hairline-over-shadow                                    | Violet palette + "automate compliance" register; no SaaS dashboard shots                  |
| **Resend / Linear** | resend.com / linear.app                        | Hero = the real artifact; two-beat "…Available today." closer                                                      | Black-on-white editorial chrome — we're dark-default                                      |
| **Sentry**          | sentry.io                                      | "Monitor in five lines" drop-in legibility; confidence through understatement                                      | Multi-product sprawl — Caisson leads narrow                                               |
| **Anti-ref**        | Refero audit-log screens (Zapier, Cake Equity) | —                                                                                                                  | The generic white audit-log table w/ colored badges is exactly what we must NOT look like |

**Authority order: brand > craft > research** — teal (not Axiom-orange/Trigger-lime/Trunk-tricolor),
Hubot+Martian+JetBrains type, tinted wet-steel surfaces (never pure `#000`/`#fff`), elevation+glow as
a deliberate step, the waterline motif, and the **honesty boundary** (show _generated evidence_, never
imply Caisson is itself certified — DESIGN.md §9, ADR-0080 §3).
