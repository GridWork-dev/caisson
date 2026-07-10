---
updated: 2026-07-10
status: live
grounds:
  - docs/business/caisson-software-llc.md
  - docs/state/go-live-legal-and-entity.md
  - knowledge/decisions/ADR-0276-eula-continuity-clause.md
  - knowledge/decisions/ADR-0282-eula-continuity-parameters.md
  - knowledge/decisions/ADR-0302-subscription-refund-coverage-horizon.md
  - apps/site/app/legal/eula/page.tsx
  - outputs/research (legal research wave, 2026-07-10 — 5 cited lanes)
---

# Legal review brief — Caisson Software LLC (one engagement, three scopes)

v2, operator-locked 2026-07-10. The single lawyer engagement for launch: **entity core +
commercial paper + open-core/trademark**. Engaged now; runs PARALLEL to the Paddle production
application and the Mercury application (both locked to proceed immediately — neither waits on
the lawyer-final documents). Program agreements (design-partner signable, affiliate terms) stay
EXCLUDED — operator-level marketing terms until a partner or the affiliate flip demands paper.

Member identity details (name, SSN, addresses) stay OUT of this repo; the lawyer receives them
directly with the formation packet (`~/lab/caisson-inbox/business-docs/`).

## Entity snapshot (from the formation packet, intake 2026-07-10)

| Fact             | Value                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal name       | **Caisson Software LLC** (must match IDENTICALLY on site ToS, Paddle account, Mercury, OA, IP instrument — even capitalization mismatches are a Paddle rejection cause) |
| Type             | Georgia domestic LLC, member-managed, single member                                                                                                                     |
| Organized        | 2026-07-06 · GA SOS control **26147198** · Certificate witnessed 2026-07-08                                                                                             |
| Registered agent | Northwest Registered Agent Service, Inc. (Fulton County); RA office is the public/service address                                                                       |
| EIN              | Issued 2026-07-10 (CP-575 with the packet)                                                                                                                              |
| Member           | The designated sole member, 100% (a parent of the operator; the operator is a minor — the entire Scope-1 structure exists because of this)                              |
| Tax posture      | Disregarded entity; **no S-corp election** (deliberate — it would kill the FICA/FUTA minor-wage exemption, §1.6 below)                                                  |

**Draft-OA defects found at intake** (Northwest free template — the lawyer replaces it, not
patches it): unsigned/undated with the certification and Exhibit-1 capital contribution blank;
member address filled with the RA office instead of the member's residence; §1.3(c)/§1.4 make
death of the member an expire-and-dissolve event — worse than the statutory default and in direct
conflict with both the transfer-at-18 structure and the EULA continuity clause the site already
serves (ADR-0276/0282); a blank bank-resolution template rides along. Georgia case law makes
indefiniteness, not lack of signature, the real enforceability risk (_Practice Benefits v. Entera
Holdings_, 340 Ga. App. 378 (2017) — unsigned OA still bound; _Souza v. Berberian_, 342 Ga. App.
161 (2017) — indefinite terms did not), so the deliverable is one definite, signed writing.

## Scope 1 — entity core: operating agreement + minor-IP instrument

One signature-ready OA plus one IP instrument, Georgia law, names/addresses exactly matching the
member's ID and the EIN record.

### 1.1 Death/continuity — override two stacked GA defaults in writing

OCGA § 14-11-601(b)(7)(A) makes a member's death an event of dissociation; § 14-11-602(b)(4)
dissolves a post-1999 LLC 90 days after the last member's dissociation. A template merely
_silent_ on death overrides neither — the OA must say so expressly, and these defaults move only
via a **written** OA (§ 14-11-101(18)). Lawyer picks ONE continuity mechanism rather than relying
on the § 14-11-506 opt-out default: a named successor member admitted immediately on
death/incapacity, a springing-member clause, or holding the interest in a revocable living trust
(§ 601(b)(7) fires only for "a member who is an individual"). Whatever is chosen must align with
the EULA vendor-continuity clause buyers already see (ADR-0276/0282: Continuity Event + Affiliate
definitions, §365(n) successors language, prospective-only cure) — OA dissolution/assignment
provisions cannot contradict what the EULA promises. TOD mechanisms are a poor fit for a private
LLC interest in GA (no registering entity; the 2024 TOD-deed statute is real estate only).

### 1.2 Transfer-at-18 — the defining custom clause set

100% of the membership interest moves to the operator at his 18th birthday. GA-specific traps the
lawyer must design around:

- **GA UTMA custodianship terminates at 21, not 18** (OCGA § 44-5-130). If 18 is the target, use
  an outright transfer/exercisable option at 18 or a trust with an express 18-trigger — not a
  standard UTMA custodianship (or confirm an earlier elected age is permitted).
- Draft as **automatic conversion that admits him as a full voting member** — silence on
  admission leaves economic rights only, no governance rights, under transfer-default law.
- Nominal consideration, successor-member admission language, manager/authority continuity
  through the transfer, and **no interim membership or management rights while a minor**.
- Minor-protective boilerplate: no capital calls, no personal guarantees, liability limited to
  contributed capital, custodian/guardian exercises any votes, plus a **ratification-at-majority
  clause** (written ratification within 90 days of 18, or deemed ratified by continuing to accept
  benefits).
- Family-law overlay to acknowledge: OCGA § 19-7-1(a) entitles the custodial parent to the
  child's services/proceeds until 18 — the parent here sits on both sides of the arrangement.

### 1.3 IP — two buckets, different instruments (load-bearing; the revenue depends on it)

A minor's contract is **voidable at the minor's election** (during minority or a reasonable time
after 18), and Georgia is a **non-Coogan state** — no court-approval procedure exists to
pre-immunize a minor's IP contract from disaffirmance. No case law anywhere resolves whether a
minor can disaffirm a copyright assignment or work-for-hire clause, so this is risk-mitigation
engineering, not a guaranteed fix:

1. **Pre-existing codebase (the headline exposure).** Everything written before a bona fide
   employment relationship is the minor's property and moves only by assignment — a voidable
   contract. Reinforce: guardian/parent execution now (binds the parent's guaranty, NOT the
   minor — never the primary lever), consideration that keeps flowing, and a **mandatory written
   re-confirmation executed at 18** on top of the O.C.G.A. § 13-3-20(a) conduct-ratification
   backstop (retaining benefits after majority ratifies).
2. **Future code → statutory work-made-for-hire** (17 U.S.C. §§ 101(1), 201(b)): copyright vests
   in the LLC by operation of law IF the employment is genuinely bona fide — real W-2 wages,
   control, tools, contemporaneous time/task logs, a rate benchmarked to an unrelated junior
   developer, regular pay cadence (not year-end revenue-linked bonuses). _Embroidery Express v.
   Comm'r_, T.C. Memo. 2016-136 and _Fisher v. Comm'r_, T.C. Summ. Op. 2016-10 show what fails.

O.C.G.A. § 13-3-21 (minor in a trade with parental permission) is a narrow, untested-against-IP
fallback — document the parental permission anyway, but don't build on it.

### 1.4 Employment of a minor child — why the tax posture is locked

Wages the LLC pays the owner's under-18 child are FICA-exempt (IRC § 3121(b)(3)(A)) and this
survives for a parent-owned disregarded SMLLC (26 CFR § 31.3121(b)(3)-1(d)); FUTA the same to 21.
Income-tax withholding is NOT exempt. The exemption breaks on a corporate election or a
non-parent member — this is WHY no S-corp election, and the lawyer must check any trust-as-owner
continuity fix (§1.1) against it before recommending one.

### 1.5 Banking authority + operating-authority gap

Sole member is sole signer (Mercury); power to appoint the operator as an authorized
agent/employee without granting membership. Separately: close the **operating-authority gap** on
death/incapacity — who can access Mercury, the Paddle merchant account, the GitHub org
(`caisson-sh`), the domain registrar, and 1Password between the event and the successor's
qualification. Naming a successor member alone grants none of this.

### 1.6 Capital + distributions — not boilerplate

With real Paddle revenue flowing, vague capital-account language creates wrongful-distribution
liability (OCGA § 14-11-408), not just ambiguity. Fill Exhibit 1 with a real contribution. Note
the fiduciary-exculpation floor: a written OA may modify duties but cannot exculpate intentional
misconduct, knowing legal violations, or improper personal benefit (§ 14-11-305(4)(A)).

The final OA is a private minute-book document (GA SOS refuses OA filings) — but Paddle KYB and
Mercury will both ask for a signed copy, so it must be signed even though state law doesn't
require it.

## Scope 2 — commercial paper (EULA / ToS / refund / privacy under Paddle MoR)

1. **Two-contract structure.** The buyer contracts with _Paddle_ (Buyer Terms) for the purchase;
   Caisson's EULA governs only the software license. The EULA must never claim Caisson is the
   seller and never promise to issue refunds directly (Paddle MSA §10.1).
2. **Mandatory verbatim MoR attribution** in the site T&Cs: "Our order process is conducted by
   our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders.
   Paddle provides all customer service inquiries and handles returns."
3. **Refund policy stays unconditional** — zero qualifiers, no fee deductions, no fault-based
   exceptions (the #1 Paddle rejection cause; already live on the site as a 14-day unconditional
   guarantee). Lawyer question: keep 14 days or lift to a 30-day floor (the research
   recommendation) — either way it sits ON TOP of Paddle's own refund policy and the statutory
   EU/UK 14-day withdrawal right; **highest protection wins**, the vendor policy can only add.
   Do not draft anything that contradicts the immediate-performance cooling-off waiver Paddle's
   checkout already collects.
4. **EULA review** (`apps/site/app/legal/eula/page.tsx`): per-org no-seat licensing (ADR-0305),
   the continuity clause (ADR-0276/0282), the subscription-refund coverage-horizon claw
   (ADR-0302), 12-month updates windows + perpetual-ownership framing (ADR-0244/0251),
   evaluation-license terms (ADR-0274/0280), plus the standard elements: limited non-exclusive
   non-transferable grant, prohibited uses (no reverse-engineering/redistribution/resale),
   retained IP, AS-IS disclaimer, liability cap to fees paid, termination, governing law.
5. **License-scope separation.** The Apache-2.0 open base (public mirror) vs the commercial
   bundles ship under one brand — the EULA must expressly NOT claim rights over the
   Apache-licensed code, or a court could read it as trying to.
6. **ROSCA independence.** The FTC sued Paddle in 2025 (No. 1:25-cv-01886, D.D.C.) over
   processing for deceptive merchants — Caisson's own subscription disclosures
   (price/frequency/auto-renewal/cancellation) must satisfy ROSCA independently of Paddle's
   checkout UI. Also flag the counterparty/continuity risk: chargebacks are disputed against
   Paddle but Caisson bears the economic loss, and Paddle can restrict the account for excessive
   disputes — a single payment rail with no permitted parallel processor.
7. **Privacy policy** covers Plausible (cookieless), PostHog (dashboard routes), OTLP telemetry,
   and the support-bot Discord surface.
8. **Tax note for the CPA leg:** Paddle registers/collects/remits sales tax/VAT as the taxable
   seller; Caisson reports GROSS payouts as income and deducts Paddle's fee; confirm 1099-K
   treatment (threshold unstable) and confirm directly with Paddle whether any W-9 step exists
   (their docs show a self-billed "Reverse Invoice" instead — absence of evidence, verify with
   sellers@paddle.com).

## Scope 3 — open-core + trademark (policy NOW; USPTO filing DEFERRED — operator lock 2026-07-10)

1. **Apache-2.0 §6 grants no trademark rights** — a pure carve-out. Publishing
   `caisson-sh/caisson-oss` under Apache-2.0 licenses nobody to name a fork "Caisson," and a
   copyright license never implies a trademark license. Cite both doctrines in the policy.
2. **`TRADEMARK.md` must exist before the public mirror flips** (ties to ADR-0318 W0):
   adapt Elastic's four rules (mark never part of a product name · less prominent than the
   user's own name · no implied affiliation · mandatory attribution), require forks to take a
   genuinely NEW name (the Redis→Valkey precedent), and spell out nominative fair use with
   do/don't examples ("works with Caisson" / "plugin for Caisson" safe; "Caisson Pro" or the
   mark as head noun unsafe).
3. **Open-core boundary sanity pass** — mechanical, not just contractual: (a) no commercial-only
   code ever shipped under an Apache LICENSE at any point in history (the grant is irrevocable
   per snapshot — relevant to the ADR-0094/0097/0136 flips); (b) the mirror carries an explicit
   LICENSE split; (c) the EULA claws back nothing Apache granted; (d) chain of title on the
   flipped packages is clean first-party (any pre-flip external contribution without
   CLA/assignment complicates title).
4. **Deferred filing, recorded for later:** when traction justifies it — Section 1(a)
   use-in-commerce, dual class (9: downloadable packages/CLI/generator · 42: hosted
   services/registry), ~$700 USPTO base fees, honest goods/services scoping by first-use date.
   **Precondition: a comprehensive clearance search first** — "caisson" is a real engineering
   term, adjacent-industry prior use is plausible, and a conflict at examination forfeits the
   fee. No search has been run yet; it is the first action when filing is picked back up.

## Deliverables checklist

- [ ] Final operating agreement — continuity-aligned (ADR-0276/0282), transfer-at-18,
      minor-protective terms, banking/operating authority, real Exhibit-1 capital
- [ ] Executed IP instrument set — pre-existing-code assignment (+ ratification-at-18 rider) and
      bona-fide-employment / work-for-hire paper for future code
- [ ] Employment-of-minor documentation pattern (wage basis, time logs, W-2 posture)
- [ ] EULA redline + accepted final
- [ ] ToS/privacy/refund redlines (refund wording stays Paddle-unconditional; 14-vs-30-day call)
- [ ] Open-core boundary memo (short)
- [ ] `TRADEMARK.md` text for the mirror (policy only; no filing)

## Sequencing

- **Engage now.** OA final + IP instrument wanted **before first sale**, not before the Paddle
  application.
- **Paddle production application: SUBMITTED NOW** (operator lock 2026-07-10). Business
  verification wants formation docs + a member/ownership document — the draft OA suffices;
  Paddle explicitly does not take EIN/tax paperwork. Feed any verification objections to the
  lawyer as addenda; do not hold the engagement for them.
- **Mercury: APPLYING NOW with the draft OA** (EIN issued 2026-07-10, same-day). Banking is not
  gated on the lawyer-final OA.
- Trademark filing deliberately deferred to post-launch traction; the usage POLICY ships with
  the mirror.
