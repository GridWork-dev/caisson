// Codegen metering — the ADR-0049/0007/0024 binding: a generation debits BEFORE any file is written;
// a 402 aborts with nothing written; a same-key retry debits once. Runs on PGlite inside withTenant
// (SET ROLE app) over the real credits ledger.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { InsufficientCreditsError } from "@caisson/kernel";
import { withTenant } from "@caisson/tenancy-rls";
import { CREDIT_SCHEMA_SQL, balance, getLedger, grant } from "@caisson/credits";
import { loadRegistryIndex } from "@caisson/registry";
import { type FileSetWriter, runGeneration } from "./meter.ts";

const ACCOUNT = "acct_a";

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/field-crypto",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/field-crypto",
            version: "0.1.0",
            kind: "primitive",
            editions: [],
            tier: "paid",
            priceCents: 100,
            license: "LicenseRef-Caisson-Commercial",
            dependencies: [],
            entry: "src/index.ts",
            agents: "AGENTS.md",
            golden: null,
            stability: "alpha",
            description: "x",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci@x",
        },
      ],
    },
  ],
});

const SELECTION = {
  projectName: "acme-app",
  modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
};

let tp: TestPg;

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await tp.exec(
    `DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

const grantSome = (amount: number) =>
  withTenant(tp.pg, ACCOUNT, (tx) =>
    grant(tx, {
      accountId: ACCOUNT,
      amount,
      eventType: "purchase",
      sourceEventId: "buy",
    }),
  );

/** A writer spy that counts calls — proves whether a file write was reached. */
function writerSpy(): { writer: FileSetWriter; calls: number } {
  const state = { calls: 0 } as { calls: number; writer: FileSetWriter };
  state.writer = async () => {
    state.calls++;
  };
  return state;
}

describe("runGeneration — debit-before-spend (ADR-0049)", () => {
  test("debits one credit, THEN writes (success path)", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, { index: INDEX, writeFileSet: spy.writer }, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "gen-1",
      }),
    );
    expect(outcome.balance).toBe(4); // 5 − 1
    expect(outcome.idempotent).toBe(false);
    expect(spy.calls).toBe(1); // write happened, after the debit
    expect(outcome.files.length).toBeGreaterThan(0);
  });

  test("a short balance returns 402 and writes NOTHING", async () => {
    const spy = writerSpy(); // no grant → balance 0
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: INDEX, writeFileSet: spy.writer },
          SELECTION,
          {
            accountId: ACCOUNT,
            idempotencyKey: "gen-x",
          },
        ),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(spy.calls).toBe(0); // the write was never reached — debit precedes spend
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      0,
    );
    expect(
      (await withTenant(tp.pg, ACCOUNT, (tx) => getLedger(tx, ACCOUNT))).length,
    ).toBe(0);
  });

  test("a retried generation with the same idempotencyKey debits once", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const first = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, { index: INDEX, writeFileSet: spy.writer }, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "gen-dup",
      }),
    );
    const retry = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, { index: INDEX, writeFileSet: spy.writer }, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "gen-dup",
      }),
    );
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      4,
    ); // one debit
    expect(
      (await withTenant(tp.pg, ACCOUNT, (tx) => getLedger(tx, ACCOUNT))).length,
    ).toBe(2); // grant + 1 debit
  });

  test("an unknown module id throws before any debit or write", async () => {
    await grantSome(5);
    const spy = writerSpy();
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: INDEX, writeFileSet: spy.writer },
          {
            projectName: "x",
            modules: [{ id: "@caisson/nope", version: "0.1.0" }],
          },
          { accountId: ACCOUNT, idempotencyKey: "gen-bad" },
        ),
      ),
    ).rejects.toThrow(/unknown module id/);
    expect(spy.calls).toBe(0);
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      5,
    ); // untouched
  });
});
