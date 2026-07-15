// src/evidence/pack.ts — the per-row audit-chain evidence-pack builder (T-E1, fork c/d, CR-06, H4).
//
// Composes, never re-implements: `RowReceipt`s are built elsewhere (T-K2's `buildRowReceipt`) and
// handed in already-assembled; this module only bundles them + the standalone verifier (T-K4) + a
// README stating the trust claim verbatim into an exportable, self-describing pack. Deterministic:
// receipts are seq-sorted before serialization, so the same input always canonicalizes to the same
// bytes (the pack is itself hashable — `sha256` below).
//
// `receipts.json`'s shape is exactly what `standalone-verifier.mjs`'s CLI mode reads
// (`{ receipts, anchorAuth? }`, plus informational fields it ignores) — `node verify.mjs
// receipts.json` works with no further wiring, and no `@caisson/*` install (fork c/d: "verify
// without trusting caisson's UI").
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalize } from "../canonical.ts";
import type { ChainVerification, JsonValue } from "../canonical.ts";
import type { RowReceipt } from "../audit-verify.ts";

/** The evidence-pack format version. Append-only (ADR-0006) — a breaking shape change mints a new
 *  version, never an in-place edit, so an old pack stays verifiable against the format it was built under. */
export const EVIDENCE_PACK_FORMAT_VERSION = 1 as const;

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

export interface EvidencePackMeta {
  readonly tenantId: string;
  readonly chainLength: number;
  /** Injected wall-clock instant — stamped on the manifest/README, never computed here. */
  readonly now: Date;
  /** Optional chain-level verdict, for the README's chain-vs-current-anchor framing (CR-04: external
   *  anchoring, if any, attaches at THIS level, never per row). */
  readonly chainVerification?: ChainVerification;
  /** Optional pinned anchor-signing public key. */
  readonly anchorAuth?: EvidencePackAnchorAuth;
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

/**
 * Render the auditor-facing README. The trust claim is stated VERBATIM and matches what
 * `verify.mjs` actually checks — never overclaiming (SPEC copy law): the strong "signature-checked"
 * seal is used only when `meta.anchorAuth` is present (so the verifier genuinely can check a
 * signature); otherwise the README states the weaker, honest self-consistency claim.
 */
function renderReadme(meta: EvidencePackMeta, rowCount: number): string {
  const provenanceSection =
    meta.anchorAuth !== undefined
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
        ]
      : [
          "This pack does not include an anchor-signing public key. `verify.mjs` therefore checks legs",
          "1 and 2 only: internal consistency between each row and the anchor this export itself",
          "embedded. That is a weaker, self-consistency claim — it does not, on its own, rule out a",
          "compromised export process substituting a forged row alongside a matching forged anchor.",
          "Treat rows in this pack as locally recomputed and consistent with the anchor this export",
          "provided, not as independently rooted.",
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
    "1. **Link recompute** — SHA-256(canonicalize([prevHash, payload])) equals the row's stored hash.",
    '   Reported "not applicable" for a redacted row (see below): the exported payload is masked, so',
    "   the original hash cannot be recomputed from it.",
    "2. **Per-length anchor equality** — the row's hash equals the tip committed in the write-once",
    "   WORM anchor minted when this row was appended.",
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
  const sorted = [...receipts].sort((a, b) => a.seq - b.seq);

  const receiptsBody: Record<string, JsonValue> = {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    tenantId: meta.tenantId,
    chainLength: meta.chainLength,
    generatedAt: meta.now.toISOString(),
    receipts: toJson(sorted),
  };
  if (meta.chainVerification !== undefined) {
    receiptsBody.chainVerification = toJson(meta.chainVerification);
  }
  if (meta.anchorAuth !== undefined) {
    receiptsBody.anchorAuth = toJson(meta.anchorAuth);
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
