import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import {
  anchorChain,
  buildChain,
  canonicalize,
  ValidationError,
  verifyChain,
  type JsonValue,
} from "@caisson/kernel";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  LocalKmsClient,
} from "./kms.ts";
import { TenantFieldCrypto } from "./crypto.ts";
import { cryptoShred, ERASURE_CRYPTO_SHRED } from "./crypto-shred.ts";

const KEK = Buffer.alloc(32, 0x55);
// Clock injected at the edge — keeps the audit payload deterministic (ADR-0058 ethos).
const OCCURRED_AT = "2026-06-27T12:00:00.000Z";

function freshProvider(): KmsKeyProvider {
  return new KmsKeyProvider(
    new LocalKmsClient(KEK),
    new InMemoryWrappedKeyStore(),
  );
}

describe("cryptoShred (erasure ⟂ append-only chain — ADR-0055/0052, TM-F/TM-G)", () => {
  test("shred renders ciphertext unrecoverable while verifyChain still passes over the committed ciphertext", async () => {
    const provider = freshProvider();
    expect(await provider.provision("subject_a")).toBe(1);
    const crypto = new TenantFieldCrypto(provider);

    // Encrypt PII, then COMMIT THE CIPHERTEXT (never the plaintext) into the audit chain.
    const ssn = await crypto.encryptField(
      "subject_a",
      "123-45-6789",
      "patient.ssn",
    );
    const dob = await crypto.encryptField(
      "subject_a",
      "1980-01-01",
      "patient.dob",
    );
    const payloads: JsonValue[] = [
      { scope: "subject_a", column: "patient.ssn", ciphertext: ssn },
      { scope: "subject_a", column: "patient.dob", ciphertext: dob },
    ];
    const entries = buildChain(payloads);
    const anchor = anchorChain(entries);

    // sanity: decryptable + chain valid BEFORE the shred
    expect(await crypto.decryptField("subject_a", ssn, "patient.ssn")).toBe(
      "123-45-6789",
    );
    expect(verifyChain(entries, anchor).valid).toBe(true);

    const receipt = await cryptoShred(provider, {
      keyScopeId: "subject_a",
      tenantId: "tenant_1",
      subjectId: "subject_a",
      reason: "gdpr-art17",
      occurredAt: OCCURRED_AT,
    });

    // 1. the ciphertext is now permanently unrecoverable — the KEK is gone (no live KMS, all local)
    await expect(
      crypto.decryptField("subject_a", ssn, "patient.ssn"),
    ).rejects.toThrow();
    await expect(
      crypto.decryptField("subject_a", dob, "patient.dob"),
    ).rejects.toThrow();
    // 2. the immutable chain over the committed CIPHERTEXT still verifies — erasure never touched it
    expect(verifyChain(entries, anchor).valid).toBe(true);
    // 3. the receipt records the erasure as an auditable, PII-free event
    expect(receipt.shreddedThroughVersion).toBe(1);
    expect(receipt.deletion).toEqual({
      state: "destroyed",
      irreversible: true,
    });
    expect((receipt.auditPayload as Record<string, JsonValue>).event).toBe(
      ERASURE_CRYPTO_SHRED,
    );
  });

  test("crypto-shred is selective: shredding one subject leaves another decryptable", async () => {
    const provider = freshProvider();
    await provider.provision("subject_a");
    await provider.provision("subject_b");
    const crypto = new TenantFieldCrypto(provider);
    const a = await crypto.encryptField("subject_a", "a-secret", "c");
    const b = await crypto.encryptField("subject_b", "b-secret", "c");

    await cryptoShred(provider, {
      keyScopeId: "subject_a",
      tenantId: "tenant_1",
      subjectId: "subject_a",
      reason: "gdpr-art17",
      occurredAt: OCCURRED_AT,
    });

    await expect(crypto.decryptField("subject_a", a, "c")).rejects.toThrow();
    // subject_b's KEK was derived independently — untouched by subject_a's shred
    expect(await crypto.decryptField("subject_b", b, "c")).toBe("b-secret");
  });

  test("the audit payload commits the FACT of erasure with no PII and no plaintext", async () => {
    const provider = freshProvider();
    await provider.provision("subject_a");
    const receipt = await cryptoShred(provider, {
      keyScopeId: "subject_a",
      tenantId: "tenant_1",
      subjectId: "subject_a",
      reason: "ccpa-1798.105",
      occurredAt: OCCURRED_AT,
    });
    // metadata-only: ids / reason / instant / version / method — nothing that could carry erased content
    expect(JSON.parse(canonicalize(receipt.auditPayload))).toEqual({
      event: ERASURE_CRYPTO_SHRED,
      deletion: {
        irreversible: true,
        state: "destroyed",
      },
      method: "kms-key-deletion",
      occurredAt: OCCURRED_AT,
      reason: "ccpa-1798.105",
      shreddedThroughVersion: 1,
      subjectId: "subject_a",
      tenantId: "tenant_1",
    });
    matchGolden(import.meta.url, "crypto-shred", receipt.auditPayload);
  });

  test("a malformed request throws (fail-closed) BEFORE any key is shredded", async () => {
    const provider = freshProvider();
    await provider.provision("subject_a");
    const crypto = new TenantFieldCrypto(provider);
    const env = await crypto.encryptField("subject_a", "still-here", "c");

    await expect(
      cryptoShred(provider, {
        keyScopeId: "subject_a",
        tenantId: "tenant_1",
        subjectId: "subject_a",
        reason: "gdpr-art17",
        occurredAt: "not-a-timestamp", // invalid ISO-8601 → reject at the boundary
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // proof nothing was scheduled: the field still decrypts
    expect(await crypto.decryptField("subject_a", env, "c")).toBe("still-here");
  });

  test("crypto-shred is irreversible: re-provisioning a shredded scope is refused", async () => {
    const provider = freshProvider();
    await provider.provision("subject_a");
    await cryptoShred(provider, {
      keyScopeId: "subject_a",
      tenantId: "tenant_1",
      subjectId: "subject_a",
      reason: "gdpr-art17",
      occurredAt: OCCURRED_AT,
    });
    await expect(provider.provision("subject_a")).rejects.toThrow(
      /crypto-shredded/,
    );
  });

  test("shreddedThroughVersion records the highest provisioned version", async () => {
    const provider = freshProvider();
    await provider.provision("subject_a"); // v1
    await provider.provision("subject_a"); // v2
    const receipt = await cryptoShred(provider, {
      keyScopeId: "subject_a",
      tenantId: "tenant_1",
      subjectId: "subject_a",
      reason: "gdpr-art17",
      occurredAt: OCCURRED_AT,
    });
    expect(receipt.shreddedThroughVersion).toBe(2);
  });

  test("shredding a never-provisioned scope is an idempotent no-op success (version 0)", async () => {
    const provider = freshProvider();
    const receipt = await cryptoShred(provider, {
      keyScopeId: "subject_ghost",
      tenantId: "tenant_1",
      subjectId: "subject_ghost",
      reason: "gdpr-art17",
      occurredAt: OCCURRED_AT,
    });
    expect(receipt.shreddedThroughVersion).toBe(0);
  });
});
