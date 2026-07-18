# PLAN — Dual-catalog OSCAL spine

- **Executes:** `outputs/specs/oscal-spine/SPEC.md` (LOCKED — ADR-0363 build-now + ADR-0364
  fork locks F2-F5; F1 bound by ADR-0363's text). No open forks: every decision below is
  derivable from the locks.
- **Branch:** `feature/oscal-spine` (one PR). **Tags:** `product`, `security`.
- **Placement (F3):** data + vendored blob in `packages/frameworks-pack`; generator +
  drift-check in `packages/compliance-core`. No new package, no SKU, no pricing rows.

## Tasks (ordered — 1 before 3, since 3's provenance pins 1's hash)

1. **Vendor the NIST SP 800-53 rev5 catalog (SPEC b).** Fetch
   `usnistgov/oscal-content` path `nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json`
   at a specific commit SHA (resolve the current main tip; never track `main`). Commit the
   verbatim bytes at `packages/frameworks-pack/src/vendor/nist-800-53-rev5-catalog.json`
   plus ONE pin constant module (`vendor/nist-catalog-pin.ts`): source URL at commit,
   commit SHA, upstream catalog `version` (5.2.0 expected), `oscal-version` (1.2.2 — must
   match the ADR-0179 CI pin), SHA-256 of the exact bytes. Binding req 1: the vendoring
   script, the crosswalk's `seedProvenance`, and the drift test all read THIS one constant.
   Drift guard = a frameworks-pack unit test hashing the committed file against the pin
   (rides the `check` gate — no new CI job). The vendoring script
   (`packages/compliance-core/scripts/vendor-nist-catalog.ts` or sibling) doubles as the
   binding-req-2 re-vendor procedure: `--refetch` re-fetches, re-hashes, structurally
   diffs (added/removed/renumbered control ids), and reports which mapping rows' provenance
   goes stale — report-only, never auto-writes the pin.
2. **OSCAL catalog exporter (SPEC a, F4 = one merged catalog).**
   `packages/compliance-core/src/evidence/oscal-catalog-export.ts`, sibling pattern to
   `oscal-export.ts` (pure, injected `now`/`newId`, no I/O). Input `Framework[]` from
   frameworks-pack; output one OSCAL `catalog` document — groups mirror each control's
   `family`, control ids under the caisson URN namespace, product-specific controls stay
   native. Golden-fixtured deterministic output. Extend the `oscal-conformance` CI job:
   `oscal-cli validate` on (i) the generated catalog and (ii) the vendored NIST catalog
   (corruption check). Validate locally if oscal-cli installs cleanly; otherwise rely on
   the CI leg and say so in the report.
3. **`nist80053Crosswalk` (SPEC c, F1 shape + F2 OLIR-verbatim override).** Widen
   `RegimeId` with `"nist-800-53"`; new crosswalk beside `regimes.ts` riding the
   regime-crosswalk pattern with the OLIR row extension SCOPED TO THIS CROSSWALK ONLY:
   `relationship: subset-of | intersects-with | equal | superset-of | not-related-to`,
   `rationale: syntactic | semantic | functional`, optional integer `strength` 0-10
   (NIST IR 8278A vocabulary, verbatim). `claim` structurally capped `"maps-to"` (no row
   carries `verification`); `canonicalControlId` REQUIRED on every row; crosswalk-level
   `seedProvenance` pins task 1's bundle (URL@SHA + sha256). Rows are OWN-AUTHORED —
   caisson canonical controls related to 800-53 controls, each checked to exist in the
   vendored catalog; honest coverage over the shipped packs (expect the AC/AU/SC/SI/CP/IA
   families to dominate), no padding. Golden `crosswalk-nist-800-53.json` beside the four
   existing goldens.
4. **Rollup generalization.** `computeCrosswalkRollup`'s hardcoded ISO-only pass 2 becomes
   a loop over every `regimeCrosswalks[]` entry carrying `canonicalControlId` rows. The
   existing ISO fixtures/goldens must stay BYTE-IDENTICAL (regression pin); a NIST-800-53
   cell renders from a collector-pass fixture exactly as ISO does; structural test: an
   800-53-driven contribution can never render `implements`.
5. **Scheduled watch job (F5 override).** Weekly advisory GitHub Actions cron (the
   `toolchain-advisory` lane precedent): runs the task-1 script in `--refetch` diff mode
   against the upstream path, FLAGS a structural diff in the job summary, never writes,
   never auto-applies, no new credential (public repo reads). Advisory-only — not a
   required check.
6. **Gates + prose.** Structural tests: every crosswalk row `maps-to` with zero
   exceptions; every `canonicalControlId` resolves to a real shipped control; the copy
   guard greps the new artifacts' notes for `compliant|certified|FedRAMP` (reuse the
   existing `postureCopy`/rollup-note regex pattern — binding req 3, no marketing copy
   changes anywhere). Changesets: frameworks-pack minor (new regime axis + vendored
   reference catalog) + compliance-core minor (catalog exporter) — buyer-readable, NO
   tracker ids. Full gate set: turbo build/lint/test on both packages + dependents, the
   standards-gate PACKAGE test suite (`--force`), standards-gate CLI, `bun run sot`.

## Routing

Builder: `gw-typescript-pro` (sonnet), worktree off main. SHIP: opus review + security
audit (opus lane — the `security` tag fires the audit; no money/license/crypto seam, so
fable is not drawn). No `ai` tag — no model logic.

## Non-goals (locked)

No new package/SKU · no per-framework catalogs · no Merkle commitment (ADR-0331 stays
parked) · no marketing/GTM copy of any kind · no other regime.
