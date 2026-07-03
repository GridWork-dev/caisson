// Spend-cap accounting tests over the in-memory PGlite double (DATABASE_URL unset). Integer
// micro-dollars, persisted, atomic accrual (ADR-0234 F2 rider / ADR-0007). Verifies the counter
// survives a re-read (persistence within the process) and the cap resolution is a safe default.
import { beforeAll, expect, test } from "bun:test";
import { getDb } from "../db.ts";
import {
  addSpendMicro,
  dollarsToMicro,
  readTodaySpendMicro,
  resolveDailyCapMicro,
} from "./spend.ts";

beforeAll(() => {
  delete process.env.DATABASE_URL;
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

test("dollarsToMicro is integer micro-dollars (never floats)", () => {
  expect(dollarsToMicro(0.95)).toBe(950_000);
  expect(dollarsToMicro(0.002)).toBe(2_000);
  expect(Number.isInteger(dollarsToMicro(0.0000019))).toBe(true);
});

test("resolveDailyCapMicro defaults to $10, is env-swappable, and falls back safely on garbage", () => {
  expect(resolveDailyCapMicro({})).toBe(10_000_000);
  expect(resolveDailyCapMicro({ ASK_AI_PUBLIC_DAILY_CAP_USD: "5" })).toBe(
    5_000_000,
  );
  expect(
    resolveDailyCapMicro({ ASK_AI_PUBLIC_DAILY_CAP_USD: "not-a-number" }),
  ).toBe(10_000_000);
  expect(resolveDailyCapMicro({ ASK_AI_PUBLIC_DAILY_CAP_USD: "-3" })).toBe(
    10_000_000,
  );
});

test("spend accrues atomically and persists across re-reads", async () => {
  const db = await getDb();
  const start = await readTodaySpendMicro(db);
  await addSpendMicro(db, 2_000);
  await addSpendMicro(db, 3_000);
  expect(await readTodaySpendMicro(db)).toBe(start + 5_000);
});

test("addSpendMicro ignores non-positive / non-integer amounts", async () => {
  const db = await getDb();
  const before = await readTodaySpendMicro(db);
  await addSpendMicro(db, 0);
  await addSpendMicro(db, -100);
  await addSpendMicro(db, 1.5);
  expect(await readTodaySpendMicro(db)).toBe(before);
});
