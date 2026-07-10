---
updated: 2026-07-10
status: live
grounds:
  - knowledge/decisions/ADR-0297-design-partner-first-n-terms.md
  - knowledge/decisions/ADR-0273-design-partner-program.md
  - apps/site/app/(marketing)/partners/page.tsx
  - docs/gtm/pricing-packaging.md
  - outputs/research/wtp-memo-2026-07-10.md
---

# Design-partner program — the partner-facing terms one-pager

The send-ready terms document behind the `/partners` application surface (which publishes the
same locked terms on-page since 2026-07-10); this one-pager is what the operator sends a
qualified applicant or outreach candidate directly. Terms are LOCKED (ADR-0297):
**first 5 partners · 40% off the initial purchase · 12-month reverting · case-study contingent
on conversion.** Outreach prep lives in `design-partner-outreach.md`; the outreach itself is an
operator act.

---

## The one-pager (send-ready — everything between the rules is partner-facing)

---

# Caisson design partners — the first five

**Caisson** ([caisson.sh](https://caisson.sh)) is a production-grade TypeScript platform sold
as source code you own: authentication, multi-tenant isolation, billing, background jobs, AI
infrastructure — and a compliance flagship built around tamper-evident WORM audit logs,
field-level encryption, and OSCAL evidence export. It ships as six composable bundles on an
Apache-2.0 open base you can read before you spend a dollar.

We're taking **five design partners** before general launch. This is a reference partnership
with real engineering attention — not a waitlist, not a discount code.

## The deal

**What you get**

- **40% off your initial purchase** — any bundle or module set. You own the source
  perpetually, the same way every buyer does; 12 months of updates and security patches are
  included as standard.
- **A direct line to the engineer who writes the code.** Your integration questions, feature
  needs, and bug reports reach the builder, not a ticket queue — and your deployment becomes
  a live use case the roadmap is worked against.
- **Partner pricing on renewal for your first year.** If you take a renewal or subscription
  surface, partner pricing holds for 12 months from purchase, then reverts to list.

**What we ask**

- **A case study — only if Caisson earns it.** If you continue at standard terms after your
  first year, you grant us a short, reviewed case study with your logo. Nothing is published
  without your sign-off on the exact wording, and every claim in it is dated and accurate. If
  you walk away instead, you owe us nothing — no case study, no reference, no hard feelings.
- **A candid feedback loop.** A short call roughly monthly (or async, as agreed) about what
  works, what's missing, and what broke. That signal is the whole point of a first cohort.

## Partner pricing

List prices as of 2026-07-10; the 40% discount applies to list at purchase time.

| Bundle        | List   | Partner price |
| ------------- | ------ | ------------- |
| Agentic-Dev   | $329   | $197.40       |
| Provenance    | $399   | $239.40       |
| Local-first   | $629   | $377.40       |
| AI-Production | $739   | $443.40       |
| Compliance    | $1,049 | $629.40       |
| Everything    | $2,059 | $1,235.40     |

À-la-carte modules qualify for the same discount — terms agreed directly.

## Who this fits

Teams building a real product on a TypeScript stack — especially under a live SOC 2, HIPAA,
GDPR, or PCI surface — who want the compliance and production plumbing owned, not rented.
Agencies standardizing a regulated-client starting point fit too. You should intend to ship
on Caisson; the partnership is the reference and the feedback, not extra integration work.

## How to apply

Email **[admin@caisson.sh](mailto:admin@caisson.sh?subject=Caisson%20design-partner%20application)**
(subject: _Caisson design-partner application_) with three things: what you're building, the
stack you're on, and the bundle or modules you'd use. Every application gets a direct reply.

Want to prove the fit first? The base is Apache-2.0 — scaffold it with `create-caisson` and
run it on your own stack before any conversation.

---

## Operator notes (NOT partner-facing)

- **Price-table collision (WTP memo F5):** partner-price Compliance ($629.40) sits within
  $0.40 of list-price Local-first ($629). Harmless in this doc (list and partner columns are
  side by side) but flag it to whoever builds any partner-facing pricing surface on-site. Any
  D2/D3 move on either bundle changes or removes the collision — refresh the table above if a
  price fork locks.
- **Feedback cadence is a working ask, not a locked term.** ADR-0273 named cadence as a term
  to draft; ADR-0297 didn't lock a number. The one-pager says "roughly monthly (or async, as
  agreed)" — adjust per partner without an ADR.
- **The `/partners` page publishes the locked terms** (Kickoff-J second picker round,
  2026-07-10): 5 partners · 40% off · 12-month reverting · case-study-on-conversion now state
  on-page, matching this one-pager. Keep the two surfaces in lockstep on any future term change.
- **Grant mechanics** reuse existing machinery (ADR-0273): a discounted purchase (Paddle
  discount at checkout) or an operator-granted entitlement — no new engineering.
- **Partners double as the real-ICP pricing instrument.** These are the first real ICP buyers
  to react to the actual anchor (at 40% off list, but anchored on list). Capture their price
  reactions — they feed the same D2/D3 evidence gap the Cookiy real-ICP study (created
  2026-07-10, study `019f4a11`) targets.
- **Case-study mechanics:** "conversion" = continuing at standard terms after the 12-month
  reverting window (ADR-0297). Publication stays operator-gated per the ADR-0080 copy laws —
  claims scraped + dated, partner signs off on exact wording.
