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

// --- Control model + own-authored framework packs — the carved framework catalogs. -------------
export * from "@caisson/frameworks-pack";

// --- Evidence engine + per-tenant signer — the carved compliance-core + signing-primitive. ------
export * from "@caisson/compliance-core";
export * from "@caisson/signing-primitive";

// --- OSCAL signed evidence-bundle — the composition of the engine + the signer, kept in-edition. -
export * from "./evidence/oscal-bundle.ts";

// --- Composition + assembly — the security-critical crypto×RLS nesting + migration order. -------
export * from "./with-tenant-crypto.ts";
export * from "./migrate/assemble.ts";

// --- Support impersonation (ADR-0187) — the dual-audit-trail session kernel.
export * from "./impersonation/session.ts";

// --- Operational telemetry — the EventSink ops mirror (evidentiary record stays in WORM). -------
export * from "./observe.ts";

// --- Regulatory-exemption posture worksheet — a typed convention artifact (NOT a rules engine
// or a SHIP gate): legal-test-element -> LLM-output-rule mapping + a human sign-off field.
export * from "./posture/exemption-worksheet.ts";
export * from "./posture/exemplar-ftc-endorsement.ts";

// --- Bundled operational-compliance primitives (ADR-0178) — the folded members, composed + surfaced.
// The Compliance bundle includes SOC2 CC7.2 alerting + CCPA/GDPR erasure; re-export both surfaces from
// this one edition import home and wire them via `createComplianceEdition` (./edition.ts).
export * from "@caisson/alerting";
export * from "@caisson/retention-runner";
// Both primitives export a `CaptureAuditSink` audit-sink type — an ambiguous `export *` name (TS2308).
// Bind the bare name explicitly to alerting's (resolving the ambiguity) and surface retention-runner's
// under a disambiguated alias.
export type { CaptureAuditSink } from "@caisson/alerting";
export type { CaptureAuditSink as RetentionCaptureAuditSink } from "@caisson/retention-runner";
export * from "./edition.ts";
