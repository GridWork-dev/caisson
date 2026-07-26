// Unit + integration coverage for `verifyExternal` (T5, ADR-0346 P2 = full CMS depth). Network-free:
// a REAL self-signed RFC-3161 TimeStampToken is minted in-process with pkijs so the full DER parse +
// CMS signature verify + TSA cert-chain validation path runs in CI (the deterministic checkpoint
// stub's opaque token can't vouch for it — that stub proves the state machine, this proves the crypto).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AlgorithmIdentifier,
  AttributeTypeAndValue,
  BasicConstraints,
  Certificate,
  ContentInfo,
  CryptoEngine,
  EncapsulatedContentInfo,
  Extension,
  ExtKeyUsage,
  getCrypto,
  IssuerAndSerialNumber,
  MessageImprint,
  setEngine,
  SignedData,
  SignerInfo,
  TSTInfo,
} from "pkijs";
import * as asn1js from "asn1js";
import { LocalArtifactStore } from "./store.local.ts";
import type { ArtifactStore } from "./store.ts";
import {
  anchorReceiptKey,
  type AnchorGrade,
  type AnchorReceipt,
  type TsaTarget,
} from "./anchor-transparency.ts";
import type { CurrentAnchorReader } from "./anchor-checkpoint.ts";
import { verifyExternal } from "./verify-external.ts";

setDefaultTimeout(30_000);

const SHA256_OID = "2.16.840.1.101.3.4.2.1";
const EKU_TIMESTAMPING = "1.3.6.1.5.5.7.3.8";
const ID_CT_TSTINFO = "1.2.840.113549.1.9.16.1.4";
const ID_SIGNED_DATA = "1.2.840.113549.1.7.2";

const TARGET: TsaTarget = {
  kind: "tsa",
  url: "https://tsa.example/tsr",
  grade: "trusted-timestamped",
};
const GEN_TIME = new Date("2026-07-13T00:00:00.000Z");
const FAR_FUTURE = new Date(Date.now() + 1_000_000_000_000);

let store: LocalArtifactStore;
let tmpDir: string;

/** A signing context: an RSA key + a self-signed CA cert (optionally carrying the timeStamping EKU). */
interface SigningCtx {
  readonly key: CryptoKeyPair;
  readonly cert: Certificate;
  readonly caDer: Uint8Array;
}
let ctx: SigningCtx; // a proper TSA cert (BasicConstraints CA + timeStamping EKU)
let noEkuCtx: SigningCtx; // a cert WITHOUT the timeStamping EKU (must fail closed)

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Build a self-signed RSA CA cert; `withEku` adds id-kp-timeStamping (a real TSA cert carries it). */
async function makeSigningCtx(withEku: boolean): Promise<SigningCtx> {
  const engine = getCrypto(true);
  const key = (await engine.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: 1 });
  for (const nameObj of [cert.issuer, cert.subject]) {
    nameObj.typesAndValues.push(
      new AttributeTypeAndValue({
        type: "2.5.4.3",
        value: new asn1js.PrintableString({ value: "Caisson Test TSA" }),
      }),
    );
  }
  // Keep validity inside UTCTime's 1950–2049 range (pkijs defaults notBefore/notAfter to UTCTime;
  // a >2049 date silently overflows the encoding) and covering GEN_TIME.
  cert.notBefore.value = new Date("2020-01-01T00:00:00Z");
  cert.notAfter.value = new Date("2045-01-01T00:00:00Z");
  const bc = new BasicConstraints({ cA: true });
  const extensions = [
    new Extension({
      extnID: "2.5.29.19",
      critical: true,
      extnValue: bc.toSchema().toBER(false),
      parsedValue: bc,
    }),
  ];
  if (withEku) {
    const eku = new ExtKeyUsage({ keyPurposes: [EKU_TIMESTAMPING] });
    extensions.push(
      new Extension({
        extnID: "2.5.29.37",
        critical: true,
        extnValue: eku.toSchema().toBER(false),
        parsedValue: eku,
      }),
    );
  }
  cert.extensions = extensions;
  await cert.subjectPublicKeyInfo.importKey(key.publicKey, engine);
  await cert.sign(key.privateKey, "SHA-256", engine);
  const caDer = new Uint8Array(cert.toSchema().toBER(false));
  return { key, cert, caDer };
}

/** Mint a real DER `TimeStampToken` (base64) attesting `sha256(anchorBytes)` at `genTime`. */
async function signTsaToken(
  signing: SigningCtx,
  anchorBytes: Uint8Array,
  genTime: Date,
): Promise<string> {
  const engine = getCrypto(true);
  const imprint = createHash("sha256").update(anchorBytes).digest();
  const tstInfo = new TSTInfo({
    version: 1,
    policy: "1.2.3.4.1",
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({
        algorithmId: SHA256_OID,
        algorithmParams: new asn1js.Null(),
      }),
      hashedMessage: new asn1js.OctetString({ valueHex: imprint }),
    }),
    serialNumber: new asn1js.Integer({ value: 1 }),
    genTime,
  });
  const tstDer = tstInfo.toSchema().toBER(false);

  // Assign eContent AFTER construction so pkijs does not force it CONSTRUCTED (its own verify reads
  // valueHexView, which is empty for a constructed octet string — real RFC-3161 tokens are primitive).
  const encap = new EncapsulatedContentInfo({ eContentType: ID_CT_TSTINFO });
  encap.eContent = new asn1js.OctetString({ valueHex: tstDer });
  const signed = new SignedData({
    version: 3,
    encapContentInfo: encap,
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({
          issuer: signing.cert.issuer,
          serialNumber: signing.cert.serialNumber,
        }),
      }),
    ],
    certificates: [signing.cert],
  });
  await signed.sign(signing.key.privateKey, 0, "SHA-256", undefined, engine);
  const cms = new ContentInfo({
    contentType: ID_SIGNED_DATA,
    content: signed.toSchema(true),
  });
  return Buffer.from(cms.toSchema().toBER(false)).toString("base64");
}

/** A reader that always returns one fixed anchor. */
function fixedReader(bytes: Uint8Array, length: number): CurrentAnchorReader {
  return {
    readCurrentAnchor: () =>
      Promise.resolve({ length, anchorBytes: Uint8Array.from(bytes) }),
  };
}

/** Write an AnchorReceipt to the WORM key for (accountId, length, tsa). */
async function writeReceipt(
  accountId: string,
  length: number,
  fields: {
    anchorDigest: string;
    messageImprint: string;
    token: string;
    grade?: AnchorGrade;
  },
  target: ArtifactStore = store,
): Promise<void> {
  const receipt: AnchorReceipt = {
    accountId,
    target: "tsa",
    anchorLength: length,
    anchorDigest: fields.anchorDigest,
    grade: fields.grade ?? "trusted-timestamped",
    receipt: {
      authority: TARGET.url,
      algorithm: "rfc3161",
      hashAlgorithm: "sha256",
      messageImprint: fields.messageImprint,
      token: fields.token,
      timestampedAt: GEN_TIME.toISOString(),
    },
    receiptedAt: "2026-07-13T00:00:01.000Z",
  };
  await target.put(
    anchorReceiptKey(accountId, length, "tsa"),
    new TextEncoder().encode(JSON.stringify(receipt)),
    { retainUntil: FAR_FUTURE, contentType: "application/json" },
  );
}

beforeAll(async () => {
  const engine = new CryptoEngine({
    name: "caisson-test",
    crypto: globalThis.crypto,
  });
  setEngine(
    "caisson-test",
    engine as unknown as Parameters<typeof setEngine>[1],
  );
  tmpDir = await mkdtemp(join(tmpdir(), "verify-external-"));
  store = new LocalArtifactStore(tmpDir);
  ctx = await makeSigningCtx(true);
  noEkuCtx = await makeSigningCtx(false);
});

afterAll(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("verifyExternal — happy path (full CMS depth)", () => {
  test("a matching receipt with a configured trust anchor verifies + validates the chain", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":3,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const token = await signTsaToken(ctx, bytes, GEN_TIME);
    await writeReceipt(acct, 3, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });

    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 3),
      target: TARGET,
      trustAnchors: [ctx.caDer],
    });
    expect(r).toEqual({
      grade: "trusted-timestamped",
      verified: true,
      chainValidated: true,
      anchorLength: 3,
    });
  });

  test("without a trust anchor: signature + imprint verify, chain not anchored (honest limit)", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":4,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const token = await signTsaToken(ctx, bytes, GEN_TIME);
    await writeReceipt(acct, 4, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });

    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 4),
      target: TARGET,
    });
    expect(r).toEqual({
      grade: "trusted-timestamped",
      verified: true,
      chainValidated: false,
      anchorLength: 4,
    });
  });
});

describe("verifyExternal — fail-closed", () => {
  test("a versioned receipt without a durably recorded identity is refused", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":12,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const token = await signTsaToken(ctx, bytes, GEN_TIME);
    await writeReceipt(acct, 12, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });
    const versionedStore: ArtifactStore = {
      put: store.put.bind(store),
      get: store.get.bind(store),
      head: async (key, versionId) => {
        void versionId;
        const meta = await store.head(key);
        return meta === null ? null : { ...meta, versionId: "provider-v1" };
      },
      extendRetention: store.extendRetention.bind(store),
    };

    const result = await verifyExternal(acct, {
      store: versionedStore,
      reader: fixedReader(bytes, 12),
      target: TARGET,
    });

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.reason).toContain("recorded version");
    }
  });

  test("no receipt → not verified", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":1,"tipHash":"${acct}"}`);
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 1),
      target: TARGET,
    });
    expect(r.verified).toBe(false);
    expect(r).toMatchObject({ grade: "trusted-timestamped" });
  });

  test("no chain → not verified (nothing to attest)", async () => {
    const acct = randomUUID();
    const r = await verifyExternal(acct, {
      store,
      reader: { readCurrentAnchor: () => Promise.resolve(null) },
      target: TARGET,
    });
    expect(r.verified).toBe(false);
  });

  test("a tampered anchor (digest mismatch vs receipt) fails closed", async () => {
    const acct = randomUUID();
    const original = new TextEncoder().encode(
      `{"length":5,"tipHash":"${acct}"}`,
    );
    const digest = sha256Hex(original);
    const token = await signTsaToken(ctx, original, GEN_TIME);
    await writeReceipt(acct, 5, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });
    // The reader now returns DIFFERENT bytes for the same length — the anchor was rewritten.
    const tampered = new TextEncoder().encode(
      `{"length":5,"tipHash":"forged!"}`,
    );
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(tampered, 5),
      target: TARGET,
      trustAnchors: [ctx.caDer],
    });
    expect(r.verified).toBe(false);
    if (!r.verified) expect(r.reason).toContain("digest");
  });

  test("a token that attests DIFFERENT bytes than the receipt claims fails closed (CMS imprint)", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":6,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    // Receipt's stored digest/imprint MATCH the current anchor (step-2 passes), but the token was
    // minted over UNRELATED bytes — only the full CMS verify catches it.
    const otherBytes = new TextEncoder().encode("unrelated-anchor");
    const token = await signTsaToken(ctx, otherBytes, GEN_TIME);
    await writeReceipt(acct, 6, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 6),
      target: TARGET,
      trustAnchors: [ctx.caDer],
    });
    expect(r.verified).toBe(false);
  });

  test("a malformed token fails closed", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":7,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    await writeReceipt(acct, 7, {
      anchorDigest: digest,
      messageImprint: digest,
      token: Buffer.from("not-a-real-cms-token").toString("base64"),
    });
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 7),
      target: TARGET,
    });
    expect(r.verified).toBe(false);
  });

  test("a signer cert without the timeStamping EKU fails closed", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":8,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const token = await signTsaToken(noEkuCtx, bytes, GEN_TIME);
    await writeReceipt(acct, 8, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
    });
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 8),
      target: TARGET,
    });
    expect(r.verified).toBe(false);
    if (!r.verified) expect(r.reason).toContain("EKU");
  });

  test("a receipt stamped externally-transparent is refused in v1 (Fork E honesty)", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":9,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const token = await signTsaToken(ctx, bytes, GEN_TIME);
    await writeReceipt(acct, 9, {
      anchorDigest: digest,
      messageImprint: digest,
      token,
      grade: "externally-transparent",
    });
    const r = await verifyExternal(acct, {
      store,
      reader: fixedReader(bytes, 9),
      target: TARGET,
    });
    expect(r.verified).toBe(false);
    // never reports the externally-transparent grade in v1
    expect(r.grade).toBe("trusted-timestamped");
  });
});
