import { describe, expect, test } from "bun:test";
import { canonicalize } from "@caisson-sh/kernel";
import { ALG_AES_256_GCM, serializeEnvelope } from "@caisson-sh/field-crypto";
import {
  fieldCryptoPolicyCollector,
  type PhiFieldFact,
} from "./field-crypto-policy.ts";

/** A valid AES-256-GCM field-crypto envelope (base64) — the shape a PHI field carries at rest. */
function encryptedSample(): string {
  return serializeEnvelope({
    algId: ALG_AES_256_GCM,
    keyVersion: 1,
    nonce: Buffer.alloc(12, 7),
    ciphertext: Buffer.from("phi-ciphertext"),
    tag: Buffer.alloc(16, 9),
  });
}

describe("fieldCryptoPolicyCollector — determinism (canonical body)", () => {
  const collector = fieldCryptoPolicyCollector();

  test("plaintextFields is sorted regardless of input order", () => {
    const fieldsA: PhiFieldFact[] = [
      { field: "patient.mrn", storedValue: "plaintext-mrn" },
      { field: "patient.dob", storedValue: "plaintext-dob" },
      { field: "patient.ssn", storedValue: encryptedSample() },
    ];
    const fieldsB = [...fieldsA].reverse();

    const rA = collector.collect({ fields: fieldsA });
    const rB = collector.collect({ fields: fieldsB });
    expect(rA.item.facts.plaintextFields).toEqual([
      "patient.dob",
      "patient.mrn",
    ]);
    expect(canonicalize(rA.item.facts)).toBe(canonicalize(rB.item.facts));
  });

  test("unsampledFields is sorted regardless of input order", () => {
    const fieldsA: PhiFieldFact[] = [
      { field: "patient.mrn", storedValue: null },
      { field: "patient.dob", storedValue: null },
      { field: "patient.ssn", storedValue: encryptedSample() },
    ];
    const fieldsB = [...fieldsA].reverse();

    const rA = collector.collect({ fields: fieldsA });
    const rB = collector.collect({ fields: fieldsB });
    expect(rA.item.facts.unsampledFields).toEqual([
      "patient.dob",
      "patient.mrn",
    ]);
    expect(canonicalize(rA.item.facts)).toBe(canonicalize(rB.item.facts));
  });

  test("the whole evidence item is byte-identical for two input orders (gap-pack determinism)", () => {
    const fieldsA: PhiFieldFact[] = [
      { field: "patient.mrn", storedValue: "plaintext-mrn" },
      { field: "patient.notes", storedValue: null },
      { field: "patient.dob", storedValue: "plaintext-dob" },
      { field: "patient.ssn", storedValue: encryptedSample() },
    ];
    const fieldsB = [...fieldsA].reverse();

    const rA = collector.collect({ fields: fieldsA });
    const rB = collector.collect({ fields: fieldsB });
    expect(rA.status).toBe("flagged");
    expect(canonicalize(rA.item.facts)).toBe(canonicalize(rB.item.facts));
  });
});
