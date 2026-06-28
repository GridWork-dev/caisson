-- 0001_audit_chain.sql — append-only audit-chain entry table (ADR-0052, ADR-0014).
--
-- The tamper-evidence floor for the Compliance edition (the SEC 17a-4 audit-trail alternative
-- path): one immutable, SHA-256 hash-chained row per audit event, scoped per tenant and serialized
-- by `seq`. Immutability is enforced at the GRANT level — the `app` role may SELECT + INSERT but is
-- NEVER granted UPDATE or DELETE, so a compromised or buggy app query can append but can never
-- rewrite or drop a committed entry (TM-D). FORCE RLS keeps the table tenant-isolated even for the
-- table owner (ADR-0005). The trusted {length,tipHash,genesisHash} anchor that catches tail
-- truncation + wholesale rewrite lives OUTSIDE this table, write-once, in the WORM ArtifactStore
-- (ADR-0054) — see chain-store.ts.
--
-- The RLS block below (ENABLE + FORCE + the GUC-bound isolation policy) is byte-identical to
-- `buildTenantPolicySql('audit_chain_entry')` from @caisson/tenancy-rls, MINUS its
-- GRANT … UPDATE, DELETE — the chain-store integration test pins that correspondence so the two
-- can never drift. Append-only is a withheld privilege, not a trigger we could forget.

CREATE TABLE IF NOT EXISTS audit_chain_entry (
  id          uuid        PRIMARY KEY,
  account_id  text        NOT NULL,
  seq         integer     NOT NULL,
  prev_hash   text,
  payload     jsonb       NOT NULL,
  hash        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One chain per tenant: `seq` is dense + unique within an account. A concurrent append that
  -- reads the same tip and mints the same seq loses on this constraint (23505 → ConflictError →
  -- caller retries), so the chain can never fork even if the advisory lock is ever bypassed.
  CONSTRAINT audit_chain_entry_account_seq_uniq UNIQUE (account_id, seq),
  -- Structural belt: genesis (seq 0) has a null prev_hash; every later entry binds a predecessor.
  CONSTRAINT audit_chain_entry_genesis_prev_null CHECK ((seq = 0) = (prev_hash IS NULL))
);

ALTER TABLE audit_chain_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_entry FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON audit_chain_entry TO app;
CREATE POLICY audit_chain_entry_tenant_isolation ON audit_chain_entry
  USING (account_id = current_setting('app.current_account', true))
  WITH CHECK (account_id = current_setting('app.current_account', true));
