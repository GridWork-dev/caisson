# ADR-0248 — OSS-line written standard (buyer-based + ratchet + SPDX) and the package-split checklist + gates

**Status:** accepted · 2026-07-05 (catalog-rework picker F4/F5, run in the SOT-expansion session;
F4 first typed as (b) and corrected by the operator to **(a)** in the same round — (a) is the
lock). **Extends** ADR-0094/0136 (the line as drawn today keeps force until redrawn under this
standard); constrains future flips. Append-only; supersede with a later ADR, never edit.
**Tags:** none at lock; the gate-check build inherits the standards-gate critical path.

## Decision

1. **F4 = (a) — the buyer-based open-core standard is adopted as the WRITTEN line-drawing rule:**
   - **Who-it-serves test:** value that accrues to an individual developer's workflow (build,
     compose, run locally, verify) → **open**. Value that accrues to the BUYER as an
     organization (compliance evidence, money movement, license enforcement, org controls,
     audit posture) → **commercial**. Mixed packages split (see F5) rather than straddle.
   - **Ratchet:** once a package version is published open, that surface is **never re-closed**
     (supersede-forward only — a successor package may be commercial; published-open code stays
     open). Every documented open-core failure in the evidence base was a retroactive close.
   - **SPDX-is-the-boundary:** the `license` field of each `package.json` is the single
     machine-readable line marker, enforced by the standards-gate (`OPEN_BASE_NAMES` +
     `checkOpenCoreLicensing`/`checkOpenCommercialBoundary`). No side lists.
   - Fair-Source/BUSL-class licenses are OUT — two-license clarity only (Apache-2.0 ·
     LicenseRef-Caisson-Commercial).
2. **Pre-launch redraw clause (binding nuance):** the ratchet engages **at first public release
   per package**. Nothing is published today (npm publish gated `confirm=publish`; the
   `caisson-oss` mirror is private). Therefore redrawing the line before launch — including
   flipping currently-Apache base packages to commercial and splitting `packages/ui` into a
   basic-OSS floor plus a deep commercial design package — is **permitted now and is exactly the
   scope of the in-flight brainstorm**. Candidates lock per-package in the follow-up picker; no
   flip is decided by this ADR. After first publish, flips are one-way.
3. **F5 = (a) — the package-split checklist + 4 standards-gate checks are adopted:** the
   §4.4 checklist from `outputs/research/catalog-doctrine-2026-07.md` becomes the written
   split standard (when a package MUST split: mixed buyer-based verdicts, N≥3 external
   consumers of a separable concern, sellable-surface-inside-a-nonsellable-package, tier
   mismatch), and the four gate checks it names (orphan-SKU detection, price-coverage,
   catalog↔manifest parity, split-trigger advisory) are QUEUED as a standards-gate build item
   (code tree — rides a code session, advisory first, promotion to enforced by a later lock).

## Consequences

- The brainstorm's flip/split candidates each get a per-package verdict against §1's test in the
  follow-up picker; locked flips execute BEFORE first publish or not at all (ratchet).
- The standards-gate build item lands on the tracker (Build-gated); its diff touches the
  greptile-gate critical path and reviews accordingly.
- `docs/gtm/pricing-packaging.md` and the public-surface docs cite this ADR as the line-drawing
  authority once the redraw round completes.
