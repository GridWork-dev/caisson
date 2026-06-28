# ADR-0083 — Local-first AI is fully commercial (removes the AGPL flank)

**Status:** accepted · 2026-06-28 (go-live copy session — operator-decided). **Supersedes:** the
**Local-first AGPL flank** in ADR-0023 (and the open-core carve-out in ADR-0010 §"open-core
boundary"). The rest of ADR-0023 (fully-commercial model, `LicenseRef-Caisson-Commercial`, no
permissive tier) and ADR-0010 (Ed25519 offline licensing, entitlements, pro-private firewall) stand.
**Relates:** ADR-0012 (pricing — Local-first anchored $349–599), ADR-0082 (go-live posture), ADR-0022
(AGPL contamination gate — now moot).

ADR-0023 kept **one** open flank: "the Local-first AI edition is `AGPL-3.0-only`." The operator
reversed this — **Local-first is now a regular commercial edition like the other three.** There is
**no AGPL, no free tier, and no copyleft caveat** anywhere in the product.

## The decision

- **Local-first AI ships under `LicenseRef-Caisson-Commercial`** — identical model to Compliance, AI
  Production Kit, and Agentic-Dev: buy once, build unlimited products, no resale/redistribution of the
  kit. Manifest `tier` = `paid`, `license` = `LicenseRef-Caisson-Commercial` (ADR-0020).
- **Price: from `$499`** (one-time, own-the-source), inside the ADR-0012 Local-first range
  ($349–599). Operator may adjust the final number before checkout goes live (ADR-0082 commits the
  displayed point prices).
- **`oss` tier is removed from the product** — no module is `oss`; the SPDX allowlist (ADR-0020) keeps
  only the commercial `LicenseRef`. The **AGPL contamination gate (ADR-0022) becomes a no-op** (kept as
  a defensive backstop, but no AGPL code exists to contaminate).

## Why (the operator's reasoning)

The AGPL flank existed for three optional reasons — tessera lineage (already public AGPL), an
open-source distribution flywheel, and a dual-license upsell. The operator does not want a free
community on-ramp at the cost of: (a) the misleading "Free" the site was showing a closed-source
regulated-SaaS buyer, who could never actually use AGPL code without open-sourcing their product;
(b) the licensing inconsistency (one edition on a different model); (c) the dual-license + contamination
-gate complexity. A single commercial model across all four editions is simpler, consistent, and
honest for the real buyer.

## Consequences

- The site must **stop showing Local-first as "Free" / "AGPL"** — the SKU cell becomes a price, the
  page reframes as a paid edition (handled in ADR-0082's copy pass).
- `tessera`'s AGPL lineage no longer governs the shipped edition — Local-first is **rebuilt clean**
  under the commercial license (the pro-private firewall + rebuild-clean rule, CLAUDE.md, already
  required this; only the license label changes).
- No open-source community edition exists. If a free/OSS on-ramp is ever wanted, it returns via a
  **new ADR** (e.g. a deliberately-scoped free "core" demo), not by reviving the AGPL flank.

## Rejected

- **Keep the AGPL dual-license** (ADR-0023 as-is) — the open-source funnel wasn't worth the "free"
  confusion + licensing inconsistency for this operator.
- **AGPL self-host free + monetize hosted/pro only** — still surfaces the copyleft caveat the operator
  wanted gone.

## Binding

Local-first AI is `LicenseRef-Caisson-Commercial`, priced from $499 (operator-adjustable pre-checkout).
No `oss` tier, no AGPL, no free tier anywhere in the product. `lib/pricing.ts` + every site surface
drop the "Free"/"AGPL" representation (ADR-0082). The AGPL gate stays as an inert backstop.
