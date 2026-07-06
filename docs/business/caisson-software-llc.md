---
updated: 2026-07-06
status: live
owner: operator (business/legal track)
---

# Caisson Software LLC — entity record, EIN cheat sheet, OA brief, post-approval runbook

The business/legal side of the commerce flip. This doc is the SOT for entity facts and the
formation → banking → Paddle-production order of operations. Product/launch mechanics stay in
`docs/state/launch-runbook.md` (this doc feeds its §2 Paddle-production prerequisite).
Personal details (member identity documents, SSN, home address) live OUTSIDE the repo — never
here.

## 1. Entity record

| Fact               | Value                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Legal name         | **Caisson Software LLC** (exact string everywhere legal: EIN application, Mercury, Paddle, site ToS/EULA) |
| Type               | Georgia limited liability company, **member-managed**, single member                                      |
| Member             | Operator's designated sole member, 100% (details off-repo); membership **omitted from the state filing**  |
| Registered agent   | Northwest Registered Agent (GA); their address is the public/service-of-process address                   |
| Formation          | Filed via Northwest 2026-07-06; standard GA processing ~1 week                                            |
| EIN                | Northwest EIN order in flight, est. 2026-07-15 (form cheat sheet §2)                                      |
| Public locale line | "based in Atlanta, Georgia" — **no street address on the site**                                           |
| Business email     | **admin@caisson.sh** (all legal/privacy/business contact points; replaces legal@/privacy@gridwork.dev)    |
| Tax posture        | Disregarded entity (default). **No S-corp election** — deferred until ~$50k+ profit or ownership transfer |
| Brand vs legal     | Public brand stays "Caisson"; the legal name appears in ToS/EULA/privacy + payment/bank/tax surfaces only |

Where each address goes (the "full address" question — answered):

- **Site / ToS / EULA / privacy:** entity name + "Atlanta, Georgia" + admin@caisson.sh. No
  street address required. Paddle's domain review looks for the legal name in the terms — the
  entity sweep (in flight on the catalog branch) puts it there.
- **Service of process / state mail:** Northwest's RA address (included in the service).
- **IRS / EIN / Mercury:** the REAL principal (home) address — these records are not public.
- **Buyer receipts/invoices:** Paddle's own details — Paddle is merchant of record (ADR-0222).

## 2. EIN form cheat sheet (the Northwest "Awaiting Client Input" order)

| Field                                                            | Enter                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Responsible Party                                                | The sole member — name EXACTLY as on her Social Security card, her SSN, her phone                                   |
| Number of members                                                | **1**                                                                                                               |
| Start date                                                       | The GA approval/formation date (from the stamped Articles)                                                          |
| Company purpose                                                  | "Software publishing and licensing"                                                                                 |
| State of organization                                            | Georgia                                                                                                             |
| Physical address                                                 | **Use my address** (the real home/principal address — IRS records are not public; Mercury later wants the real one) |
| Mailing address                                                  | Home, or Northwest's if preferred (either fine)                                                                     |
| Highway vehicle / gambling / Form 720 / alcohol-tobacco-firearms | **No** to all                                                                                                       |
| Employees receiving W-2s in next 12 months                       | **No** (payroll can start later without pre-declaring; a Yes triggers employment-tax filing expectations now)       |
| Signature                                                        | The sole member, dated                                                                                              |

Keep the resulting CP 575 EIN letter — Mercury and Paddle both want it.

## 3. Operating agreement — the lawyer brief

One signature-ready **operating agreement** plus one **minor-IP-assignment instrument**,
Georgia law, names/addresses exactly matching the member's ID and the EIN record. What it must
contain beyond a standard single-member member-managed GA template:

1. **Transfer-at-18.** The defining custom clause set: 100% of the membership interest
   transfers/assigns to the operator upon his 18th birthday (automatic or exercisable option —
   lawyer picks the cleaner GA mechanism), nominal consideration, successor-member admission
   language, manager/authority continuity through the transfer, and no interim membership or
   management rights for the operator while a minor.
2. **IP assignment (load-bearing — the product revenue depends on it).** All work product the
   operator (a minor) creates for the business is assigned to the LLC. Minors can disaffirm
   contracts, so the lawyer must pick the enforceable GA mechanism (guardian co-signature /
   ratification by the sole member, periodic re-confirmation, or an OA exhibit). Must cover
   already-created work (the existing codebase) retroactively AND future work.
3. **Employment of a minor child.** The LLC (disregarded, parent-owned) may pay the under-18
   child wages exempt from FICA/FUTA. Document the duties + reasonable-wage basis. This is
   also WHY the entity must stay a disregarded entity for now — an S-corp election kills the
   exemption (recorded in §1 tax posture).
4. **Banking authority.** Sole member is the sole signer (Mercury); power to appoint the
   operator as an authorized agent/employee without granting membership.
5. **Succession.** Death/incapacity of the sole member — transfer-on-death aligned with the
   at-18 clause (lawyer's call on mechanism).
6. Standard single-member terms otherwise: capital, distributions, dissolution, amendment
   (amendments require the sole member; no operator consent rights while a minor).

## 4. Order of operations — LLC approval → revenue-capable (dedicated session)

Run as its own session when the GA approval lands. Steps in hard order; parallel where noted.

0. **Now / parallel (already moving):** GA filing processes · the site entity sweep
   (Caisson Software LLC + admin@caisson.sh) rides the catalog-rework branch · **verify
   admin@caisson.sh actually receives mail** (operator: wire the mailbox/alias before Paddle
   or lawyer correspondence uses it).
1. **GA approval** → pull the stamped Articles of Organization from the Northwest dashboard.
2. **EIN** → complete the Northwest EIN order per §2 → CP 575 letter in hand.
3. **Operating agreement + IP assignment** signed per §3 brief (before Mercury — banks may ask
   for the OA; the IP assignment should predate revenue).
4. **Mercury** → the sole member applies DIRECT at mercury.com (never via a referral/affiliate
   layer): Articles + EIN letter + real principal address. Outcome: checking account + payout
   details for Paddle.
5. **Paddle production** (`launch-runbook.md` §2.1): business type **Private**, legal name
   **Caisson Software LLC**, the sole member as the 25%+ owner/representative, Mercury for
   payouts, EIN + Articles for verification. **Domain review dependency:** Paddle must be able
   to READ the site's ToS/pricing/refund/privacy — the site is CF-Access-gated pre-launch, so
   either the site_gate flips first or the legal + pricing routes get a public carve-out
   before domain review. Operator decision at the dedicated session — do not pre-decide here.
6. **Paddle production catalog** (`launch-runbook.md` §2.2/§2.3): operator creates the
   ADR-0257/0258 target catalog in the production dashboard (sandbox never ports); an agent
   then lands the §2.3 pricebook/catalog re-point PR with the new `pri_…` ids.
7. Continue the launch-runbook §1.1 gates (credential rotations, mirror scan, caisson-oss
   flip) — independent of this chain, already tracked in `docs/state/outstanding-work.md` §1.

**Dependency spine:** Articles → EIN → OA/IP → Mercury → Paddle account → production catalog →
checkout flip. The catalog-rework W7 sandbox big-bang is independent of ALL of this (sandbox
creds already on the box) — only production Paddle waits on the entity chain.
