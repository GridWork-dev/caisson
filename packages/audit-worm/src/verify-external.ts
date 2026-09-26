// src/verify-external.ts — chain-level external-anchor verification (SPEC external-anchoring Design §5,
// Fork E; ADR-0346 P2 = full CMS depth; ADR-0332/0346 v1.1 = offline inclusion-proof depth).
//
// `verifyExternal` sits beside `AuditChainStore.verify()` and answers a different question: not "is the
// local chain internally consistent against its WORM anchor" (that is `verify()`), but "does a stored
// external-anchor receipt genuinely attest THIS tenant's current anchor". It DISPATCHES on the target:
//
//   TSA target  → `trusted-timestamped`: existence + anchor-byte match + FULL RFC-3161 CMS verification
//                 (token parses as CMS DER, signature verifies over the TSTInfo bound to the live anchor,
//                 timeStamping EKU, and — when trust anchors are configured — cert-chain validation).
//   Rekor target → `externally-transparent`: existence + anchor-byte match + a FULLY OFFLINE public-log
//                 check (C2SP signed-note checkpoint against the receipt-embedded log key, RFC-6962
//                 inclusion proof, `SHA-512(anchorBytes)` leaf-digest binding) — zero live TUF/Rekor
//                 fetch. `verifyRekorReceipt` (anchor-rekor.ts) owns the crypto; this file wires it.
//
// FAIL-CLOSED at every step: a missing/malformed receipt, a digest mismatch, a grade/target mismatch, or
// any unverifiable token/proof resolves to `{ verified: false, reason }` — never a throw a caller might
// read as "inconclusive", and never `verified: true` on doubt. GRADE HONESTY (Fork E, ADR-0332 Binding):
// the returned `grade` is exactly the target's grade; a `trusted-timestamped` receipt is NEVER reported
// as `externally-transparent`, and vice-versa (a grade/receipt mismatch fails closed).
import {
  Certificate,
  ContentInfo,
  CryptoEngine,
  type ExtKeyUsage,
  SignedData,
  setEngine,
} from "pkijs";
import { fromBER } from "asn1js";
import { parseStrict, safeEqualFixed } from "@caisson-sh/kernel/node";
import type { ArtifactStore } from "./store.ts";
import {
  anchorReceiptKey,
  anchorReceiptSchema,
  sha256Hex,
  targetId,
  type AnchorGrade,
  type AnchorReceipt,
  type TransparencyTarget,
} from "./anchor-transparency.ts";
import { verifyRekorReceipt } from "./anchor-rekor.ts";
import type { CurrentAnchorReader } from "./anchor-checkpoint.ts";
import type { AnchorOutbox } from "./anchor-outbox.ts";

/** id-kp-timeStamping — RFC-3161 requires the TSA signing cert to carry this EKU. */
const EKU_TIMESTAMPING = "1.3.6.1.5.5.7.3.8";
/** X.509 extendedKeyUsage extension OID. */
const EKU_EXTENSION_OID = "2.5.29.37";

/**
 * pkijs needs a WebCrypto engine for SignedData.verify. Bun exposes `globalThis.crypto` (WebCrypto)
 * globally; set it ONCE, idempotently. Only the TSA path uses it (the Rekor path is node:crypto).
 */
let engineReady = false;
function ensureCryptoEngine(): void {
  if (engineReady) return;
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
  /** The anchor target (TSA `trusted-timestamped` or Rekor `externally-transparent`). */
  readonly target: TransparencyTarget;
  /**
   * Durable receipt identity reader. Production wiring should pass the same outbox used by the
   * checkpoint writer so versioned backends verify the exact immutable receipt, never key-current.
   * Optional only for backward compatibility with legacy/non-versioned deployments.
   */
  readonly receiptVersions?: Pick<AnchorOutbox, "get">;
  /**
   * Buyer-configured TSA CA root certificates (DER), Fork C. TSA path only. When provided, the token's
   * certificate chain is validated against them (`chainValidated: true`); when omitted, the signature +
   * imprint + EKU are still verified but the chain is not anchored to a known root
   * (`chainValidated: false`) — the honest limit surfaced to the caller, never silently upgraded.
   */
  readonly trustAnchors?: readonly Uint8Array[];
}

/**
 * The typed verdict. `grade` is exactly the target's grade — a discriminated union on (grade, verified)
 * so the two grades never conflate, and a TSA verdict carries `chainValidated` while a Rekor verdict
 * carries the public `logIndex`.
 */
export type AnchorVerification =
  | {
      readonly grade: "trusted-timestamped";
      readonly verified: true;
      /** Whether the TSA cert chain was validated against buyer-configured trust anchors. */
      readonly chainValidated: boolean;
      readonly anchorLength: number;
    }
  | {
      readonly grade: "externally-transparent";
      readonly verified: true;
      /** The public-log index the anchor is provably included at. */
      readonly logIndex: string;
      readonly anchorLength: number;
    }
  | {
      readonly grade: AnchorGrade;
      readonly verified: false;
      readonly reason: string;
    };

function fail(grade: AnchorGrade, reason: string): AnchorVerification {
  return { grade, verified: false, reason };
}

/** True iff the certificate carries the id-kp-timeStamping extended key usage (RFC-3161). */
function hasTimestampingEku(cert: Certificate | undefined): boolean {
  const ext = cert?.extensions?.find((e) => e.extnID === EKU_EXTENSION_OID);
  const eku = ext?.parsedValue as ExtKeyUsage | undefined;
  return eku?.keyPurposes?.includes(EKU_TIMESTAMPING) ?? false;
}

/**
 * Verify a stored external-anchor receipt against the tenant's CURRENT anchor. Fail-closed; the returned
 * `grade` is exactly the target's grade. Dispatches TSA (full CMS) vs Rekor (offline inclusion proof).
 */
export async function verifyExternal(
  accountId: string,
  deps: VerifyExternalDeps,
): Promise<AnchorVerification> {
  const grade = deps.target.grade;

  const current = await deps.reader.readCurrentAnchor(accountId);
  if (current === null) return fail(grade, "tenant has no anchor to verify");

  const expectedDigest = sha256Hex(current.anchorBytes);
  const target = targetId(deps.target);
  const receiptKey = anchorReceiptKey(accountId, current.length, target);
  const receiptVersionId =
    (
      await deps.receiptVersions?.get({
        accountId,
        target,
        anchorLength: current.length,
        anchorDigest: expectedDigest,
      })
    )?.receiptVersionId ?? undefined;

  // (1) existence. A versioned backend without a durable identity is unsafe: key-current can be a
  // replacement or delete-marker successor, so refuse instead of silently verifying that object.
  const receiptMeta = await deps.store.head(receiptKey, receiptVersionId);
  if (receiptMeta === null) {
    return fail(
      grade,
      "no external-anchor receipt for the current anchor length",
    );
  }
  if (receiptMeta.versionId !== undefined && receiptVersionId === undefined) {
    return fail(
      grade,
      "external-anchor receipt has no recorded version identity",
    );
  }

  // Read + parse the receipt, fail-closed on any malformation.
  let receipt: AnchorReceipt;
  try {
    const obj = await deps.store.get(receiptKey, receiptVersionId);
    receipt = parseStrict(
      anchorReceiptSchema,
      JSON.parse(new TextDecoder().decode(obj.body)),
    );
  } catch {
    return fail(grade, "external-anchor receipt is missing or malformed");
  }

  // Grade honesty: the stored receipt's grade must match the target's grade exactly.
  if (receipt.grade !== grade) {
    return fail(
      grade,
      `receipt grade ${receipt.grade} does not match the target`,
    );
  }

  // (2) byte-match the CURRENT anchor against the receipt's stored length + digest, constant-time.
  if (receipt.anchorLength !== current.length) {
    return fail(
      grade,
      "receipt anchor length does not match the current anchor",
    );
  }
  if (!safeEqualFixed(receipt.anchorDigest, expectedDigest)) {
    return fail(
      grade,
      "receipt anchor digest does not match the current anchor (tamper)",
    );
  }

  // (3) grade-specific verification.
  if (deps.target.kind === "tsa") {
    return verifyTsaReceipt(receipt, current.anchorBytes, expectedDigest, deps);
  }
  if (deps.target.kind === "rekor") {
    return verifyRekorExternal(receipt, current.anchorBytes);
  }
  // OTS (Fork R-γ): v1.1 ships the submit leg only. Offline verification requires upgrading the `.ots`
  // proof and confirming the Bitcoin commitment via block headers — a documented seam, out of scope
  // here. Fail closed HONESTLY rather than claim a grade we cannot prove offline (Fork E).
  return fail(
    grade,
    "OpenTimestamps offline verification requires Bitcoin block headers (documented seam, out of scope in v1.1)",
  );
}

/** The TSA `trusted-timestamped` path: full RFC-3161 CMS verification (ADR-0346 P2). */
async function verifyTsaReceipt(
  receipt: AnchorReceipt,
  anchorBytes: Uint8Array,
  expectedDigest: string,
  deps: VerifyExternalDeps,
): Promise<AnchorVerification> {
  const grade = "trusted-timestamped" as const;
  if (receipt.receipt.algorithm !== "rfc3161") {
    return fail(grade, "receipt is not an RFC-3161 timestamp receipt");
  }
  const token = receipt.receipt;
  if (!safeEqualFixed(token.messageImprint, expectedDigest)) {
    return fail(
      grade,
      "receipt timestamp imprint does not match the current anchor",
    );
  }

  ensureCryptoEngine();

  let signedData: SignedData;
  try {
    const tokenDer = Uint8Array.from(Buffer.from(token.token, "base64"));
    const asn1 = fromBER(tokenDer);
    if (asn1.offset === -1)
      return fail(grade, "timestamp token is not valid DER");
    const contentInfo = new ContentInfo({ schema: asn1.result });
    signedData = new SignedData({ schema: contentInfo.content });
  } catch {
    return fail(grade, "timestamp token is not a valid CMS SignedData");
  }

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
      return fail(grade, "a configured TSA trust anchor is not valid DER");
    }
  }

  let result: { signatureVerified?: boolean; signerCertificate?: Certificate };
  try {
    result = (await signedData.verify({
      signer: 0,
      data: toArrayBuffer(anchorBytes),
      checkChain: chainValidated,
      trustedCerts,
      extendedMode: true,
    })) as { signatureVerified?: boolean; signerCertificate?: Certificate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(grade, `timestamp token verification failed: ${message}`);
  }

  if (result.signatureVerified !== true) {
    return fail(grade, "timestamp token signature did not verify");
  }
  if (!hasTimestampingEku(result.signerCertificate)) {
    return fail(
      grade,
      "timestamp signer certificate lacks the timeStamping EKU",
    );
  }

  return {
    grade,
    verified: true,
    chainValidated,
    anchorLength: receipt.anchorLength,
  };
}

/** The Rekor `externally-transparent` path: fully offline public-log inclusion verification. */
function verifyRekorExternal(
  receipt: AnchorReceipt,
  anchorBytes: Uint8Array,
): AnchorVerification {
  const grade = "externally-transparent" as const;
  if (receipt.receipt.algorithm !== "rekor-v2-hashedrekord") {
    return fail(grade, "receipt is not a Rekor transparency receipt");
  }
  const result = verifyRekorReceipt(receipt.receipt, anchorBytes);
  if (!result.ok) return fail(grade, result.reason);
  return {
    grade,
    verified: true,
    logIndex: result.logIndex,
    anchorLength: receipt.anchorLength,
  };
}
