// The full node-capable barrel: everything on `./browser` (the strict event schema, the in-memory
// append-only store, the run-state port, both projections, the transcript adapter) plus the two
// Postgres-backed store implementations, which cannot enter a client bundle. The shared half lives
// in exactly one list (src/browser.ts), so `.` is a superset of `./browser` by construction
// (ADR-0396 subset discipline); every name this barrel exported before still resolves here.
export * from "./browser.ts";
// PG-backed TrajectoryStore (ADR-0360 U-3, S3): additive, mirrors the memory impl's contract.
export { createPgTrajectoryStore } from "./store.pg.ts";
// The PG-backed run-state store (ADR-0360 U-3, S3): CAS-guarded, snapshot encrypted at rest.
export {
  createPgRunStateStore,
  type RunStateCryptoContextRunner,
} from "./run-state.pg.ts";
