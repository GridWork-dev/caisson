# ADR-0106 — Final pricing numbers + grandfathering (P6 go-live lock)

Status: accepted · 2026-06-29 (P6 operator-gates session, pricing picker round) · **executes the
deliberately-deferred final-numbers decision of ADR-0095 §4** · supersedes the displayed point-values
of **ADR-0082 §2** · extends **ADR-0012** (commerce model + grandfather binding), **ADR-0081** (display),
**ADR-0089** (X-2 annual cycle→grant). Append-only; supersede with a later ADR, never edit.

## Context

ADR-0095 §4 deliberately deferred the **exact** pricing numbers + grandfathering policy to P6/checkout,
recording the Perplexity GTM reports' Compliance **$2,999–$4,999** anchor (vs the then-committed ~$1,299)
plus the validation tasks (20 ICP interviews, Ahrefs/SEMrush keyword volumes, paid WTP pilots) as the
P6 repricing input. The site is still CF-Access-gated to `@gridwork.dev` (ADR-0107) and checkout does
not exist, so **no prices are public and there are zero buyers** — a pre-flip adjustment carries
near-zero public-consistency cost (ADR-0082 §2 reserved this silent final-number authority to the
operator). The operator resolved the numbers in the 2026-06-29 P6 picker round, anchored on the two
GTM reports, choosing the **conservative end of the research floor** over the full premium anchor.

## Decision — locked pricebook (replaces the ADR-0082 §2 display point-values)

| SKU                                                     | **Locked price**                  | Was (ADR-0082 §2) | Note                                                         |
| ------------------------------------------------------- | --------------------------------- | ----------------- | ------------------------------------------------------------ |
| **Compliance** — edition, one-time                      | **$2,499**                        | $1,299            | the wedge; research floor was $2,499–2,999, conservative end |
| **Everything Bundle** — base + all 4 editions, one-time | **$3,499**                        | $2,499            | discount bundle: ~15% / $597 off the $4,096 sum-of-parts     |
| **AI Production Kit** — edition, one-time               | $599                              | $599              | unchanged (outside the A1 fork)                              |
| **Local-first AI** — edition, one-time                  | $499                              | $499              | unchanged; commercial (ADR-0083)                             |
| **Agentic-Dev** — edition, one-time                     | $499                              | $499              | unchanged; labeled-roadmap (ADR-0082 §4)                     |
| **Per-module** — à la carte                             | from $49                          | from $49          | unchanged                                                    |
| **Compliance-Updates** — subscription                   | **$1,499 / yr**                   | $199/mo           | annual cadence (ADR-0095 §3); below old monthly×12           |
| **Developer** — subscription                            | **$499 / yr**                     | $99/mo            | annual cadence (ADR-0095 §3); below old monthly×12           |
| **Enterprise / SLA**                                    | **Contact us** (no public number) | —                 | founder-assisted (ADR-0095 §2); ref $9,999–$24,999           |

**Bundle coherence.** Sum-of-parts (the four editions at locked prices) = $2,499 + $599 + $499 + $499 =
**$4,096**; the everything-bundle at **$3,499** is a true discount (~15% / $597 off), coherent next to
à-la-carte purchase. The picker's interim "$4,499" figure was a **Compliance+AI-Kit 2-pack** number from
`gtm-customer-acquisition.md`, not the everything-bundle — at $4,499 the "discount" bundle would have
cost **more** than buying à la carte; corrected to keep bundle < parts.

**Subscription cadence.** Both subscriptions move monthly→annual per ADR-0095 §3; the locked annual
numbers ($1,499 / $499) sit **below** the old monthly-annualized figures ($2,388 / $1,188), so the
annual reframe reads as "regulatory insurance," not a hike. The X-2 cycle→grant mapper (ADR-0089) is
therefore an **annual** grant cycle at these amounts.

## Grandfathering policy (closes the open grandfather fork)

1. **No retroactive obligation today.** The site is gated and checkout does not exist → **zero buyers**
   at the old $1,299/$2,499 display. Raising the committed numbers now grandfathers nobody and breaks
   no prior sale.
2. **Forward price-lock (ADR-0012 binding, reaffirmed).** From checkout-live onward, **every buyer's
   purchased price + version is honored against all future increases** — one-time editions own the
   purchased version perpetually (updates optional); subscription renewals hold the rate the existing
   subscriber signed at (forced uplift is the top voluntary-churn driver, ADR-0012). Increases never
   claw back existing buyers.
3. **Pre-flip safety clause.** Should any early / manual / founder-assisted sale close at the old
   committed display **before** the gate flips, that buyer is honored at that price (the operator's
   "pre-flip buyers keep old display" intent) — a safety clause, currently vacuous.

## Downstream (code/design track wires; this ADR only locks the numbers)

- `@caisson/pricebook` plan/price config + the X-2 annual cycle→grant amounts (code track).
- `apps/site` pricing page + JSON-LD displayed numbers (design/code track — the W1 `apps/site`
  licensing-copy tail).
- Enterprise/SLA "Contact us" SKU surface (ADR-0095 W4) + the free EU-AI-Act eval sample (W3) are
  separate GTM build items.
- **These numbers bake into the pricebook _before_ the A2 gate flips** (ADR-0107 checklist step 5) —
  any post-flip change re-triggers the grandfathering event.

## Confidence + revisit

**MEDIUM.** All WTP figures are self-labeled estimates pending 20 ICP interviews + Ahrefs/SEMrush
volumes + paid WTP pilots + first-10-sales (both reports' methodology sections). These are the
**launch** numbers, to be validated-and-revised post-launch via a superseding ADR; the still-applied
gate keeps the consistency cost of a later change low until checkout flips.

## Rejected

- **Keep committed $1,299 / $2,499 as-is** — every GTM source flags it 2–4× below WTP; a later
  post-flip raise costs a re-commit + grandfathering event. Chosen against: capture the floor now while
  the gate makes it free.
- **Full premium ($2,999 Compliance / $6,999 bundle / Enterprise $9,999–$24,999 public)** — biggest
  jump on the least-validated figures; highest walk-back cost.
- **$4,499 everything-bundle** — above the $4,096 sum-of-parts; a discount bundle priced over
  à-la-carte is incoherent on a pricing page.

Evidence: `outputs/research/{gtm-market-analysis-2026-06,gtm-customer-acquisition,market-competitive-analysis}.md`;
`knowledge/decisions/ADR-0082` §2, `ADR-0095` §3–4, `ADR-0012`; the 2026-06-29 P6 operator picker rounds.
