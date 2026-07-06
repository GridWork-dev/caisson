// live/kms-gcp.live.test.ts — the LIVE cloud-KMS envelope proof for the GCP driver (ADR-0171),
// mirroring kms.live.test.ts's structure for AWS. Drives the REAL adapter stack top-to-bottom
// against a freshly minted, throwaway GCP CryptoKey: createGcpKmsClient → KmsKeyProvider.provision/
// keyFor → TenantFieldCrypto.encryptField/decryptField → cryptoShred — the legs no fake backend can
// vouch for (every unit/conformance test injects a fake GcpKmsSendable).
//
// GCP semantics differ from AWS's throwaway-CMK discipline in one respect: a KeyRing can NEVER be
// deleted (a permanent GCP resource, by design — there is no DeleteKeyRing RPC), so unlike the AWS
// live test (which self-mints a fully throwaway CMK) this test requires a PRE-PROVISIONED KeyRing
// named via `CAISSON_KMS_GCP_KEY_RING` (create it once, out-of-band — e.g. `gcloud kms keyrings
// create ... --location=...`; it is a fixed fixture, not something a test run should be minting). A
// CryptoKey WITHIN that KeyRing, however, IS freely creatable per run — CryptoKeys also can't be
// deleted, but GCP bills per ACTIVE key-version-month, not per CryptoKey, so a CryptoKey whose only
// version has been destroyed costs nothing ongoing — so this test mints a throwaway CryptoKey per
// leg (mirroring the AWS test's throwaway CMK) and destroys its PRIMARY version
// (`destroyCryptoKeyVersion`) at the end: that IS the disposal boundary GCP actually offers
// (CryptoKeyVersions are destroyable; CryptoKeys/KeyRings are not). Every minted CryptoKey carries
// Purpose/Run labels so a missed cleanup is still auditable, mirroring the AWS test's tag discipline.
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src`, CI's
// secret-free runners, and the published tarball never see it) AND every leg self-skips without the
// KMS-specific opt-in + a pre-provisioned KeyRing (ADR-0201 live-test convention, extended here). Run
// it via `bun run test:live` with CAISSON_KMS_GCP_LIVE=1, CAISSON_KMS_GCP_KEY_RING=<full keyring
// resource name>, and GCP Application Default Credentials scoped to create/destroy CryptoKeys +
// encrypt/decrypt under that KeyRing. The opt-in is KMS-GCP-specific so other live suites' GCP creds
// (if any) don't accidentally mint KMS keys.
//
// The test SELF-PROVISIONS its throwaway CryptoKeys via the raw SDK (the port carries no createKey
// op — a deliberate 3-op crypto surface, mirroring kms.live.test.ts's KMS-2=B2 note), reaching AROUND
// the adapter exactly as that AWS test reaches around createAwsKmsClient for raw
// CreateKey/DescribeKey.
import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  TenantFieldCrypto,
  createGcpKmsClient,
  cryptoShred,
} from "../src/index.ts";

/** KMS-specific opt-in (mirrors kms.live.test.ts's OPT_IN). */
const OPT_IN = process.env.CAISSON_KMS_GCP_LIVE ?? "";
/** The pre-provisioned KeyRing fixture — required because KeyRings can never be deleted in GCP. */
const KEY_RING = process.env.CAISSON_KMS_GCP_KEY_RING ?? "";
const HAVE_CREDS = OPT_IN.length > 0 && KEY_RING.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 60_000; // several sequential GCP calls per leg
/** Every proof key carries these labels so a missed cleanup is auditable. */
const PURPOSE = "caisson-field-crypto-live-proof";
const RUN = randomUUID(); // never collide across re-runs

const COLUMN = "patient.ssn";
const SECRET = `caisson kms live proof ${RUN}`;

// Constructed without creds even when every leg skips — the client resolves Application Default
// Credentials lazily at the first RPC, so no network happens at module load in the credential-less run.
const raw = new KeyManagementServiceClient();

/** Per-run mutable proof state, threaded across the ordered legs (all skip or all run together). */
let cryptoKeyA = "";
let cryptoKeyB = "";
let provider: KmsKeyProvider | null = null;
let envelopeA = "";

/** Mint a fresh, tagged, per-run CryptoKey under the pre-provisioned KeyRing. */
async function mintCryptoKey(label: string): Promise<string> {
  const [cryptoKey] = await raw.createCryptoKey({
    parent: KEY_RING,
    // GCP cryptoKeyId is limited to 63 chars and [a-zA-Z0-9_-] — a UUID-suffixed label fits.
    cryptoKeyId: `${PURPOSE}-${label}-${RUN}`.slice(0, 63),
    cryptoKey: {
      purpose: "ENCRYPT_DECRYPT",
      versionTemplate: { algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION" },
      labels: { purpose: PURPOSE, run: RUN },
    },
  });
  const name = cryptoKey.name;
  if (name === undefined || name === null || name.length === 0) {
    throw new Error("CreateCryptoKey returned no name");
  }
  return name;
}

/** Best-effort destroy of a CryptoKey's primary (v1) version — swallows "already destroyed" / denied. */
async function destroyPrimaryVersion(cryptoKeyName: string): Promise<void> {
  try {
    await raw.destroyCryptoKeyVersion({
      name: `${cryptoKeyName}/cryptoKeyVersions/1`,
    });
  } catch {
    // Already destroyed (leg 5 got there first) / denied — the Purpose/Run labels make any survivor
    // auditable regardless.
  }
}

afterAll(async () => {
  // Destroy BOTH CryptoKeys' primary versions defensively, not just CryptoKey-B — mirrors
  // kms.live.test.ts's afterAll rationale: if any leg throws before reaching leg 5, CryptoKey-A's
  // version would otherwise leak with no cleanup. Re-destroying an already-scheduled version is a
  // no-op (destroyPrimaryVersion swallows the error). A skip-clean run never mints either CryptoKey,
  // so both stay empty strings and this is a no-op.
  if (cryptoKeyA.length > 0) await destroyPrimaryVersion(cryptoKeyA);
  if (cryptoKeyB.length > 0) await destroyPrimaryVersion(cryptoKeyB);
});

describe("field-crypto cloud-KMS envelope — LIVE proof against real GCP Cloud KMS (ADR-0171)", () => {
  liveTest(
    "(1) mint a per-run throwaway CryptoKey-A and wire the real adapter stack",
    async () => {
      cryptoKeyA = await mintCryptoKey("a");
      expect(cryptoKeyA.length).toBeGreaterThan(0);
      const kms = createGcpKmsClient({ cryptoKeyName: cryptoKeyA });
      // CryptoKey-A's name is BOTH the tenant scope and the default fallback; the provider passes the
      // scope as the per-call keyId, so cryptoKeyFor targets it directly (never the fallback).
      provider = new KmsKeyProvider(kms, new InMemoryWrappedKeyStore());
    },
    TIMEOUT,
  );

  liveTest(
    "(2) provision() generates a REAL wrapped DEK (version 1) via Encrypt",
    async () => {
      if (!provider)
        throw new Error("provider not wired (leg 1 must run first)");
      const version = await provider.provision(cryptoKeyA);
      expect(version).toBe(1);
    },
    TIMEOUT,
  );

  liveTest(
    "(3) encrypt/decrypt round-trips through the REAL wrapped DEK — the leg no fake covers",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const fc = new TenantFieldCrypto(provider);
      envelopeA = await fc.encryptField(cryptoKeyA, SECRET, COLUMN);
      expect(envelopeA.length).toBeGreaterThan(0);
      expect(envelopeA).not.toContain(SECRET); // the envelope is ciphertext, not plaintext
      const roundTripped = await fc.decryptField(cryptoKeyA, envelopeA, COLUMN);
      expect(roundTripped).toBe(SECRET);
    },
    TIMEOUT,
  );

  liveTest(
    "(4) per-tenant CryptoKey isolation: a value sealed under CryptoKey-A never opens under CryptoKey-B",
    async () => {
      if (!provider) throw new Error("provider not wired");
      cryptoKeyB = await mintCryptoKey("b");
      await provider.provision(cryptoKeyB);
      const fc = new TenantFieldCrypto(provider);
      // Doubly bound: CryptoKey-B unwraps a DIFFERENT DEK AND the per-scope AAD differs, so the GCM
      // auth tag fails closed (mirrors kms.test.ts's cross-scope proof, now against real Cloud KMS).
      await expect(
        fc.decryptField(cryptoKeyB, envelopeA, COLUMN),
      ).rejects.toThrow();
    },
    TIMEOUT,
  );

  liveTest(
    "(5) crypto-shred CryptoKey-A → DestroyCryptoKeyVersion, verified independently via GetCryptoKeyVersion",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const receipt = await cryptoShred(provider, {
        keyScopeId: cryptoKeyA,
        tenantId: RUN,
        subjectId: `subject-${RUN}`,
        reason: "gdpr-art17",
        occurredAt: new Date().toISOString(),
      });
      expect(receipt.shreddedThroughVersion).toBe(1);
      // Confirm the shred OUTSIDE the adapter under test — the first live exercise of the GCP driver's
      // fail-closed erasure. GCP flips state to DESTROY_SCHEDULED synchronously on the destroy call
      // (no read-consistency lag to poll through, unlike AWS's DescribeKey).
      const [version] = await raw.getCryptoKeyVersion({
        name: `${cryptoKeyA}/cryptoKeyVersions/1`,
      });
      expect(version.state).toBe("DESTROY_SCHEDULED");
    },
    TIMEOUT,
  );

  liveTest(
    "(6) post-shred: decrypt through CryptoKey-A fails closed — the unrecoverability proof, LIVE",
    async () => {
      if (!provider) throw new Error("provider not wired");
      const fc = new TenantFieldCrypto(provider);
      // GCP Decrypt refuses a key version pending destruction → the wrapped DEK can never be unwrapped again.
      await expect(
        fc.decryptField(cryptoKeyA, envelopeA, COLUMN),
      ).rejects.toThrow();
    },
    TIMEOUT,
  );
});
