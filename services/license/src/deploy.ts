// src/deploy.ts — the production deploy entrypoint (Stage-2, ADR-0110/0139). server.ts's
// `import.meta.main` is a deliberate hard stop: `startServer(db)` takes the tenant Transactor as an
// injected argument and the repo has no in-tree production Postgres pool. This file supplies one — a
// node-postgres Pool over DATABASE_URL wrapped in a Transactor — and calls startServer(db).
//
import { createPgPool, createPgTransactor } from "@caisson/tenancy-rls";
import { startServer } from "./server.ts";

if (import.meta.main) {
  // Fail closed: a production issuer must NEVER fall back to an in-memory PGlite double the way
  // apps/site's dev-only getDb does. An unset DATABASE_URL aborts startup before the socket binds,
  // matching server.ts's fail-closed posture on the token + signing key. Never log the URL.
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the license issuer needs a Postgres Transactor) — refusing to start.",
    );
  }
  const pool = createPgPool(url);
  const db = createPgTransactor(pool);
  // Bun.serve inside startServer holds the event loop open — the process stays up serving.
  startServer(db);
}
