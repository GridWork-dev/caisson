// The browser-safe entry (`@caisson-sh/frameworks-pack/browser`, ADR-0396): the control model, the
// three own-authored framework packs, the named-regime crosswalks, the SoA computation, and the
// browser half of the OSCAL compatibility surface. This is src/index.ts with exactly ONE
// substitution — `@caisson-sh/oscal-spine` -> `@caisson-sh/oscal-spine/browser` — so the node-only spine
// modules (the delivery transport, the oscal-cli spawn, the vendored-catalog fs reader) never
// enter a bundle graph. ADDITIVE: `.` and `./registry` are untouched; every name here is also on
// `.` (browser-safety.test.ts pins the subset direction). The 6 duplicated export lines are the
// price of leaving `.` provably untouched — the subset test is the drift guard.
export * from "./registry/control.ts";
export * from "./frameworks/soc2-tsc.ts";
export * from "./frameworks/hipaa-security.ts";
export * from "./frameworks/eu-ai-act.ts";
export * from "./crosswalks/regimes.ts";
export * from "./soa/iso-27001-soa.ts";
export * from "@caisson-sh/oscal-spine/browser";
