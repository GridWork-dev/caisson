// The credit wallet + append-only ledger schema (ADR-0007/0023). Integer balance, signed-amount
// ledger (+grant / −debit), two partial-unique idempotency indexes, and a one-of-two CHECK so
// every row is covered by exactly one. RLS via @stack/tenancy-rls — the ledger is tenant-owned.
// In prod this is a numbered Drizzle migration (ADR-0014); the DDL is owned here.
import { buildTenantPolicySql } from "@stack/tenancy-rls";

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
  source_event_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- exactly one idempotency source per row (ADR-0024)
  CONSTRAINT credit_event_one_idem CHECK (
    (source_event_id IS NOT NULL)::int + (idempotency_key IS NOT NULL)::int = 1
  ),
  CONSTRAINT credit_event_amount_nonzero CHECK (amount <> 0)
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
