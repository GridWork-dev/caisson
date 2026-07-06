// @caisson/compliance-core — the compliance evidence engine, carved out of the Compliance edition
// (ADR-0246/0257). The leg this engine ships: run typed collectors over live system state, assemble
// a deterministic, byte-stable canonical evidence pack that REFUSES to generate when any control's
// evidence is unresolved (flag-never-guess), and export the result through the OSCAL seam. Framework
// catalogs live in @caisson/frameworks-pack; evidence signing lives in @caisson/signing-primitive;
// the Compliance edition composes all three (and assembles the signed OSCAL bundle over them).

// --- Collectors — typed evidence collection over live system state. -----------------------------
export * from "./evidence/collector.ts";
export * from "./evidence/collectors/rls-force.ts";
export * from "./evidence/collectors/chain-verify.ts";
export * from "./evidence/collectors/worm-retention.ts";
export * from "./evidence/collectors/field-crypto-policy.ts";
export * from "./evidence/collectors/ai-risk-register.ts";
export * from "./evidence/collectors/impersonation.ts";

// --- Canonical pack format + deterministic generator. -------------------------------------------
export * from "./evidence/pack-format.ts";
export * from "./evidence/generate.ts";

// --- OSCAL export seam (assessment plan, results, POA&M, XML). ----------------------------------
export * from "./evidence/oscal-export.ts";
export * from "./evidence/oscal-export-xml.ts";
export * from "./evidence/oscal-assessment-plan.ts";
