import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { z } from "zod";
import {
  canonicalize,
  type AuditChainAnchor,
  type AuditChainEntry,
  type JsonValue,
} from "@caisson-sh/kernel";
import {
  verifyEntryAgainstAnchor,
  type LegResult,
} from "@caisson-sh/kernel/audit-verify";
import {
  EVIDENCE_PACK_FORMAT_VERSION,
  EVIDENCE_PACK_KEY_ID_MAX_LENGTH,
  EVIDENCE_PACK_MANIFEST_VERSION,
  EVIDENCE_PACK_SEAL_VERSION,
  evidencePackSealPayloadBytes,
  isEvidencePackKeyId,
  type EvidencePack,
  type EvidencePackManifest,
} from "@caisson-sh/kernel/evidence";

const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const MAX_PACK_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_PACK_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_LOGICAL_FILE_BYTES = 24 * 1024 * 1024;
const MAX_RECEIPTS = 100_000;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;
const MAX_JSON_TEXT_CODE_UNITS = 8 * 1024 * 1024;

const manifestEntrySchema = z
  .object({
    name: z.string().regex(FILE_NAME),
    sha256: z.string().regex(SHA256),
  })
  .strict();

const manifestSchema = z
  .object({
    v: z.literal(EVIDENCE_PACK_MANIFEST_VERSION),
    formatVersion: z.literal(EVIDENCE_PACK_FORMAT_VERSION),
    files: z.array(manifestEntrySchema).min(1).max(64),
  })
  .strict();

const packFileSchema = z
  .object({
    name: z.string().regex(FILE_NAME),
    contents: z.string().max(MAX_PACK_FILE_BYTES),
  })
  .strict();

const packSealSchema = z
  .object({
    v: z.literal(EVIDENCE_PACK_SEAL_VERSION),
    keyId: z
      .string()
      .max(EVIDENCE_PACK_KEY_ID_MAX_LENGTH)
      .refine(isEvidencePackKeyId),
    accountId: z.string().uuid(),
    sig: z.string().min(1).max(1024).regex(BASE64),
  })
  .strict();

const evidencePackSchema = z
  .object({
    formatVersion: z.literal(EVIDENCE_PACK_FORMAT_VERSION),
    files: z.array(packFileSchema).min(1).max(64),
    manifest: manifestSchema,
    packSeal: packSealSchema.optional(),
    sha256: z.string().regex(SHA256),
  })
  .strict();

const anchorSchema = z
  .object({
    length: z.number().int().positive(),
    tipHash: z.string().regex(SHA256),
    genesisHash: z.string().regex(SHA256).optional(),
    sig: z.string().min(1).max(1024).regex(BASE64).optional(),
    keyId: z
      .string()
      .max(EVIDENCE_PACK_KEY_ID_MAX_LENGTH)
      .refine(isEvidencePackKeyId)
      .optional(),
    sigV: z.literal(2).optional(),
    sigAccountId: z.string().uuid().optional(),
  })
  .strict();

const checksSchema = z
  .object({
    linkRecompute: z.enum(["pass", "fail", "na"]),
    anchorEquality: z.enum(["pass", "fail"]),
    signature: z.enum(["pass", "fail", "na"]).optional(),
  })
  .strict();

const receiptSchema = z
  .object({
    v: z.literal(1),
    seq: z.number().int().nonnegative(),
    hash: z.string().regex(SHA256),
    prevHash: z.string().regex(SHA256).nullable(),
    anchor: anchorSchema,
    raw: z
      .object({
        prevHash: z.string().regex(SHA256).nullable(),
        payload: z.unknown(),
      })
      .strict(),
    redacted: z.boolean(),
    checks: checksSchema,
    verifiedAt: z.iso.datetime(),
  })
  .strict();

const receiptsFileSchema = z
  .object({
    formatVersion: z.literal(EVIDENCE_PACK_FORMAT_VERSION),
    tenantId: z.string().trim().min(1).max(256),
    chainLength: z.number().int().positive(),
    generatedAt: z.iso.datetime(),
    chainVerification: z
      .object({
        valid: z.literal(true),
        brokenAt: z.null(),
      })
      .strict(),
    receipts: z.array(receiptSchema).min(1).max(MAX_RECEIPTS),
    anchorAuth: z
      .object({
        keyId: z
          .string()
          .max(EVIDENCE_PACK_KEY_ID_MAX_LENGTH)
          .refine(isEvidencePackKeyId),
        publicKeySpkiBase64: z.string().min(1).max(4096).regex(BASE64),
      })
      .strict(),
  })
  .strict();

const evidencePackTrustSchema = z
  .object({
    expectedPublicKeySha256: z.string().regex(SHA256),
  })
  .strict();

export interface EvidencePackTrust {
  /** SHA-256 of the trusted Ed25519 SPKI DER bytes, obtained independently from the pack. */
  readonly expectedPublicKeySha256: string;
}

export interface VerifiedPackRow {
  readonly seq: number;
  readonly linkRecompute: LegResult;
  readonly anchorEquality: "pass" | "fail";
  readonly signature: LegResult;
}

export interface EvidencePackVerificationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly rows: readonly VerifiedPackRow[];
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function publicKeyFingerprint(publicKeySpkiBase64: string): string {
  return createHash("sha256")
    .update(Buffer.from(publicKeySpkiBase64, "base64"))
    .digest("hex");
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function manifestMatchesFiles(
  pack: z.infer<typeof evidencePackSchema>,
): boolean {
  const sortedFiles = [...pack.files].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const names = sortedFiles.map((file) => file.name);
  if (new Set(names).size !== names.length) return false;
  if (pack.manifest.files.length !== sortedFiles.length) return false;
  for (const [index, file] of sortedFiles.entries()) {
    const entry = pack.manifest.files[index];
    if (
      entry === undefined ||
      entry.name !== file.name ||
      entry.sha256 !== sha256(file.contents)
    ) {
      return false;
    }
  }
  return true;
}

function manifestDigest(manifest: EvidencePackManifest): string {
  return sha256(canonicalize(jsonValue(manifest)));
}

function logicalFileBytes(pack: z.infer<typeof evidencePackSchema>): number {
  return pack.files.reduce(
    (total, file) => total + Buffer.byteLength(file.contents, "utf8"),
    0,
  );
}

function isBoundedJsonValue(value: unknown): value is JsonValue {
  const stack: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let textCodeUnits = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) return false;
    nodes += 1;
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      return false;
    }
    if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isFinite(current.value))
    ) {
      continue;
    }
    if (typeof current.value === "string") {
      textCodeUnits += current.value.length;
      if (textCodeUnits > MAX_JSON_TEXT_CODE_UNITS) return false;
      continue;
    }
    if (typeof current.value !== "object") return false;
    if (seen.has(current.value)) return false;
    seen.add(current.value);

    if (Array.isArray(current.value)) {
      for (const child of current.value) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
      continue;
    }
    const prototype = Object.getPrototypeOf(current.value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const [key, child] of Object.entries(current.value)) {
      textCodeUnits += key.length;
      if (textCodeUnits > MAX_JSON_TEXT_CODE_UNITS) return false;
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }
  return true;
}

function trustedKeyMatches(
  receipts: z.infer<typeof receiptsFileSchema>,
  trust: z.infer<typeof evidencePackTrustSchema>,
): boolean {
  const actual = Buffer.from(
    publicKeyFingerprint(receipts.anchorAuth.publicKeySpkiBase64),
    "hex",
  );
  const expected = Buffer.from(trust.expectedPublicKeySha256, "hex");
  return timingSafeEqual(actual, expected);
}

function normalizeAnchor(
  anchor: z.infer<typeof anchorSchema>,
): AuditChainAnchor {
  return {
    length: anchor.length,
    tipHash: anchor.tipHash,
    ...(anchor.genesisHash === undefined
      ? {}
      : { genesisHash: anchor.genesisHash }),
    ...(anchor.sig === undefined ? {} : { sig: anchor.sig }),
    ...(anchor.keyId === undefined ? {} : { keyId: anchor.keyId }),
    ...(anchor.sigV === undefined ? {} : { sigV: anchor.sigV }),
    ...(anchor.sigAccountId === undefined
      ? {}
      : { sigAccountId: anchor.sigAccountId }),
  };
}

function verifyPackSeal(
  pack: z.infer<typeof evidencePackSchema>,
  receipts: z.infer<typeof receiptsFileSchema>,
): boolean {
  const seal = pack.packSeal;
  if (seal === undefined || seal.keyId !== receipts.anchorAuth.keyId) {
    return false;
  }
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(receipts.anchorAuth.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return false;
  }
  try {
    return verifySignature(
      null,
      Buffer.from(
        evidencePackSealPayloadBytes({
          manifest: pack.manifest,
          accountId: seal.accountId,
        }),
      ),
      publicKey,
      Buffer.from(seal.sig, "base64"),
    );
  } catch {
    return false;
  }
}

/**
 * Verify a logical evidence-pack envelope obtained independently from this package. Validation is
 * fail closed: malformed envelopes, file-set drift, an invalid manifest digest/seal, incomplete
 * receipt sequences, or any failed row leg return `ok: false`.
 */
export async function verifyEvidencePack(
  input: unknown,
  trust: EvidencePackTrust,
): Promise<EvidencePackVerificationResult> {
  const parsedTrust = evidencePackTrustSchema.safeParse(trust);
  if (!parsedTrust.success) {
    return {
      ok: false,
      errors: ["an independently obtained public-key fingerprint is required"],
      rows: [],
    };
  }
  const parsedPack = evidencePackSchema.safeParse(input);
  if (!parsedPack.success) {
    return {
      ok: false,
      errors: ["evidence pack envelope is incomplete or malformed"],
      rows: [],
    };
  }
  const pack = parsedPack.data;
  const errors: string[] = [];

  if (!manifestMatchesFiles(pack)) {
    errors.push("file set does not match the signed manifest");
  }
  if (pack.sha256 !== manifestDigest(pack.manifest)) {
    errors.push("manifest digest is invalid");
  }
  if (logicalFileBytes(pack) > MAX_TOTAL_LOGICAL_FILE_BYTES) {
    errors.push("logical pack contents exceed the verification limit");
  }
  if (errors.length > 0) {
    return { ok: false, errors, rows: [] };
  }

  const receiptsFile = pack.files.find((file) => file.name === "receipts.json");
  if (receiptsFile === undefined) {
    return {
      ok: false,
      errors: [...errors, "receipts.json is missing"],
      rows: [],
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(receiptsFile.contents);
  } catch {
    return {
      ok: false,
      errors: [...errors, "receipts.json is incomplete or malformed"],
      rows: [],
    };
  }
  const parsedReceipts = receiptsFileSchema.safeParse(decoded);
  if (!parsedReceipts.success) {
    return {
      ok: false,
      errors: [...errors, "receipts.json is incomplete or malformed"],
      rows: [],
    };
  }
  const receipts = parsedReceipts.data;
  const payloads: JsonValue[] = [];
  for (const receipt of receipts.receipts) {
    if (!isBoundedJsonValue(receipt.raw.payload)) {
      return {
        ok: false,
        errors: ["receipt payload exceeds the verification limit"],
        rows: [],
      };
    }
    payloads.push(receipt.raw.payload);
  }
  if (!trustedKeyMatches(receipts, parsedTrust.data)) {
    return {
      ok: false,
      errors: ["pack key does not match the independently trusted fingerprint"],
      rows: [],
    };
  }
  if (!verifyPackSeal(pack, receipts)) {
    return {
      ok: false,
      errors: ["pack seal signature is invalid"],
      rows: [],
    };
  }

  if (receipts.receipts.length !== receipts.chainLength) {
    return {
      ok: false,
      errors: ["receipt sequence is incomplete"],
      rows: [],
    };
  }

  let priorHash: string | null = null;
  for (const [index, receipt] of receipts.receipts.entries()) {
    const sequenceValid =
      receipt.seq === index &&
      receipt.prevHash === priorHash &&
      receipt.raw.prevHash === receipt.prevHash &&
      receipt.anchor.length === index + 1;
    if (!sequenceValid) {
      errors.push(`receipt ${String(index)} sequence is invalid`);
    }
    priorHash = receipt.hash;
  }
  if (errors.length > 0) {
    return { ok: false, errors, rows: [] };
  }

  const rows: VerifiedPackRow[] = [];
  for (const [index, receipt] of receipts.receipts.entries()) {
    const payload = payloads[index];
    if (payload === undefined) {
      return {
        ok: false,
        errors: ["receipt payload sequence is incomplete"],
        rows: [],
      };
    }
    const entry: AuditChainEntry = {
      seq: receipt.seq,
      prevHash: receipt.raw.prevHash,
      payload,
      hash: receipt.hash,
    };
    const seal = pack.packSeal;
    const legs = await verifyEntryAgainstAnchor(
      entry,
      normalizeAnchor(receipt.anchor),
      {
        redacted: receipt.redacted,
        pinnedKey: receipts.anchorAuth,
        ...(seal === undefined ? {} : { expectedAccountId: seal.accountId }),
      },
    );
    const signature = legs.signature ?? "na";
    rows.push({
      seq: receipt.seq,
      linkRecompute: legs.linkRecompute,
      anchorEquality: legs.anchorEquality,
      signature,
    });
    if (
      legs.anchorEquality !== "pass" ||
      // nosemgrep: tools.security.semgrep-rules.no-insecure-token-compare -- `signature` is a public verification verdict enum ("pass"/"fail"/"na"), not signature bytes; `verifyAuditReceipt` already performs the Ed25519 cryptographic verification.
      signature !== "pass" ||
      (receipt.redacted
        ? legs.linkRecompute !== "na"
        : legs.linkRecompute !== "pass")
    ) {
      errors.push(`receipt ${String(index)} verification failed`);
    }
  }

  return { ok: errors.length === 0, errors, rows };
}

export type { EvidencePack };
