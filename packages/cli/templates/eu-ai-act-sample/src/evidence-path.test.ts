import { describe, expect, test } from "bun:test";
import { runEvidencePathDemo } from "./evidence-path.ts";

describe("evidence path (EU AI Act sample)", () => {
  test("the SHA-256 hash-chain verifies end to end", () => {
    const result = runEvidencePathDemo();
    expect(result.chain).toHaveLength(3);
    expect(result.chainVerification).toEqual({ valid: true, brokenAt: null });
  });

  test("the Ed25519 signature over the anchor verifies", () => {
    const result = runEvidencePathDemo();
    expect(result.signatureValid).toBe(true);
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/); // 64-byte Ed25519 sig, hex
  });

  test("a custom record list still chains and signs correctly", () => {
    const result = runEvidencePathDemo([
      {
        event: "custom.event",
        actorId: "system:test",
        timestamp: "2026-01-01T00:00:00.000Z",
        details: {},
      },
    ]);
    expect(result.chain).toHaveLength(1);
    expect(result.chain[0]?.prevHash).toBeNull(); // genesis
    expect(result.chainVerification.valid).toBe(true);
    expect(result.signatureValid).toBe(true);
  });
});
