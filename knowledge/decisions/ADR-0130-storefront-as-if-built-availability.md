# ADR-0130 — Store-front "as-if-built" availability: full catalog shown, no maturity flags

Status: accepted · 2026-06-30 (pricing + store-rework grill session, round 1 lock #4) ·
**SUPERSEDES ADR-0082 §3** (true-to-built artifacts/claims discipline) **and §4** (Agentic-Dev as
the one labeled-roadmap exception) · site stays Cloudflare-Access-gated per ADR-0107 (not public) ·
composes ADR-0129's 12-module + 5-edition catalog · extends ADR-0095/0106's catalog framing.
Append-only; supersede with a later ADR, never edit.

## Context

ADR-0082 (2026-06-28, go-live copy session) locked a deliberate honesty floor: at that time only
the base substrate + `create-caisson` were "genuinely built" per its own accounting, so §3 required
every demoed artifact to be real and forbade fabricated metrics, and §4 kept Agentic-Dev a clearly
labeled "coming" roadmap edition rather than showing it as buyable.

Two things changed by 2026-06-30. First, `docs/build-state.md`'s per-package reality check (current
at this ADR) shows every edition package carries real `src/` + passing tests — rated **substantial**
across the board (`compliance` 16/11/2871, `audit-worm` 7/6/1302, `agent-dev` 7/3/761, etc.), not
the "empty stubs" ADR-0082 §3 was written against (that line predates the Wave-1 edition merge, per
`docs/adr-index.md`'s accuracy flag). Only `ai-kit` itself is flagged "partial" (thinnest edition
root). Second, the store-rework session opened a packaging fork ADR-0082 §4 didn't anticipate:
once the catalog carries 12 individually-sold modules (ADR-0129) plus 5 editions, treating one
edition (Agentic-Dev) as a roadmap exception breaks the catalog's visual/commercial consistency for
no remaining honesty benefit, since the underlying code is no longer vapor.

## Decision

The full catalog — 5 editions + 12 modules (ADR-0129) — is shown **fully available, with no
maturity/roadmap flags**, on the gated pre-launch store front. This is a pure as-if-live
presentation:

- **Agentic-Dev loses its labeled-roadmap treatment** (ADR-0082 §4) and gets the same pricing-page,
  cart (ADR-0131), and purchase-CTA treatment as every other edition.
- **No "structure only" / "coming soon" / "thinnest surface" badges anywhere on the customer-facing
  store** — that language stays internal (`docs/build-state.md`'s own per-package reality check),
  never customer-facing.
- **"Subject to change" stays as the sole hedge** (ADR-0106/0095's pricing-deferral framing,
  unchanged) — this ADR removes maturity hedging, not pricing hedging.
- **The site remains gated behind Cloudflare Access (ADR-0107)** — it is not public. The audience
  for this as-if-built catalog, until the gate flips, is the operator's own preview/QA pass and any
  pre-flip manual sale (ADR-0106's pre-flip safety clause), not a real anonymous customer.
- **The ADR-0082 §3 artifact-truthfulness discipline is otherwise UNCHANGED** for what is actively
  _demoed_ (the hero fail-closed RLS denial, `verifyChain`, the standards gate, real CI proof
  strips) — this ADR only changes whether a module/edition shows a purchase CTA, not whether a
  specific code demo is fabricated. No new fabricated CLI output, metrics, or customer quotes are
  introduced by this lock.

## Why

- **The underlying claim is no longer false in substance.** ADR-0082 §3's caution was written
  against genuinely-empty packages; `docs/build-state.md` now rates every edition "substantial."
  Removing the roadmap label is closer to correcting a stale caveat than fabricating one.
- **Gated, not public.** Per ADR-0107, the storefront is `@gridwork.dev`-only until the operator
  flips the Access gate as a deliberate DEPLOY-class act — so this lock carries none of the
  real-customer-deception risk a public live catalog would. It previews the complete commerce
  experience (full-catalog cart math, bundle pricing, à la carte flow) before the operator commits
  to flipping the gate.
- **Consistency.** A catalog with 17 SKUs (12 modules + 5 editions) and one singled-out "coming
  soon" entry reads as an inconsistency on a pricing/cart page, not as honesty — ADR-0082's own
  §4 conceded this was "the one honest exception," implying it was already a tolerated wart, not a
  load-bearing principle.

## Scope — what changes, what does NOT

**Changes:** Agentic-Dev's catalog/pricing/cart treatment (no longer roadmap-labeled); removal of
any remaining maturity-flag copy across the 17-SKU catalog.

**Unchanged:** the CF-Access gate itself (ADR-0107 — still the actual control, not the copy); the
artifact-truthfulness discipline for live code demos (ADR-0082 §3, the parts of it this ADR does
not touch); the pricing-display hedge ("subject to change," ADR-0106); the underlying build-state
truth in `docs/build-state.md` (internal, unaffected by storefront copy).

## Rejected

- **Keep ADR-0082 §3/§4 as-is** — rejected; the empty-stub premise it was written against is now
  stale per `docs/build-state.md`, and the gated, non-public audience removes the deception risk
  the original §3/§4 was guarding against.
- **Soften to partial-maturity badges instead of full supersession** (e.g. "early access" tags) —
  rejected; the operator explicitly locked "no maturity flags," not a softer compromise.
- **Re-litigate per-package** (some editions keep labels, others don't) — rejected for
  inconsistency; the catalog reads as one coherent storefront or it doesn't.

## Note for the next gate decision

This ADR governs the **gated, pre-launch** storefront. Whether the as-if-built catalog framing
carries through unchanged when the CF-Access gate actually flips (ADR-0107's DEPLOY-class act) is
not decided here — that flip checklist (ADR-0107) already requires "checkout works + Compliance is
buyable end-to-end + license issuer + EULA land" before the gate opens; this ADR does not relax
that checklist. If the harvest initiative (ADR-0133) has not yet fattened a given edition by the
time the gate flips, that is the operator's call to revisit at flip time, not a re-opening of this
lock.

## Binding

The pre-launch (CF-Access-gated) storefront shows the complete 5-edition + 12-module catalog as
fully available with no maturity flags; Agentic-Dev is no longer the labeled-roadmap exception;
"subject to change" remains the sole pricing hedge; live-code-demo truthfulness (ADR-0082 §3's
artifact discipline) is otherwise unchanged. Reintroducing maturity flags, or changing this posture
at the actual public go-live flip, requires a superseding ADR.

Evidence: `pricing-and-store-rework-plan.md` lock #4; `docs/build-state.md` per-package reality
check (2026-06-29 snapshot, "substantial" across editions); `knowledge/decisions/ADR-0082` §3-§4;
`knowledge/decisions/ADR-0107` (CF-Access gate, unaffected).
