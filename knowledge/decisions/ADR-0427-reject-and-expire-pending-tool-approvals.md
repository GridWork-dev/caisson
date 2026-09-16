# ADR-0427 — Reject and expire pending tool approvals

- Date: 2026-09-16
- Status: Accepted — operator S8_REPAIRS_2 / WR-01 (R359 continuation)
- Scope: pending tool approval lifetime and capacity
- Supersedes: ADR-0423 no-expiry policy and consume-only store interface

## Decision

ToolExec.reject(approvalId) validates the UUID and atomically deletes the pending record
without returning execution data or spawning. It returns true for a removed pending
record, false for missing/expired/consumed IDs. Caller authorization remains mandatory.
Rejection and execution consume compete for one deletion; a rejection cannot revoke an
execution that already consumed the record. Rejected IDs cannot be replayed.

Every proposal has a digest-bound expiresAt equal to issuance time plus a fixed fifteen
minutes (APPROVAL_TTL_MS). No renewal or client-selected lifetime is accepted. The existing
injected clock supplies epoch milliseconds; production uses Date.now. Execution rechecks
expiry after its awaited atomic consume, so an expired record returned by a durable
adapter cannot spawn. Applications must provide trustworthy clocks and private stores.

The memory store prunes expired entries before put/reject and discards expired consumes.
Thus abandoned records no longer permanently occupy its 1,000-slot bound. Idle expired
entries may remain allocated until an operation, but are bounded and have no execution
authority. Durable adapters must provide mutually atomic consume/reject, enforce expiry,
and reclaim expired capacity using the same clock domain. Restart behavior and all other
ADR-0423 digest, policy, schema, environment and caller-authentication rules remain.

## Verification and compatibility

Tests cover 1,000 rejected and 1,000 expired records reclaiming capacity, exact expiry,
no spawn or replay after rejection, both rejection/consumption race orders, and an expired
record returned by a durable adapter. A caller cannot alter the digest-bound timestamp.
Named mutation arms and restoration hashes are in RUN-NOTES. The pending tool-exec minor
changeset includes the new public timestamp and required store.reject adapter method.
