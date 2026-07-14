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
import { createHash } from "node:crypto";
import { z } from "zod";
import { strictObject } from "@caisson/kernel";
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
 * The pluggable target union (Fork F). v1 carries ONLY the TSA variant; the v1.1 Rekor/OTS variants
 * ({ kind: "rekor" | "ots"; grade: "externally-transparent" }) slot into this discriminated union
 * without a rewrite — that is the whole point of keeping it a union of one today.
 */
export const transparencyTargetSchema = z.discriminatedUnion("kind", [
  tsaTargetSchema,
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
  receipt: timestampReceiptSchema,
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
