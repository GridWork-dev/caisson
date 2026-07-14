// src/verify-external.ts — chain-level external-anchor verification (T5; SPEC external-anchoring
// Design §5, Fork E; ADR-0346 P2 = FULL ASN.1/CMS depth).
//
// `verifyExternal` sits beside `AuditChainStore.verify()` and answers a different question: not "is
// the local chain internally consistent against its WORM anchor" (that is `verify()`), but "does a
// stored external-anchor receipt genuinely attest THIS tenant's current anchor". V1 verifies the
// `trusted-timestamped` (RFC-3161 TSA) grade to FULL depth and NOTHING else:
//   1. a receipt object exists in WORM for the current anchor length (existence);
//   2. the receipt's `anchorDigest` (and the token's messageImprint) byte-match `sha256(anchorBytes)`
//      of the CURRENT anchor, compared constant-time (tamper catch);
//   3. the RFC-3161 TimeStampToken parses as complete CMS DER, its signature verifies over the
//      TSTInfo, the TSTInfo's imprint equals `sha256(anchorBytes)`, the signing cert carries the
//      timeStamping EKU, and — when the buyer configures trust anchors — the TSA certificate chain
//      validates against them (ADR-0346 P2, done via pkijs — no hand-rolled ASN.1).
//
// FAIL-CLOSED at every step: a missing/malformed receipt, a digest mismatch, an unparseable or
// unverifiable token, or a wrong grade all resolve to `{ verified: false, reason }` — never a throw
// that a caller might read as "inconclusive", and never a `verified: true` on doubt.
//
// GRADE HONESTY (Fork E, ADR-0332 Binding): the returned `grade` is ALWAYS `trusted-timestamped` in
// v1. `verifyExternal` refuses to ever report `externally-transparent` — a receipt Caisson has not
// verified against a PUBLIC log (which does not exist in v1) is not externally anchored. A receipt
// whose stored grade is anything other than `trusted-timestamped` fails closed here.
import {
  Certificate,
  ContentInfo,
  CryptoEngine,
  type ExtKeyUsage,
  SignedData,
  setEngine,
} from "pkijs";
import { fromBER } from "asn1js";
import { parseStrict, safeEqualFixed } from "@caisson/kernel";
import type { ArtifactStore } from "./store.ts";
import {
  anchorReceiptKey,
  anchorReceiptSchema,
  sha256Hex,
  targetId,
  type TransparencyTarget,
} from "./anchor-transparency.ts";
import type { CurrentAnchorReader } from "./anchor-checkpoint.ts";

/** The only grade v1 can produce or report (Fork E). Hard-coded so a bug can never widen it. */
const V1_GRADE = "trusted-timestamped" as const;
/** id-kp-timeStamping — RFC-3161 requires the TSA signing cert to carry this EKU. */
const EKU_TIMESTAMPING = "1.3.6.1.5.5.7.3.8";
/** X.509 extendedKeyUsage extension OID. */
const EKU_EXTENSION_OID = "2.5.29.37";

/**
 * pkijs needs a WebCrypto engine for SignedData.verify. Bun exposes `globalThis.crypto` (WebCrypto)
 * globally; set it ONCE, idempotently. Nothing else in this package uses a pkijs crypto engine
 * (TsaAnchorLog only does DER encode/parse), so this is a private, side-effect-free-until-called set.
 */
let engineReady = false;
function ensureCryptoEngine(): void {
  if (engineReady) return;
  // Bun's WebCrypto `generateKey` overload set (X25519/Ed25519) is narrower than pkijs's
  // `ICryptoEngine`, so the constructed engine needs a bridging cast — runtime is fully compatible
  // (the RSA + digest surface verify uses is present); only the DOM-vs-Bun lib types diverge.
  const engine = new CryptoEngine({
    name: "caisson-audit-worm",
    crypto: globalThis.crypto,
  });
  setEngine(
    "caisson-audit-worm",
    engine as unknown as Parameters<typeof setEngine>[1],
  );
  engineReady = true;
}

/** A fresh, exactly-sized `ArrayBuffer` copy — pkijs's verify `data` param is typed `ArrayBuffer`. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

export interface VerifyExternalDeps {
  /** The WORM store the receipt object is read from. */
  readonly store: ArtifactStore;
  /** Reads the tenant's current anchor + its EXACT canonical bytes (same port the handler uses). */
  readonly reader: CurrentAnchorReader;
  /** The anchor target (v1: a TSA target carrying `grade: "trusted-timestamped"`). */
  readonly target: TransparencyTarget;
  /**
   * Buyer-configured TSA CA root certificates (DER), Fork C. When provided, the token's certificate
   * chain is validated against them (full P2 depth → `chainValidated: true`). When omitted, the
   * signature + imprint + EKU are still verified but the chain is NOT anchored to a known root
   * (`chainValidated: false`) — the honest limit surfaced to the caller, never silently upgraded.
   */
  readonly trustAnchors?: readonly Uint8Array[];
}

/** The typed verdict. `grade` is ALWAYS `trusted-timestamped` in v1 — never `externally-transparent`. */
export type AnchorVerification =
  | {
      readonly grade: typeof V1_GRADE;
      readonly verified: true;
      /** Whether the TSA cert chain was validated against buyer-configured trust anchors. */
      readonly chainValidated: boolean;
      readonly anchorLength: number;
    }
  | {
      readonly grade: typeof V1_GRADE;
      readonly verified: false;
      readonly reason: string;
    };

function fail(reason: string): AnchorVerification {
  return { grade: V1_GRADE, verified: false, reason };
}

/** True iff the certificate carries the id-kp-timeStamping extended key usage (RFC-3161). */
function hasTimestampingEku(cert: Certificate | undefined): boolean {
  const ext = cert?.extensions?.find((e) => e.extnID === EKU_EXTENSION_OID);
  const eku = ext?.parsedValue as ExtKeyUsage | undefined;
  return eku?.keyPurposes?.includes(EKU_TIMESTAMPING) ?? false;
}

/**
 * Verify that the WORM receipt for the tenant's CURRENT anchor genuinely attests it, to full v1
 * (`trusted-timestamped`) depth. Fail-closed; the returned `grade` is always `trusted-timestamped`.
 */
export async function verifyExternal(
  accountId: string,
  deps: VerifyExternalDeps,
): Promise<AnchorVerification> {
  // Fork E honesty guard: v1 can only verify the timestamped grade. A public-log target has no
  // inclusion-proof check in v1 and must not be reported as verified.
  if (deps.target.grade !== V1_GRADE) {
    return fail(`v1 verifyExternal supports only the ${V1_GRADE} grade`);
  }

  const current = await deps.reader.readCurrentAnchor(accountId);
  if (current === null) return fail("tenant has no anchor to verify");

  const expectedDigest = sha256Hex(current.anchorBytes);
  const target = targetId(deps.target);
  const receiptKey = anchorReceiptKey(accountId, current.length, target);

  // (1) existence.
  if ((await deps.store.head(receiptKey)) === null) {
    return fail("no external-anchor receipt for the current anchor length");
  }

  // Read + parse the receipt, fail-closed on any malformation.
  let receipt;
  try {
    const obj = await deps.store.get(receiptKey);
    receipt = parseStrict(
      anchorReceiptSchema,
      JSON.parse(new TextDecoder().decode(obj.body)),
    );
  } catch {
    return fail("external-anchor receipt is missing or malformed");
  }

  // Grade honesty: a v1 receipt must be trusted-timestamped (never report externally-transparent).
  if (receipt.grade !== V1_GRADE) {
    return fail(`receipt grade ${receipt.grade} is not verifiable in v1`);
  }

  // (2) byte-match the CURRENT anchor against the receipt's stored digest + the token's imprint,
  // constant-time. Length + digest + imprint must all agree with the live anchor.
  if (receipt.anchorLength !== current.length) {
    return fail("receipt anchor length does not match the current anchor");
  }
  if (!safeEqualFixed(receipt.anchorDigest, expectedDigest)) {
    return fail(
      "receipt anchor digest does not match the current anchor (tamper)",
    );
  }
  if (!safeEqualFixed(receipt.receipt.messageImprint, expectedDigest)) {
    return fail("receipt timestamp imprint does not match the current anchor");
  }

  // (3) FULL CMS verification of the RFC-3161 TimeStampToken.
  ensureCryptoEngine();

  let signedData: SignedData;
  try {
    const tokenDer = Uint8Array.from(
      Buffer.from(receipt.receipt.token, "base64"),
    );
    const asn1 = fromBER(tokenDer);
    if (asn1.offset === -1) return fail("timestamp token is not valid DER");
    const contentInfo = new ContentInfo({ schema: asn1.result });
    signedData = new SignedData({ schema: contentInfo.content });
  } catch {
    return fail("timestamp token is not a valid CMS SignedData");
  }

  // Parse buyer trust anchors (DER CA certs) if provided; a malformed anchor fails closed.
  const chainValidated = (deps.trustAnchors ?? []).length > 0;
  let trustedCerts: Certificate[] = [];
  if (chainValidated) {
    try {
      trustedCerts = (deps.trustAnchors ?? []).map((der) => {
        const parsed = fromBER(Uint8Array.from(der));
        if (parsed.offset === -1) throw new Error("bad anchor DER");
        return new Certificate({ schema: parsed.result });
      });
    } catch {
      return fail("a configured TSA trust anchor is not valid DER");
    }
  }

  // pkijs treats an id-ct-TSTInfo token as COUNTERSIGNING external `data`: it recomputes
  // sha256(data) and compares it to the token's messageImprint, verifies the CMS signature over the
  // TSTInfo, and (with checkChain) validates the signer cert path to `trustedCerts`. Passing the
  // CURRENT anchor bytes as `data` binds all of that to the live anchor in one vetted call.
  let result: { signatureVerified?: boolean; signerCertificate?: Certificate };
  try {
    result = (await signedData.verify({
      signer: 0,
      data: toArrayBuffer(current.anchorBytes),
      checkChain: chainValidated,
      trustedCerts,
      extendedMode: true,
    })) as { signatureVerified?: boolean; signerCertificate?: Certificate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`timestamp token verification failed: ${message}`);
  }

  if (result.signatureVerified !== true) {
    return fail("timestamp token signature did not verify");
  }
  if (!hasTimestampingEku(result.signerCertificate)) {
    return fail("timestamp signer certificate lacks the timeStamping EKU");
  }

  return {
    grade: V1_GRADE,
    verified: true,
    chainValidated,
    anchorLength: current.length,
  };
}
