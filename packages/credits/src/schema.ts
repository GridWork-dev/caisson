// The credit wallet + append-only ledger schema (ADR-0007/0023). Integer balance, signed-amount
// ledger (+grant / −debit), two partial-unique idempotency indexes, and a one-of-two CHECK so
// every row is covered by exactly one. A generic feature-meter envelope (ADR-0074) adds a `feature`
// payload column gated present-iff-feature-event by a CHECK. RLS via @caisson-sh/tenancy-rls — the
// ledger is tenant-owned. In prod this is a numbered Drizzle migration (ADR-0014); the DDL is owned here.
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";

export const CREDIT_SCHEMA_SQL = `
CREATE TABLE credit_wallet (
  account_id text PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  CONSTRAINT credit_wallet_balance_nonneg CHECK (balance >= 0)
);

CREATE TABLE credit_event (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  event_type text NOT NULL,
  amount integer NOT NULL,
  -- The per-action discriminator for a generic feature meter (ADR-0074). Payload, NOT part of the
  -- idempotency key — present iff event_type is feature_debit/feature_grant (CHECK below). The value
  -- is validated against the registered feature-tag set at the credit boundary, not by the DB.
  feature text,
  source_event_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- exactly one idempotency source per row (ADR-0024)
  CONSTRAINT credit_event_one_idem CHECK (
    (source_event_id IS NOT NULL)::int + (idempotency_key IS NOT NULL)::int = 1
  ),
  CONSTRAINT credit_event_amount_nonzero CHECK (amount <> 0),
  -- feature tag present IFF this is a generic feature event (ADR-0074): legacy specific types carry
  -- no feature; feature_debit/feature_grant must. Both sides are booleans, so '=' is the biconditional.
  CONSTRAINT credit_event_feature_iff CHECK (
    (feature IS NOT NULL) = (event_type IN ('feature_debit', 'feature_grant'))
  )
);

-- External-event idempotency: one ledger effect per (provider event, type).
CREATE UNIQUE INDEX credit_event_source_uniq
  ON credit_event (source_event_id, event_type)
  WHERE source_event_id IS NOT NULL;

-- Internal/client idempotency: per-account caller-supplied key.
CREATE UNIQUE INDEX credit_event_idem_uniq
  ON credit_event (account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

${buildTenantPolicySql("credit_wallet")}
${buildTenantPolicySql("credit_event")}
`;

/**
 * Rounding provenance (ADR-0212): the pre-rounding raw value + the site's rounding direction that
 * produced `amount`, persisted so a grant/debit is auditable after the fact. Both columns nullable —
 * a row from a rounding site carries both; a row whose amount is an EXACT table integer (an
 * apply-billing-event grant, ADR-0089 §5) carries NULL/NULL. The biconditional CHECK mirrors the
 * `credit_event_feature_iff` idiom above; the mode CHECK closes the enum. ADR-0007 untouched:
 * `amount` stays the stored integer — provenance only DESCRIBES the rounding.
 *
 * A SEPARATE migration, not an edit to CREDIT_SCHEMA_SQL: that string ships as the checksum-pinned
 * `0002_credits.sql` platform migration (apps/site deploy-migrate) — editing it in place would fail
 * the runner CLOSED on the live DB (ADR-0006 append-only). Apply this AFTER CREDIT_SCHEMA_SQL
 * everywhere the table is bootstrapped (mirrors ENTITLEMENT_GRANT_MIGRATION_SQL's convention).
 */
export const CREDIT_ROUNDING_MIGRATION_SQL = `
ALTER TABLE credit_event
  ADD COLUMN rounding_raw integer,
  ADD COLUMN rounding_mode text;
ALTER TABLE credit_event
  ADD CONSTRAINT credit_event_rounding_iff CHECK (
    (rounding_raw IS NOT NULL) = (rounding_mode IS NOT NULL)
  ),
  ADD CONSTRAINT credit_event_rounding_mode CHECK (
    rounding_mode IS NULL OR rounding_mode IN ('up', 'down')
  );
`;

/**
 * Per-line grant provenance for Paddle per-line partial refunds (ADR-0218, fork C-b: columns, not a
 * side-table). `line_item_id` is the Paddle transaction-item id (`txnitm_…`) that granted this row's
 * credits — the join key a later per-line adjustment refund reads to claw back only THAT line's
 * credits. `line_charged_amount` is the line's charged minor units (from the transaction's
 * `details.line_items[].totals.total`), persisted so a dollar-PARTIAL adjustment can claw a
 * PROPORTIONAL credit amount (`floor(granted * refunded / charged)`) without re-deriving from a
 * possibly-changed pricebook. Both nullable: a subscription/single-source grant carries neither.
 *
 * The `credit_event_source_uniq` index gains `COALESCE(line_item_id, '')` so the N per-line `purchase`
 * rows of one multi-item cart — all sharing the transaction id as `source_event_id` — stay DISTINCT
 * instead of collapsing to one via `ON CONFLICT DO NOTHING` (which would silently under-grant every
 * line past the first). A row without a line item (`line_item_id` NULL → '') keeps its prior
 * uniqueness exactly, so all existing grant/debit/clawback idempotency is byte-identical.
 *
 * SEPARATE migration, not an edit to CREDIT_SCHEMA_SQL / CREDIT_ROUNDING_MIGRATION_SQL: both ship as
 * checksum-pinned platform migrations (apps/site deploy-migrate) — editing either in place would fail
 * the runner CLOSED on the live DB (ADR-0006 append-only). Apply AFTER both, everywhere the table is
 * bootstrapped that grants a one-time purchase or claws a per-line refund.
 */
export const CREDIT_LINE_ITEM_MIGRATION_SQL = `
ALTER TABLE credit_event
  ADD COLUMN line_item_id text,
  ADD COLUMN line_charged_amount integer;
DROP INDEX credit_event_source_uniq;
CREATE UNIQUE INDEX credit_event_source_uniq
  ON credit_event (source_event_id, event_type, COALESCE(line_item_id, ''))
  WHERE source_event_id IS NOT NULL;
`;

/**
 * Grant-level expiry (ADR-0245/0252): nullable `expires_at` on `credit_event`, populated on
 * grant rows only (`grant()` sets it application-side, default issue + 12 months, overridable per
 * grant class). The backfill retro-dates every pre-existing grant row `created_at + 12 months`
 * (ADR-0252 Decision 4 — the live rows are Paddle-SANDBOX pipeline proofs, not customer money, so
 * a permanent `NULL = never expires` two-tier ledger is not worth protecting test data).
 *
 * SEPARATE migration (ships as the checksum-pinned `0014_credit_expiry.sql`), never an edit to
 * CREDIT_SCHEMA_SQL / the earlier constants (ADR-0006 append-only). Apply AFTER them everywhere
 * the table is bootstrapped — `grant()` writes `expires_at` unconditionally (mirrors the
 * rounding columns' convention, not the caller-gated line-item columns).
 */
export const CREDIT_EXPIRY_MIGRATION_SQL = `
ALTER TABLE credit_event
  ADD COLUMN expires_at timestamptz;
UPDATE credit_event
  SET expires_at = created_at + interval '12 months'
  WHERE amount > 0;
`;

/**
 * FIFO burn materialization + T-30d notice marker (ADR-0252 Decisions 2/6). Ships as the
 * checksum-pinned `0015_grant_consumption.sql`; apply AFTER CREDIT_EXPIRY_MIGRATION_SQL.
 *
 * `grant_consumption` is the append-only join table recording which grant(s) each debit consumed:
 * the debit path walks unexpired grants in burn order (`created_at ASC, expires_at ASC, id ASC`)
 * and writes 1..k rows, splitting across grants when one remainder can't cover the debit. A grant's
 * remaining balance is always `amount - SUM(gc.amount)` over the indexed `grant_event_id` —
 * never a mutated column (ADR-0007 append-only). Rows are only ever inserted, never updated.
 *
 * `credit_expiry_notice` is the per-grant already-notified marker for the T-30d expiry email
 * (ADR-0252 Decision 6): one row per grant, inserted `ON CONFLICT DO NOTHING`, so the notice
 * fires exactly once — an append-only marker table, NOT a mutated column on `credit_event`.
 *
 * Both carry `account_id` + the standard tenant policy: they are tenant-owned money/PII-adjacent
 * data, and the fail-closed RLS floor (ADR-0005) binds every tenant table — the ADR-0252 column
 * list is the minimum, not a licence to skip isolation.
 */
export const GRANT_CONSUMPTION_MIGRATION_SQL = `
CREATE TABLE grant_consumption (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  grant_event_id text NOT NULL,
  debit_event_id text NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grant_consumption_amount_positive CHECK (amount > 0)
);
CREATE INDEX grant_consumption_grant_idx ON grant_consumption (grant_event_id);

CREATE TABLE credit_expiry_notice (
  grant_event_id text PRIMARY KEY,
  account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

${buildTenantPolicySql("grant_consumption")}
${buildTenantPolicySql("credit_expiry_notice")}
`;
