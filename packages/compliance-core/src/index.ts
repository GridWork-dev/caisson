// @caisson-sh/compliance-core — the compliance evidence engine, carved out of the Compliance edition
// (ADR-0246/0257). The leg this engine ships: run typed collectors over live system state, assemble
// a deterministic, byte-stable canonical evidence pack that REFUSES to generate when any control's
// evidence is unresolved (flag-never-guess), and export the result through the OSCAL seam. Framework
// catalogs live in @caisson-sh/frameworks-pack; evidence signing lives in @caisson-sh/signing-primitive;
// the Compliance edition composes all three (and assembles the signed OSCAL bundle over them).

// --- Collectors — typed evidence collection over live system state. -----------------------------
export * from "./evidence/collector.ts";
export * from "./evidence/collectors/rls-force.ts";
export * from "./evidence/collectors/chain-verify.ts";
export * from "./evidence/collectors/worm-retention.ts";
export * from "./evidence/collectors/field-crypto-policy.ts";
export * from "./evidence/collectors/ai-risk-register.ts";
export * from "./evidence/collectors/impersonation.ts";

// --- Cross-framework evidence rollup (ADR-0333/ADR-0347) — the crosswalk-pointer join. -----------
export * from "./evidence/crosswalk-rollup.ts";

// --- Canonical pack format + deterministic generator. -------------------------------------------
export * from "./evidence/pack-format.ts";
// The node-free assembly half (flag-never-guess refusal + derived canonical body, ADR-0396) —
// `EvidencePackBlockedError` and `EvidenceControlPlan` keep their names here; `generate.ts` composes
// this module and owns only the archive/digest phase.
export * from "./evidence/assemble.ts";
export * from "./evidence/generate.ts";
// External-anchor grade tag + detached-receipt attachment (SPEC external-anchoring §6).
export * from "./evidence/external-anchor.ts";

// --- OSCAL compatibility surface (ADR-0384) — the complete carve re-exported unchanged. ----------
export * from "@caisson-sh/oscal-spine";

// --- Control<->collector binding table (PLAN Group E) — a derived artifact, not a config layer. --
export * from "./evidence/binding-table.ts";

// --- Compliance drift monitor (ADR-0371) — scheduled re-run of the registered collectors, a
// deterministic previous-vs-current snapshot diff, accepted-deviation alert suppression, and
// every-run WORM anchoring. Composed from ports STRUCTURALLY compatible with @caisson-sh/jobs'
// TaskDefinition, @caisson-sh/alerting's AlertChannel, and @caisson-sh/audit-worm's chain+outbox seam —
// compliance-core stays dependency-free of all three (the same precedent `external-anchor.ts`
// already set for @caisson-sh/audit-worm), so a caller with those real packages wires them in directly.
export * from "./evidence/drift/types.ts";
export * from "./evidence/drift/diff.ts";
export * from "./evidence/drift/deviation.ts";
export * from "./evidence/drift/alert-sink.ts";
export * from "./evidence/drift/anchor-sink.ts";
export * from "./evidence/drift/schedule.ts";
