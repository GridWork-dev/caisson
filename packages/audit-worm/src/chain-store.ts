// src/chain-store.ts — the append-only audit-chain persistence + WORM anchor (ADR-0052, ADR-0014).
//
// This is the DB+WORM persistence layer ON TOP of the kernel's pure audit-chain primitives — it
// adds nothing to the hash algebra, it COMPOSES it. Every link hash, the anchor shape, and the
// verification are kernel functions used verbatim (`canonicalize`/`chainEntry`/`anchorChain`/
// `verifyChain`); this file only durably stores entries and the trusted anchor, fail-closed.
//
// Three invariants, each enforced by a different mechanism so no single bug defeats them:
//   1. APPEND-ONLY — entries land in `audit_chain_entry`, whose migration grants the `app` role
//      SELECT + INSERT and *withholds* UPDATE/DELETE. A committed entry is immutable by
//      privilege, not by convention.
//   2. NO FORK — appends for one tenant serialize under `pg_advisory_xact_lock`, and the
//      UNIQUE(account_id, seq) constraint is the hard belt: two racing appends that mint the same
//      seq collide on 23505 → `ConflictError` → the caller retries against the new tip.
//   3. TRUNCATION/REWRITE EVIDENT — every append mints a fresh `anchorChain()` and writes it to the
//      WORM store under a LENGTH-keyed, write-once key. The store is therefore the trusted length
//      oracle: a tail-truncated DB has an anchor for a length it can no longer produce, and a
//      re-anchor of an existing length is refused by the store's write-once put. `verify`
//      reads the anchor back and runs `verifyChain(entries, anchor)`.
//
// KNOWN BOUND: the anchor `put` is an external side effect inside the DB transaction, so it cannot
// be atomic with the commit. The advisory lock + write-once key make this fail CLOSED — a put that
// outlived a rolled-back commit poisons only that one length and stalls further appends (the safe
// direction for an immutable log), never silently accepts an un-anchored entry.
import {
  randomUUID,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { z } from "zod";
import {
  anchorChain,
  canonicalize,
  chainEntry,
  ConflictError,
  InternalError,
  isUniqueViolation,
  NotFoundError,
  strictObject,
  parseStrict,
  ValidationError,
  verifyChain,
  type AuditChainAnchor,
  type AuditChainEntry,
  type ChainVerification,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import {
  ANCHOR_SIGNATURE_VERSION,
  anchorSignatureEnvelopeBytes,
} from "@caisson-sh/kernel/audit-verify";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import {
  ArtifactExistsError,
  assertValidArtifactVersionId,
  buildArtifactKey,
  type ArtifactStore,
} from "./store.ts";
import { DEFAULT_RETENTION_YEARS, retainUntilFrom } from "./retain.ts";
import type { AnchorSigner } from "./anchor-signer.ts";

/** Advisory-lock namespace so audit-chain locks never collide with another subsystem's keyspace. */
const LOCK_NAMESPACE = "caisson.audit-chain";
/** WORM key layout: `{account_id}/audit-chain/anchors/<zero-padded length>.json`. */
const ANCHOR_SEGMENT = "audit-chain";
const ANCHOR_DIR = "anchors";
/** Zero-pad the length so anchor keys sort lexicographically and never collide across magnitudes. */
const LENGTH_PAD = 12;

/** The trusted anchor body, validated on read back from the (possibly remote) WORM store. `sig`+`keyId`
 *  are ADDITIVE optional fields — a legacy unsigned anchor omits them and stays valid. */
const anchorSchema = strictObject({
  length: z.number().int().nonnegative(),
  tipHash: z.string().min(1),
  genesisHash: z.string().min(1).optional(),
  sig: z.string().min(1).optional(),
  keyId: z.string().min(1).optional(),
  sigV: z.literal(ANCHOR_SIGNATURE_VERSION).optional(),
  sigAccountId: z.string().uuid().optional(),
});

/** A row read back from `audit_chain_entry`. `payload` is jsonb — already a parsed JSON value. */
interface ChainRow {
  readonly seq: number;
  readonly prev_hash: string | null;
  readonly payload: JsonValue;
  readonly hash: string;
}

function toEntry(row: ChainRow): AuditChainEntry {
  return {
    seq: row.seq,
    prevHash: row.prev_hash,
    payload: row.payload,
    hash: row.hash,
  };
}

/** The WORM object key for a chain anchor of exactly `length` entries (write-once, ADR-0052). */
function anchorKey(accountId: string, length: number): string {
  return buildArtifactKey(
    accountId,
    ANCHOR_SEGMENT,
    ANCHOR_DIR,
    `${String(length).padStart(LENGTH_PAD, "0")}.json`,
  );
}

/**
 * The anchor's CANONICAL CORE bytes: `canonicalize({length, tipHash, genesisHash?})`. External
 * anchoring builds against this stable legacy commitment. The v2 Ed25519 signature wraps these bytes
 * in the account-bound envelope from `anchorSignatureEnvelopeBytes`; `sig`/`keyId` remain excluded
 * from both forms. Never change the core bytes (chain-format break).
 */
function encodeAnchor(anchor: AuditChainAnchor): Uint8Array {
  const obj: { [key: string]: JsonValue } = {
    length: anchor.length,
    tipHash: anchor.tipHash,
  };
  if (anchor.genesisHash !== undefined) obj.genesisHash = anchor.genesisHash;
  return new TextEncoder().encode(canonicalize(obj));
}

/**
 * The WORM object body: the canonical CORE plus the optional `sig`+`keyId` stored ALONGSIDE (T-W2).
 * For an UNSIGNED anchor (no `sig`) this is byte-identical to {@link encodeAnchor} and to the legacy
 * stored form — the signature fields are purely additive, so no existing anchor needs migrating.
 */
function encodeStoredAnchor(anchor: AuditChainAnchor): Uint8Array {
  const obj: { [key: string]: JsonValue } = {
    length: anchor.length,
    tipHash: anchor.tipHash,
  };
  if (anchor.genesisHash !== undefined) obj.genesisHash = anchor.genesisHash;
  if (anchor.sig !== undefined) obj.sig = anchor.sig;
  if (anchor.keyId !== undefined) obj.keyId = anchor.keyId;
  if (anchor.sigV !== undefined) obj.sigV = anchor.sigV;
  if (anchor.sigAccountId !== undefined) {
    obj.sigAccountId = anchor.sigAccountId;
  }
  return new TextEncoder().encode(canonicalize(obj));
}

function decodeAnchor(body: Uint8Array): AuditChainAnchor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ValidationError("audit chain anchor is not valid JSON");
  }
  const a = parseStrict(anchorSchema, parsed);
  // Build to the exact-optional shape: only carry an optional field when it is actually present (Zod's
  // `.optional()` widens to `string | undefined`, which exactOptionalPropertyTypes rejects).
  const anchor: {
    length: number;
    tipHash: string;
    genesisHash?: string;
    sig?: string;
    keyId?: string;
    sigV?: 2;
    sigAccountId?: string;
  } = { length: a.length, tipHash: a.tipHash };
  if (a.genesisHash !== undefined) anchor.genesisHash = a.genesisHash;
  if (a.sig !== undefined) anchor.sig = a.sig;
  if (a.keyId !== undefined) anchor.keyId = a.keyId;
  if (a.sigV !== undefined) anchor.sigV = a.sigV;
  if (a.sigAccountId !== undefined) {
    anchor.sigAccountId = a.sigAccountId;
  }
  return anchor;
}

/**
 * Verify a signed anchor's Ed25519 signature over its canonical CORE bytes against a pinned public
 * key. Returns `false` for an unsigned anchor (no `sig`), a malformed signature, or a mismatch — a
 * signature check is `crypto.verify` (constant-time by construction), NOT a secret compare, so it is
 * the right tool here and never a hand-rolled `timingSafeEqual` (SPEC G7). This is the server-side
 * check; the browser / offline verifier runs the WebCrypto equivalent over the same core bytes.
 */
export function verifyAnchorSignature(
  anchor: AuditChainAnchor,
  publicKey: KeyObject,
  expectedAccountId: string,
): boolean {
  if (
    anchor.sig === undefined ||
    anchor.sigV !== ANCHOR_SIGNATURE_VERSION ||
    anchor.sigAccountId !== expectedAccountId
  ) {
    return false;
  }
  let sig: Buffer;
  try {
    sig = Buffer.from(anchor.sig, "base64");
  } catch {
    return false;
  }
  try {
    return cryptoVerify(
      null,
      anchorSignatureEnvelopeBytes(anchor, expectedAccountId),
      publicKey,
      sig,
    );
  } catch {
    return false;
  }
}

async function loadEntries(
  tx: TenantExecutor,
  accountId: string,
): Promise<AuditChainEntry[]> {
  const res = await tx.query<ChainRow>(
    `SELECT seq, prev_hash, payload, hash
       FROM audit_chain_entry
      WHERE account_id = $1
      ORDER BY seq ASC`,
    [accountId],
  );
  return res.rows.map(toEntry);
}

async function recordArtifactVersion(
  tx: TenantExecutor,
  accountId: string,
  key: string,
  versionId: string | undefined,
): Promise<void> {
  if (versionId === undefined) return;
  assertValidArtifactVersionId(versionId);
  await tx.query(
    `INSERT INTO worm_artifact_version (id, account_id, artifact_key, version_id)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), accountId, key, versionId],
  );
}

async function recordedArtifactVersion(
  tx: TenantExecutor,
  accountId: string,
  key: string,
): Promise<string | undefined> {
  const result = await tx.query<{ version_id: string }>(
    `SELECT version_id FROM worm_artifact_version
      WHERE account_id = $1 AND artifact_key = $2`,
    [accountId, key],
  );
  const versionId = result.rows[0]?.version_id;
  if (versionId !== undefined) assertValidArtifactVersionId(versionId);
  return versionId;
}

function assertRecordedArtifactVersion(
  key: string,
  recordedVersionId: string | undefined,
  returnedVersionId: string | undefined,
): void {
  if (returnedVersionId !== undefined && recordedVersionId === undefined) {
    throw new InternalError(
      "versioned WORM artifact has no recorded provider version identity",
      { key },
    );
  }
  if (
    recordedVersionId !== undefined &&
    returnedVersionId !== recordedVersionId
  ) {
    throw new InternalError(
      "WORM artifact provider version does not match its recorded identity",
      { key },
    );
  }
}

export interface AuditChainStoreOptions {
  /** A transactor over the tenant DB (PGlite, node-postgres, Drizzle) — appends run under RLS. */
  readonly db: Transactor;
  /** The WORM store the trusted anchor is written to, write-once (`ArtifactStore`). */
  readonly store: ArtifactStore;
  /** Clock injected at the edge so anchor retention is deterministic + testable. Default: wall clock. */
  readonly now?: () => Date;
  /** WORM retention term (years) for the anchor object. Default: the `retain.ts` legal floor. */
  readonly retentionYears?: number;
  /**
   * Optional anchor-signing identity. When present, EVERY minted anchor is signed at
   * mint — `sig`+`keyId` are stored additively alongside the canonical core, so the client / offline
   * pack can check tamper-evidence against a pinned public key. Absent → unsigned anchors (the legacy
   * form, still structurally valid). Production wiring injects `Ed25519AnchorSigner.fromEnv()` at the
   * composition root once the operator provisions `CAISSON_ANCHOR_SIGNING_KEY`; tests inject an
   * ephemeral keypair.
   */
  readonly signer?: AnchorSigner;
}

/** The result of one append: the new entry and the anchor minted over the resulting chain. */
export interface AppendResult {
  readonly entry: AuditChainEntry;
  readonly anchor: AuditChainAnchor;
  /** Exact provider identity durably recorded for this anchor, when the backend is versioned. */
  readonly anchorVersionId?: string;
}

/**
 * A single-row proof: the raw (unredacted at this layer) entry, the per-length WORM anchor minted
 * when it was the tip, and the current chain length. Redaction happens ABOVE this layer at the
 * endpoint, before the payload crosses the wire (H3). The endpoint recomputes leg 1 (link) and
 * leg 2 (`anchorForRow.tipHash === entry.hash`) from this material.
 */
export interface RowProof {
  readonly entry: AuditChainEntry;
  readonly anchorForRow: AuditChainAnchor;
  readonly chainLength: number;
}

/**
 * Fail-closed result when the row's per-length anchor is unreadable — the SAME direction `verify()`
 * takes. NEVER a fabricated pass (binding #6): the endpoint maps this to a 200 `unverifiable` verdict.
 */
export interface RowProofUnverifiable {
  readonly unverifiable: true;
  readonly reason: string;
}

/**
 * Append-only, WORM-anchored audit chain over a per-tenant `audit_chain_entry` table. One instance
 * binds a tenant DB transactor and a WORM `ArtifactStore`; every method is tenant-scoped through
 * `withTenant`, so a forgotten filter still sees only the caller's chain (ADR-0005, fail-closed).
 */
export class AuditChainStore {
  private readonly db: Transactor;
  private readonly store: ArtifactStore;
  private readonly now: () => Date;
  private readonly retentionYears: number;
  private readonly signer: AnchorSigner | undefined;

  constructor(opts: AuditChainStoreOptions) {
    this.db = opts.db;
    this.store = opts.store;
    this.now = opts.now ?? ((): Date => new Date());
    this.retentionYears = opts.retentionYears ?? DEFAULT_RETENTION_YEARS;
    this.signer = opts.signer;
  }

  /**
   * Append `payload` to the tenant's chain and mint + persist a fresh WORM anchor over the result.
   * Fail-closed: a seq collision (`ConflictError`) or an anchor-length collision (`ConflictError`,
   * the WORM key already exists) rolls the whole transaction back — never a partial append.
   */
  async append(accountId: string, payload: JsonValue): Promise<AppendResult> {
    // Stabilize through the canonical form once, up front: `canonicalize` rejects NaN/Infinity and
    // fixes key order, so what we hash == what we store (jsonb) == what we read back to verify.
    const stablePayload = JSON.parse(canonicalize(payload)) as JsonValue;
    const retainUntil = retainUntilFrom(this.now(), this.retentionYears);

    return withTenant(this.db, accountId, async (tx) => {
      // Serialize appends for THIS tenant for the txn's life — concurrent appends can't both read
      // the same tip and fork the chain. UNIQUE(account_id, seq) is the hard belt under the lock.
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
        [LOCK_NAMESPACE, accountId],
      );

      const tipRes = await tx.query<ChainRow>(
        `SELECT seq, prev_hash, payload, hash
           FROM audit_chain_entry
          WHERE account_id = $1
          ORDER BY seq DESC
          LIMIT 1`,
        [accountId],
      );
      const tipRow = tipRes.rows[0];
      const prev = tipRow !== undefined ? toEntry(tipRow) : null;
      const entry = chainEntry(prev, stablePayload);

      try {
        await tx.query(
          `INSERT INTO audit_chain_entry (id, account_id, seq, prev_hash, payload, hash)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
          [
            randomUUID(),
            accountId,
            entry.seq,
            entry.prevHash,
            canonicalize(stablePayload),
            entry.hash,
          ],
        );
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("audit chain append conflicted; retry", {
            accountId,
          });
        }
        throw err;
      }

      const entries = await loadEntries(tx, accountId);
      const anchor = anchorChain(entries);

      // Sign the v2 account-bound envelope over the stable canonical commitment at mint.
      // Signature provenance is stored ALONGSIDE the core, so legacy unsigned anchors remain
      // structurally valid and the external-anchoring commitment is unchanged.
      let anchorToStore: AuditChainAnchor = anchor;
      if (this.signer !== undefined) {
        const sigBytes = await this.signer.sign(
          anchorSignatureEnvelopeBytes(anchor, accountId),
        );
        anchorToStore = {
          ...anchor,
          sig: Buffer.from(sigBytes).toString("base64"),
          keyId: this.signer.keyId,
          sigV: ANCHOR_SIGNATURE_VERSION,
          sigAccountId: accountId,
        };
      }

      // The trusted commitment lands in WORM under a LENGTH-keyed, write-once key. A second anchor
      // for the same length (a truncate-then-re-append, a replay) hits the existing immutable object
      // → ArtifactExistsError → ConflictError: the original tip can never be overwritten.
      const key = anchorKey(accountId, anchor.length);
      let anchorVersionId: string | undefined;
      try {
        const meta = await this.store.put(
          key,
          encodeStoredAnchor(anchorToStore),
          {
            retainUntil,
            contentType: "application/json",
          },
        );
        anchorVersionId = meta.versionId;
        await recordArtifactVersion(tx, accountId, key, anchorVersionId);
      } catch (err) {
        if (err instanceof ArtifactExistsError) {
          throw new ConflictError(
            "audit chain anchor already exists for this length",
            { accountId, length: anchor.length },
          );
        }
        throw err;
      }

      return anchorVersionId === undefined
        ? { entry, anchor: anchorToStore }
        : { entry, anchor: anchorToStore, anchorVersionId };
    });
  }

  /** Load the tenant's full chain, oldest first (genesis at index 0). */
  async load(accountId: string): Promise<AuditChainEntry[]> {
    return withTenant(this.db, accountId, (tx) => loadEntries(tx, accountId));
  }

  /**
   * Verify the tenant's persisted chain against its trusted WORM anchor. Catches interior tamper +
   * mid-chain insert/reorder/drop (`verifyChain` hash recompute), wholesale rewrite (tip-hash
   * mismatch vs the write-once anchor), a forged root (genesis mismatch), AND tail truncation — the
   * latter because an anchor existing for a length BEYOND the loadable rows proves the tail was cut.
   */
  async verify(accountId: string): Promise<ChainVerification> {
    return withTenant(this.db, accountId, async (tx) => {
      const entries = await loadEntries(tx, accountId);

      // Truncation guard: the WORM store is the trusted length oracle. An anchor for a length
      // past what the DB can now produce means the tail was dropped — invalid even if the surviving
      // prefix is internally consistent (which, being a true prefix, it always is).
      const beyondKey = anchorKey(accountId, entries.length + 1);
      const beyondVersion = await recordedArtifactVersion(
        tx,
        accountId,
        beyondKey,
      );
      const beyond = await this.store.head(beyondKey, beyondVersion);
      if (beyond !== null) {
        return { valid: false, brokenAt: entries.length };
      }
      if (entries.length === 0) {
        return { valid: true, brokenAt: null };
      }

      const key = anchorKey(accountId, entries.length);
      const versionId = await recordedArtifactVersion(tx, accountId, key);
      const anchorObj = await this.store.get(key, versionId);
      assertRecordedArtifactVersion(key, versionId, anchorObj.versionId);
      const anchor = decodeAnchor(anchorObj.body);
      return verifyChain(entries, anchor);
    });
  }

  /**
   * Read the tenant's CURRENT WORM anchor as `{ length, anchorBytes }`, or `null` when the tenant
   * has no chain yet. The external-anchoring checkpoint injects this as its `CurrentAnchorReader`
   * port (which anchor-checkpoint.ts deferred to "once the chain-store accessor lands"). `anchorBytes`
   * is the canonical CORE — `encodeAnchor`, with `sig`/`keyId` EXCLUDED — the exact bytes the anchor
   * signature and the external message imprint are taken over, byte-identical to what `verify` reads
   * back and checks. Tenant-scoped through `withTenant`; reads the trusted write-once WORM object
   * (never a recompute). A missing anchor for a NON-empty chain throws `NotFoundError` — the same
   * fail-closed direction `verify()` takes, because that is corruption, not "no chain".
   */
  async readCurrentAnchor(accountId: string): Promise<{
    readonly length: number;
    readonly anchorBytes: Uint8Array;
  } | null> {
    return withTenant(this.db, accountId, async (tx) => {
      const entries = await loadEntries(tx, accountId);
      if (entries.length === 0) return null;
      const key = anchorKey(accountId, entries.length);
      const versionId = await recordedArtifactVersion(tx, accountId, key);
      const anchorObj = await this.store.get(key, versionId);
      assertRecordedArtifactVersion(key, versionId, anchorObj.versionId);
      const anchor = decodeAnchor(anchorObj.body);
      return { length: entries.length, anchorBytes: encodeAnchor(anchor) };
    });
  }

  /**
   * Read a single row's proof material: the entry at `seq`, its per-length WORM anchor (`anchor(seq+1)`
   * — the commitment minted when this row was the tip, so `anchor(seq+1).tipHash === row.hash` is a
   * genuine per-row check), and the chain length. Targeted single-row + single-anchor read (fork f —
   * one WORM GET per inspected row), tenant-scoped through `withTenant`.
   *
   * Fail-closed contract:
   *   - `seq` is bounded server-side to `0 <= seq < length` (L1). `seq == length` addresses
   *     `anchor(length+1)` — the truncation-probe key — and `seq > length` is out of range; both throw
   *     `ValidationError` (→ 400 at the route), NEVER a silent `unverifiable`.
   *   - A missing `anchor(seq+1)` returns `{ unverifiable: true, reason }` (matching `verify()`'s
   *     direction), never a fabricated pass (binding #6).
   *   - The WORM key is constructed SERVER-SIDE only, via `anchorKey`/`buildArtifactKey` (CR-07 §5).
   */
  async getRowProof(
    accountId: string,
    seq: number,
  ): Promise<RowProof | RowProofUnverifiable> {
    return withTenant(this.db, accountId, async (tx) => {
      // Target chain length from the tenant's OWN rows (RLS-scoped). For a healthy contiguous chain
      // count == length == maxSeq+1; any tamper that breaks that surfaces at chain-level `verify()`.
      const lenRes = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_chain_entry WHERE account_id = $1`,
        [accountId],
      );
      const chainLength = lenRes.rows[0]?.n ?? 0;

      // L1: valid rows are 0 .. length-1. Reject the truncation-probe boundary and beyond.
      if (!Number.isInteger(seq) || seq < 0 || seq >= chainLength) {
        throw new ValidationError("audit chain seq is out of range", {
          seq,
          chainLength,
        });
      }

      // Fork f: one WORM GET — the per-length anchor minted when this row was the tip.
      let anchorForRow: AuditChainAnchor;
      try {
        const key = anchorKey(accountId, seq + 1);
        const versionId = await recordedArtifactVersion(tx, accountId, key);
        const anchorObj = await this.store.get(key, versionId);
        assertRecordedArtifactVersion(key, versionId, anchorObj.versionId);
        anchorForRow = decodeAnchor(anchorObj.body);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return {
            unverifiable: true,
            reason: "per-length anchor is missing for this row",
          };
        }
        throw err;
      }

      const rowRes = await tx.query<ChainRow>(
        `SELECT seq, prev_hash, payload, hash
           FROM audit_chain_entry
          WHERE account_id = $1 AND seq = $2`,
        [accountId, seq],
      );
      const row = rowRes.rows[0];
      if (row === undefined) {
        // The COUNT said this seq exists but the targeted read found nothing (a concurrent change or
        // inconsistency). Fail closed rather than fabricate.
        return { unverifiable: true, reason: "row not found for seq" };
      }
      return { entry: toEntry(row), anchorForRow, chainLength };
    });
  }
}
