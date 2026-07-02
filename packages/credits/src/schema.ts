// The credit wallet + append-only ledger schema (ADR-0007/0023). Integer balance, signed-amount
// ledger (+grant / −debit), two partial-unique idempotency indexes, and a one-of-two CHECK so
// every row is covered by exactly one. A generic feature-meter envelope (ADR-0074) adds a `feature`
// payload column gated present-iff-feature-event by a CHECK. RLS via @caisson/tenancy-rls — the
// ledger is tenant-owned. In prod this is a numbered Drizzle migration (ADR-0014); the DDL is owned here.
import { buildTenantPolicySql } from "@caisson/tenancy-rls";

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
 * Rounding provenance (ADR-0206): the pre-rounding raw value + the site's rounding direction that
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
