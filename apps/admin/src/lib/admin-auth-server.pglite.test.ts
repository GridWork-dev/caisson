// ADR-0283 WR-02 — a real `createAdminAuth` integration test against PGlite (an in-memory
// Postgres — this app's real dialect, unlike apps/site/lib/auth-flow.test.ts's bun:sqlite double,
// which is fine for THAT file's own magic-link speed goal but wouldn't exercise the same adapter
// path admin's real `pg.Pool` config does). Two things this file proves that every other admin-
// auth test only mocks around:
//   1. better-auth's migrator really creates admin's tables against a real Postgres-dialect DB —
//      the SAME `getMigrations(auth.options).runMigrations()` call CR-01's preDeployCommand runs.
//      A regression here means a fresh deploy's first OAuth callback 500s on relation-does-not-
//      exist and locks the operator out.
//   2. The PRIMARY allowlist gate (`databaseHooks.account.create.before`, admin-auth-server.ts)
//      really throws for an off-allowlist GitHub numeric id and really passes for an on-list one,
//      called as better-auth invokes it — `auth.options.databaseHooks.account.create.before` off
//      the SAME instance the migration ran against, not a re-implemented copy of the check.
//      (Driving this through a FULL simulated GitHub OAuth network handshake — token exchange +
//      userinfo — would additionally prove better-auth's own OAuth wiring, which is better-auth's
//      tested responsibility, not this app's; that wiring is unmocked/real in this instance too,
//      just not exercised over the network here.)
//
// better-auth's Kysely postgres adapter auto-detects "postgres" by duck-typing `"connect" in db`
// then calling `pool.connect()` → `client.query()`/`client.release()`, exactly like node-postgres.
// PGlite doesn't expose `.connect()` (a single embedded instance, not a connection pool), so this
// file wraps it in the minimal shim that shape needs — the same bridge the community
// `kysely-pglite-dialect` package provides, hand-rolled here rather than adding a dependency for
// one test file.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";
import { createAdminAuth } from "./admin-auth-server.ts";

// PGlite spin-up + a real migration run is slower than the 5s bun:test default — the license
// PGlite integration suite hit the same flake under runner load (docs/state, ADR-0224 F1-F6).
setDefaultTimeout(30_000);

function pgliteAsPool(db: PGlite): Pool {
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      const command = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
      return { command, rowCount: result.rows.length, rows: result.rows };
    },
    release: (): void => {},
  };
  return {
    connect: async () => client,
    end: async () => {
      /* the caller owns db.close() — see afterAll below */
    },
    on: (): void => {},
  } as unknown as Pool;
}

const SECRET = "test-secret-value-at-least-32-characters-long";

describe("createAdminAuth over PGlite (ADR-0283 WR-02)", () => {
  const db = new PGlite();
  const pool = pgliteAsPool(db);

  beforeAll(async () => {
    // Regression-proves CR-01: the SAME getMigrations() call the preDeployCommand runs.
    const auth = createAdminAuth({
      database: pool,
      secret: SECRET,
      githubClientId: "test-client-id",
      githubClientSecret: "test-client-secret",
      allowedGithubIds: new Set(["123456"]),
    });
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  });

  afterAll(async () => {
    await db.close();
  });

  test("CR-01 regression: migrations create the user/session/account tables", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tableNames = rows.map((r) => r.table_name);
    expect(tableNames).toContain("user");
    expect(tableNames).toContain("session");
    expect(tableNames).toContain("account");
  });

  test("databaseHooks.account.create.before REJECTS an off-allowlist GitHub numeric id", async () => {
    const auth = createAdminAuth({
      database: pool,
      secret: SECRET,
      githubClientId: "test-client-id",
      githubClientSecret: "test-client-secret",
      allowedGithubIds: new Set(["123456"]),
    });
    const before = auth.options.databaseHooks?.account?.create?.before;
    expect(before).toBeDefined();
    await expect(
      before?.({
        id: "acct_1",
        accountId: "999999",
        providerId: "github",
        userId: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow(/not authorized/);
  });

  test("databaseHooks.account.create.before PASSES an on-allowlist GitHub numeric id", async () => {
    const auth = createAdminAuth({
      database: pool,
      secret: SECRET,
      githubClientId: "test-client-id",
      githubClientSecret: "test-client-secret",
      allowedGithubIds: new Set(["123456"]),
    });
    const before = auth.options.databaseHooks?.account?.create?.before;
    expect(before).toBeDefined();
    await expect(
      before?.({
        id: "acct_2",
        accountId: "123456",
        providerId: "github",
        userId: "user_2",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});
