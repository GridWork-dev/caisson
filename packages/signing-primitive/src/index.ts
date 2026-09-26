// @caisson-sh/signing-primitive — the per-tenant evidence-signing surface, carved out of the
// Compliance edition (ADR-0246/0257). Detached Ed25519 signatures over a canonical, chain-anchored
// manifest body (per-tenant identity, never the Caisson license-issuer key), an optional RFC-3161
// trusted-timestamp countersignature, and a fail-closed verify path. The evidence engine
// (@caisson-sh/compliance-core) produces the bodies this module signs; the Compliance edition composes both.
export * from "./sign.ts";
export * from "./ph-signer.ts";
