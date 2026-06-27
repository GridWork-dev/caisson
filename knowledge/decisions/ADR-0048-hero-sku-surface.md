# ADR-0048 — Hero SKU surface: structure shown, prices deferred to the waitlist

Status: accepted · 2026-06-27 (closes the **"Hero SKU surface + pricing display"** open fork for the
GTM session. The **"Pricing numbers"** board fork stays OPEN — operator-owned, no hard prices printed.)

The marketing site shows the **SKU structure** — the compliance-led lineup and the commerce model —
but prints **no hard prices**. Compliance is the hero / front door; the free Local-first AGPL flank is
the top-of-funnel CTA; AI Production Kit is named #2; Agentic-Dev is roadmap; the two subscriptions
(Compliance Updates, Developer) and the "EU AI Act-ready" gated slot are listed as structure. The page
converts to the **waitlist** (ADR-0046), not a checkout.

## Why

ADR-0040 locked a **sequenced launch + buyer firewall**, and the **pricing numbers are an open
board fork the operator owns** (ADR-0012 holds only working anchors). Showing the SKU _structure_
without numbers honors both: it communicates the lineup and the one-time/bundle/per-module/subscription
model that frames the wedge, while committing no price the operator hasn't locked. The generic base
appears **once, as a footnote** ("and yes, it's a better base than the $199 kits"), never as a
comparison table (ADR-0040 firewall); no non-compliance edition is co-heroed; nothing is geo-restricted.

## Scope

Pricing/SKU surface (`/pricing` + the home SKU section): edition cards (Compliance hero; AI Production
Kit #2; Local-first AGPL free flank; Agentic-Dev roadmap), the commerce-model labels (one-time ·
bundle · per-module · subscription) and the two subscription SKUs + the EU-AI-Act gated slot **as
structure only** — every price rendered as "early access / join the waitlist," never a number. When
the operator locks pricing, a superseding decision swaps the deferred slots for figures.

## Rejected

- **Show ADR-0012 anchor prices as provisional** — stronger conversion signal, but commits numbers the
  operator hasn't locked (violates the open "Pricing numbers" fork + the one-operator-rule).
- **Compliance-only page** — tightest wedge, but the umbrella ("no orphans") goes unstated and the
  AGPL flank loses its top-of-funnel slot.

## Binding

The SKU surface shows structure with **no hard prices** and converts to the waitlist; the generic base
is a one-line footnote, never a comparison table; no edition but Compliance is heroed; no
geo-restriction. Printing prices requires the operator to first lock the open "Pricing numbers" fork.
