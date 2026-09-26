# @caisson/tenancy-rls

Fail-closed multi-tenant Postgres RLS (FORCE policies + schema test).

- **Layer:** base

Real src + tests: fail-closed RLS. Small by design — the guard is the whole package.

## ORM adapter family (ADR-0266)

`withTenant`'s `TenantExecutor` port is raw SQL (`query(sql, params)` / `exec(sql)`) — the fail-closed
guarantee is enforced by Postgres RLS, not by any particular query-building style. Apps that already
have Drizzle or Prisma can bridge straight through the same `TenantExecutor` instead of
hand-writing raw SQL for every tenant-scoped call.

### Drizzle — `.toSQL()` bridge

```ts
import { withTenant, queryDrizzle, execDrizzle } from "@caisson/tenancy-rls";

const rows = await withTenant(db, accountId, async (tx) => {
  const { rows } = await queryDrizzle(tx, drizzleDb.select().from(documents));
  return rows;
});

await withTenant(db, accountId, (tx) =>
  execDrizzle(tx, drizzleDb.insert(documents).values({ accountId, title })),
);
```

`queryDrizzle`/`execDrizzle` accept anything exposing `.toSQL(): { sql, params }` — a real
`drizzle-orm` query builder chain, or any object shaped the same way — and feed it through the
unmodified `TenantExecutor`. No runtime `drizzle-orm` dependency in this package; it's a
devDependency here for the tests only. RLS still does the isolation, so a Drizzle query that
forgets its own `.where(eq(documents.accountId, accountId))` still comes back scoped to the
active tenant (proven in `drizzle.integration.test.ts`).

### Prisma — raw-query facade

```ts
import { withTenant, createPrismaBridge } from "@caisson/tenancy-rls";

const rows = await withTenant(db, accountId, async (tx) => {
  const prisma = createPrismaBridge(tx);
  return prisma.$queryRawUnsafe<Doc>(
    `SELECT * FROM document WHERE account_id = $1`,
    accountId,
  );
});
```

`createPrismaBridge(tx)` returns an object shaped like `PrismaClient`'s raw surface
(`$queryRawUnsafe`/`$executeRawUnsafe`), so call sites written against a real `PrismaClient`
port over with a rename, not a rewrite. **Multi-statement tenant work:** don't reach for
Prisma's own interactive `$transaction(async (tx) => { ... })` inside `withTenant` — the
`withTenant` callback already IS the transaction boundary. Wrap `tx` once with
`createPrismaBridge` and issue every statement inside that same callback:

```ts
await withTenant(db, accountId, async (tx) => {
  const prisma = createPrismaBridge(tx);
  await prisma.$executeRawUnsafe(
    `UPDATE account SET seats = seats - 1 WHERE id = $1`,
    accountId,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO seat_log (account_id) VALUES ($1)`,
    accountId,
  );
});
```

**Tested against a stub, not a real `PrismaClient`:** wiring a real `PrismaClient` needs a
`schema.prisma` + `prisma generate` + a query engine binary — disproportionate for a bridge that
only forwards `sql`/`params` to the already-tested `TenantExecutor`. `prisma.test.ts` asserts
parameter passthrough, `$1`/`$2` placeholder style, and error propagation against a faithful stub
of the raw-client surface. **Real-Prisma recipe (do this once, in your app):**

```ts
import { PrismaClient } from "@prisma/client";
import { withTenant } from "@caisson/tenancy-rls";

const prisma = new PrismaClient();
await withTenant(pool, accountId, async (tx) => {
  // `prisma.$transaction` is unnecessary here — `withTenant` already holds one open
  // transaction; run prisma's OWN raw calls against a client bound to that same
  // connection, or use `createPrismaBridge(tx)` above instead of a second client.
});
```

A real-Prisma integration leg (a live `PrismaClient` against the PGlite/Postgres harness) is a
followup, not shipped here.

### The drizzle-kit RLS gotcha

`drizzle-kit` cannot emit `FORCE ROW LEVEL SECURITY` (open drizzle-team issue
[#5843](https://github.com/drizzle-team/drizzle-orm/issues/5843) as of this writing) — only
`ENABLE ROW LEVEL SECURITY`, which a table's OWNER role silently bypasses. Caisson's raw-SQL
migrations (`buildTenantPolicySql`) stay the canonical source for every tenant table's
RLS DDL. Point `drizzle-kit`/Prisma Migrate at your OWN application tables if you use either as a
schema tool — never let either generate or manage the RLS policy itself.
