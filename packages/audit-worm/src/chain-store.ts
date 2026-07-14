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
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  anchorChain,
  canonicalize,
  chainEntry,
  ConflictError,
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
} from "@caisson/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
import {
  ArtifactExistsError,
  buildArtifactKey,
  type ArtifactStore,
} from "./store.ts";
import { DEFAULT_RETENTION_YEARS, retainUntilFrom } from "./retain.ts";

/** Advisory-lock namespace so audit-chain locks never collide with another subsystem's keyspace. */
const LOCK_NAMESPACE = "caisson.audit-chain";
/** WORM key layout: `{account_id}/audit-chain/anchors/<zero-padded length>.json`. */
const ANCHOR_SEGMENT = "audit-chain";
const ANCHOR_DIR = "anchors";
/** Zero-pad the length so anchor keys sort lexicographically and never collide across magnitudes. */
const LENGTH_PAD = 12;

/** The trusted anchor body, validated on read back from the (possibly remote) WORM store. */
const anchorSchema = strictObject({
  length: z.number().int().nonnegative(),
  tipHash: z.string().min(1),
  genesisHash: z.string().min(1).optional(),
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

function encodeAnchor(anchor: AuditChainAnchor): Uint8Array {
  // The anchor is a trusted commitment — store its CANONICAL bytes so the stored form is
  // deterministic and reproducible (the same hash discipline the chain itself uses).
  const obj: { [key: string]: JsonValue } = {
    length: anchor.length,
    tipHash: anchor.tipHash,
  };
  if (anchor.genesisHash !== undefined) obj.genesisHash = anchor.genesisHash;
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
  // Build to the exact-optional shape: only carry `genesisHash` when it is actually present (Zod's
  // `.optional()` widens to `string | undefined`, which exactOptionalPropertyTypes rejects).
  return a.genesisHash === undefined
    ? { length: a.length, tipHash: a.tipHash }
    : { length: a.length, tipHash: a.tipHash, genesisHash: a.genesisHash };
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

export interface AuditChainStoreOptions {
  /** A transactor over the tenant DB (PGlite, node-postgres, Drizzle) — appends run under RLS. */
  readonly db: Transactor;
  /** The WORM store the trusted anchor is written to, write-once (`ArtifactStore`). */
  readonly store: ArtifactStore;
  /** Clock injected at the edge so anchor retention is deterministic + testable. Default: wall clock. */
  readonly now?: () => Date;
  /** WORM retention term (years) for the anchor object. Default: the `retain.ts` legal floor. */
  readonly retentionYears?: number;
}

/** The result of one append: the new entry and the anchor minted over the resulting chain. */
export interface AppendResult {
  readonly entry: AuditChainEntry;
  readonly anchor: AuditChainAnchor;
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

  constructor(opts: AuditChainStoreOptions) {
    this.db = opts.db;
    this.store = opts.store;
    this.now = opts.now ?? ((): Date => new Date());
    this.retentionYears = opts.retentionYears ?? DEFAULT_RETENTION_YEARS;
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

      // The trusted commitment lands in WORM under a LENGTH-keyed, write-once key. A second anchor
      // for the same length (a truncate-then-re-append, a replay) hits the existing immutable object
      // → ArtifactExistsError → ConflictError: the original tip can never be overwritten.
      try {
        await this.store.put(
          anchorKey(accountId, anchor.length),
          encodeAnchor(anchor),
          {
            retainUntil,
            contentType: "application/json",
          },
        );
      } catch (err) {
        if (err instanceof ArtifactExistsError) {
          throw new ConflictError(
            "audit chain anchor already exists for this length",
            { accountId, length: anchor.length },
          );
        }
        throw err;
      }

      return { entry, anchor };
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
      const beyond = await this.store.head(
        anchorKey(accountId, entries.length + 1),
      );
      if (beyond !== null) {
        return { valid: false, brokenAt: entries.length };
      }
      if (entries.length === 0) {
        return { valid: true, brokenAt: null };
      }

      const anchorObj = await this.store.get(
        anchorKey(accountId, entries.length),
      );
      const anchor = decodeAnchor(anchorObj.body);
      return verifyChain(entries, anchor);
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
        const anchorObj = await this.store.get(anchorKey(accountId, seq + 1));
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
