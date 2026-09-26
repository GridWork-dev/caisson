// src/evidence/pack.ts — the per-row audit-chain evidence-pack builder (T-E1, fork c/d, CR-06, H4).
//
// Composes, never re-implements: `RowReceipt`s are built elsewhere (T-K2's `buildRowReceipt`) and
// handed in already-assembled; this module only bundles them + a README stating the trust claim
// verbatim into an exportable, self-describing pack. Verification is deliberately OUT OF BAND via
// `@caisson-sh/verify-pack`: executable verifier code never travels inside the evidence it vouches for.
// Deterministic: receipts are seq-sorted before serialization, so the same input always canonicalizes
// to the same bytes (the pack is itself hashable — `sha256` below).
//
// The signed v2 envelope binds a canonical manifest of every exported file name and digest. The seal
// is detached at the logical-pack envelope level, avoiding a circular "signature file signs itself"
// construction while still making any file addition, removal, rename, or substitution fail closed.
import { createHash } from "node:crypto";
import { canonicalize } from "../canonical.ts";
import type { ChainVerification, JsonValue } from "../canonical.ts";
import type { RowReceipt } from "../audit-verify.ts";
import { ValidationError } from "../errors.ts";

/** The evidence-pack format version. Append-only (ADR-0006) — a breaking shape change mints a new
 *  version, never an in-place edit, so an old pack stays verifiable against the format it was built under. */
export const EVIDENCE_PACK_FORMAT_VERSION = 2 as const;
export const EVIDENCE_PACK_MANIFEST_VERSION = 1 as const;
export const EVIDENCE_PACK_SEAL_VERSION = 2 as const;
export const EVIDENCE_PACK_KEY_ID_MAX_LENGTH = 256;
export const EVIDENCE_PACK_SEAL_DOMAIN =
  "caisson.audit-chain.evidence-pack.v2" as const;
// eslint-disable-next-line no-control-regex -- public key ids reject C0/C1 bytes before README/export serialization.
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;

/** Shared signer/export/verifier contract. Key ids are public provenance labels, never secrets. */
export function isEvidencePackKeyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= EVIDENCE_PACK_KEY_ID_MAX_LENGTH &&
    value === value.trim() &&
    !CONTROL_CHARACTER.test(value)
  );
}

/** Reject an artifact before signing when its key identity cannot round-trip through verification. */
export function assertEvidencePackKeyId(
  value: unknown,
): asserts value is string {
  if (!isEvidencePackKeyId(value)) {
    throw new ValidationError(
      `evidence pack keyId must be a trimmed, control-free string of at most ${String(EVIDENCE_PACK_KEY_ID_MAX_LENGTH)} characters`,
    );
  }
}

/**
 * The anchor-signing public key a pack presents so the out-of-band verifier can check signatures
 * after matching it to an independently obtained fingerprint. Optional:
 * absent when the caller has no signed anchors to prove, or chooses not to embed provenance.
 */
export interface EvidencePackAnchorAuth {
  readonly keyId: string;
  /** Base64 SPKI DER Ed25519 public key. NOT a secret — safe to embed and publish. */
  readonly publicKeySpkiBase64: string;
}

/** Detached signature over the complete evidence-pack snapshot. Unlike per-row historical anchor
 * signatures, this binds the declared terminal length and every receipt to one export. */
export interface EvidencePackSeal {
  readonly v: typeof EVIDENCE_PACK_SEAL_VERSION;
  readonly keyId: string;
  /** UUID-shaped WORM account bound by the same signer as the row anchors. */
  readonly accountId: string;
  /** Base64 Ed25519 signature over {@link evidencePackSealPayloadBytes}. */
  readonly sig: string;
}

export interface EvidencePackMeta {
  readonly tenantId: string;
  readonly chainLength: number;
  /** Injected wall-clock instant — stamped on the manifest/README, never computed here. */
  readonly now: Date;
  /** Required chain-level verdict. The standalone verifier refuses a pack unless the issuer's
   *  full-chain verification was valid with no broken row at export time. */
  readonly chainVerification: ChainVerification;
  /** Optional pinned anchor-signing public key. */
  readonly anchorAuth?: EvidencePackAnchorAuth;
  /** Required alongside `anchorAuth` for an authenticated standalone PASS. */
  readonly packSeal?: EvidencePackSeal;
}

export interface EvidencePackFile {
  readonly name: string;
  readonly contents: string;
}

export interface EvidencePackManifestEntry {
  readonly name: string;
  readonly sha256: string;
}

/** Canonical, name-sorted inventory of every file carried in {@link EvidencePack.files}. */
export interface EvidencePackManifest {
  readonly v: typeof EVIDENCE_PACK_MANIFEST_VERSION;
  readonly formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  readonly files: readonly EvidencePackManifestEntry[];
}

export interface EvidencePack {
  readonly formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  /** `receipts.json` (the verifier's input) and `README.md`; never executable verifier code. */
  readonly files: readonly EvidencePackFile[];
  /** The complete file inventory whose canonical bytes are covered by `packSeal` when present. */
  readonly manifest: EvidencePackManifest;
  /** Detached Ed25519 signature over the canonical manifest envelope. */
  readonly packSeal?: EvidencePackSeal;
  /** Lowercase-hex SHA-256 over the canonical manifest bytes (an unsigned convenience fingerprint;
   *  authenticity comes from `packSeal`, never this value by itself). */
  readonly sha256: string;
}

export interface BuildEvidencePackInput {
  readonly receipts: readonly RowReceipt[];
  readonly meta: EvidencePackMeta;
}

export interface EvidencePackManifestInput {
  readonly receipts: readonly RowReceipt[];
  readonly meta: Omit<EvidencePackMeta, "packSeal">;
}

/** Round-trip to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts the value —
 *  mirrors the same helper in `compliance-core/evidence/generate.ts` (a proven, tiny pattern). */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** SHA-256 fingerprint of the raw public-key bytes — the value an operator publishes out-of-band
 *  (trust page, `.well-known`) so a pack recipient can confirm this pack's embedded key independently. */
function keyFingerprint(publicKeySpkiBase64: string): string {
  return createHash("sha256")
    .update(Buffer.from(publicKeySpkiBase64, "base64"))
    .digest("hex");
}

export interface EvidencePackSealPayloadInput {
  readonly manifest: EvidencePackManifest;
  readonly accountId: string;
}

/**
 * Domain-separated bytes signed by the evidence-pack issuer. The canonical manifest covers every
 * exported file name and digest; `receipts.json` in turn carries the terminal count, tenant identity,
 * export instant, verification verdict, ordered receipts, and pinned public key.
 */
export function evidencePackSealPayloadBytes(
  input: EvidencePackSealPayloadInput,
): Uint8Array<ArrayBuffer> {
  const { manifest, accountId } = input;
  return new TextEncoder().encode(
    canonicalize({
      domain: EVIDENCE_PACK_SEAL_DOMAIN,
      v: EVIDENCE_PACK_SEAL_VERSION,
      formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
      accountId,
      manifest: toJson(manifest),
    }),
  );
}

/** Build the canonical inventory the detached pack seal authenticates. */
export function evidencePackManifest(
  files: readonly EvidencePackFile[],
): EvidencePackManifest {
  return {
    v: EVIDENCE_PACK_MANIFEST_VERSION,
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    files: [...files]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((file) => ({
        name: file.name,
        sha256: createHash("sha256").update(file.contents).digest("hex"),
      })),
  };
}

/**
 * Render the auditor-facing README. The trust claim is stated VERBATIM and matches what
 * `@caisson-sh/verify-pack` actually checks — never overclaiming (SPEC copy law).
 *
 * It names NO install command, deliberately. `@caisson-sh/verify-pack` is commercial and is not
 * distributed through a package registry, so an `npx` line would be a copy-pasteable command that
 * cannot resolve; and the in-repo `bun run packages/verify-pack/...` path this README used to offer
 * as the fallback pointed an external auditor at a private repository they have no way to obtain.
 * What it names instead is the route that genuinely does not depend on the issuer: the Apache-2.0
 * `@caisson-sh/kernel`, which is publicly installable and carries every primitive the checks rest on.
 */
function renderReadme(meta: EvidencePackMeta, rowCount: number): string {
  const provenanceSection =
    meta.anchorAuth !== undefined
      ? [
          "3. **Anchor signature** — each signed row's anchor is checked against the candidate public",
          `   key embedded below (keyId \`${meta.anchorAuth.keyId}\`, SHA-256 fingerprint`,
          `   \`${keyFingerprint(meta.anchorAuth.publicKeySpkiBase64)}\`). Confirm this fingerprint`,
          "   out-of-band — e.g. against the value published on caisson's trust page — and supply it",
          "   through `CAISSON_VERIFY_PACK_KEY_SHA256`; this pack cannot authenticate its own key.",
          "",
          "A row whose signature check passes reads **verified against write-once anchor",
          "(signature-checked)**: the trust root is independent of this pack's own claims — the",
          "verifier never trusts the `checks` field embedded in a receipt (that field records only",
          "what the *issuing* run computed), and the signature is rooted in a key you confirm separately.",
          "",
          "4. **Complete file-manifest seal** — the same pinned key signs a canonical manifest of every",
          "   exported file name and SHA-256 digest. Adding, removing, renaming, or substituting any file",
          "   invalidates the seal. Replaying an older intact signed pack still requires an out-of-band",
          "   freshness reference, such as a current external checkpoint.",
        ]
      : [
          "This pack does not include both an anchor-signing public key and a complete-snapshot seal.",
          "`@caisson-sh/verify-pack` therefore refuses an authenticated PASS. The embedded rows can still be",
          "inspected, but internal consistency alone does not rule out a compromised export process",
          "substituting a forged row, changing the declared terminal length, or removing signature metadata.",
        ];

  const lines: string[] = [
    "# Caisson audit-chain evidence pack",
    "",
    `Tenant: ${meta.tenantId}`,
    `Chain length at export: ${String(meta.chainLength)}`,
    `Rows in this pack: ${String(rowCount)}`,
    `Generated: ${meta.now.toISOString()}`,
    "",
    "## How to verify — independently obtained verifier",
    "",
    "This pack intentionally contains no executable verifier: a program travelling inside the archive",
    "it judges cannot establish its own integrity. Verification needs two things this pack cannot",
    "supply — a verifier obtained separately from it, and the issuer's key fingerprint obtained",
    "through a separate trusted channel and supplied as `CAISSON_VERIFY_PACK_KEY_SHA256`.",
    "",
    "**How to obtain a verifier.** The sanctioned runner is the commercial `@caisson-sh/verify-pack`,",
    "licensed from Caisson. It is not distributed through a package registry, so there is no public",
    "install command for it; request it from Caisson directly.",
    "",
    "**The format is inspectable rather than proprietary,** which is the path that does not depend on",
    "the issuer at all. The Apache-2.0 `@caisson-sh/kernel` is publicly installable and carries every",
    "primitive the checks below rest on: `@caisson-sh/kernel/evidence` rebuilds the canonical file",
    "manifest and the exact bytes the seal signs, and `@caisson-sh/kernel/audit-verify` recomputes each",
    "row's hash link, checks its per-length write-once anchor, and verifies the anchor signature.",
    "",
    "Whichever route is taken, verification refuses PASS unless the embedded key matches that independently supplied",
    "fingerprint. It then checks the signed canonical file manifest and recomputes from",
    "the raw material in `receipts.json` — never from its embedded `checks` field, which records only",
    "what the issuing run computed — for every row:",
    "",
    "Before checking rows, the verifier requires the issuer's full-chain snapshot verdict to be",
    "`{ valid: true, brokenAt: null }`. That prevents a chain the issuer already detected as truncated",
    "or broken from being exported as a passing pack. This embedded verdict is not a signed freshness",
    "proof; confirm the pack's key fingerprint and any current external checkpoint out-of-band.",
    "",
    "1. **Link recompute** — SHA-256(canonicalize([prevHash, payload])) equals the row's stored hash.",
    '   Reported "not applicable" for a redacted row (see below): the exported payload is masked, so',
    "   the original hash cannot be recomputed from it.",
    "2. **Per-length anchor equality** — the row's hash equals the tip committed in the write-once",
    "   WORM anchor minted at exactly `row.seq + 1` entries.",
    ...provenanceSection,
    "",
    "## The six per-row states these receipts encode",
    "",
    "`verified` · `anchor-confirmed-original-not-disclosed` (redacted: anchor confirmed, hash not",
    "recomputable) · `tampered` · `unverifiable` · `pending` · `genesis`. A receipt never carries",
    "`verified` for a redacted row.",
    "",
    "## Redacted rows",
    "",
    "A redacted row's `raw.payload` in `receipts.json` is the MASKED payload — the original never left",
    "the server that produced this pack. Its hash commits to content this pack cannot show you;",
    '`@caisson-sh/verify-pack` reports leg 1 as "not applicable" for that row (never a pass or a fail) and checks',
    "leg 2 (anchor equality) only.",
    "",
    "## External (checkpoint-level) anchoring — chain level only, never per row",
    "",
    "If this chain is also anchored to an external checkpoint outside caisson, that status attaches at",
    "the CHAIN level only: verifying an individual row against a checkpoint minted after it would",
    'require replaying every intervening entry, which this pack does not include. A per-row "externally',
    'anchored" badge (if shown elsewhere) is always derived from the chain-level receipt, never a',
    "compact per-row external inclusion proof.",
    "",
    "## Scope",
    "",
    "This pack reflects cryptographic consistency checks over the material it embeds. It is not a",
    "compliance attestation, an audit opinion, or a certification, and its claims never exceed what",
    "`@caisson-sh/verify-pack` actually recomputes above.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildEvidencePackFiles(
  input: EvidencePackManifestInput,
): EvidencePackFile[] {
  const { receipts, meta } = input;
  const sorted = [...receipts].sort((a, b) => a.seq - b.seq);
  const receiptsBody: Record<string, JsonValue> = {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    tenantId: meta.tenantId,
    chainLength: meta.chainLength,
    generatedAt: meta.now.toISOString(),
    receipts: toJson(sorted),
  };
  receiptsBody.chainVerification = toJson(meta.chainVerification);
  if (meta.anchorAuth !== undefined) {
    receiptsBody.anchorAuth = toJson(meta.anchorAuth);
  }
  const receiptsJson = canonicalize(receiptsBody);
  return [
    { name: "receipts.json", contents: receiptsJson },
    { name: "README.md", contents: renderReadme(meta, sorted.length) },
  ];
}

/**
 * Compute the exact canonical file inventory before signing. The final builder uses the same pure
 * file assembly, so the signer never predicts or hand-reconstructs bytes.
 */
export function evidencePackManifestForInput(
  input: EvidencePackManifestInput,
): EvidencePackManifest {
  return evidencePackManifest(buildEvidencePackFiles(input));
}

/**
 * Assemble an evidence pack: the caller's already-built receipts (sorted by `seq`) and a README whose
 * trust claim matches `meta.anchorAuth`'s presence. Executable verification stays out of band. Pure
 * assembly — no DB/WORM access, no fetch.
 */
export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePack {
  const { receipts, meta } = input;
  if (meta.anchorAuth !== undefined) {
    assertEvidencePackKeyId(meta.anchorAuth.keyId);
  }
  if (meta.packSeal !== undefined) {
    assertEvidencePackKeyId(meta.packSeal.keyId);
  }
  if (
    (meta.anchorAuth === undefined) !== (meta.packSeal === undefined) ||
    (meta.anchorAuth !== undefined &&
      meta.packSeal !== undefined &&
      meta.anchorAuth.keyId !== meta.packSeal.keyId)
  ) {
    throw new ValidationError(
      "evidence pack anchor authentication and seal must be configured together",
    );
  }
  const files = buildEvidencePackFiles({
    receipts,
    meta: {
      tenantId: meta.tenantId,
      chainLength: meta.chainLength,
      now: meta.now,
      chainVerification: meta.chainVerification,
      ...(meta.anchorAuth === undefined ? {} : { anchorAuth: meta.anchorAuth }),
    },
  });
  const manifest = evidencePackManifest(files);
  const sha256 = createHash("sha256")
    .update(canonicalize(toJson(manifest)))
    .digest("hex");

  return {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    files,
    manifest,
    ...(meta.packSeal === undefined ? {} : { packSeal: meta.packSeal }),
    sha256,
  };
}
