-- 0003_agent_run_state_parked_state_encrypted.sql — ADR-0361: parked_state stores a
-- @caisson/field-crypto envelope (base64 TEXT, row-bound to run_id via encryptField/decryptField),
-- never a plaintext jsonb body. S3 (0002) shipped `parked_state jsonb` carrying the raw
-- conversation/tool-call snapshot in the clear, accepted PRE-PUBLISH ONLY (ADR-0361) — this is the
-- S5 gate that closes it before the runtime can be sold.
--
-- ADR-0006 (append-only) forbids editing an already-shipped migration's bytes; this is a NEW
-- migration, not an edit of 0002. No buyer data exists yet (pre-publish, ADR-0361 — the package
-- ships `sellable: false` through this same slice's start), so widening the column type
-- DESTRUCTIVELY (`USING NULL`) is correct: any pre-existing parked_state value was never a real
-- buyer's data, and a jsonb→text cast of a real payload would just produce un-decryptable text
-- (it was never a field-crypto envelope) — NULLing it is honest, not lossy in any way that matters.
--
-- WARNING for a future maintainer: `USING NULL` is safe HERE only because 0.2.0 was never deployed
-- to a populated buyer database (`sellable: false`, pre-publish). Never reuse this destructive-cast
-- pattern on a column any live deployment might hold real rows in — that would be silent data loss.

ALTER TABLE agent_run_state ALTER COLUMN parked_state TYPE text USING NULL;
