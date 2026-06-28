# ADR-0081 — Pricing display: indicative placeholder prices on the pre-launch site

**Status:** accepted · 2026-06-27 (Design·Brand·SEO·Copy session — operator: "indicative placeholders,
subject to change"). **Supersedes:** ADR-0087 (which deferred **all** hard prices to the waitlist and printed
"early access" instead of numbers). **Relates:** ADR-0012 (pricing anchors — `proposed`, numbers working),
ADR-0040 (sequenced launch / firewall), ADR-0079 (JSON-LD price), ADR-0080 (pricing copy). The open **"Pricing
numbers"** board fork stays **operator-owned for the FINAL lock**; this ADR authorizes **indicative**
placeholders on the not-yet-live site.

The marketing site is pre-launch / not live. The operator opted to show **indicative early-access prices**
rather than the empty "early access — join the waitlist" slots that read unfinished next to competitor
number-grids. ADR-0087's structure-without-numbers stance is superseded for the pre-launch site.

## The indicative prices (from the ADR-0012 anchors)

| SKU                              | Indicative price | Model              |
| -------------------------------- | ---------------- | ------------------ |
| **Compliance** (hero)            | **from $1,299**  | one-time           |
| **AI Production Kit**            | **from $599**    | one-time           |
| **Agentic-Dev**                  | **from $499**    | one-time (roadmap) |
| **Local-first AI**               | **Free**         | AGPL open flank    |
| **Bundle** (base + all editions) | **$2,499**       | one-time           |
| **Per-module**                   | **from $49**     | à la carte         |
| **Compliance Updates**           | **$199/mo**      | subscription       |
| **Developer**                    | **$99/mo**       | subscription       |

Every price renders with a persistent **"indicative — final pricing set before launch"** frame.

## Why

The site is not live, so the cost of showing a number we may change is low, and the benefit — pricing legible
to a buyer comparing against competitor grids — is real. Anchored on ADR-0012 (Clynova compliance dev-kits
clear 5–10× generic, $999–1,999 one-time). The **"indicative / subject to change"** framing keeps it inside
the voice floor ("flag, never guess", specs/04 §6) and preserves the operator's right to finalize. The
generic base stays a one-line footnote, never a comparison table (ADR-0040 firewall); no edition but
Compliance is heroed; nothing is geo-restricted; the conversion is still the **waitlist** (no checkout —
Stripe/commerce is P6).

## Scope

`/pricing` + the home and per-edition SKU sections render the anchors above with the indicative frame.
`SoftwareApplication` / `Offer` JSON-LD MAY now carry the indicative price (per-edition `Offer` with
`priceCurrency: USD` + the price + `availability: PreOrder`) — this updates ADR-0079's "price omitted" note.
The "$199 kits" footnote and the better-than-a-kit framing are unchanged.

## Rejected

- **Keep ADR-0087 (no prices)** — the operator chose to show indicative numbers.
- **Lock the numbers as final** — the operator chose "subject to change"; the **"Pricing numbers" fork stays
  open** for the final lock + grandfathering policy (ADR-0012).
- **Show ranges instead of single figures** — the operator chose single indicative anchors (cleaner read).

## Binding

The pre-launch site shows **single indicative anchor prices** with a persistent "subject to change before
launch" frame; this **supersedes ADR-0087**. The **final** pricing lock + grandfathering remain the
operator's open board fork (ADR-0012). Moving from the waitlist to a real checkout requires the commerce
build (P6) + a superseding decision. Implementation lands in the **build session**.
