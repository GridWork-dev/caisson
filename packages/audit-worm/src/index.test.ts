// src/index.test.ts — barrel smoke + the canonical WORM-anchor golden (ADR-0052/0013).
//
// Two assertions:
//   1. The public barrel re-exports the full surface (gate-blocking wiring) —
//      a missing re-export is caught here, not by a downstream edition's import failure.
//   2. The trusted anchor a chain mints is byte-stable. The audit chain's whole tamper-evidence
//      rests on a reproducible `{length, tipHash, genesisHash}` commitment; the golden pins that
//      exact structure over a fixed chain so any change to the hash discipline surfaces as a
//      reviewable diff (BLESS-gated), per golden-before-logic (ADR-0013).
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  anchorChain,
  buildChain,
  verifyChain,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import {
  ArtifactExistsError,
  AuditChainStore,
  AzureBlobArtifactStore,
  DEFAULT_RETENTION_YEARS,
  LocalArtifactStore,
  LockedVersionStore,
  MIN_RETENTION_YEARS,
  S3ArtifactStore,
  assertSafeKey,
  buildArtifactKey,
  irreversibleComplianceOptIn,
  provenanceSchema,
  retainUntilFrom,
} from "./index.ts";

describe("@caisson-sh/audit-worm barrel", () => {
  test("re-exports the T1–T4 public surface", () => {
    // Artifact store.
    expect(typeof assertSafeKey).toBe("function");
    expect(typeof buildArtifactKey).toBe("function");
    expect(typeof LocalArtifactStore).toBe("function");
    expect(typeof S3ArtifactStore).toBe("function");
    expect(typeof AzureBlobArtifactStore).toBe("function");
    expect(typeof irreversibleComplianceOptIn).toBe("function");
    expect(ArtifactExistsError.prototype).toBeInstanceOf(Error);
    // Retention floor.
    expect(typeof retainUntilFrom).toBe("function");
    expect(MIN_RETENTION_YEARS).toBe(6);
    expect(DEFAULT_RETENTION_YEARS).toBe(7);
    // Chain store.
    expect(typeof AuditChainStore).toBe("function");
    // Version store.
    expect(typeof LockedVersionStore).toBe("function");
    expect(typeof provenanceSchema.parse).toBe("function");
  });
});

describe("WORM anchor", () => {
  // A fixed compliance-flavored chain → a DETERMINISTIC anchor. These payloads stand in for the
  // locked-artifact events the chain commits to; the values are fixed so the golden pins the exact
  // anchor structure the WORM store persists (`encodeAnchor` canonicalizes this same shape).
  const payloads: JsonValue[] = [
    { event: "artifact.locked", artifactId: "policy", version: 1 },
    { event: "artifact.locked", artifactId: "policy", version: 2 },
    { event: "artifact.superseded", artifactId: "policy", supersedes: 1 },
  ];

  test("anchorChain mints a byte-stable {length, tipHash, genesisHash} commitment", () => {
    const chain = buildChain(payloads);
    const anchor = anchorChain(chain);

    // Sanity: the anchor genuinely commits to THIS chain.
    expect(anchor.length).toBe(chain.length);
    expect(verifyChain(chain, anchor)).toEqual({ valid: true, brokenAt: null });

    matchGolden(import.meta.url, "anchor", anchor);
  });
});
