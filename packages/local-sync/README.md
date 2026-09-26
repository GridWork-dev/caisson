# @caisson-sh/local-sync

The Local-first edition's sync engine: an in-house, application-layer changeset log (`bun:sqlite`
exposes no `sqlite3session_*` API, so this is the app-layer analog), a hybrid-logical-clock LWW
merge, and tombstone persistence with horizon GC — converging any number of per-tenant replicas
onto one canonical local store. A base primitive (Apache-2.0).

## What it gives you

- **`ChangesetLog`** — per-tenant change capture bound to one already-open SQLite file (the file IS
  the tenant partition, ADR-0073). `recordUpsert` / `recordDelete` mirror local writes;
  `capture(sinceSeq)` packages everything past a watermark into a tenant-bound, replica-stamped
  `Changeset` a peer can pull. `assertApplicable` fails closed on a cross-tenant changeset.
- **`reconcileReplicas`** — a pure, deterministic last-writer-wins merge over any number of
  replicas' changesets, keyed by the `HlcStamp` (physical time → replica id → per-replica
  sequence), so the winner is unambiguous and input-order-independent even under clock skew.
- **Tombstone-aware convergence** (`reconcileWithTombstones` / `gcTombstones`) — a durable
  tombstone index so a later, incomplete batch can't resurrect a row a peer already deleted; a
  strictly-greater-stamped upsert still legitimately un-deletes it.

## One entry point, browser-safe

`@caisson-sh/local-sync` has a single `.` entry and it reaches no Node builtin, so the merge, the
clock, and the changeset types can be imported inside a client bundle as-is. The replica id is
minted with the runtime's built-in WebCrypto `crypto.randomUUID()` (Node 20.12 or later);
`bun:sqlite` appears only as an erased type import, so nothing pulls SQLite into a browser graph.
`src/browser-safety.test.ts` proves this with a static source-graph walk, not a bundler exit code.

## Install

```bash
bun add @caisson-sh/local-sync
```

## Use

```ts
import { ChangesetLog, reconcileReplicas } from "@caisson-sh/local-sync";
import { Database } from "bun:sqlite";

const log = ChangesetLog.open(new Database(":memory:"), "tenant-a");
log.recordUpsert("notes", "n1", { title: "hello" });

const changeset = log.capture(0); // everything since watermark 0

const converged = reconcileReplicas([changeset]); // [{ table: "notes", pk: "n1", values: {...} }]
```

## Tests

`bun test packages/local-sync/src` — changeset capture + the tenant-partition guard, the LWW merge
truth table (including order-independence and delete-wins-no-resurrection), the HLC total order,
tombstone GC, and a full multi-replica convergence integration test.

License: Apache-2.0.
