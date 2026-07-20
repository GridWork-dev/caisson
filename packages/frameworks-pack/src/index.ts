// @caisson/frameworks-pack — compliance framework catalogs as config-as-code. Carved out of the
// Compliance edition (ADR-0246/0257) so the control packs are purchasable standalone: the typed
// canonical-control model (Zod-strict builders, clean-room authorship) plus the three own-authored
// framework packs, each control crosswalked to the external framework's requirement ids. The
// evidence engine (@caisson/compliance-core) consumes catalogs shaped like these; the Compliance
// edition composes both.

// --- Control model — typed registry builders (defineControl / defineFramework). -----------------
export * from "./registry/control.ts";

// --- Own-authored framework packs (never an external-catalog transform). ------------------------
export * from "./frameworks/soc2-tsc.ts";
export * from "./frameworks/hipaa-security.ts";
export * from "./frameworks/eu-ai-act.ts";

// --- Named-regime crosswalks (ADR-0277 data + ADR-0279 claim posture) — the buyer-facing five-column
// SOC 2 / PCI DSS / GDPR mapping with a machine-readable claim level, a required proof pointer for
// every assertive row, and the disclaimer embedded in the export artifact.
export * from "./crosswalks/regime-crosswalk.ts";
export * from "./crosswalks/regimes.ts";
export * from "./crosswalks/nist-800-53.ts";

// --- ISO/IEC 27001:2022 Statement of Applicability (SoA) row computation — pure, flag-never-guess. -
export * from "./soa/iso-27001-soa.ts";

// --- Vendored NIST SP 800-53 rev5 OSCAL catalog (SPEC oscal-spine, ADR-0363/0364) — the pinned
// source bundle + control-id existence surface the nist80053Crosswalk is checked against.
export * from "./vendor/nist-catalog-pin.ts";
// Only the PURE parser + its type are public. `loadVendoredNistControlIds` does I/O relative to
// its own module file and ENOENTs from a built dist/ tree (bare tsc ships no JSON copy) — it
// stays a package-internal test/re-vendor-script helper, imported by relative path where it's
// genuinely needed. Regression-pinned in index.test.ts.
export {
  extractControlIds,
  type NistCatalogDocument,
} from "./vendor/nist-catalog-controls.ts";
