// src/evidence/pack.ts — the per-row audit-chain evidence-pack builder (T-E1, fork c/d, CR-06, H4).
//
// Composes, never re-implements: `RowReceipt`s are built elsewhere (T-K2's `buildRowReceipt`) and
// handed in already-assembled; this module only bundles them + the standalone verifier (T-K4) + a
// README stating the trust claim verbatim into an exportable, self-describing pack. Deterministic:
// receipts are seq-sorted before serialization, so the same input always canonicalizes to the same
// bytes (the pack is itself hashable — `sha256` below).
//
// `receipts.json`'s shape is exactly what `standalone-verifier.mjs`'s CLI mode reads
// (`{ tenantId, chainLength, generatedAt, chainVerification, receipts, anchorAuth, packSeal }`;
// completeness fields are validated before any row cryptography) — `node verify.mjs receipts.json`
// works with no further wiring (fork c/d: "verify without trusting caisson's UI").
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalize } from "../canonical.ts";
import type { ChainVerification, JsonValue } from "../canonical.ts";
import type { RowReceipt } from "../audit-verify.ts";

/** The evidence-pack format version. Append-only (ADR-0006) — a breaking shape change mints a new
 *  version, never an in-place edit, so an old pack stays verifiable against the format it was built under. */
export const EVIDENCE_PACK_FORMAT_VERSION = 1 as const;
export const EVIDENCE_PACK_SEAL_VERSION = 1 as const;
export const EVIDENCE_PACK_SEAL_DOMAIN =
  "caisson.audit-chain.evidence-pack.v1" as const;

/**
 * The anchor-signing public key a pack pins so its bundled verifier can independently check anchor
 * authenticity — the offline way to verify without trusting caisson. Optional:
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

export interface EvidencePack {
  readonly formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  /** `receipts.json` (the verifier's input) · `verify.mjs` (T-K4, embedded verbatim) · `README.md`. */
  readonly files: readonly EvidencePackFile[];
  /** Lowercase-hex SHA-256 over the name-sorted concatenation of every file's contents — a content
   *  fingerprint for the pack as exported (the same receipts + meta always produce the same digest). */
  readonly sha256: string;
}

export interface BuildEvidencePackInput {
  readonly receipts: readonly RowReceipt[];
  readonly meta: EvidencePackMeta;
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
  readonly receipts: readonly RowReceipt[];
  readonly meta: Pick<
    EvidencePackMeta,
    "tenantId" | "chainLength" | "now" | "chainVerification" | "anchorAuth"
  >;
  readonly accountId: string;
}

/**
 * Domain-separated bytes signed by the evidence-pack issuer. The receipt digest covers the complete
 * ordered raw-material set; the terminal count, tenant/WORM identities, export instant, verification
 * verdict, and pinned-key fingerprint are bound in the same signature.
 */
export function evidencePackSealPayloadBytes(
  input: EvidencePackSealPayloadInput,
): Uint8Array<ArrayBuffer> {
  const { receipts, meta, accountId } = input;
  if (meta.anchorAuth === undefined) {
    throw new Error("evidence pack seal requires anchor authentication");
  }
  const sorted = [...receipts].sort((a, b) => a.seq - b.seq);
  const receiptsJson = canonicalize(toJson(sorted));
  const receiptsSha256 = createHash("sha256")
    .update(receiptsJson)
    .digest("hex");
  return new TextEncoder().encode(
    canonicalize({
      domain: EVIDENCE_PACK_SEAL_DOMAIN,
      v: EVIDENCE_PACK_SEAL_VERSION,
      formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
      tenantId: meta.tenantId,
      accountId,
      chainLength: meta.chainLength,
      generatedAt: meta.now.toISOString(),
      chainVerification: toJson(meta.chainVerification),
      receiptsSha256,
      anchorAuth: {
        keyId: meta.anchorAuth.keyId,
        publicKeySha256: keyFingerprint(meta.anchorAuth.publicKeySpkiBase64),
      },
    }),
  );
}

/**
 * Render the auditor-facing README. The trust claim is stated VERBATIM and matches what
 * `verify.mjs` actually checks — never overclaiming (SPEC copy law): the strong "signature-checked"
 * seal is used only when `meta.anchorAuth` is present (so the verifier genuinely can check a
 * signature); otherwise the README states the weaker, honest self-consistency claim.
 */
function renderReadme(meta: EvidencePackMeta, rowCount: number): string {
  const provenanceSection =
    meta.anchorAuth !== undefined && meta.packSeal !== undefined
      ? [
          "3. **Anchor signature** — each signed row's anchor is checked against the pinned public",
          `   key embedded below (keyId \`${meta.anchorAuth.keyId}\`, SHA-256 fingerprint`,
          `   \`${keyFingerprint(meta.anchorAuth.publicKeySpkiBase64)}\`). Confirm this fingerprint`,
          "   out-of-band — e.g. against the value published on caisson's trust page — before relying",
          "   on it; this pack cannot, by itself, prove the key it ships is the right one.",
          "",
          "A row whose signature check passes reads **verified against write-once anchor",
          "(signature-checked)**: the trust root is independent of this pack's own claims — the",
          "verifier never trusts the `checks` field embedded in a receipt (that field records only",
          "what the *issuing* run computed), and the signature is rooted in a key you confirm separately.",
          "",
          "4. **Complete-snapshot seal** — the same pinned key signs the tenant, WORM account, terminal",
          "   chain length, export instant, full-chain verdict, public-key fingerprint, and SHA-256",
          "   digest of every ordered receipt. Removing a tail and lowering the declared length invalidates",
          "   this seal. Replaying an older intact signed pack still requires an out-of-band freshness",
          "   reference, such as a current external checkpoint.",
        ]
      : [
          "This pack does not include both an anchor-signing public key and a complete-snapshot seal.",
          "`verify.mjs` therefore refuses an authenticated PASS. The embedded rows can still be inspected,",
          "but internal consistency alone does not rule out a compromised export process substituting a",
          "forged row, changing the declared terminal length, or removing signature metadata.",
        ];

  const lines: string[] = [
    "# Caisson audit-chain evidence pack",
    "",
    `Tenant: ${meta.tenantId}`,
    `Chain length at export: ${String(meta.chainLength)}`,
    `Rows in this pack: ${String(rowCount)}`,
    `Generated: ${meta.now.toISOString()}`,
    "",
    "## How to verify — no caisson account, no network call, no `@caisson/*` install",
    "",
    "```",
    "node verify.mjs receipts.json",
    "```",
    "",
    "`verify.mjs` recomputes, from the raw material in `receipts.json` — never from its embedded",
    "`checks` field, which records only what the issuing run computed — for every row:",
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
    '`verify.mjs` reports leg 1 as "not applicable" for that row (never a pass or a fail) and checks',
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
    "`verify.mjs` actually recomputes above.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Assemble a self-contained evidence pack: the caller's already-built receipts (sorted by `seq`),
 * the standalone verifier's exact source, and a README whose trust claim matches `meta.anchorAuth`'s
 * presence. Pure assembly — no DB/WORM access, no fetch.
 */
export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePack {
  const { receipts, meta } = input;
  if (
    (meta.anchorAuth === undefined) !== (meta.packSeal === undefined) ||
    (meta.anchorAuth !== undefined &&
      meta.packSeal !== undefined &&
      meta.anchorAuth.keyId !== meta.packSeal.keyId)
  ) {
    throw new Error(
      "evidence pack anchor authentication and seal must be configured together",
    );
  }
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
  if (meta.packSeal !== undefined) {
    receiptsBody.packSeal = toJson(meta.packSeal);
  }
  const receiptsJson = canonicalize(receiptsBody);

  const verifierSource = readFileSync(
    new URL("./standalone-verifier.mjs", import.meta.url),
    "utf8",
  );

  const files: EvidencePackFile[] = [
    { name: "receipts.json", contents: receiptsJson },
    { name: "verify.mjs", contents: verifierSource },
    { name: "README.md", contents: renderReadme(meta, sorted.length) },
  ];

  const digestInput = [...files]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => `${f.name}\n${f.contents}`)
    .join("\n---\n");
  const sha256 = createHash("sha256").update(digestInput).digest("hex");

  return { formatVersion: EVIDENCE_PACK_FORMAT_VERSION, files, sha256 };
}
