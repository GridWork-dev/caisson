// @caisson/compliance — the Compliance edition (the hero, ADR-0040). A COMPOSITION of base packages,
// never a fork (ADR-0003): it imports DOWN onto `@caisson/audit-worm` (WORM + audit chain + locked
// versions), `@caisson/field-crypto` (tenant-scoped field encryption + crypto-shred), and
// `@caisson/tenancy-rls` (the RLS tenant boundary), all over the `@caisson/kernel` integrity algebra.
//
// The leg this edition ships: seed a tenant → write encrypted SEC/HIPAA fields under
// `withTenantCrypto` (crypto nested INSIDE the RLS scope, fail-closed) → lock an append-only artifact
// into WORM with a SHA-256 chain anchor → emit a deterministic, signed control→evidence pack that
// validates against a golden fixture and REFUSES to generate when any control's evidence is missing
// (flag-never-guess). Operational telemetry is mirrored through the base `EventSink` port; the
// evidentiary record stays in the WORM chain.

// --- Control model (T9/T10) — typed registry builders + own-authored framework packs. ------------
export * from "./registry/control.ts";
export * from "./frameworks/soc2-tsc.ts";
export * from "./frameworks/hipaa-security.ts";
export * from "./frameworks/eu-ai-act.ts";

// --- Evidence engine (T11–T15) — collectors, canonical pack format, generator, signer, OSCAL seam.
export * from "./evidence/collector.ts";
export * from "./evidence/collectors/rls-force.ts";
export * from "./evidence/collectors/chain-verify.ts";
export * from "./evidence/collectors/worm-retention.ts";
export * from "./evidence/pack-format.ts";
export * from "./evidence/generate.ts";
export * from "./evidence/sign.ts";
export * from "./evidence/oscal-export.ts";

// --- Composition + assembly (T16/T17) — the security-critical crypto×RLS nesting + migration order.
export * from "./with-tenant-crypto.ts";
export * from "./migrate/assemble.ts";

// --- Operational telemetry (T18) — the EventSink ops mirror (evidentiary record stays in WORM).
export * from "./observe.ts";
