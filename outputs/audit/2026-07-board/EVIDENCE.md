# EVIDENCE.md — Phase-0 master index (caisson board audit, 2026-07-23)

Snapshot: caisson `main` @ `f6df03f9` (contains the shipped ADR-0378 site redesign —
see the E-I2 correction). Every persona reads THIS file first; section files carry
the numbered evidence items. Cite by E-id; an uncited claim is ASSUMED.

| Section              | File                       | Id space   | One-line scope                                                                                                                          |
| -------------------- | -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Repo + branches      | `EVIDENCE-repo.md`         | E-A*, E-I* | monorepo inventory, LOC scale, consolidation candidates, LLM-provider spread; E-I2 CORRECTED: redesign merged+deployed                  |
| Site + market voice  | `EVIDENCE-market-voice.md` | E-B*       | deployed-site positioning/CTAs ($1,449 compliance SKU), zero organic mentions, incumbent complaint wedges                               |
| Competitor deltas    | `EVIDENCE-competitors.md`  | E-C*       | Sentrik (closest mirror), Comp AI + Probo (missed entrants), AuditKit "After Delve", MS toolkit escalation, EU AI Act Art. 50 confirmed |
| First-party corpus   | `EVIDENCE-firstparty.md`   | E-D*       | Cookiy ICP studies, WTP legs + self-warnings, cost rollup, standing ADR-locks table, 2026-07-13 audit recap                             |
| Demand ledger        | `DEMAND-LEDGER.md`         | (tables)   | explicit zeroes: 0 outreach sent, 0 waitlist, site gated, repo private, $0 revenue; go-live held on Mercury/Paddle                      |
| Product data         | `EVIDENCE-product-data.md` | E-P*       | 30d: 1 visitor / 2 sessions; sufficiency gate TRIPPED                                                                                   |
| Operator constraints | `OPERATOR-CONSTRAINTS.md`  | (doc)      | solo, self-funded, pre-revenue; [CONFIRM] fields pending operator                                                                       |

## Binding gates (from the evidence itself)

1. **Sufficiency gate (E-P1/2):** all funnel/CAC/activation claims ASSUMED;
   pricing/pivot decision rows at best EXPERIMENT-FIRST.
2. **WTP self-warning (E-D):** the corpus itself forbids pricing locks at current
   n — recommendations must respect it or argue against it BY NAME.
3. **Quarantined items:** E-C5 (Delve/LiteLLM) — corroborated core, uncorroborated
   partnership-drop claim; E-C10 SynthetIQ figure low-confidence; Probo funding
   facts conflict. Cite only with the CONTESTED tag.
4. **Not re-verified this cycle (E-C12):** eight baseline items — absence of a
   delta there is a research gap, not stability evidence.
5. **Standing ADR locks (E-D table, spot-audit-corrected):** 0040 positioning ·
   0297 design-partner terms · **0373 SKU arming (2026-07-20) — Compliance now
   $1,449, SUPERSEDING 0304's $1,049 anchor** · 0305 per-org licensing · 0328
   research budget · 0085 waitlist seam · 0080 copy law. Contradict only
   explicitly. **WTP anchor gap (spot-audit): every Study-1 price reaction was
   gathered at $1,049 — 38% below the live $1,449; no persona may cite Study-1
   WTP as validation of the CURRENT price.**

## Spot-audit status

COMPLETE — `EVIDENCE-spot-audit.md` (17 items sampled, 13 verified-as-stated).
Binding corrections: the gate-5 rewrite above; ADR count is 328 (not 302, E-A7);
**the CF-Access gate is no longer observably up (2026-07-23)** — E-P1's zero
traffic is no longer fully attributable to gating (weak, days-old demand signal);
EU Art. 50 correct-the-rumor copy must not overclaim (a Dec-2026 grace period
exists for one marking obligation).
