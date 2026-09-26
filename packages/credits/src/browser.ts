// The browser-safe entry (`@caisson-sh/credits/browser`, ADR-0396): the wallet's PURE half only —
// the grant/debit event vocabulary and the FIFO consumption waterfall.
//
// The money half that touches a database is deliberately NOT here and never joins this entry:
// `grant`, `debit`, `clawback`, `balance`/`spendableBalance`, the ledger reads, the expiry sweeps,
// and the schema SQL all take a `@caisson-sh/tenancy-rls` TenantExecutor, run SQL, and reach
// `node:crypto` — they stay on `.`, which is unchanged. Admission rule: a module joins this entry
// only when its whole value-import graph passes the static source-graph walk in
// `browser-safety.test.ts` (a bundler proves nothing — it substitutes a polyfill for a node
// builtin and exits 0).
//
// Subset discipline is one-way: every runtime name here is also on `.`, never the reverse. The
// names are listed explicitly rather than re-exported wholesale so an internal helper gaining an
// `export` in `fifo.ts` cannot silently widen the published entry.
export { DEBIT_EVENT_TYPES, GRANT_EVENT_TYPES, planFifoDebit } from "./fifo.ts";
export type {
  DebitEventType,
  FifoDebitPlan,
  FifoDraw,
  GrantEventType,
  GrantRemainder,
} from "./fifo.ts";
