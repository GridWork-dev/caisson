// src/index.test.ts — barrel smoke (gate-blocking wiring). Asserts the public barrel re-exports
// the edition's surface across all four tracks — control model, evidence engine, composition/assembly,
// and operational telemetry — so a missing re-export is caught here, not by a downstream app's import
// failure. (Behavioral correctness of each symbol is pinned by its own test; this only proves wiring.)
import { describe, expect, test } from "bun:test";
import {
  // Control model.
  defineControl,
  defineFramework,
  soc2Tsc,
  hipaaSecurity,
  euAiAct,
  // Evidence engine.
  rlsForceCollector,
  chainVerifyCollector,
  wormRetentionCollector,
  passResult,
  flaggedResult,
  unresolvedResult,
  parseEvidencePackManifest,
  EVIDENCE_PACK_FORMAT_VERSION,
  generateEvidencePack,
  EvidencePackBlockedError,
  signEvidencePack,
  verifyEvidenceSignature,
  Ed25519Signer,
  toOscalBundle,
  // Composition + assembly.
  withTenantCrypto,
  assembleComplianceMigrations,
  complianceMigrationPackages,
  // Support impersonation (ADR-0187).
  beginImpersonation,
  recordImpersonatedAction,
  endImpersonation,
  withImpersonation,
  findDualRecordSeqs,
  impersonationCollector,
  // Operational telemetry.
  emitEvidenceGenerated,
  emitErasureCryptoShred,
  EVIDENCE_GENERATED,
  ERASURE_CRYPTO_SHRED,
} from "./index.ts";

describe("@caisson-sh/compliance barrel", () => {
  test("re-exports the control model surface (T9/T10)", () => {
    expect(typeof defineControl).toBe("function");
    expect(typeof defineFramework).toBe("function");
    expect(soc2Tsc.id).toBeDefined();
    expect(hipaaSecurity.id).toBeDefined();
    expect(euAiAct.id).toBeDefined();
  });

  test("re-exports the evidence engine surface (T11–T15)", () => {
    expect(typeof rlsForceCollector).toBe("function");
    expect(typeof chainVerifyCollector).toBe("function");
    expect(typeof wormRetentionCollector).toBe("function");
    expect(typeof passResult).toBe("function");
    expect(typeof flaggedResult).toBe("function");
    expect(typeof unresolvedResult).toBe("function");
    expect(typeof parseEvidencePackManifest).toBe("function");
    expect(EVIDENCE_PACK_FORMAT_VERSION).toBe("2");
    expect(typeof generateEvidencePack).toBe("function");
    expect(EvidencePackBlockedError.prototype).toBeInstanceOf(Error);
    expect(typeof signEvidencePack).toBe("function");
    expect(typeof verifyEvidenceSignature).toBe("function");
    expect(typeof Ed25519Signer).toBe("function");
    expect(typeof toOscalBundle).toBe("function");
  });

  test("re-exports composition + assembly (T16/T17)", () => {
    expect(typeof withTenantCrypto).toBe("function");
    expect(typeof assembleComplianceMigrations).toBe("function");
    expect(typeof complianceMigrationPackages).toBe("function");
  });

  test("re-exports the support-impersonation kernel + collector (ADR-0187)", () => {
    expect(typeof beginImpersonation).toBe("function");
    expect(typeof recordImpersonatedAction).toBe("function");
    expect(typeof endImpersonation).toBe("function");
    expect(typeof withImpersonation).toBe("function");
    expect(typeof findDualRecordSeqs).toBe("function");
    expect(typeof impersonationCollector).toBe("function");
  });

  test("re-exports operational telemetry (T18)", () => {
    expect(typeof emitEvidenceGenerated).toBe("function");
    expect(typeof emitErasureCryptoShred).toBe("function");
    expect(EVIDENCE_GENERATED).toBe("evidence.generated");
    expect(ERASURE_CRYPTO_SHRED).toBe("erasure.crypto-shred");
  });
});
