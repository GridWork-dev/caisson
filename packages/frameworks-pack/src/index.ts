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
