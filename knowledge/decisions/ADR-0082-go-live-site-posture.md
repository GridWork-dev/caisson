# ADR-0082 — Go-live site posture: live self-serve, committed pricing, true-to-built claims

**Status:** accepted · 2026-06-28 (go-live copy session — operator-decided across a 4-fork picker).
**Supersedes:** the **pre-launch waitlist-capture stance** of ADR-0046/ADR-0048 (CTA = capture, not
checkout) and the **indicative-placeholder pricing** stance of ADR-0081 (which superseded ADR-0048's
no-price stance). **Relates:** ADR-0012 (price anchors), ADR-0083 (Local-first commercial), ADR-0040
(hero — unchanged), ADR-0080 (copy laws — unchanged), specs/04 (voice). Evidence: the as-if-live copy
audit (`outputs/specs/design-brand-site-seo/` session; 4-dimension fanout — hedge-language /
cta-funnel / claims-readiness).

The site was built as a **pre-launch waitlist**: 28 of 35 CTAs were "Request early access" → an inert
`#waitlist` seam; copy hedged with "we'll reach out as editions open", "no customers to quote yet",
"subject to change before launch", and "Roadmap" labels. The operator's directive: the copy should
**read as a live, finished product** (the site isn't live, so there is no harm in it reading shipped —
and every harm in it reading half-baked). This ADR records the four locked decisions.

## 1. Posture — live self-serve store

The site reads as a **shipping, self-serve dev kit** (the ShipFast/MakerKit model, ADR-0023). The
primary conversion action is **purchase**, not list-signup.

- **CTAs flip:** the global nav CTA + every hero/section primary CTA become **"Get started" /
  "Get <Edition>"** targeting `/pricing` (and, once wired, a real checkout). Ghost secondary stays
  "Read the docs". No "Request early access" anywhere.
- **Waitlist retired** as the conversion model. The `WaitlistForm` is **repurposed to a low-key
  "product updates" capture** (footer / changelog), not the page-closing CTA. Page-closing sections
  become get-started CTAs (install command + Get <Edition>).
- **Drop every pre-launch tell:** "we'll reach out", "early-access list/partners", "as editions
  open", "no customers to quote yet", "pre-launch marketing site / waitlist" self-descriptions.
- **Checkout is a fast-follow** (DEPLOY/build): until it exists, purchase CTAs target `/pricing`
  (never a dead anchor). Wiring Merchant-of-Record checkout (ADR-0012) + license delivery is tracked,
  not faked.

## 2. Pricing — committed, no hedge

Present the **ADR-0012 anchor point-values as the prices** — drop "indicative pricing — subject to
change before launch" everywhere (banner, per-card footnotes, JSON-LD `description`). The displayed
prices (all inside ADR-0012 ranges): **Compliance from $1,299 · AI Production Kit from $599 ·
Local-first AI from $499 (ADR-0083) · Agentic-Dev from $499 · Bundle $2,499 · per-module from $49 ·
Compliance Updates $199/mo · Developer $99/mo.** The operator may still adjust a number before
checkout goes live, but the site no longer **says** they will — a live store cannot sit next to
"subject to change". This **closes the open pricing-display fork** (CLAUDE.md); final-number authority
remains the operator's, silently.

## 3. Claims — confident copy, artifacts true-to-built

Keep the live, finished tone **without fabricating unshipped features.** Four of five edition packages
are currently empty stubs (audit-worm, compliance, local-ai, ai-kit — "structure only"); only the base
substrate (kernel, tenancy-rls, field-crypto, auth, billing, credits) + `create-caisson` are built.

- **Every terminal/CLI/config artifact must demonstrate built code** — the hero fail-closed RLS denial
  (tenancy-rls ✓), field-crypto, `create-caisson`, `verifyChain`, the standards gate. Replace
  unbuilt-edition demos (e.g. `caisson compliance evidence-pack`, `caisson eval run`, a local-ai
  privacy-gate config) with real built-substrate examples **or** clearly-illustrative design snippets
  that don't imply a runnable CLI.
- **CI proof strip = real checks only:** keep what actually runs (turbo build·lint·test, the standards
  gate, golden-file, the RLS cross-tenant test); **drop fabricated metrics** ("0 high-severity CVEs",
  "WORM delete refused", "audit chain: 0 breaks") unless a real check produces them.
- **Honesty boundary unchanged** (ADR-0080): still never imply Caisson is "certified".

## 4. Agentic-Dev (the one honest exception)

Agentic-Dev is genuinely unbuilt. It stays a **clearly-labeled roadmap edition** — a live site may
carry a "coming" edition; that is not a pre-launch tell for the _site_. Its CTA is forward-looking
("Follow development on GitHub" / "Notify me"), **not** "Request early access", and it is **not**
rewritten to read as shipping (that would violate §3). It is kept out of primary nav (status quo).

## Downstream (handled in the copy pass)

- `/legal/terms` + `/legal/privacy` reframe from "early-access waitlist program" to **purchase /
  commercial-license terms** (the `LicenseRef-Caisson-Commercial` EULA, operator-review framed).
- `/changelog` reframes from "early access opens" to **GA release notes** (real milestones, no
  fabricated shipped features).
- `/security` drops "pre-launch marketing site" self-description.

## Rejected

- **Keep the waitlist** (reads not-live — the thing being fixed). **Keep indicative pricing** (can't
  sit next to a live store). **State everything as live with no caveats** (would fabricate unshipped
  CLI/features — failed the honesty bar; §3 chosen instead). **Rewrite Agentic-Dev as shipping** (false
  claim).

## Binding

The site reads live self-serve: purchase CTAs to `/pricing`, no waitlist conversion, no pre-launch
hedges; committed prices with no "subject to change"; Local-first commercial (ADR-0083); every artifact
true-to-built; Agentic-Dev the one labeled-roadmap exception. Real checkout + EULA drafting are tracked
fast-follows, not faked. Implementation lands in this session's copy pass on `apps/site`.
