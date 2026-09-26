// src/anchor-rekor.ts — the Rekor v2 public-log anchoring leg (`externally-transparent` grade; SPEC
// external-anchoring Design §2/§5, ADR-0332/0346 Fork R-α/β). Two halves, both proven end-to-end
// against the LIVE public instance in the R1 de-risk:
//
//   1. RekorAnchorLog.submit — build a `hashedrekord/0.0.2` request (ed25519ph over the anchor bytes,
//      `keyDetails PKIX_ED25519_PH`, `digest = SHA-512(anchorBytes)`), read the write URL from a
//      deployment-supplied SigningConfig (NEVER a hardcoded shard — it rotates ~6-monthly, spike Q4),
//      POST via `fetchWithTimeout(..., >= 20s)` (spike decision #7, hard requirement), and snapshot the
//      returned `TransparencyLogEntry` + the log's checkpoint-signing key (from a deployment TrustedRoot)
//      into a SELF-CONTAINED `TransparencyReceipt`.
//   2. verifyRekorReceipt — verify that receipt fully OFFLINE (zero network): the C2SP signed-note
//      checkpoint against the receipt-EMBEDDED log key (no TUF freshness — receipts outlive shards), the
//      RFC-6962 inclusion proof against the checkpoint root, and `leaf.data.digest == SHA-512(anchorBytes)`.
//
// Fork R-β = HAND-ROLL (R1 findings): `@sigstore/*` expose no v2 self-managed submit and only TUF-rooted
// verify (the machinery the self-contained receipt discards). The RFC-6962 + signed-note verify here is
// NEW code — `kernel/audit-chain.ts` is a prevHash linked list, not a Merkle tree (PC3). Every step
// fails closed. The ed25519ph crypto is INJECTED (`AnchorSubmissionSigner`), so this file adds no crypto
// dependency; the checkpoint verify + Merkle hashing are `node:crypto`.
import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { z } from "zod";
import {
  fetchWithTimeout,
  safeEqualFixed,
  ValidationError,
} from "@caisson-sh/kernel/node";
import {
  isIrreversiblePublicityOptIn,
  transparencyReceiptSchema,
  type AnchorSubmissionSigner,
  type IrreversiblePublicityOptIn,
  type TransparencyLog,
  type TransparencyReceipt,
} from "./anchor-transparency.ts";

// --- constants -----------------------------------------------------------------------------------

/** Rekor v2 blocks on checkpoint publication; CLIENTS.md mandates >= 20s timeouts (spike decision #7). */
const MIN_REKOR_TIMEOUT_MS = 20_000;
/** The Rekor v2 write endpoint path appended to the SigningConfig shard URL. */
const CREATE_ENTRY_PATH = "/api/v2/log/entries";
/** Ed25519 SubjectPublicKeyInfo DER = this fixed 12-byte prefix + the raw 32-byte public key. */
const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
/** RFC-6962 domain-separation prefixes (§2.1). */
const LEAF_PREFIX = 0x00;
const NODE_PREFIX = 0x01;

// --- deployment config parsing (SigningConfig + TrustedRoot; spike decision #3/Q4) --------------

const signingConfigSchema = z
  .object({
    rekorTlogUrls: z
      .array(
        z
          .object({
            url: z.string().min(1),
            majorApiVersion: z.number().int().optional(),
            validFor: z
              .object({
                start: z.string().optional(),
                end: z.string().optional(),
              })
              .strip()
              .optional(),
          })
          .strip(),
      )
      .min(1),
  })
  .strip();

const trustedRootTlogSchema = z
  .object({
    logId: z.object({ keyId: z.string().min(1) }).strip(),
    publicKey: z
      .object({ rawBytes: z.string().min(1), keyDetails: z.string().min(1) })
      .strip(),
  })
  .strip();

const trustedRootSchema = z
  .object({ tlogs: z.array(trustedRootTlogSchema).min(1) })
  .strip();

/**
 * Resolve the current Rekor v2 write URL from a deployment SigningConfig. Picks the first v2 shard
 * whose `validFor` window is current, asserts it is https (public-log egress — security floor), and
 * fails closed if none qualifies. NEVER a hardcoded shard.
 */
function resolveWriteUrl(signingConfig: unknown, now: Date): string {
  const cfg = signingConfigSchema.parse(signingConfig);
  const nowMs = now.getTime();
  const inWindow = (v?: {
    start?: string | undefined;
    end?: string | undefined;
  }): boolean => {
    if (v?.start !== undefined && Date.parse(v.start) > nowMs) return false;
    if (v?.end !== undefined && Date.parse(v.end) <= nowMs) return false;
    return true;
  };
  const chosen = cfg.rekorTlogUrls.find(
    (t) => (t.majorApiVersion ?? 2) === 2 && inWindow(t.validFor),
  );
  if (chosen === undefined) {
    throw new ValidationError(
      "SigningConfig has no currently-valid Rekor v2 shard URL",
    );
  }
  if (new URL(chosen.url).protocol !== "https:") {
    throw new ValidationError("Rekor write URL must be an https endpoint");
  }
  return chosen.url.replace(/\/+$/, "");
}

/** Snapshot the checkpoint-signing key material for the shard the entry landed in (self-contained). */
function resolveLogKey(
  trustedRoot: unknown,
  logIdKeyId: string,
): { logPublicKey: string; keyDetails: string } {
  const root = trustedRootSchema.parse(trustedRoot);
  const shard = root.tlogs.find((t) => t.logId.keyId === logIdKeyId);
  if (shard === undefined) {
    throw new ValidationError(
      "TrustedRoot has no shard key matching the entry logId",
    );
  }
  return {
    logPublicKey: shard.publicKey.rawBytes,
    keyDetails: shard.publicKey.keyDetails,
  };
}

// --- the log entry response (only the fields the receipt consumes) ------------------------------

const logEntrySchema = z
  .object({
    logIndex: z.string().regex(/^\d+$/),
    logId: z.object({ keyId: z.string().min(1) }).strip(),
    canonicalizedBody: z.string().min(1),
    inclusionProof: z
      .object({
        hashes: z.array(z.string().min(1)),
        checkpoint: z.object({ envelope: z.string().min(1) }).strip(),
      })
      .strip(),
  })
  .strip();

// --- RekorAnchorLog (R4) -------------------------------------------------------------------------

export interface RekorAnchorLogConfig {
  /** The injected deployment ed25519ph signer (`Ed25519PhSigner` from signing-primitive). */
  readonly signer: AnchorSubmissionSigner;
  /** Deployment-supplied SigningConfig (write-URL source). Never a hardcoded shard. */
  readonly signingConfig: unknown;
  /** Deployment-supplied TrustedRoot (checkpoint-key source, snapshotted into the receipt). */
  readonly trustedRoot: unknown;
  /** Fork D: the typed irreversible-publicity consent. WITHOUT it, this log cannot be constructed. */
  readonly optIn: IrreversiblePublicityOptIn;
  /** Outbound timeout (ms). Default + floor 20s per CLIENTS.md; below the floor is refused. */
  readonly timeoutMs?: number;
  /** Clock for SigningConfig window selection. Default: wall clock. */
  readonly now?: () => Date;
}

/**
 * The Rekor v2 public-log `TransparencyLog`. Construction REFUSES without the irreversible-publicity
 * opt-in (Fork D / R10) — the branded value is unforgeable, so an accidental public egress is impossible.
 * `submit` egresses the anchor bytes (hashes only, no PII) and returns a self-contained receipt.
 */
export class RekorAnchorLog implements TransparencyLog {
  readonly #signer: AnchorSubmissionSigner;
  readonly #signingConfig: unknown;
  readonly #trustedRoot: unknown;
  readonly #timeoutMs: number;
  readonly #now: () => Date;

  constructor(config: RekorAnchorLogConfig) {
    // Fork D: the opt-in is a required, branded arg — TypeScript blocks construction without it, and
    // this runtime brand check blocks an untyped JS caller passing a forged value.
    if (!isIrreversiblePublicityOptIn(config.optIn)) {
      throw new ValidationError(
        "RekorAnchorLog requires a valid irreversible-publicity opt-in (Fork D)",
      );
    }
    const timeoutMs = config.timeoutMs ?? MIN_REKOR_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs < MIN_REKOR_TIMEOUT_MS) {
      throw new ValidationError(
        `Rekor timeout must be a finite value >= ${String(MIN_REKOR_TIMEOUT_MS)}ms`,
      );
    }
    if (config.signer.algorithm !== "ed25519ph") {
      throw new ValidationError(
        "RekorAnchorLog requires an ed25519ph signer (hashedrekord rejects pure Ed25519)",
      );
    }
    this.#signer = config.signer;
    this.#signingConfig = config.signingConfig;
    this.#trustedRoot = config.trustedRoot;
    this.#timeoutMs = timeoutMs;
    this.#now = config.now ?? ((): Date => new Date());
  }

  async submit(anchorBytes: Uint8Array): Promise<TransparencyReceipt> {
    const writeUrl = resolveWriteUrl(this.#signingConfig, this.#now());
    const digest = createHash("sha512").update(anchorBytes).digest(); // SHA2_512 prehash
    const [rawPub, signature] = await Promise.all([
      this.#signer.publicKey(),
      this.#signer.sign(anchorBytes),
    ]);
    const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + rawPub.length);
    spki.set(ED25519_SPKI_PREFIX);
    spki.set(rawPub, ED25519_SPKI_PREFIX.length);

    const body = {
      hashedRekordRequestV002: {
        digest: Buffer.from(digest).toString("base64"),
        signature: {
          content: Buffer.from(signature).toString("base64"),
          verifier: {
            publicKey: { rawBytes: Buffer.from(spki).toString("base64") },
            keyDetails: "PKIX_ED25519_PH",
          },
        },
      },
    };

    const resp = await fetchWithTimeout(
      `${writeUrl}${CREATE_ENTRY_PATH}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: this.#timeoutMs },
    );
    if (!resp.ok) {
      throw new ValidationError("Rekor submission was not accepted", {
        status: resp.status,
      });
    }
    return rekorEntryToReceipt(await resp.json(), this.#trustedRoot);
  }
}

/**
 * Turn a raw Rekor v2 `TransparencyLogEntry` into a SELF-CONTAINED receipt: snapshot the checkpoint
 * envelope + inclusion proof + leaf, and the log's checkpoint-signing key (resolved from the deployment
 * TrustedRoot by `logId`) + origin. Pure (no network) — the live POST in `RekorAnchorLog.submit` and the
 * hermetic golden-fixture test share this exact parse. Fails closed on a non-Ed25519 shard key (v1.1
 * only verifies Ed25519 checkpoints offline).
 */
export function rekorEntryToReceipt(
  rawEntry: unknown,
  trustedRoot: unknown,
): TransparencyReceipt {
  const entry = logEntrySchema.parse(rawEntry);
  const key = resolveLogKey(trustedRoot, entry.logId.keyId);
  if (key.keyDetails !== "PKIX_ED25519") {
    throw new ValidationError(
      "Rekor shard checkpoint key is not Ed25519 (unverifiable in v1.1)",
    );
  }
  const origin = entry.inclusionProof.checkpoint.envelope.split("\n")[0] ?? "";
  return transparencyReceiptSchema.parse({
    algorithm: "rekor-v2-hashedrekord",
    origin,
    checkpoint: entry.inclusionProof.checkpoint.envelope,
    logKeyDetails: "PKIX_ED25519",
    logPublicKey: key.logPublicKey,
    logId: entry.logId.keyId,
    logIndex: entry.logIndex,
    inclusionHashes: entry.inclusionProof.hashes,
    canonicalizedBody: entry.canonicalizedBody,
  } satisfies TransparencyReceipt);
}

// --- offline verification (R5 core; proven against the golden fixture) ---------------------------

/** A fail-closed verdict for the offline Rekor receipt check. */
export type RekorVerifyResult =
  | { readonly ok: true; readonly logIndex: string }
  | { readonly ok: false; readonly reason: string };

function fail(reason: string): RekorVerifyResult {
  return { ok: false, reason };
}

/** SHA-256 over a concatenation of byte chunks. */
function sha256(...chunks: Uint8Array[]): Uint8Array {
  const h = createHash("sha256");
  for (const c of chunks) h.update(c);
  return Uint8Array.from(h.digest());
}

/** Constant-length byte equality (no early-exit leak beyond length). */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

/**
 * Parse a C2SP signed-note checkpoint envelope. The signed text is the newline-terminated BODY lines
 * only — NOT the blank separator line before the `— name sig` block (a live-verified gotcha, R1). The
 * signature block is `base64(keyHash[4] ‖ ed25519Sig[64])`; multiple witness lines may follow.
 */
function parseCheckpoint(envelope: string): {
  readonly signedText: Uint8Array;
  readonly origin: string;
  readonly treeSize: bigint;
  readonly rootHash: Uint8Array;
  readonly sigLines: readonly { name: string; blob: Uint8Array }[];
} | null {
  const sigIdx = envelope.indexOf("\n— ");
  if (sigIdx === -1) return null;
  const bodyLines = envelope.slice(0, sigIdx).replace(/\n$/, "").split("\n");
  if (bodyLines.length < 3) return null;
  const [origin, treeSizeStr, rootB64] = bodyLines as [string, string, string];
  if (!/^\d+$/.test(treeSizeStr)) return null;
  let rootHash: Uint8Array;
  try {
    rootHash = Uint8Array.from(Buffer.from(rootB64, "base64"));
  } catch {
    return null;
  }
  if (rootHash.length !== 32) return null;
  const signedText = new TextEncoder().encode(bodyLines.join("\n") + "\n");
  const sigLines: { name: string; blob: Uint8Array }[] = [];
  for (const line of envelope.slice(sigIdx + 1).split("\n")) {
    const m = /^— (\S+) (\S+)$/.exec(line);
    if (m === null) continue;
    sigLines.push({
      name: m[1] as string,
      blob: Uint8Array.from(Buffer.from(m[2] as string, "base64")),
    });
  }
  if (sigLines.length === 0) return null;
  return {
    signedText,
    origin,
    treeSize: BigInt(treeSizeStr),
    rootHash,
    sigLines,
  };
}

/** RFC-6962 §2.1.1 inclusion-proof verification: reconstruct the root and compare to the checkpoint. */
function verifyInclusion(
  index: bigint,
  size: bigint,
  leafHash: Uint8Array,
  proof: readonly Uint8Array[],
  root: Uint8Array,
): boolean {
  if (index >= size || size <= 0n) return false;
  let fn = index;
  let sn = size - 1n;
  let hash: Uint8Array = leafHash;
  for (const sibling of proof) {
    if (fn === sn || (fn & 1n) === 1n) {
      hash = sha256(Uint8Array.of(NODE_PREFIX), sibling, hash);
      if ((fn & 1n) === 0n) {
        do {
          fn >>= 1n;
          sn >>= 1n;
        } while ((fn & 1n) === 0n && fn !== 0n);
      }
    } else {
      hash = sha256(Uint8Array.of(NODE_PREFIX), hash, sibling);
    }
    fn >>= 1n;
    sn >>= 1n;
  }
  return fn === 0n && bytesEqual(hash, root);
}

const leafBodySchema = z
  .object({
    spec: z
      .object({
        hashedRekordV002: z
          .object({
            data: z
              .object({ algorithm: z.string(), digest: z.string().min(1) })
              .strip(),
          })
          .strip(),
      })
      .strip(),
  })
  .strip();

/**
 * Verify a self-contained Rekor receipt FULLY OFFLINE against the CURRENT anchor bytes. Fail-closed at
 * every step; zero network. Steps (all proven against the golden fixture in R1):
 *   1. checkpoint signature verifies against the receipt-embedded Ed25519 log key, with the C2SP note
 *      keyHash bound to the signing name — WITHOUT enforcing TUF freshness (receipts outlive shards);
 *   2. RFC-6962 inclusion proof reconstructs the checkpoint root from the leaf + hashes + logIndex;
 *   3. the leaf's `data.digest` equals `SHA-512(anchorBytes)` and `data.algorithm` is `SHA2_512`.
 */
export function verifyRekorReceipt(
  receipt: TransparencyReceipt,
  anchorBytes: Uint8Array,
): RekorVerifyResult {
  if (receipt.logKeyDetails !== "PKIX_ED25519") {
    return fail("unsupported checkpoint key algorithm");
  }

  // Embedded log key (DER SPKI) → node KeyObject + raw 32-byte key for the note keyHash.
  let logKey: ReturnType<typeof createPublicKey>;
  let rawLogPub: Uint8Array;
  try {
    const der = Buffer.from(receipt.logPublicKey, "base64");
    logKey = createPublicKey({ key: der, format: "der", type: "spki" });
    if (logKey.asymmetricKeyType !== "ed25519") {
      return fail("embedded log key is not Ed25519");
    }
    rawLogPub = Uint8Array.from(der.subarray(der.length - 32));
  } catch {
    return fail("embedded log key is not valid DER SPKI");
  }

  const cp = parseCheckpoint(receipt.checkpoint);
  if (cp === null) return fail("checkpoint envelope is malformed");
  if (cp.origin !== receipt.origin) {
    return fail("checkpoint origin does not match the receipt origin");
  }

  // (1) find the log's own signature line (keyHash-bound) and verify it.
  const expectKeyHash = sha256(
    new TextEncoder().encode(cp.origin),
    Uint8Array.of(0x0a, 0x01),
    rawLogPub,
  ).subarray(0, 4);
  const ownSig = cp.sigLines.find(
    (s) =>
      s.name === cp.origin &&
      s.blob.length === 68 &&
      bytesEqual(s.blob.subarray(0, 4), expectKeyHash),
  );
  if (ownSig === undefined) return fail("no matching log checkpoint signature");
  let checkpointOk: boolean;
  try {
    checkpointOk = edVerify(
      null,
      cp.signedText,
      logKey,
      ownSig.blob.subarray(4),
    );
  } catch {
    return fail("checkpoint signature verification errored");
  }
  if (!checkpointOk) return fail("checkpoint signature did not verify");

  // (2) RFC-6962 inclusion proof against the VERIFIED checkpoint root + tree size.
  let leaf: Uint8Array;
  let proof: Uint8Array[];
  try {
    leaf = Uint8Array.from(Buffer.from(receipt.canonicalizedBody, "base64"));
    proof = receipt.inclusionHashes.map((h: string) =>
      Uint8Array.from(Buffer.from(h, "base64")),
    );
  } catch {
    return fail("inclusion proof material is not valid base64");
  }
  const leafHash = sha256(Uint8Array.of(LEAF_PREFIX), leaf);
  if (
    !verifyInclusion(
      BigInt(receipt.logIndex),
      cp.treeSize,
      leafHash,
      proof,
      cp.rootHash,
    )
  ) {
    return fail("inclusion proof does not reconstruct the checkpoint root");
  }

  // (3) the leaf digest must equal SHA-512(anchorBytes) under SHA2_512.
  let parsedLeaf;
  try {
    parsedLeaf = leafBodySchema.parse(
      JSON.parse(new TextDecoder().decode(leaf)),
    );
  } catch {
    return fail("leaf body is not a parseable hashedrekord v0.0.2");
  }
  const leafData = parsedLeaf.spec.hashedRekordV002.data;
  if (leafData.algorithm !== "SHA2_512") {
    return fail("leaf digest algorithm is not SHA2_512");
  }
  const expectedDigestB64 = createHash("sha512")
    .update(anchorBytes)
    .digest("base64");
  if (!safeEqualFixed(leafData.digest, expectedDigestB64)) {
    return fail(
      "leaf digest does not match SHA-512 of the current anchor bytes",
    );
  }

  return { ok: true, logIndex: receipt.logIndex };
}
