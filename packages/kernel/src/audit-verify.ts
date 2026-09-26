// Browser-safe per-row audit verification + versioned receipt builder (T-K2, fork d core).
//
// Imports ONLY the node-free canonical.ts, so this module is bundle-safe for the client and the
// offline pack verifier: SHA-256 runs through WebCrypto (`crypto.subtle`) instead of the node crypto
// builtin, and no path here reaches the node-tainted audit-chain.ts `.` barrel. It is reached only
// through the `@caisson-sh/kernel/audit-verify` subpath, never the barrel.
//
// The state a UI chip renders is computed HERE, client-side, from the recompute outcome — NEVER read
// from a receipt's `checks` block, which is derived/untrusted display material (CR-06, M3). Any leg
// that cannot be recomputed (redacted payload, WebCrypto unavailable) resolves away from "verified",
// never into it (L4): redaction → the explicit anchor-confirmed state, everything else → unverifiable.
import { canonicalize, checkAnchor } from "./canonical.ts";
import type {
  AuditChainAnchor,
  AuditChainEntry,
  ChainVerification,
  JsonValue,
} from "./canonical.ts";

// Minting an anchor reads hashes the chain already committed — no hashing, so the ONE
// implementation in `canonical.ts` serves the node builder and the browser verifier alike.
export { anchorChain } from "./canonical.ts";

/** Lowercase hex of a byte array — matches the kernel's `createHash(...).digest("hex")` encoding. */
function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * The async WebCrypto twin of the kernel's sync `hashChainLink`: SHA-256 over the canonical
 * serialization of the `[prevHash, payload]` 2-tuple → lowercase hex. A NEW async helper (a browser
 * has only the async `crypto.subtle.digest`), NOT a signature change to the sync one. Byte-for-byte
 * agreement with `hashChainLink` is pinned by a cross-impl test.
 */
export async function hashChainLinkAsync(
  prevHash: string | null,
  payload: JsonValue,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize([prevHash, payload]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

/**
 * The async WebCrypto twin of the sync `chainEntry`: `prev = null` mints genesis (seq 0, prevHash
 * null); otherwise this entry binds `prev.hash` and takes `prev.seq + 1`. Same 2-tuple link hash,
 * pinned byte-for-byte against the node implementation by a cross-impl test.
 */
export async function chainEntryAsync(
  prev: AuditChainEntry | null,
  payload: JsonValue,
): Promise<AuditChainEntry> {
  const prevHash = prev === null ? null : prev.hash;
  const seq = prev === null ? 0 : prev.seq + 1;
  return {
    seq,
    prevHash,
    payload,
    hash: await hashChainLinkAsync(prevHash, payload),
  };
}

/** The async twin of `buildChain`: fold a list of payloads into a complete chain, oldest first. */
export async function buildChainAsync(
  payloads: readonly JsonValue[],
): Promise<AuditChainEntry[]> {
  const entries: AuditChainEntry[] = [];
  let prev: AuditChainEntry | null = null;
  for (const payload of payloads) {
    prev = await chainEntryAsync(prev, payload);
    entries.push(prev);
  }
  return entries;
}

/**
 * The async twin of `verifyChain` — WHOLE-CHAIN verification for a client or an offline pack, where
 * only `crypto.subtle` is available. {@link verifyEntryAgainstAnchor} answers "is THIS row intact
 * against its own per-length anchor"; this answers "are these entries the complete, original chain",
 * which is a different question and the one a tail truncation turns on.
 *
 * Identical semantics to the node version: returns the FIRST broken index; WITHOUT an `anchor` it
 * proves only mutual consistency (a truncation or a wholesale rewrite still reads valid), WITH one
 * the committed root/length/tip are asserted through the shared `checkAnchor`.
 */
export async function verifyChainAsync(
  entries: readonly AuditChainEntry[],
  anchor?: AuditChainAnchor,
): Promise<ChainVerification> {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as AuditChainEntry;
    const expectedPrev =
      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;
    if (entry.seq !== i) return { valid: false, brokenAt: i };
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    if (
      entry.hash !== (await hashChainLinkAsync(entry.prevHash, entry.payload))
    ) {
      return { valid: false, brokenAt: i };
    }
  }
  if (anchor !== undefined) {
    const anchorFailure = checkAnchor(entries, anchor);
    if (anchorFailure !== null) return anchorFailure;
  }
  return { valid: true, brokenAt: null };
}

/** A single verification leg. `na` = not applicable (a redacted row cannot recompute its link hash). */
export type LegResult = "pass" | "fail" | "na";

/**
 * A pinned anchor-signing public key, delivered OUT-OF-BAND (baked into the app bundle / injected
 * config) — NEVER read from the row-serving response, which is exactly the independent trust root the
 * design requires. Supplying it is what lets the client run the signature leg and earn the
 * "(signature-checked)" seal: a compromised row API can forge a self-consistent
 * `(payload, hash, anchor)` triple, but it cannot forge a signature that verifies against THIS key.
 */
export interface PinnedAnchorKey {
  readonly keyId: string;
  /** Base64 SPKI DER Ed25519 public key. NOT a secret — safe to embed in the client bundle. */
  readonly publicKeySpkiBase64: string;
}

/**
 * The per-row legs: link recompute (leg 1), per-length WORM-anchor tip equality (leg 2), and the
 * Ed25519 anchor-signature (leg 3).
 */
export interface VerifyLegs {
  readonly linkRecompute: LegResult;
  readonly anchorEquality: "pass" | "fail";
  /**
   * The anchor-signature leg. `pass`/`fail` ONLY when the anchor carries a `sig` AND a matching pinned
   * key was supplied; `na` otherwise (unsigned legacy anchor, no pinned key, keyId mismatch, or the
   * runtime lacks WebCrypto Ed25519). An unchecked signature NEVER earns the "(signature-checked)"
   * seal, and `na` never flags tamper; a `fail` (a signed anchor whose signature does NOT verify
   * against the pinned key) is a forged anchor → `tampered` in {@link classifyRowState}.
   */
  readonly signature?: LegResult;
}

/** The six per-row states (SPEC Per-row states). Redacted rows are never `verified`. */
export type RowState =
  | "verified"
  | "anchor-confirmed-original-not-disclosed"
  | "tampered"
  | "unverifiable"
  | "pending"
  | "genesis";

/** Decode base64 to bytes with only runtime globals (`atob`) — node-free, so this stays bundle-safe.
 *  Backed by a concrete `ArrayBuffer` so the result is a `BufferSource` WebCrypto accepts (a default
 *  `Uint8Array<ArrayBufferLike>` is not assignable to `ArrayBufferView<ArrayBuffer>` under TS strict). */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export const ANCHOR_SIGNATURE_VERSION = 2 as const;
export const ANCHOR_SIGNATURE_DOMAIN = "caisson.audit-chain.anchor.v2" as const;

/**
 * Versioned signature envelope. The legacy/external anchor core stays byte-identical, while the
 * signature additionally binds that commitment to one tenant-scoped WORM account so a valid anchor
 * cannot be replayed as another tenant's evidence.
 */
export function anchorSignatureEnvelopeBytes(
  anchor: AuditChainAnchor,
  accountId: string,
): Uint8Array<ArrayBuffer> {
  const core: { [key: string]: JsonValue } = {
    length: anchor.length,
    tipHash: anchor.tipHash,
  };
  if (anchor.genesisHash !== undefined) core.genesisHash = anchor.genesisHash;
  return new TextEncoder().encode(
    canonicalize({
      domain: ANCHOR_SIGNATURE_DOMAIN,
      v: ANCHOR_SIGNATURE_VERSION,
      accountId,
      anchor: core,
    }),
  );
}

/**
 * Leg 3: verify a signed anchor's Ed25519 signature over its canonical CORE
 * against a PINNED, out-of-band public key, using WebCrypto (node-free). Returns `pass`/`fail` ONLY
 * when the anchor is signed AND `pinnedKey.keyId` matches the anchor's `keyId`; `na` when it is
 * unsigned, no pinned key was supplied, the keyId does not match, or the runtime lacks WebCrypto
 * Ed25519 (an unchecked signature is `na`, NEVER a false `fail`/tamper flag — L4 fail-safe direction).
 * A signature check is `crypto.subtle.verify` (constant-time by construction), the right tool here,
 * never a hand-rolled `timingSafeEqual` (SPEC G7).
 */
export async function verifyAnchorSignature(
  anchor: AuditChainAnchor,
  pinnedKey?: PinnedAnchorKey,
  expectedAccountId?: string,
): Promise<LegResult> {
  if (pinnedKey === undefined) {
    return "na";
  }
  if (anchor.sig === undefined) return "na";
  if (pinnedKey.keyId !== anchor.keyId) return "fail";
  if (
    anchor.sigV !== ANCHOR_SIGNATURE_VERSION ||
    anchor.sigAccountId === undefined ||
    expectedAccountId === undefined
  ) {
    return "na";
  }
  if (anchor.sigAccountId !== expectedAccountId) return "fail";
  let publicKeyBytes: Uint8Array<ArrayBuffer>;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    publicKeyBytes = base64ToBytes(pinnedKey.publicKeySpkiBase64);
    signatureBytes = base64ToBytes(anchor.sig);
  } catch {
    return "fail";
  }
  if (signatureBytes.byteLength !== 64) return "fail";
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      anchorSignatureEnvelopeBytes(anchor, expectedAccountId),
    );
    return ok ? "pass" : "fail";
  } catch {
    // WebCrypto Ed25519 unavailable or the pinned key cannot be imported: fail to an unchecked state.
    // Callers with a required pinned key classify `na` as unverifiable, never verified.
    return "na";
  }
}

/**
 * Run the per-row legs against the row's per-length WORM anchor.
 *
 * Leg 2 (anchor equality): both `anchorForLen.tipHash === entry.hash` and
 * `anchorForLen.length === entry.seq + 1`. These are PUBLIC integrity fields, not secrets, so plain
 * equality is correct.
 *
 * Leg 1 (link recompute): recompute the link hash from `(prevHash, payload)` and compare to the
 * stored hash. A `redacted` row ships a MASKED payload that can never recompute the original hash, so
 * leg 1 is reported `na` — never a silent `fail` that would read as tamper (CR-06 honest marking).
 *
 * Leg 3 (anchor signature): verified against `opts.pinnedKey` when present. This is the leg
 * that makes the "(signature-checked)" seal HONEST — without a pinned key it is `na` and the strong
 * seal is withheld (the seal-copy caller gates on `legs.signature === "pass"`).
 */
export async function verifyEntryAgainstAnchor(
  entry: AuditChainEntry,
  anchorForLen: AuditChainAnchor,
  opts: {
    redacted?: boolean;
    pinnedKey?: PinnedAnchorKey;
    expectedAccountId?: string;
  } = {},
): Promise<VerifyLegs> {
  const expectedAnchorLength =
    Number.isSafeInteger(entry.seq) &&
    entry.seq >= 0 &&
    entry.seq < Number.MAX_SAFE_INTEGER
      ? entry.seq + 1
      : undefined;
  const anchorEquality: "pass" | "fail" =
    anchorForLen.tipHash === entry.hash &&
    anchorForLen.length === expectedAnchorLength
      ? "pass"
      : "fail";
  const signature = await verifyAnchorSignature(
    anchorForLen,
    opts.pinnedKey,
    opts.expectedAccountId,
  );
  if (opts.redacted === true) {
    return { linkRecompute: "na", anchorEquality, signature };
  }
  const recomputed = await hashChainLinkAsync(entry.prevHash, entry.payload);
  return {
    linkRecompute: recomputed === entry.hash ? "pass" : "fail",
    anchorEquality,
    signature,
  };
}

/**
 * Map the two legs to one of the six states. Fail-closed by construction: either leg failing is
 * `tampered` (the proof panel names WHICH leg from the legs object); a leg that is `na` NOT because of
 * redaction (WebCrypto unavailable, recompute skipped) is `unverifiable`, never `verified` (L4). The
 * genesis row wears the root chip only when it otherwise verifies; a redacted genesis still surfaces
 * the redaction-honest state (the more important signal) — same checks apply either way.
 */
export function classifyRowState(
  legs: VerifyLegs,
  opts: {
    redacted: boolean;
    isGenesis?: boolean;
    pending?: boolean;
    requireSignature?: boolean;
  },
): RowState {
  if (opts.pending === true) return "pending";
  if (
    legs.anchorEquality === "fail" ||
    legs.linkRecompute === "fail" ||
    // nosemgrep: tools.security.semgrep-rules.no-insecure-token-compare -- `legs.signature` is a LegResult verdict ("pass"/"fail"/"na"), not a secret or signature value; the real Ed25519 check is crypto.subtle.verify in verifyAnchorSignature. No timing side channel exists on a public verdict enum.
    legs.signature === "fail"
  ) {
    // A failing leg is tamper evidence (the proof panel names WHICH from the legs object) — a signed
    // anchor whose signature does not verify against the pinned key is a forged anchor.
    return "tampered";
  }
  // nosemgrep: tools.security.semgrep-rules.no-insecure-token-compare -- same verdict-enum rationale as above; `legs.signature` holds "pass"/"fail"/"na", never signature bytes.
  if (opts.requireSignature === true && legs.signature !== "pass") {
    return "unverifiable";
  }
  if (legs.linkRecompute === "na") {
    return opts.redacted
      ? "anchor-confirmed-original-not-disclosed"
      : "unverifiable";
  }
  return opts.isGenesis === true ? "genesis" : "verified";
}

/** The receipt schema version — bumped on any change to the raw-material shape (CR-06 versioning). */
export const ROW_RECEIPT_VERSION = 1;

/**
 * A per-row proof receipt. `raw` carries the VERSIONED raw proof material (the link inputs) a verifier
 * recomputes both legs from; `anchor` carries the per-length commitment (length + tipHash, never the
 * internal WORM key — L2). `checks`/`verifiedAt` are DERIVED/UNTRUSTED display fields: they record
 * what the issuing run computed and a verifier MUST ignore them, recomputing from `raw` (CR-06).
 *
 * `anchor.genesisHash` plus the v2 `sig`/`keyId`/`sigV`/`sigAccountId` fields are ADDITIVE,
 * OPT-IN provenance. Together they let a verifier reconstruct the account-bound signature envelope
 * without exposing the internal WORM key.
 */
export interface RowReceipt {
  readonly v: number;
  readonly seq: number;
  readonly hash: string;
  readonly prevHash: string | null;
  readonly anchor: {
    readonly length: number;
    readonly tipHash: string;
    readonly genesisHash?: string;
    readonly sig?: string;
    readonly keyId?: string;
    readonly sigV?: 2;
    readonly sigAccountId?: string;
  };
  readonly raw: {
    readonly prevHash: string | null;
    readonly payload: JsonValue;
  };
  readonly redacted: boolean;
  readonly checks: VerifyLegs;
  readonly verifiedAt: string;
}

/**
 * Build a versioned per-row receipt from the raw entry + its per-length anchor. `entry.payload` is
 * whatever the caller passes — the endpoint passes the REDACTED payload for a redacted row so the
 * original never crosses the wire (H3), and `redacted` marks it so a verifier reports leg 1 as `na`.
 */
export function buildRowReceipt(input: {
  entry: AuditChainEntry;
  anchorForRow: AuditChainAnchor;
  redacted: boolean;
  checks: VerifyLegs;
  verifiedAt: string;
  /**
   * Opt-in (T-E1 evidence-pack export, H4): also carry the anchor's public signature provenance so
   * an offline verifier can reconstruct the v2 account-bound envelope and independently check it
   * against a pinned public key.
   * Defaults to `false`; existing callers (the live admin proof endpoint) are unaffected.
   */
  includeAnchorProvenance?: boolean;
}): RowReceipt {
  const {
    entry,
    anchorForRow,
    redacted,
    checks,
    verifiedAt,
    includeAnchorProvenance,
  } = input;
  const anchor: {
    length: number;
    tipHash: string;
    genesisHash?: string;
    sig?: string;
    keyId?: string;
    sigV?: 2;
    sigAccountId?: string;
  } = { length: anchorForRow.length, tipHash: anchorForRow.tipHash };
  if (includeAnchorProvenance === true) {
    if (anchorForRow.genesisHash !== undefined) {
      anchor.genesisHash = anchorForRow.genesisHash;
    }
    if (anchorForRow.sig !== undefined) anchor.sig = anchorForRow.sig;
    if (anchorForRow.keyId !== undefined) anchor.keyId = anchorForRow.keyId;
    if (anchorForRow.sigV !== undefined) anchor.sigV = anchorForRow.sigV;
    if (anchorForRow.sigAccountId !== undefined) {
      anchor.sigAccountId = anchorForRow.sigAccountId;
    }
  }
  return {
    v: ROW_RECEIPT_VERSION,
    seq: entry.seq,
    hash: entry.hash,
    prevHash: entry.prevHash,
    anchor,
    raw: { prevHash: entry.prevHash, payload: entry.payload },
    redacted,
    checks,
    verifiedAt,
  };
}
