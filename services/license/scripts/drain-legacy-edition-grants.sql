-- drain-legacy-edition-grants.sql — ADR-0270 §4 (edition-trace purge, data-migration).
--
-- One-time, operator-gated, pre-launch cleanup of any `entitlement_grant` rows still keyed to a
-- DISSOLVED EDITION id (`ai-kit` / `local-ai` / `agent-dev` / `bundle`). ADR-0270 narrowed the purchase-
-- alias spine to empty, so those ids no longer normalize to a bundle at the fail-closed resolver — a row
-- left carrying one would resolve to just its meta package (an under-grant). This migrates each such row
-- to its canonical bundle id so a test grant keeps working; the operator deletes disposable fixtures by
-- hand. Idempotent (a re-run finds zero legacy rows and no-ops), self-verifying (raises if any remain).
--
-- ⚠ DO NOT auto-apply. This is NOT wired into the `@caisson/migrate` platform path (deploy-migrate.ts);
--   it is run MANUALLY at DEPLOY, per the §4 runbook, AFTER the read-only enumerate below proves the
--   real-buyer count is zero. Never run it from a worktree or CI.
--
-- ⚠ RLS: `entitlement_grant` is FORCE ROW LEVEL SECURITY. Run this (and the enumerate) as the SUPERUSER
--   deploy role (the same role deploy-migrate.ts connects as — it bypasses FORCE RLS), NEVER the `app`
--   role, or RLS scopes the session to one tenant and the drain silently no-ops.
--
-- STEP 1 — ENUMERATE (read-only; run FIRST, eyeball every row, confirm real-buyer count = 0 with the
-- operator; if ANY row is a genuine real buyer, STOP — grandfathering is back on the table, ADR-0270 §4.2):
--
--   SELECT account_id, entitlement_id, source_kind, subscription_id, purchase_id, status, granted_at
--     FROM entitlement_grant
--    WHERE entitlement_id IN ('ai-kit','local-ai','agent-dev','bundle')
--    ORDER BY entitlement_id, account_id;
--
-- STEP 2 — MIGRATE (the block below). Logs each pair's migrated + de-duplicated counts, then proves empty.

DO $$
DECLARE
  pair record;
  migrated int;
  deleted int;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('ai-kit',    'ai-production'),
      ('local-ai',  'local-first'),
      ('agent-dev', 'agentic-dev'),
      ('bundle',    'everything')
    ) AS m(legacy, canonical)
  LOOP
    -- A legacy row whose canonical twin already exists on the SAME grant slot would violate
    -- entitlement_grant_uniq on rename — delete the legacy duplicate instead (the canonical row already
    -- carries the entitlement). `IS NOT DISTINCT FROM` matches the index's COALESCE(sub,purchase) NULL slot.
    DELETE FROM entitlement_grant g
     WHERE g.entitlement_id = pair.legacy
       AND EXISTS (
         SELECT 1 FROM entitlement_grant c
          WHERE c.account_id = g.account_id
            AND c.entitlement_id = pair.canonical
            AND c.source_kind = g.source_kind
            AND COALESCE(c.subscription_id, c.purchase_id)
                  IS NOT DISTINCT FROM COALESCE(g.subscription_id, g.purchase_id)
            AND COALESCE(c.line_item_id, '') = COALESCE(g.line_item_id, '')
       );
    GET DIAGNOSTICS deleted = ROW_COUNT;

    -- Migrate the remaining legacy rows to the canonical bundle id.
    UPDATE entitlement_grant
       SET entitlement_id = pair.canonical
     WHERE entitlement_id = pair.legacy;
    GET DIAGNOSTICS migrated = ROW_COUNT;

    RAISE NOTICE 'drain %  ->  %: migrated % row(s), removed % colliding duplicate(s)',
      pair.legacy, pair.canonical, migrated, deleted;
  END LOOP;

  -- Prove-empty gate (ADR-0270 §4.4): the goal-backward proof the emptied aliases lock no one out.
  IF EXISTS (
    SELECT 1 FROM entitlement_grant
     WHERE entitlement_id IN ('ai-kit','local-ai','agent-dev','bundle')
  ) THEN
    RAISE EXCEPTION 'drain incomplete: legacy edition grant rows still remain';
  END IF;

  RAISE NOTICE 'drain complete: zero legacy edition grant rows remain';
END $$;
