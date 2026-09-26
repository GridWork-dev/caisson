// src/anchor-transparency.ts — external anchoring for the audit-worm chain (SPEC external-anchoring,
// ADR-0332 forks + ADR-0346 PLAN locks). V1 ships the TSA `trusted-timestamped` leg ONLY.
//
// This module supplies the external trust ROOT the per-tenant hash chain chains up to: each periodic
// anchor's canonical bytes ({length, tipHash, genesisHash} — hashes only, zero payload/PII, produced
// by chain-store's `encodeAnchor`) are imprint-submitted to an RFC-3161 TSA, and the returned receipt
// is stored as a WORM evidence object. The load-bearing property is HONESTY, not reach: a TSA receipt
// lives in the buyer's own trust domain, so it is `trusted-timestamped` — NEVER marketed as
// "externally verifiable". Only the v1.1 `externally-transparent` grade (public log) unlocks that
// claim; this file must never let v1 produce `externally-transparent` (Fork E, enforced in
// verify-external's grade tag — a sibling stage).
//
// GRADES ARE TWO DISTINCT STRING LITERALS in ONE enum, used everywhere — never a boolean — so code
// cannot conflate them (ADR-0332 Binding).
//
// This file is the T1 (types + schemas + port + shared key/hash helpers) layer. The implementations
// (StubTrustedTimestampLog, TsaAnchorLog) land in the same file's T2 section; the durable outbox is
// anchor-outbox.ts; the checkpoint handler is anchor-checkpoint.ts. `verifyExternal` (existence +
// byte-match + full TSA CMS verification, ADR-0346 P2) is a sibling stage.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { fromBER, Integer, Null, OctetString } from "asn1js";
import {
  AlgorithmIdentifier,
  MessageImprint,
  PKIStatus,
  SignedData,
  TimeStampReq,
  TimeStampResp,
  TSTInfo,
} from "pkijs";
import {
  fetchWithTimeout,
  safeEqualFixed,
  strictObject,
  ValidationError,
} from "@caisson-sh/kernel/node";
import { buildArtifactKey } from "./store.ts";

// --- trust grades (ADR-0332 CR-03) -------------------------------------------------------------

/**
 * The two honestly-distinct trust grades. `trusted-timestamped` (RFC-3161 TSA, private receipt) is
 * the ONLY grade v1 produces; `externally-transparent` (public log) is v1.1. One enum of two string
 * literals — never a boolean — so a target can never silently upgrade its own claim.
 */
export const anchorGradeSchema = z.enum([
  "trusted-timestamped",
  "externally-transparent",
]);
export type AnchorGrade = z.infer<typeof anchorGradeSchema>;

// --- transparency target (Fork F — target-agnostic; v1 = TSA only) -----------------------------

/**
 * A TSA anchor target (v1). `url` is buyer-injected deployment config (Fork C), never a module
 * constant; `grade` is pinned to `trusted-timestamped` at the type level so a TSA target can never
 * be constructed claiming the public-log grade.
 */
export const tsaTargetSchema = strictObject({
  kind: z.literal("tsa"),
  url: z.string().url(),
  grade: z.literal("trusted-timestamped"),
});
export type TsaTarget = z.infer<typeof tsaTargetSchema>;

/**
 * A Rekor v2 public-log target (v1.1). Carries NO write URL — the shard URL is read from a
 * deployment-supplied SigningConfig at `RekorAnchorLog` construction (spike decision #3: never hardcode
 * `log2025-1…` in source; it rotates ~6-monthly). `grade` is pinned to `externally-transparent` at the
 * type level. Submission additionally requires the typed irreversible-publicity opt-in (Fork D, R10).
 */
export const rekorTargetSchema = strictObject({
  kind: z.literal("rekor"),
  grade: z.literal("externally-transparent"),
});
export type RekorTarget = z.infer<typeof rekorTargetSchema>;

/**
 * An OpenTimestamps public-log target (v1.1, Fork R-γ). Bitcoin-anchored via calendar servers;
 * `grade` is pinned to `externally-transparent`. Like the Rekor target it requires the irreversible-
 * publicity opt-in (R10). Its offline verify is a documented Bitcoin-header-dependent seam (v1.1 ships
 * the submit leg; full verify is out of scope — see `anchor-ots.ts`).
 */
export const otsTargetSchema = strictObject({
  kind: z.literal("ots"),
  grade: z.literal("externally-transparent"),
});
export type OtsTarget = z.infer<typeof otsTargetSchema>;

/**
 * The pluggable target union (Fork F). v1 carried ONLY the TSA variant; v1.1 adds the Rekor + OTS
 * public-log variants — the whole point of keeping this a discriminated union.
 */
export const transparencyTargetSchema = z.discriminatedUnion("kind", [
  tsaTargetSchema,
  rekorTargetSchema,
  otsTargetSchema,
]);
export type TransparencyTarget = z.infer<typeof transparencyTargetSchema>;

/**
 * The stable string id a target is keyed by (receipt key, outbox row). v1 uses the discriminant
 * `kind` because a deployment configures exactly one TSA.
 * ponytail: one target per kind in v1; if a buyer ever configures two same-kind targets, suffix a
 * short hash of the url here (and only here — every keyer routes through this fn).
 */
export function targetId(target: TransparencyTarget): string {
  return target.kind;
}

// --- RFC-3161 timestamp receipt (submit result) ------------------------------------------------

/**
 * What `TrustedTimestampLog.submit` returns — the RFC-3161 token plus the imprint/time it attests.
 * Structurally the `TimestampToken` shape from signing-primitive's sign.ts (ADR-0346 P1 reimplements
 * the port locally rather than depend on that package). `token` is the opaque base64 DER
 * `TimeStampToken`; a sibling stage's `verifyExternal` does the full CMS parse + TSA cert-chain
 * validation against it (ADR-0346 P2).
 */
export const timestampReceiptSchema = strictObject({
  authority: z.string().min(1),
  algorithm: z.literal("rfc3161"),
  hashAlgorithm: z.literal("sha256"),
  /** `sha256(anchorBytes)` — the RFC-3161 messageImprint the TSA attests (lowercase hex). */
  messageImprint: z.string().regex(/^[0-9a-f]{64}$/),
  /** Deterministic base64 for the stub; a live TSA returns base64 of the DER `TimeStampToken`. */
  token: z.string().min(1),
  /** The instant the TSA attests the imprint existed at (ISO-8601). */
  timestampedAt: z.string().min(1),
});
export type TimestampReceipt = z.infer<typeof timestampReceiptSchema>;

// --- self-contained Rekor transparency receipt (v1.1, spike decision #2) ------------------------

/** Standard base64 (with padding) — the wire encoding for every byte field a Rekor receipt carries. */
const base64String = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "must be standard base64");

/**
 * The SELF-CONTAINED public-log receipt (`externally-transparent`). It carries EVERYTHING
 * `verifyExternal` needs to check offline — including the log's own checkpoint-signing key + origin —
 * because Rekor v2 removed online proof retrieval AND shards retire ~6-monthly while receipts are
 * WORM-retained for years (spike decision #2 + Q4): a stored receipt must verify with NO live TUF/Rekor
 * fetch, long after its shard is gone. `verifyExternal` verifies the checkpoint signature against
 * `logPublicKey` WITHOUT enforcing TUF timestamp freshness — a years-old-but-valid checkpoint still
 * verifies. The leaf's `data.digest` (inside `canonicalizedBody`) is `SHA-512(anchorBytes)`; the outer
 * `AnchorReceipt.anchorDigest` stays `sha256` (the target-agnostic join key), a distinct hash.
 */
export const transparencyReceiptSchema = strictObject({
  algorithm: z.literal("rekor-v2-hashedrekord"),
  /** The log origin string (the checkpoint's first line, e.g. `log2025-1.rekor.sigstore.dev`). */
  origin: z.string().min(1),
  /** The raw C2SP signed-note checkpoint envelope (origin/treeSize/rootHash + `— name sig`). */
  checkpoint: z.string().min(1),
  /** The log's checkpoint-signing algorithm. Only Ed25519 checkpoints are verifiable today. */
  logKeyDetails: z.literal("PKIX_ED25519"),
  /** base64 DER SPKI of the log's checkpoint-signing key — snapshotted so the receipt self-verifies. */
  logPublicKey: base64String,
  /** base64 SHA-256 log id (`TransparencyLogEntry.logId.keyId`), bound to the fixture shard. */
  logId: base64String,
  /** The authoritative leaf position (`TransparencyLogEntry.logIndex`, top-level, int64 as string). */
  logIndex: z.string().regex(/^\d+$/),
  /** The RFC-6962 inclusion-proof audit path (`inclusionProof.hashes[]`, base64). */
  inclusionHashes: z.array(base64String),
  /** base64 leaf preimage (`canonicalizedBody`): the `{data,signature}` the leaf hash is taken over. */
  canonicalizedBody: base64String,
  /** Optional RFC-3161 token composing the `trusted-timestamped` layer over the same anchor (Q5 #5). */
  rfc3161Token: base64String.optional(),
});
export type TransparencyReceipt = z.infer<typeof transparencyReceiptSchema>;

/**
 * An OpenTimestamps receipt (v1.1, Fork R-γ minimal drop-in). OTS needs NO per-entry signature — the
 * calendar Merkle-trees all submitters and commits to Bitcoin — so `signature`/`verifier` are absent.
 * `status: pending` holds the calendar's `PendingAttestation` (Bitcoin not yet confirmed); `complete`
 * holds the upgraded proof. FULL verification requires Bitcoin block headers (documented seam, out of
 * scope v1.1) — the persisted proof is durable evidence, upgraded/verified later.
 */
export const otsReceiptSchema = strictObject({
  algorithm: z.literal("opentimestamps"),
  /** `sha256(anchorBytes)` — the digest OTS calendars aggregate (lowercase hex). */
  messageImprint: z.string().regex(/^[0-9a-f]{64}$/),
  /** The calendar servers the digest was submitted to. */
  calendars: z.array(z.string().url()).min(1),
  /** base64 of the `.ots` proof bytes (a `PendingAttestation` while `pending`). */
  proof: z.string().min(1),
  /** `pending` = Bitcoin not yet confirmed; `complete` = upgraded proof landed. */
  status: z.enum(["pending", "complete"]),
  /** When the calendar accepted the digest (ISO-8601). */
  submittedAt: z.string().min(1),
});
export type OtsReceipt = z.infer<typeof otsReceiptSchema>;

/**
 * The receipt a `TransparencyLog.submit` returns, per target: a TSA `TimestampReceipt`, a self-contained
 * Rekor `TransparencyReceipt`, or an `OtsReceipt`. Discriminated on `algorithm`. Existing rfc3161
 * receipts parse unchanged — widening to a union is backward-compatible.
 */
export const anchorSubmitReceiptSchema = z.discriminatedUnion("algorithm", [
  timestampReceiptSchema,
  transparencyReceiptSchema,
  otsReceiptSchema,
]);
export type AnchorSubmitReceipt = z.infer<typeof anchorSubmitReceiptSchema>;

// --- the persisted WORM anchor receipt ---------------------------------------------------------

/**
 * The evidence object written write-once to the tenant's WORM prefix under
 * `{account_id}/audit-chain/receipts/<len>.<target>.json`. It binds the timestamp receipt to a
 * SPECIFIC anchor (length + digest of that anchor's canonical bytes) and tags the grade. `anchorDigest`
 * equals `receipt.messageImprint` (both are `sha256(encodeAnchor(anchor))`) — the redundancy is
 * deliberate: the outer field is the join key, the inner is what the TSA signed over.
 */
export const anchorReceiptSchema = strictObject({
  accountId: z.string().min(1),
  target: z.string().min(1),
  anchorLength: z.number().int().nonnegative(),
  anchorDigest: z.string().regex(/^[0-9a-f]{64}$/),
  grade: anchorGradeSchema,
  receipt: anchorSubmitReceiptSchema,
  /** When Caisson persisted the receipt to WORM (ISO-8601). Distinct from `receipt.timestampedAt`. */
  receiptedAt: z.string().min(1),
});
export type AnchorReceipt = z.infer<typeof anchorReceiptSchema>;

// --- durable-outbox state model (CR-02 / ADR-0346 P4) ------------------------------------------

/**
 * Outbox lifecycle. `pending` is persisted BEFORE any egress; `submitted` is persisted BEFORE the
 * network call resolves. A response-loss window (submitted, no receipt) resolves to `needs_reconcile`
 * — surfaced to the operator, NEVER blind-retried into a duplicate submission. `receipted`, `failed`,
 * and `needs_reconcile` are terminal.
 */
export const anchorOutboxStateSchema = z.enum([
  "pending",
  "submitted",
  "receipted",
  "failed",
  "needs_reconcile",
]);
export type AnchorOutboxState = z.infer<typeof anchorOutboxStateSchema>;

/** The natural key of an outbox row / receipt: one (tenant, target, anchor) tuple. */
export const anchorOutboxKeySchema = strictObject({
  accountId: z.string().min(1),
  target: z.string().min(1),
  anchorLength: z.number().int().nonnegative(),
  anchorDigest: z.string().regex(/^[0-9a-f]{64}$/),
});
export type AnchorOutboxKey = z.infer<typeof anchorOutboxKeySchema>;

/** A row read back from `anchor_outbox` (mutable operational state — NOT a WORM object). */
export const anchorOutboxRowSchema = strictObject({
  id: z.string().uuid(),
  accountId: z.string().min(1),
  target: z.string().min(1),
  anchorLength: z.number().int().nonnegative(),
  anchorDigest: z.string().regex(/^[0-9a-f]{64}$/),
  state: anchorOutboxStateSchema,
  lastError: z.string().nullable(),
  receiptVersionId: z.string().min(1).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AnchorOutboxRow = z.infer<typeof anchorOutboxRowSchema>;

// --- the port (SPEC Design §1, verbatim shape) -------------------------------------------------

/**
 * The v1 `trusted-timestamped` port. `submit` imprint-egresses `sha256(anchorBytes)` to a third-party
 * clock and returns its receipt. The v1.1 `externally-transparent` port is a DIFFERENT (signed)
 * shape, gated on the Rekor protocol spike — it does not appear here.
 */
export interface TrustedTimestampLog {
  submit(anchorBytes: Uint8Array): Promise<TimestampReceipt>;
}

/**
 * The target-agnostic anchoring port (Fork F). `submit` egresses the anchor bytes to SOME external log
 * and returns whichever receipt that target produces (TSA `TimestampReceipt` or Rekor
 * `TransparencyReceipt`). Every concrete log — `TsaAnchorLog`, `RekorAnchorLog`, `OpenTimestampsAnchorLog`
 * — implements this; the checkpoint handler and outbox are written against it and stay target-blind
 * (correction #3). `TrustedTimestampLog` is the narrower TSA-only shape; a `TsaAnchorLog` satisfies both.
 */
export interface TransparencyLog {
  submit(anchorBytes: Uint8Array): Promise<AnchorSubmitReceipt>;
}

/**
 * The minimal signer port `RekorAnchorLog` needs — the deployment ed25519ph anchoring signer
 * (`@caisson-sh/signing-primitive`'s `Ed25519PhSigner`) is INJECTED as this structural shape, so audit-worm
 * keeps its down-only dependency set (no `signing-primitive` import; ADR-0346 P1 discipline). `sign`
 * returns a detached 64-byte ed25519ph signature over the exact anchor bytes; `publicKey` returns the
 * raw 32-byte Ed25519 key (this module DER-wraps it into the Rekor verifier material).
 */
export interface AnchorSubmissionSigner {
  readonly keyId: string;
  readonly algorithm: "ed25519ph";
  sign(anchorBytes: Uint8Array): Promise<Uint8Array>;
  publicKey(): Promise<Uint8Array>;
}

// --- Fork D: typed irreversible-publicity opt-in (R10; mirrors store.s3 COMPLIANCE opt-in) ------

/** The exact acknowledgement a deployment must echo to submit to a PUBLIC transparency log. */
export const PUBLICITY_ACKNOWLEDGEMENT =
  "I acknowledge public transparency-log anchoring is irreversible: each submission is a permanent, " +
  "publicly visible entry (existence, timing, and rough volume are disclosed) and cannot be deleted.";

const PUBLICITY_OPT_IN_BRAND: unique symbol = Symbol(
  "audit-worm.irreversible-publicity-opt-in",
);

/**
 * The typed, opaque proof that a deployment has acknowledged public-log anchoring is irreversible
 * (Fork D). Unforgeable in practice — the only constructor is {@link irreversiblePublicityOptIn}, which
 * demands the exact {@link PUBLICITY_ACKNOWLEDGEMENT}. No public-log target submits without one in hand,
 * so the irreversible public egress cannot be triggered by accident or by a default. TSA never needs it.
 */
export interface IrreversiblePublicityOptIn {
  readonly [PUBLICITY_OPT_IN_BRAND]: true;
}

/**
 * Mint the irreversible-publicity opt-in. Fail-closed: the acknowledgement must be the exact
 * {@link PUBLICITY_ACKNOWLEDGEMENT} string, so neither a typo nor a default ever yields one.
 */
export function irreversiblePublicityOptIn(input: {
  acknowledgement: string;
}): IrreversiblePublicityOptIn {
  if (input.acknowledgement !== PUBLICITY_ACKNOWLEDGEMENT) {
    throw new ValidationError(
      "audit-worm: public-log anchoring requires the exact irreversible-publicity acknowledgement string",
    );
  }
  return { [PUBLICITY_OPT_IN_BRAND]: true };
}

/**
 * The runtime brand check a public-log target uses to refuse a forged/absent opt-in (a belt for untyped
 * JS callers; the type system is the primary gate — the brand symbol is module-private, so the only way
 * to obtain the value is {@link irreversiblePublicityOptIn}).
 */
export function isIrreversiblePublicityOptIn(
  value: unknown,
): value is IrreversiblePublicityOptIn {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[PUBLICITY_OPT_IN_BRAND] === true
  );
}

// --- shared helpers (keyer + digest; imported by writer T4 and reader/verify siblings) ---------

/** WORM key layout for a receipt: `{account_id}/audit-chain/receipts/<zero-padded len>.<target>.json`. */
const RECEIPT_SEGMENT = "audit-chain";
const RECEIPT_DIR = "receipts";
/** Match chain-store's anchor zero-padding so receipts sort lexically alongside their anchors. */
const LENGTH_PAD = 12;

/**
 * The write-once WORM key for the receipt of anchor `anchorLength` at `target`. The single sanctioned
 * builder — the checkpoint writer and `verifyExternal` reader MUST route through it so their keys can
 * never drift. Re-derives the `audit-chain` segment locally (chain-store's constant is file-private
 * and that file is owned by a parallel lane this wave) — a small, deliberate duplication.
 */
export function anchorReceiptKey(
  accountId: string,
  anchorLength: number,
  target: string,
): string {
  return buildArtifactKey(
    accountId,
    RECEIPT_SEGMENT,
    RECEIPT_DIR,
    `${String(anchorLength).padStart(LENGTH_PAD, "0")}.${target}.json`,
  );
}

/** `sha256(bytes)` as lowercase hex — the anchor digest / RFC-3161 message imprint. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ===============================================================================================
// T2 — TrustedTimestampLog implementations (deterministic stub + live RFC-3161 client).
// ADR-0346 P1: the port is reimplemented LOCALLY here (mirroring signing-primitive's sign.ts
// RFC-3161 pattern), no dependency on signing-primitive. P2: the live client uses a vetted ASN.1/CMS
// dependency (pkijs) for real DER TimeStampReq encode + TimeStampResp/TSTInfo parse.
// ===============================================================================================

/**
 * A deterministic, network-free `TrustedTimestampLog` test double. Reproduces the imprint a real TSA
 * would attest (`sha256(anchorBytes)`) and stamps an injected clock, so the whole checkpoint flow is
 * exercised in CI without a live authority. Mirrors `StubTimestampAuthority` (sign.ts). NOT for prod.
 */
export class StubTrustedTimestampLog implements TrustedTimestampLog {
  readonly #authority: string;
  readonly #clock: Date;

  constructor(options?: { readonly authority?: string; readonly now?: Date }) {
    this.#authority = options?.authority ?? "urn:caisson:test-tsa";
    this.#clock = options?.now ?? new Date(0);
  }

  submit(anchorBytes: Uint8Array): Promise<TimestampReceipt> {
    const messageImprint = sha256Hex(anchorBytes);
    const timestampedAt = this.#clock.toISOString();
    const token = Buffer.from(
      `rfc3161|${this.#authority}|${messageImprint}|${timestampedAt}`,
      "utf8",
    ).toString("base64");
    return Promise.resolve({
      authority: this.#authority,
      algorithm: "rfc3161",
      hashAlgorithm: "sha256",
      messageImprint,
      token,
      timestampedAt,
    });
  }
}

/** The RFC-3161 SHA-256 OID (`id-sha256`). */
const SHA256_OID = "2.16.840.1.101.3.4.2.1";
/** RFC-3161 blocks on token publication; the SPEC cadence section sets timeouts at >= 20s. */
const DEFAULT_TSA_TIMEOUT_MS = 20_000;

export interface TsaAnchorLogConfig {
  /** The buyer-injected TSA endpoint (Fork C) — never a module constant. http or https only. */
  readonly url: string;
  /** Outbound timeout (ms). Default 20s per the SPEC cadence; below 1s is refused. */
  readonly timeoutMs?: number;
  /** Optional TSA policy OID the request pins (`reqPolicy`). */
  readonly reqPolicy?: string;
}

/**
 * The live RFC-3161 client (the `trusted-timestamped` grade). `submit` DER-encodes a `TimeStampReq`
 * with `messageImprint = sha256(anchorBytes)` and `certReq = true` (so the TSA returns its cert chain
 * for the sibling `verifyExternal`'s full CMS/chain validation — ADR-0346 P2), POSTs it over
 * `fetchWithTimeout` (NEVER the Bun-forbidden `AbortSignal.timeout`), then parses the `TimeStampResp`,
 * confirms it was granted, and reconfirms the attested imprint constant-time before returning.
 *
 * Egress is imprint-only (hashes, no payload/PII — SPEC data-custody). The trust of an RFC-3161 token
 * rides its SIGNATURE, not the transport, so http TSA endpoints (many public TSAs use them) are
 * accepted; the token itself is verified downstream. LIVE transport is un-exercised in CI — the DER
 * round-trip is proven only by the self-skipping `live/tsa.live.test.ts` (ADR-0047 live-test ethos).
 */
export class TsaAnchorLog implements TrustedTimestampLog {
  readonly #url: string;
  readonly #timeoutMs: number;
  readonly #reqPolicy: string | undefined;

  constructor(config: TsaAnchorLogConfig) {
    const parsed = new URL(config.url); // throws on a malformed url
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError("TSA url must be an http(s) endpoint", {
        protocol: parsed.protocol,
      });
    }
    const timeoutMs = config.timeoutMs ?? DEFAULT_TSA_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
      throw new ValidationError("TSA timeout must be a finite value >= 1000ms");
    }
    this.#url = config.url;
    this.#timeoutMs = timeoutMs;
    this.#reqPolicy = config.reqPolicy;
  }

  async submit(anchorBytes: Uint8Array): Promise<TimestampReceipt> {
    const imprint = createHash("sha256").update(anchorBytes).digest();
    const reqBer = buildTimeStampReqBer(imprint, this.#reqPolicy);
    const resp = await fetchWithTimeout(
      this.#url,
      {
        method: "POST",
        headers: {
          "content-type": "application/timestamp-query",
          accept: "application/timestamp-reply",
        },
        body: reqBer,
        // `http:` is a deliberate RFC-3161 decision here (only a sha256 imprint transits, and the
        // CMS/EKU verification below is what establishes trust), and a private TSA is a supported
        // deployment — so a public-host SSRF guard would be wrong on this seam. Refusing redirects
        // is the part that is right regardless: it keeps the request on the configured endpoint.
        redirect: "error",
      },
      { timeoutMs: this.#timeoutMs },
    );
    if (!resp.ok) {
      throw new ValidationError("TSA request failed", { status: resp.status });
    }
    const respDer = new Uint8Array(await resp.arrayBuffer());
    return parseTimeStampResp(respDer, imprint, this.#url);
  }
}

/** Build the DER `TimeStampReq` (RFC-3161): version 1, sha256 imprint, certReq, random nonce. */
function buildTimeStampReqBer(
  imprint: Uint8Array,
  reqPolicy: string | undefined,
): ArrayBuffer {
  const messageImprint = new MessageImprint({
    hashAlgorithm: new AlgorithmIdentifier({
      algorithmId: SHA256_OID,
      algorithmParams: new Null(),
    }),
    hashedMessage: new OctetString({ valueHex: imprint }),
  });
  const req = new TimeStampReq({
    version: 1,
    messageImprint,
    certReq: true,
    nonce: new Integer({ valueHex: randomBytes(16) }),
    ...(reqPolicy !== undefined ? { reqPolicy } : {}),
  });
  return req.toSchema().toBER();
}

/**
 * Parse the DER `TimeStampResp`: require a granted status, extract the DER `TimeStampToken` (kept
 * opaque base64 for the sibling verify's full CMS/cert-chain validation), and reconfirm — via the
 * embedded TSTInfo — that the TSA attested the EXACT imprint we submitted (constant-time). The
 * `genTime` becomes the receipt's `timestampedAt`.
 */
function parseTimeStampResp(
  respDer: Uint8Array,
  expectedImprint: Uint8Array,
  authorityUrl: string,
): TimestampReceipt {
  const asn1 = fromBER(respDer);
  if (asn1.offset === -1) {
    throw new ValidationError("TSA response is not valid DER");
  }
  const resp = new TimeStampResp({ schema: asn1.result });
  if (
    resp.status.status !== PKIStatus.granted &&
    resp.status.status !== PKIStatus.grantedWithMods
  ) {
    throw new ValidationError("TSA did not grant the timestamp request", {
      status: resp.status.status,
    });
  }
  const token = resp.timeStampToken;
  if (token === undefined) {
    throw new ValidationError("TSA response carried no timeStampToken");
  }
  const tokenDer = new Uint8Array(token.toSchema().toBER());

  // Reach the signed TSTInfo: CMS SignedData -> encapContentInfo.eContent (DER TSTInfo).
  const signed = new SignedData({ schema: token.content });
  const eContent = signed.encapContentInfo.eContent;
  if (eContent === undefined) {
    throw new ValidationError("TSA token carried no eContent");
  }
  const tstAsn1 = fromBER(eContent.valueBlock.valueHexView);
  if (tstAsn1.offset === -1) {
    throw new ValidationError("TSA TSTInfo is not valid DER");
  }
  const tstInfo = new TSTInfo({ schema: tstAsn1.result });
  const attestedImprint = new Uint8Array(
    tstInfo.messageImprint.hashedMessage.valueBlock.valueHexView,
  );

  const expectedHex = Buffer.from(expectedImprint).toString("hex");
  const attestedHex = Buffer.from(attestedImprint).toString("hex");
  if (!safeEqualFixed(expectedHex, attestedHex)) {
    throw new ValidationError(
      "TSA attested a different imprint than submitted",
    );
  }

  return {
    authority: authorityUrl,
    algorithm: "rfc3161",
    hashAlgorithm: "sha256",
    messageImprint: expectedHex,
    token: Buffer.from(tokenDer).toString("base64"),
    timestampedAt: tstInfo.genTime.toISOString(),
  };
}
