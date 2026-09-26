// The browser-safe entry (`@caisson-sh/local-store/browser`): the Reciprocal Rank Fusion arithmetic
// and its constant — the one part of this package that does not need a database. Fuse leg rankings
// a server (or a worker) already produced, inside a client bundle. ADDITIVE — the `.` barrel is
// untouched and stays the full surface; every name here is also on `.` (the subset test in
// browser-safety.test.ts pins that direction, one way only).
//
// DELIBERATELY EXCLUDED, and not completable: `LocalStore` and `openTenantDb` are `bun:sqlite` +
// the `sqlite-vec` native extension, and `gc.ts` hashes with node:crypto. The vec0 KNN leg and the
// FTS5 bm25 leg need a real SQLite extension host — there is no browser form of them, which is
// exactly why the fusion is the part that carves out.
export * from "./rrf.ts";
