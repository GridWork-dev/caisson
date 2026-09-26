// @caisson-sh/frameworks-pack — compliance framework catalogs as config-as-code. Carved out of the
// Compliance edition (ADR-0246/0257) so the control packs are usable standalone: the typed
// canonical-control model (Zod-strict builders, clean-room authorship) plus the three own-authored
// framework packs, each control crosswalked to the external framework's requirement ids. The
// evidence engine (@caisson-sh/compliance-core) consumes catalogs shaped like these; the Compliance
// edition composes both.

// --- Control model — typed registry builders (defineControl / defineFramework). -----------------
export * from "./registry/control.ts";

// --- Own-authored framework packs (never an external-catalog transform). ------------------------
export * from "./frameworks/soc2-tsc.ts";
export * from "./frameworks/hipaa-security.ts";
export * from "./frameworks/eu-ai-act.ts";

// --- Named-regime crosswalks (ADR-0277 data + ADR-0279 claim posture) — the customer-facing five-column
// SOC 2 / PCI DSS / GDPR mapping with a machine-readable claim level, a required proof pointer for
// every assertive row, and the disclaimer embedded in the export artifact.
export * from "./crosswalks/regimes.ts";

// --- ISO/IEC 27001:2022 Statement of Applicability (SoA) row computation — pure, flag-never-guess. -
export * from "./soa/iso-27001-soa.ts";

// --- OSCAL compatibility surface (ADR-0384) — the complete carve re-exported unchanged. ----------
export * from "@caisson-sh/oscal-spine";
