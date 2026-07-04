// Generation audit row (ADR-0049/0024/0005) on PGlite: the row is append-only, dedups on the
// idempotency key (a same-key retry records once), and is fail-closed tenant-isolated — a query
// without the bound tenant GUC, and a cross-tenant read, both see nothing. Mirrors the credits
// integration harness (withTenant over real RLS). Plus a focused hashFileSet determinism check.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import type { Selection } from "./generate.ts";
import {
  GENERATION_SCHEMA_SQL,
  hashFileSet,
  recordGeneration,
} from "./generation-record.ts";

let tp: TestPg;
const A = "acct_a";
const B = "acct_b";

const SELECTION: Selection = {
  projectName: "acme-app",
  modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
};

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await tp.exec(`DROP TABLE IF EXISTS generation;`);
  await tp.exec(GENERATION_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

const countRows = (accountId: string) =>
  tp
    .query<{ n: number }>(
      `SELECT count(*)::int AS n FROM generation WHERE account_id = $1`,
      [accountId],
    )
    .then((rows) => rows[0]?.n ?? 0);

describe("recordGeneration — generation audit row", () => {
  test("records a row scoped to the account (snapshot + hash)", async () => {
    const r = await withTenant(tp.pg, A, (tx) =>
      recordGeneration(tx, {
        accountId: A,
        idempotencyKey: "gen-1",
        selection: SELECTION,
        fileSetHash: "deadbeef",
      }),
    );
    expect(r.recorded).toBe(true);
    expect(await countRows(A)).toBe(1);
    const [row] = await tp.query<{
      idempotency_key: string;
      file_set_hash: string;
      selection: { projectName: string };
    }>(`SELECT idempotency_key, file_set_hash, selection FROM generation`);
    expect(row?.idempotency_key).toBe("gen-1");
    expect(row?.file_set_hash).toBe("deadbeef");
    expect(row?.selection.projectName).toBe("acme-app");
  });

  test("dedups on idempotency key — a same-key retry records once", async () => {
    const first = await withTenant(tp.pg, A, (tx) =>
      recordGeneration(tx, {
        accountId: A,
        idempotencyKey: "gen-dup",
        selection: SELECTION,
        fileSetHash: "h1",
      }),
    );
    const retry = await withTenant(tp.pg, A, (tx) =>
      recordGeneration(tx, {
        accountId: A,
        idempotencyKey: "gen-dup",
        selection: SELECTION,
        fileSetHash: "h1",
      }),
    );
    expect(first.recorded).toBe(true);
    expect(retry.recorded).toBe(false); // the existing row absorbed the retry
    expect(await countRows(A)).toBe(1);
  });

  test("a distinct idempotency key records a second row", async () => {
    for (const key of ["gen-a", "gen-b"]) {
      await withTenant(tp.pg, A, (tx) =>
        recordGeneration(tx, {
          accountId: A,
          idempotencyKey: key,
          selection: SELECTION,
          fileSetHash: "h",
        }),
      );
    }
    expect(await countRows(A)).toBe(2);
  });

  test("RLS: one tenant cannot see another tenant's generation rows", async () => {
    await withTenant(tp.pg, A, (tx) =>
      recordGeneration(tx, {
        accountId: A,
        idempotencyKey: "gen-A",
        selection: SELECTION,
        fileSetHash: "h",
      }),
    );
    const seenByB = await tp.asTenant(B, (tx) =>
      tx
        .query<{ n: number }>(`SELECT count(*)::int AS n FROM generation`)
        .then((res) => res.rows[0]?.n ?? 0),
    );
    expect(seenByB).toBe(0);
  });

  test("RLS fail-closed: WITH CHECK rejects an account_id that is not the bound tenant", async () => {
    await expect(
      withTenant(tp.pg, A, (tx) =>
        recordGeneration(tx, {
          accountId: B, // mismatches the bound GUC (A) → policy WITH CHECK refuses the insert
          idempotencyKey: "gen-x",
          selection: SELECTION,
          fileSetHash: "h",
        }),
      ),
    ).rejects.toThrow();
    expect(await countRows(B)).toBe(0);
    expect(await countRows(A)).toBe(0);
  });
});

describe("hashFileSet — deterministic content hash", () => {
  const FILES = [
    { path: "package.json", content: "{}\n" },
    { path: "README.md", content: "# acme\n" },
  ];

  test("is stable + order-independent for identical content", () => {
    expect(hashFileSet(FILES)).toBe(hashFileSet([...FILES].reverse()));
  });

  test("changes when any content or path changes", () => {
    const base = hashFileSet(FILES);
    // a content edit moves the hash
    expect(
      hashFileSet([{ path: "package.json", content: "{ }\n" }, FILES[1]!]),
    ).not.toBe(base);
    // a path rename moves the hash
    expect(
      hashFileSet([{ path: "pkg.json", content: "{}\n" }, FILES[1]!]),
    ).not.toBe(base);
  });
});
