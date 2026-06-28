# ADR-0050 — Local-first AI edition is fully-commercial (kills the AGPL open flank)

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Closes the lone non-commercial
flank ADR-0023 carved out for Local-first AI.)

ADR-0023 made every module commercial **except** one deliberate open flank: the Local-first AI
edition shipped `AGPL-3.0-only` (← public `tessera`) as a community/distribution play. That flank
was the sole source of copyleft in the tree, and it dragged a standing legal + tooling burden — an
AGPL→commercial contamination gate, a dependency budget, a mixed-license reference-app question, and
a dual-license revenue model. The operator closed it.

## Decision

- **The Local-first AI edition ships `LicenseRef-Caisson-Commercial`, like every other edition.** No
  open-source, no AGPL, no copyleft anywhere in the product.
- **Licensing is now uniform across all packages and editions** — `tier: paid`,
  `license: LicenseRef-Caisson-Commercial`, no exceptions. The manifest `oss` tier (ADR-0023) marks
  nothing and is dead.
- **Supersedes the AGPL "sole open flank" clause of ADR-0023** (append-only; the rest of ADR-0023 —
  uniform commercial EULA, no permissive tier, SPDX allowlist, buyer rights — stands and now applies
  without exception).
- The combined-work / copyleft-downward problem is **eliminated**: no AGPL exists in the tree, so
  copyleft can never reach the commercial base. **ADR-0022 Gate-1 (AGPL→commercial import block)
  never fires** — there is no AGPL source for it to catch. The gate stays wired as a tripwire (a
  re-introduced AGPL dep must still hard-fail), but it is dormant by construction.
- The following all collapse to **moot**: the AGPL dependency budget; the AGPL-consumes-commercial
  legal gate on the shared local-store; the mixed-license reference-app question; and the local-ai
  dual-license (community-AGPL + paid-commercial) revenue model.

## Rejected

- **Keep AGPL as a free open-core funnel** (community AGPL + paid commercial dual-license) — preserves
  a free-adoption channel but reinstates copyleft-downward forks, a CLA/dual-license surface, and the
  contamination gate as a live (not dormant) concern. The operator chose uniform commercial over the
  funnel.
- **Permissive OSS (MIT/Apache) free edition** — zero moat: anyone can fork, resell, or SaaS-ify the
  kit. Already barred from the SPDX allowlist (ADR-0023/0020); not reopened here. Losing the free-OSS
  adoption funnel is accepted as a **GTM tradeoff, not a technical one**.

## Binding

No `AGPL-3.0-only`, no copyleft, and no permissive/free license enters the Caisson tree or SPDX
allowlist; the Local-first AI edition's manifest is `tier: paid`,
`license: LicenseRef-Caisson-Commercial`, identical to every other edition; future code and agents
treat licensing as uniform and may not re-carve an open flank without superseding this ADR. The
ADR-0022 AGPL gate remains as a dormant tripwire — any re-introduced AGPL dependency hard-fails CI.
Evidence: ADR-0023 (fully-commercial model + the AGPL flank this retires), ADR-0022 (AGPL
contamination gate now dormant), ADR-0020 (SPDX allowlist / `tier` field), ADR-0003 (composable
editions never fork); `tooling/` + `registry/` standards seam; research artifact
`outputs/research/wave1-forks.md`.
