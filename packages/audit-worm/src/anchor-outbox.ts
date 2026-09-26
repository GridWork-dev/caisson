// src/anchor-outbox.ts — the durable submission outbox for external anchoring (CR-02, ADR-0346 P4).
//
// The amendment's whole reason for existing: an anchoring submission has an unrecoverable crash window
// between "the TSA/log accepted the imprint" and "the receipt is durably written." The outbox closes
// it by persisting intent BEFORE egress and resolving a response-loss window to an operator
// reconciliation state — NEVER a blind duplicate submit (a blind retry against a PUBLIC log would mint
// a duplicate irrevocable entry; worse than a delayed checkpoint).
//
// This is a MUTABLE OPERATIONAL table (states transition) — the opposite of the WORM receipt objects,
// which is exactly why it is a Postgres row, not an ArtifactStore object (ADR-0346 P4). Every method
// is tenant-scoped through `withTenant` (the adopter `app` role, fail-closed RLS); the cross-tenant
// reconcile read the operator control plane needs rides the `admin_write` policy this schema grants —
// the SAME established pattern credit_wallet/entitlement_grant use (service-applied operational tables
// with an admin_write twin), NOT the compliance-edition migration assembler (which owns the adopter's
// immutable DATA schema — audit_chain/versions/field-crypto). The license service applies this SQL at
// deploy beside those tables, mirroring CREDIT_SCHEMA_SQL.
//
// State machine (persist-before-egress):
//   enqueuePending  → pending      (written BEFORE any network call)
//   markSubmitted   pending → submitted   (written BEFORE the submit() resolves)
//   markReceipted   submitted → receipted (terminal — the WORM receipt is durable)
//   markFailed      pending|submitted → failed (terminal)
//   markNeedsReconcile submitted → needs_reconcile (terminal — surfaced, never blind-retried)
//   markReceiptIdentityMissing receipted → needs_reconcile (legacy repair only: object identity absent)
// Transitions are DB-guarded (`… AND state IN (<from>) RETURNING id`): a `submitted` row can never be
// re-submitted because markSubmitted only fires from `pending`. "No second submit" is structural.
import { randomUUID } from "node:crypto";
import { ConflictError, InternalError, parseStrict } from "@caisson-sh/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import { assertValidArtifactVersionId } from "./store.ts";
import {
  anchorOutboxKeySchema,
  anchorOutboxRowSchema,
  type AnchorOutboxKey,
  type AnchorOutboxRow,
  type AnchorOutboxState,
} from "./anchor-transparency.ts";

/**
 * The `anchor_outbox` DDL — table + indexes + tenant RLS (NULLIF-hardened from birth) + a guarded
 * `admin_write` cross-tenant policy. Applied by the license service at deploy (like CREDIT_SCHEMA_SQL),
 * NOT by the compliance-edition migration assembler. The `app` role gets SELECT/INSERT/UPDATE — this is
 * mutable operational state, but never DELETE (rows are durable operational history). The admin_write
 * block is guarded for role absence (the same migrate-before-role-provisioned pattern the intel
 * findings-triage migration uses) so it applies on the live DB and no-ops on a fresh one, re-applied at
 * the operator-gated admin DEPLOY.
 */
export const ANCHOR_OUTBOX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS anchor_outbox (
  id            uuid        PRIMARY KEY,
  account_id    text        NOT NULL,
  target        text        NOT NULL,
  anchor_length integer     NOT NULL,
  anchor_digest text        NOT NULL,
  state         text        NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','submitted','receipted','failed','needs_reconcile')),
  last_error    text,
  receipt_version_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anchor_outbox_key_uniq UNIQUE (account_id, target, anchor_length, anchor_digest)
);

-- Existing deployments already have anchor_outbox; add the exact receipt identity append-only.
ALTER TABLE anchor_outbox
  ADD COLUMN IF NOT EXISTS receipt_version_id text;

-- Cross-tenant reconcile sweeps look up stuck rows by state (e.g. needs_reconcile / submitted).
CREATE INDEX IF NOT EXISTS anchor_outbox_state_idx ON anchor_outbox (state);

ALTER TABLE anchor_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_outbox FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON anchor_outbox TO app;
DROP POLICY IF EXISTS anchor_outbox_tenant_isolation ON anchor_outbox;
CREATE POLICY anchor_outbox_tenant_isolation ON anchor_outbox
  USING (account_id = NULLIF(current_setting('app.current_account', true), ''))
  WITH CHECK (account_id = NULLIF(current_setting('app.current_account', true), ''));

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_write') THEN
    GRANT SELECT, INSERT, UPDATE ON anchor_outbox TO admin_write;
    EXECUTE 'DROP POLICY IF EXISTS anchor_outbox_admin_write ON anchor_outbox';
    EXECUTE 'CREATE POLICY anchor_outbox_admin_write ON anchor_outbox TO admin_write USING (true) WITH CHECK (true)';
  END IF;
END $$;
`;

/** A row as it comes back from Postgres (snake_case). */
interface AnchorOutboxDbRow {
  readonly id: string;
  readonly account_id: string;
  readonly target: string;
  readonly anchor_length: number;
  readonly anchor_digest: string;
  readonly state: string;
  readonly last_error: string | null;
  readonly receipt_version_id: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

function toRow(r: AnchorOutboxDbRow): AnchorOutboxRow {
  return parseStrict(anchorOutboxRowSchema, {
    id: r.id,
    accountId: r.account_id,
    target: r.target,
    anchorLength: r.anchor_length,
    anchorDigest: r.anchor_digest,
    state: r.state,
    lastError: r.last_error,
    receiptVersionId: r.receipt_version_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

const SELECT_COLS = `id, account_id, target, anchor_length, anchor_digest, state, last_error, receipt_version_id, created_at, updated_at`;

async function selectRow(
  tx: TenantExecutor,
  key: AnchorOutboxKey,
): Promise<AnchorOutboxDbRow | null> {
  const res = await tx.query<AnchorOutboxDbRow>(
    `SELECT ${SELECT_COLS} FROM anchor_outbox
      WHERE account_id = $1 AND target = $2 AND anchor_length = $3 AND anchor_digest = $4`,
    [key.accountId, key.target, key.anchorLength, key.anchorDigest],
  );
  return res.rows[0] ?? null;
}

/**
 * The durable-outbox store. One instance binds a tenant `Transactor`; every method runs under
 * `withTenant`, so a row can never be read or written outside its own tenant (fail-closed RLS).
 */
export class AnchorOutbox {
  readonly #db: Transactor;

  constructor(db: Transactor) {
    this.#db = db;
  }

  /** The current row for a key, or null. Tenant-scoped. */
  async get(key: AnchorOutboxKey): Promise<AnchorOutboxRow | null> {
    const k = parseStrict(anchorOutboxKeySchema, key);
    return withTenant(this.#db, k.accountId, async (tx) => {
      const row = await selectRow(tx, k);
      return row === null ? null : toRow(row);
    });
  }

  /**
   * Persist intent BEFORE egress: insert a `pending` row (idempotent on the natural key). Returns the
   * CURRENT row whether just-created or pre-existing — the caller inspects its `state` to decide
   * whether to (re)submit a `pending` row, skip a terminal one, or reconcile a `submitted` one. The
   * insert never resurrects a terminal row (ON CONFLICT DO NOTHING leaves its state intact).
   */
  async enqueuePending(key: AnchorOutboxKey): Promise<AnchorOutboxRow> {
    const k = parseStrict(anchorOutboxKeySchema, key);
    return withTenant(this.#db, k.accountId, async (tx) => {
      await tx.query(
        `INSERT INTO anchor_outbox (id, account_id, target, anchor_length, anchor_digest, state)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (account_id, target, anchor_length, anchor_digest) DO NOTHING`,
        [randomUUID(), k.accountId, k.target, k.anchorLength, k.anchorDigest],
      );
      const row = await selectRow(tx, k);
      if (row === null) {
        // Unreachable: the INSERT-or-existing row must be present. Fail closed rather than guess.
        throw new InternalError("anchor_outbox row vanished after enqueue", {
          accountId: k.accountId,
        });
      }
      return toRow(row);
    });
  }

  /** pending → submitted, written BEFORE the network submit resolves (the egress fence). */
  async markSubmitted(key: AnchorOutboxKey): Promise<void> {
    await this.#transition(key, ["pending"], "submitted", null);
  }

  /** submitted → receipted (terminal: the WORM receipt is durably written). */
  async markReceipted(
    key: AnchorOutboxKey,
    receiptVersionId?: string,
  ): Promise<void> {
    if (receiptVersionId !== undefined) {
      assertValidArtifactVersionId(receiptVersionId);
    }
    await this.#transition(
      key,
      ["submitted"],
      "receipted",
      null,
      receiptVersionId,
    );
  }

  /** pending|submitted → failed (terminal). `error` is a short, non-secret message. */
  async markFailed(key: AnchorOutboxKey, error: string): Promise<void> {
    await this.#transition(key, ["pending", "submitted"], "failed", error);
  }

  /**
   * submitted → needs_reconcile (terminal). The response-loss resolution: the TSA/log MAY have
   * accepted the imprint but the receipt was lost — surfaced to the operator, never blind-retried.
   */
  async markNeedsReconcile(key: AnchorOutboxKey, error: string): Promise<void> {
    await this.#transition(key, ["submitted"], "needs_reconcile", error);
  }

  /**
   * Legacy repair: a row marked receipted before provider version identities were persisted cannot
   * prove which immutable object was accepted. Demote it to reconciliation instead of trusting the
   * provider's mutable current pointer.
   */
  async markReceiptIdentityMissing(
    key: AnchorOutboxKey,
    error: string,
  ): Promise<void> {
    await this.#transition(key, ["receipted"], "needs_reconcile", error);
  }

  /**
   * Guarded transition: UPDATE only when the row is in an expected `from` state, proven by
   * `RETURNING id` (an empty result = the state moved underneath, so we refuse rather than force it).
   * This is what makes "no second submit" structural — markSubmitted's only `from` is `pending`, so a
   * `submitted`/`needs_reconcile` row can never be re-submitted.
   */
  async #transition(
    key: AnchorOutboxKey,
    from: readonly AnchorOutboxState[],
    to: AnchorOutboxState,
    lastError: string | null,
    receiptVersionId?: string,
  ): Promise<void> {
    const k = parseStrict(anchorOutboxKeySchema, key);
    await withTenant(this.#db, k.accountId, async (tx) => {
      const res = await tx.query<{ id: string }>(
        `UPDATE anchor_outbox
            SET state = $1, last_error = $2,
                receipt_version_id = COALESCE($3, receipt_version_id), updated_at = now()
          WHERE account_id = $4 AND target = $5 AND anchor_length = $6 AND anchor_digest = $7
            AND state = ANY($8::text[])
        RETURNING id`,
        [
          to,
          lastError,
          receiptVersionId ?? null,
          k.accountId,
          k.target,
          k.anchorLength,
          k.anchorDigest,
          [...from],
        ],
      );
      if (res.rows.length !== 1) {
        throw new ConflictError("illegal anchor_outbox state transition", {
          to,
          expectedFrom: [...from],
        });
      }
    });
  }
}
