// Browser-safe per-row audit verification + versioned receipt builder (T-K2, fork d core).
//
// Imports ONLY the node-free canonical.ts, so this module is bundle-safe for the client and the
// offline pack verifier: SHA-256 runs through WebCrypto (`crypto.subtle`) instead of the node crypto
// builtin, and no path here reaches the node-tainted audit-chain.ts `.` barrel. It is reached only
// through the `@caisson/kernel/audit-verify` subpath, never the barrel.
//
// The state a UI chip renders is computed HERE, client-side, from the recompute outcome — NEVER read
// from a receipt's `checks` block, which is derived/untrusted display material (CR-06, M3). Any leg
// that cannot be recomputed (redacted payload, WebCrypto unavailable) resolves away from "verified",
// never into it (L4): redaction → the explicit anchor-confirmed state, everything else → unverifiable.
import { canonicalize } from "./canonical.ts";
import type {
  AuditChainAnchor,
  AuditChainEntry,
  JsonValue,
} from "./canonical.ts";

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

/**
 * The anchor's signed CANONICAL CORE bytes — byte-identical to `audit-worm`'s `encodeAnchor`
 * (`genesisHash` carried only when present; `sig`/`keyId` EXCLUDED), so the client checks the exact
 * bytes the server signed. Never change these bytes (they are the cross-lane external-anchoring seam).
 */
function anchorCoreBytes(anchor: AuditChainAnchor): Uint8Array<ArrayBuffer> {
  const core: { [key: string]: JsonValue } = {
    length: anchor.length,
    tipHash: anchor.tipHash,
  };
  if (anchor.genesisHash !== undefined) core.genesisHash = anchor.genesisHash;
  return new TextEncoder().encode(canonicalize(core));
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
): Promise<LegResult> {
  if (
    anchor.sig === undefined ||
    pinnedKey === undefined ||
    pinnedKey.keyId !== anchor.keyId
  ) {
    return "na";
  }
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(pinnedKey.publicKeySpkiBase64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64ToBytes(anchor.sig),
      anchorCoreBytes(anchor),
    );
    return ok ? "pass" : "fail";
  } catch {
    // WebCrypto Ed25519 unavailable, or a malformed key/signature — can't check → `na`, never `fail`.
    return "na";
  }
}

/**
 * Run the per-row legs against the row's per-length WORM anchor.
 *
 * Leg 2 (anchor equality): `anchorForLen.tipHash === entry.hash`. These are PUBLIC integrity tags,
 * not secrets, so plain `===` is correct — `timingSafeEqual` is not required here (SECURITY-PREPLAN
 * Clarification, SPEC G7).
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
  opts: { redacted?: boolean; pinnedKey?: PinnedAnchorKey } = {},
): Promise<VerifyLegs> {
  const anchorEquality: "pass" | "fail" =
    anchorForLen.tipHash === entry.hash ? "pass" : "fail";
  const signature = await verifyAnchorSignature(anchorForLen, opts.pinnedKey);
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
  opts: { redacted: boolean; isGenesis?: boolean; pending?: boolean },
): RowState {
  if (opts.pending === true) return "pending";
  if (
    legs.anchorEquality === "fail" ||
    legs.linkRecompute === "fail" ||
    // nosemgrep: no-insecure-token-compare -- `legs.signature` is a LegResult verdict ("pass"/"fail"/"na"), not a secret or signature value; the real Ed25519 check is crypto.subtle.verify in verifyAnchorSignature. No timing side channel exists on a public verdict enum.
    legs.signature === "fail"
  ) {
    // A failing leg is tamper evidence (the proof panel names WHICH from the legs object) — a signed
    // anchor whose signature does not verify against the pinned key is a forged anchor.
    return "tampered";
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
 * `anchor.genesisHash`/`sig`/`keyId` are ADDITIVE, OPT-IN fields (T-E1 evidence-pack export, H4):
 * present only when the caller asks `buildRowReceipt` to include anchor provenance. Reconstructing the
 * signed core (`{length, tipHash, genesisHash?}`, matching `audit-worm`'s `encodeAnchor`) needs
 * `genesisHash` alongside `sig`/`keyId`, which is why the three travel together. Omitted by default —
 * every existing receipt shape (e.g. the live admin proof endpoint) is byte-identical to before.
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
   * Opt-in (T-E1 evidence-pack export, H4): also carry the anchor's `genesisHash`+`sig`+`keyId` so an
   * offline verifier can reconstruct the exact signed core bytes and independently check anchor
   * authenticity against a pinned public key — the offline counterpart of the signed-anchor check.
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
  } = { length: anchorForRow.length, tipHash: anchorForRow.tipHash };
  if (includeAnchorProvenance === true) {
    if (anchorForRow.genesisHash !== undefined) {
      anchor.genesisHash = anchorForRow.genesisHash;
    }
    if (anchorForRow.sig !== undefined) anchor.sig = anchorForRow.sig;
    if (anchorForRow.keyId !== undefined) anchor.keyId = anchorForRow.keyId;
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
