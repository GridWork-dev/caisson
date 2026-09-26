// live/kms.live.test.ts — the LIVE cloud-KMS envelope proof (ADR-0221, extends ADR-0201's live
// convention as a 4th transport). Drives the REAL adapter stack top-to-bottom against a freshly
// minted, throwaway AWS CMK: createAwsKmsClient → KmsKeyProvider.provision/keyFor →
// TenantFieldCrypto.encryptField/decryptField → cryptoShred — the legs no fake backend can vouch
// for (every unit/conformance test injects a fake KmsSendable or the LocalKmsClient double).
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src`, CI's
// secret-free runners, and the published tarball never see it) AND every leg self-skips without the
// KMS-specific opt-in + AWS creds (ADR-0201 live-test convention). Run it via `bun run test:live`
// with CAISSON_KMS_LIVE=1 + AWS creds allowed to create, use and schedule deletion of KMS keys
// (ADR-0221 KMS-1=A1: the KMS statements joined onto the existing WORM live-proof prover). The
// opt-in is KMS-specific so WORM's AWS creds sitting in env don't accidentally mint KMS keys.
//
// KMS-2=B2 — the test SELF-PROVISIONS its throwaway CMKs via the raw SDK (the port carries no
// createKey op — a deliberate 3-op crypto surface, SPEC Risk 1), reaching AROUND the adapter exactly
// as audit-worm's S3 live test reaches around S3ArtifactStore for raw ListObjectVersions/Delete.
// A CMK is itself the destructible resource under test, so no persistent resource is provisioned;
// AWS's own 7-day pending-deletion window is the self-cleanup (no reaper needed).
import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  CreateAliasCommand,
  CreateKeyCommand,
  DescribeKeyCommand,
  KMSClient,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  TenantFieldCrypto,
  createAwsKmsClient,
  cryptoShred,
} from "../src/index.ts";

/** KMS-specific opt-in (SPEC gate): WORM's AWS creds alone must NOT fire a key-minting proof. */
const OPT_IN = process.env.CAISSON_KMS_LIVE ?? "";
const HAVE_CREDS =
  OPT_IN.length > 0 && (process.env.AWS_ACCESS_KEY_ID ?? "").length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const REGION = process.env.AWS_REGION ?? "us-east-1";
const TIMEOUT = 60_000; // several sequential AWS calls per leg
/** Every proof key carries these tags so a missed cleanup is auditable via CloudTrail + tag-scoped. */
const PURPOSE = "caisson-field-crypto-live-proof";
const RUN = randomUUID(); // never collide across re-runs

const COLUMN = "patient.ssn";
const SECRET = `caisson kms live proof ${RUN}`;

// Constructed without creds even when every leg skips — the SDK resolves credentials lazily at
// `send`, so no network happens at module load in the credential-less run.
const raw = new KMSClient({ region: REGION });

/** Per-run mutable proof state, threaded across the ordered legs (all skip or all run together). */
let cmkA = "";
let cmkB = "";
let provider: KmsKeyProvider | null = null;
let envelopeA = "";

/** Mint a fresh, tagged, per-run CMK via the raw SDK (KMS-2=B2 self-provisioning) + a readable alias. */
async function mintCmk(label: string): Promise<string> {
  const created = await raw.send(
    new CreateKeyCommand({
      Description: `${PURPOSE} ${label} ${RUN}`,
      Tags: [
        { TagKey: "Purpose", TagValue: PURPOSE },
        { TagKey: "Run", TagValue: RUN },
      ],
    }),
  );
  const keyId = created.KeyMetadata?.KeyId;
  if (keyId === undefined) throw new Error("CreateKey returned no KeyId");
  await raw.send(
    new CreateAliasCommand({
      AliasName: `alias/${PURPOSE}-${label}-${RUN}`,
      TargetKeyId: keyId,
    }),
  );
  return keyId;
}

/** Best-effort ScheduleKeyDeletion — swallows "already scheduled" / denied, never throws. */
async function scheduleDeletion(keyId: string): Promise<void> {
  try {
    await raw.send(
      new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: 7 }),
    );
  } catch {
    // Already scheduled (leg 5 got there first) / denied — the Purpose tag makes any survivor
    // auditable via CloudTrail regardless.
  }
}

afterAll(async () => {
  // Schedule BOTH CMKs defensively, not just CMK-B. Leg 5 normally schedules CMK-A's
  // deletion itself, but if any leg throws before reaching it (a mint failure, an assertion failure
  // in legs 1-4, cryptoShred itself throwing in leg 5), CMK-A would otherwise leak with no cleanup —
  // this afterAll is the only place that runs regardless of which leg failed. Re-scheduling an
  // already-pending-deletion key is a no-op (scheduleDeletion swallows the error), so this is safe
  // to always run for both keys. A skip-clean run (no CAISSON_KMS_LIVE) never mints either CMK, so
  // both stay empty strings and this is a no-op.
  if (cmkA.length > 0) await scheduleDeletion(cmkA);
  if (cmkB.length > 0) await scheduleDeletion(cmkB);
});

describe("field-crypto cloud-KMS envelope — LIVE proof against real AWS KMS (ADR-0221)", () => {
  liveTest(
    "(1) mint a per-run throwaway CMK-A and wire the real adapter stack",
    async () => {
      cmkA = await mintCmk("a");
      expect(cmkA.length).toBeGreaterThan(0);
      const kms = createAwsKmsClient({ keyId: cmkA, region: REGION });
      // CMK-A's id is BOTH the tenant scope and the default fallback; the provider passes the scope
      // as the per-call keyId, so cmkFor targets it directly (never the fallback).
      provider = new KmsKeyProvider(kms, new InMemoryWrappedKeyStore());
    },
    TIMEOUT,
  );

  liveTest(
    "(2) provision() generates a REAL wrapped DEK (version 1) via GenerateDataKey",
    async () => {
      if (!provider)
        throw new Error("provider not wired (leg 1 must run first)");
      const version = await provider.provision(cmkA);
      expect(version).toBe(1);
    },
    TIMEOUT,
  );

  liveTest(
    "(3) encrypt/decrypt round-trips through the REAL wrapped DEK — the leg no fake covers",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const fc = new TenantFieldCrypto(provider);
      envelopeA = await fc.encryptField(cmkA, SECRET, COLUMN);
      expect(envelopeA.length).toBeGreaterThan(0);
      expect(envelopeA).not.toContain(SECRET); // the envelope is ciphertext, not plaintext
      const roundTripped = await fc.decryptField(cmkA, envelopeA, COLUMN);
      expect(roundTripped).toBe(SECRET);
    },
    TIMEOUT,
  );

  liveTest(
    "(4) per-tenant CMK isolation: a value sealed under CMK-A never opens under CMK-B",
    async () => {
      if (!provider) throw new Error("provider not wired");
      cmkB = await mintCmk("b");
      await provider.provision(cmkB);
      const fc = new TenantFieldCrypto(provider);
      // Doubly bound: CMK-B unwraps a DIFFERENT DEK AND the per-scope EncryptionContext differs, so
      // the GCM auth tag fails closed (mirrors kms.test.ts's cross-scope proof, now against real KMS).
      await expect(fc.decryptField(cmkB, envelopeA, COLUMN)).rejects.toThrow();
    },
    TIMEOUT,
  );

  liveTest(
    "(5) crypto-shred CMK-A → ScheduleKeyDeletion, verified independently via DescribeKey",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const receipt = await cryptoShred(provider, {
        keyScopeId: cmkA,
        tenantId: RUN,
        subjectId: `subject-${RUN}`,
        reason: "gdpr-art17",
        occurredAt: new Date().toISOString(),
      });
      expect(receipt.shreddedThroughVersion).toBe(1);
      // Confirm the shred OUTSIDE the adapter under test — the first live exercise of ADR-0197.
      // KeyState flips to PendingDeletion atomically, but DescribeKey can lag a beat in populating
      // DeletionDate right after ScheduleKeyDeletion (AWS read-consistency), so re-describe briefly.
      let meta = (await raw.send(new DescribeKeyCommand({ KeyId: cmkA })))
        .KeyMetadata;
      for (let i = 0; i < 8 && meta?.DeletionDate === undefined; i++) {
        await new Promise((r) => setTimeout(r, 500));
        meta = (await raw.send(new DescribeKeyCommand({ KeyId: cmkA })))
          .KeyMetadata;
      }
      expect(meta?.KeyState).toBe("PendingDeletion");
      expect(meta?.DeletionDate).toBeDefined();
    },
    TIMEOUT,
  );

  liveTest(
    "(6) post-shred: decrypt through CMK-A fails closed — the unrecoverability proof, LIVE",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const fc = new TenantFieldCrypto(provider);
      // AWS Decrypt refuses a key pending deletion → the wrapped DEK can never be unwrapped again.
      await expect(fc.decryptField(cmkA, envelopeA, COLUMN)).rejects.toThrow();
    },
    TIMEOUT,
  );
});
